import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Logo } from "@/components/Logo";
import { Lock, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";
import {
  classifyRecoveryFailure,
  classifyUpdateError,
  readRecoveryParams,
  type RecoveryFailure,
  type RecoveryReturn,
} from "@/lib/password-recovery";
import { requestPasswordReset, resolveRecoveryReturn } from "@/lib/password-recovery-actions";

type View =
  | { kind: "checking" }
  | { kind: "ready" }
  | { kind: "failed"; reason: RecoveryFailure }
  | { kind: "success"; next: RecoveryReturn | null };

const FAILURE_COPY: Record<RecoveryFailure, { title: string; desc: string }> = {
  expired: {
    title: "El enlace venció o ya se usó",
    desc: "Los enlaces de recuperación sirven una sola vez y por tiempo limitado. Pedí uno nuevo y abrilo apenas te llegue.",
  },
  invalid: {
    title: "No pudimos validar el enlace",
    desc: "Puede estar incompleto o haberse abierto en otro navegador. Pedí uno nuevo y abrilo desde el mismo dispositivo.",
  },
  missing: {
    title: "Tu enlace de recuperación ya no está activo",
    desc: "Para cambiar la contraseña necesitás abrir el enlace que te mandamos por mail. Si no lo tenés, pedí uno nuevo.",
  },
};

const ResetPassword = () => {
  const navigate = useNavigate();
  // Se lee el enlace tal como llegó, antes de que nada lo limpie.
  const params = useRef(readRecoveryParams(window.location.href)).current;
  const [view, setView] = useState<View>({ kind: "checking" });
  const [accountEmail, setAccountEmail] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetSending, setResetSending] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  // 1) Establecer la sesión de recuperación a partir del enlace.
  useEffect(() => {
    let cancelled = false;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!cancelled && event === "PASSWORD_RECOVERY" && session) {
        setAccountEmail(session.user.email ?? null);
        setView({ kind: "ready" });
      }
    });

    (async () => {
      // supabase-js ya procesó el #access_token (o el error) al iniciar; esto
      // espera a que termine y devuelve el error del enlace, si lo hubo.
      const { error: initError } = await supabase.auth.initialize();
      let linkError: { code?: string | null; message?: string | null } | null = initError
        ? { code: (initError as { details?: { code?: string } }).details?.code ?? initError.code ?? null, message: initError.message }
        : null;

      // Enlaces con token_hash (plantillas que apuntan directo a la app)
      if (!linkError && params.tokenHash && params.type === "recovery") {
        const { error } = await supabase.auth.verifyOtp({ token_hash: params.tokenHash, type: "recovery" });
        if (error) linkError = { code: error.code ?? null, message: error.message };
      }
      // Enlaces PKCE (?code=…): solo funcionan en el navegador que pidió el mail
      if (!linkError && params.code) {
        const { data: current } = await supabase.auth.getSession();
        if (!current.session) {
          const { error } = await supabase.auth.exchangeCodeForSession(params.code);
          if (error) linkError = { code: error.code ?? null, message: error.message };
        }
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (cancelled) return;
      if (session && !linkError) {
        setAccountEmail(session.user.email ?? null);
        setView({ kind: "ready" });
        // Sacar tokens/códigos de la barra de direcciones
        if (params.tokenHash || params.code) window.history.replaceState(window.history.state, "", "/reset-password");
      } else {
        setView({ kind: "failed", reason: classifyRecoveryFailure(params, linkError?.code, linkError?.message) });
      }
    })();

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [params]);

  // 2) Guardar la contraseña nueva (solo con sesión vigente).
  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast.error("Las contraseñas no coinciden");
      return;
    }
    if (password.length < 6) {
      toast.error("La contraseña debe tener al menos 6 caracteres");
      return;
    }

    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setView({ kind: "failed", reason: "missing" });
        return;
      }
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        const kind = classifyUpdateError(error);
        if (kind === "session") {
          setView({ kind: "failed", reason: "missing" });
        } else if (kind === "same") {
          toast.error("La contraseña nueva tiene que ser distinta de la anterior");
        } else if (kind === "weak") {
          toast.error("Elegí una contraseña más segura (al menos 6 caracteres)");
        } else {
          toast.error("No se pudo actualizar la contraseña. Probá de nuevo.");
        }
        return;
      }
      setPassword("");
      setConfirmPassword("");
      let next: RecoveryReturn | null = null;
      try {
        next = await resolveRecoveryReturn(session.user.id);
      } catch {
        next = { kind: "path", path: "/acceso", label: "Ir a ingresar" };
      }
      setView({ kind: "success", next });
      toast.success("Contraseña actualizada correctamente");
    } finally {
      setLoading(false);
    }
  };

  // 3) Al terminar, seguir solo al lugar que corresponde.
  useEffect(() => {
    if (view.kind !== "success" || view.next?.kind !== "path") return;
    const path = view.next.path;
    const t = window.setTimeout(() => navigate(path, { replace: true }), 2500);
    return () => window.clearTimeout(t);
  }, [view, navigate]);

  const handleRequestNew = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail.trim()) return;
    setResetSending(true);
    try {
      const { rateLimited } = await requestPasswordReset(resetEmail);
      if (rateLimited) {
        toast.error("Pediste varios enlaces seguidos. Esperá un minuto y probá de nuevo.");
        return;
      }
      setResetSent(true);
    } catch {
      toast.error("No pudimos enviar el enlace. Probá de nuevo en unos minutos.");
    } finally {
      setResetSending(false);
    }
  };

  const header = (() => {
    if (view.kind === "success") {
      return { icon: <CheckCircle2 className="w-7 h-7 text-primary" />, title: "¡Contraseña actualizada!", desc: "Ya podés seguir con tu cuenta." };
    }
    if (view.kind === "failed") {
      const copy = FAILURE_COPY[view.reason];
      return { icon: <AlertTriangle className="w-7 h-7 text-primary" />, title: copy.title, desc: copy.desc };
    }
    return {
      icon: <Lock className="w-7 h-7 text-primary" />,
      title: "Nueva contraseña",
      desc: view.kind === "checking" ? "Verificando tu enlace…" : "Ingresá tu nueva contraseña para restablecer el acceso",
    };
  })();

  return (
    <div className="min-h-screen flex items-center justify-center bg-[hsl(180,15%,4%)] p-4">
      {/* Background glow */}
      <div className="fixed inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse 60% 40% at 50% 0%, hsla(176,80%,40%,0.1), transparent)" }} />

      <div className="relative z-10 w-full max-w-md">
        <div className="flex justify-center mb-6">
          <Logo variant="full" size="4xl" showTagline={false} />
        </div>

        <Card className="border-border/40 bg-card/80 backdrop-blur-sm shadow-2xl">
          <CardHeader className="text-center space-y-2">
            <div className="mx-auto w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-2">
              {header.icon}
            </div>
            <CardTitle className="text-2xl font-bold">{header.title}</CardTitle>
            <CardDescription>{header.desc}</CardDescription>
          </CardHeader>

          <CardContent>
            {view.kind === "checking" && (
              <div className="flex justify-center py-4" aria-live="polite">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            )}

            {view.kind === "ready" && (
              <form onSubmit={handleReset} className="space-y-4" data-testid="reset-form">
                {accountEmail && (
                  <p className="text-xs text-center text-muted-foreground">
                    Cuenta: <span className="font-medium text-foreground">{accountEmail}</span>
                  </p>
                )}
                <div className="space-y-2">
                  <Label htmlFor="password">Nueva contraseña</Label>
                  <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                    required minLength={6} placeholder="••••••••" autoComplete="new-password" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirmar contraseña</Label>
                  <Input id="confirmPassword" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                    required minLength={6} placeholder="••••••••" autoComplete="new-password" />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Actualizando..." : "Cambiar contraseña"}
                </Button>
              </form>
            )}

            {view.kind === "failed" && (
              <div className="space-y-4" data-testid={`reset-failed-${view.reason}`}>
                {resetSent ? (
                  <p className="text-sm text-center text-muted-foreground" role="status">
                    Si ese email tiene una cuenta, te llegó un enlace nuevo. Abrilo desde este mismo dispositivo.
                  </p>
                ) : (
                  <form onSubmit={handleRequestNew} className="space-y-3">
                    <Label htmlFor="resetEmail">Tu email</Label>
                    <Input id="resetEmail" type="email" value={resetEmail} onChange={(e) => setResetEmail(e.target.value)}
                      required placeholder="tu@email.com" autoComplete="email" />
                    <Button type="submit" className="w-full" disabled={resetSending}>
                      {resetSending ? "Enviando..." : "Pedir un enlace nuevo"}
                    </Button>
                  </form>
                )}
                <p className="text-xs text-center text-muted-foreground">
                  <Link to="/acceso" className="underline">Volver a ingresar</Link>
                </p>
              </div>
            )}

            {view.kind === "success" && (
              <div className="space-y-3" data-testid="reset-success">
                {view.next?.kind === "choose" ? (
                  <>
                    <p className="text-sm text-center text-muted-foreground">¿A qué portal querés ir?</p>
                    {view.next.clinics.map((c) => (
                      <Button key={c.slug} variant="outline" className="w-full" onClick={() => navigate(`/portal/${c.slug}`, { replace: true })}>
                        {c.name}
                      </Button>
                    ))}
                  </>
                ) : view.next ? (
                  <Button className="w-full" onClick={() => navigate((view.next as { path: string }).path, { replace: true })}>
                    {view.next.label}
                  </Button>
                ) : null}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ResetPassword;

import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { Loader2, Lock, AlertCircle, CheckCircle, Smartphone, Share, Plus, MoreVertical, ArrowRight } from "lucide-react";
import LoadingPage from "@/components/LoadingPage";

type InviteStatus = "loading" | "valid" | "invalid" | "expired" | "used" | "success" | "install";

const PatientInvitation = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token");
  
  const [status, setStatus] = useState<InviteStatus>("loading");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("invalid");
      setErrorMessage("No se proporcionó un token de invitación.");
      return;
    }
    validateToken();
  }, [token]);

  const validateToken = async () => {
    try {
      // Use secure function to validate token (prevents enumeration attacks)
      const { data: invite, error } = await supabase
        .rpc("validate_patient_invite", { p_token: token })
        .maybeSingle();

      if (error || !invite) {
        setStatus("invalid");
        setErrorMessage("Este enlace de invitación no es válido.");
        return;
      }

      if (invite.used_at) {
        setStatus("used");
        setErrorMessage("Este enlace ya fue utilizado. Si ya configuraste tu cuenta, podés iniciar sesión.");
        return;
      }

      if (new Date(invite.expires_at) < new Date()) {
        setStatus("expired");
        setErrorMessage("Este enlace ha expirado. Pedile a tu profesional que te envíe uno nuevo.");
        return;
      }

      setStatus("valid");
    } catch (error) {
      console.error("Error validating token:", error);
      setStatus("invalid");
      setErrorMessage("Error al validar la invitación.");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password.length < 6) {
      toast({
        title: "Error",
        description: "La contraseña debe tener al menos 6 caracteres",
        variant: "destructive",
      });
      return;
    }

    if (password !== confirmPassword) {
      toast({
        title: "Error",
        description: "Las contraseñas no coinciden",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await supabase.functions.invoke("activate-patient-account", {
        body: { token, password },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      const data = response.data;

      if (data.error) {
        throw new Error(data.error);
      }

      setStatus("success");

      // If we got a session, set it but DON'T redirect yet — show install guide first
      if (data.session) {
        await supabase.auth.setSession(data.session);
        toast({
          title: "¡Cuenta activada!",
          description: "Bienvenido al portal del paciente",
        });
        setTimeout(() => setStatus("install"), 1200);
      } else {
        toast({
          title: "Cuenta activada",
          description: "Ahora podés iniciar sesión con tu nueva contraseña",
        });
        setTimeout(() => setStatus("install"), 1500);
      }
    } catch (error) {
      console.error("Error activating account:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "No se pudo activar la cuenta",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (status === "loading") {
    return <LoadingPage />;
  }

  if (status === "invalid" || status === "expired" || status === "used") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md rounded-2xl">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertCircle className="h-6 w-6 text-destructive" />
            </div>
            <CardTitle className="text-xl">Enlace no válido</CardTitle>
            <CardDescription className="text-base">
              {errorMessage}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {status === "used" && (
              <Button 
                onClick={() => navigate("/auth")} 
                className="w-full rounded-xl"
              >
                Iniciar sesión
              </Button>
            )}
            <Button 
              variant="outline" 
              onClick={() => navigate("/")} 
              className="w-full rounded-xl"
            >
              Ir al inicio
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (status === "success") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md rounded-2xl">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              <CheckCircle className="h-6 w-6 text-primary" />
            </div>
            <CardTitle className="text-xl">¡Cuenta activada!</CardTitle>
            <CardDescription className="text-base">
              Preparando el siguiente paso...
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (status === "install") {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isAndroid = /Android/.test(navigator.userAgent);
    const isMobile = isIOS || isAndroid;

    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-lg rounded-2xl">
          <CardHeader className="text-center pb-4">
            <Stepper current={2} />
            <div className="mx-auto mb-4 mt-2 h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Smartphone className="h-6 w-6 text-primary" />
            </div>
            <CardTitle className="text-xl">Instalá la app en tu dispositivo</CardTitle>
            <CardDescription className="text-base">
              Accedé al portal con un toque desde tu pantalla de inicio. Funciona offline y se siente como una app nativa.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isIOS && <IOSInstructions />}
            {isAndroid && <AndroidInstructions />}
            {!isMobile && <DesktopInstructions />}

            <Button
              onClick={() => navigate("/portal-paciente")}
              className="w-full rounded-xl"
              size="lg"
            >
              Continuar al portal
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <button
              type="button"
              onClick={() => navigate("/portal-paciente")}
              className="w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Lo hago más tarde
            </button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md rounded-2xl">
        <CardHeader className="text-center pb-4">
          <Stepper current={1} />
          <div className="mx-auto mb-4 mt-2 h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Lock className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-xl">Configurá tu acceso</CardTitle>
          <CardDescription className="text-base">
            Creá una contraseña para acceder a tu portal del paciente
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                required
                minLength={6}
                className="rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmar contraseña</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repetí tu contraseña"
                required
                minLength={6}
                className="rounded-xl"
              />
            </div>
            <Button
              type="submit"
              className="w-full rounded-xl"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Activando cuenta...
                </>
              ) : (
                <>
                  Continuar
                  <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

// ============= Subcomponentes =============

const Stepper = ({ current }: { current: 1 | 2 }) => (
  <div className="flex items-center justify-center gap-2 mb-2">
    <StepDot n={1} active={current >= 1} done={current > 1} label="Crear cuenta" />
    <div className={`h-0.5 w-12 ${current > 1 ? "bg-primary" : "bg-border"}`} />
    <StepDot n={2} active={current >= 2} done={false} label="Instalar app" />
  </div>
);

const StepDot = ({ n, active, done, label }: { n: number; active: boolean; done: boolean; label: string }) => (
  <div className="flex flex-col items-center gap-1">
    <div
      className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-semibold transition-colors ${
        done
          ? "bg-primary text-primary-foreground"
          : active
          ? "bg-primary text-primary-foreground ring-4 ring-primary/20"
          : "bg-muted text-muted-foreground"
      }`}
    >
      {done ? <CheckCircle className="h-4 w-4" /> : n}
    </div>
    <span className={`text-[10px] ${active ? "text-foreground font-medium" : "text-muted-foreground"}`}>{label}</span>
  </div>
);

const InstructionStep = ({ n, icon, text }: { n: number; icon?: React.ReactNode; text: React.ReactNode }) => (
  <div className="flex items-start gap-3 rounded-xl border border-border bg-muted/30 p-3">
    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-semibold">
      {n}
    </div>
    <div className="flex-1 text-sm text-foreground flex items-center gap-2 flex-wrap">
      {text}
      {icon && <span className="inline-flex items-center text-primary">{icon}</span>}
    </div>
  </div>
);

const IOSInstructions = () => (
  <div className="space-y-2">
    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">En iPhone / iPad (Safari)</p>
    <InstructionStep n={1} text={<>Tocá el botón de compartir</>} icon={<Share className="h-4 w-4" />} />
    <InstructionStep n={2} text={<>Bajá y elegí <strong>"Agregar a pantalla de inicio"</strong></>} icon={<Plus className="h-4 w-4" />} />
    <InstructionStep n={3} text={<>Tocá <strong>"Agregar"</strong> arriba a la derecha</>} />
  </div>
);

const AndroidInstructions = () => (
  <div className="space-y-2">
    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">En Android (Chrome)</p>
    <InstructionStep n={1} text={<>Tocá el menú</>} icon={<MoreVertical className="h-4 w-4" />} />
    <InstructionStep n={2} text={<>Elegí <strong>"Instalar aplicación"</strong> o <strong>"Agregar a pantalla principal"</strong></>} />
    <InstructionStep n={3} text={<>Confirmá tocando <strong>"Instalar"</strong></>} />
  </div>
);

const DesktopInstructions = () => (
  <div className="space-y-2">
    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Estás en una computadora</p>
    <div className="rounded-xl border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
      Para instalar la app, abrí este mismo enlace desde tu celular. También podés usar el portal directamente desde el navegador.
    </div>
  </div>
);

export default PatientInvitation;

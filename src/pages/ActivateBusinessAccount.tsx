import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { AlertCircle, CheckCircle, Loader2, Building2, Mail } from "lucide-react";
import LoadingPage from "@/components/LoadingPage";

interface PendingActivation {
  id: string;
  business_name: string;
  owner_email: string;
  plan_code: string;
  expires_at: string;
  used_at: string | null;
}

export default function ActivateBusinessAccount() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const token = searchParams.get("token");

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingActivation | null>(null);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!token) {
      setError("No se proporcionó un token de activación.");
      setLoading(false);
      return;
    }
    void validateToken();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const validateToken = async () => {
    try {
      const { data, error: rpcError } = await supabase
        .rpc("validate_business_activation_token", { p_token: token })
        .maybeSingle();

      if (rpcError || !data) {
        setError("Este enlace de activación no es válido.");
        setLoading(false);
        return;
      }

      if (data.used_at) {
        setError("Este enlace ya fue utilizado. Si ya activaste el consultorio, ingresá con tu email y contraseña.");
        setLoading(false);
        return;
      }

      if (data.expires_at && new Date(data.expires_at) < new Date()) {
        setError("Este enlace ha expirado. Pedile al administrador que te envíe uno nuevo.");
        setLoading(false);
        return;
      }

      setPending(data as PendingActivation);
      setLoading(false);
    } catch (err) {
      console.error("validateToken error:", err);
      setError("Ocurrió un error validando el enlace. Intentá nuevamente más tarde.");
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pending || !token) return;

    if (password.length < 8) {
      toast({
        title: "Contraseña muy corta",
        description: "La contraseña debe tener al menos 8 caracteres.",
        variant: "destructive",
      });
      return;
    }
    if (password !== confirmPassword) {
      toast({
        title: "Las contraseñas no coinciden",
        description: "Verificá que ambas contraseñas sean iguales.",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("activate-business", {
        body: { token, password },
      });

      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);

      // Activación OK → loguear automáticamente
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: pending.owner_email,
        password,
      });

      if (signInError) {
        // Activación funcionó pero el login falló — mandamos a /auth
        toast({
          title: "Consultorio activado",
          description: "Iniciá sesión con tu email y la contraseña que acabás de definir.",
        });
        navigate("/auth");
        return;
      }

      setSuccess(true);
      toast({
        title: "¡Cuenta activada!",
        description: "Ahora vas a configurar tu consultorio.",
      });

      setTimeout(() => {
        navigate("/onboarding");
      }, 1500);
    } catch (err: any) {
      console.error("activate-business error:", err);
      toast({
        title: "No se pudo activar",
        description: err?.message || "Ocurrió un error. Intentá nuevamente.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <LoadingPage />;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Building2 className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl">Activá tu cuenta</CardTitle>
          <CardDescription>
            Definí tu contraseña de acceso. Después vas a configurar los datos de tu consultorio.
          </CardDescription>
        </CardHeader>

        <CardContent>
          {error ? (
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-4 rounded-lg bg-destructive/10 text-destructive">
                <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
                <p className="text-sm">{error}</p>
              </div>
              <Button variant="outline" className="w-full" onClick={() => navigate("/auth")}>
                Ir a iniciar sesión
              </Button>
            </div>
          ) : success ? (
            <div className="space-y-4 text-center py-6">
              <div className="mx-auto h-12 w-12 rounded-full bg-success/10 flex items-center justify-center">
                <CheckCircle className="h-6 w-6 text-success" />
              </div>
              <p className="text-sm text-muted-foreground">
                ¡Listo! Te estamos llevando a tu panel...
              </p>
              <Loader2 className="h-5 w-5 animate-spin mx-auto text-primary" />
            </div>
          ) : pending ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="rounded-lg border bg-muted/40 p-4 space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Email:</span>
                  <span className="font-medium">{pending.owner_email}</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Contraseña</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mínimo 8 caracteres"
                  autoComplete="new-password"
                  required
                  minLength={8}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirmá la contraseña</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repetí la contraseña"
                  autoComplete="new-password"
                  required
                  minLength={8}
                />
              </div>

              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Activar cuenta y continuar
              </Button>

              <p className="text-xs text-muted-foreground text-center">
                Al activar, aceptás los términos de servicio. Vas a recibir 7 días de prueba gratis.
              </p>
            </form>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
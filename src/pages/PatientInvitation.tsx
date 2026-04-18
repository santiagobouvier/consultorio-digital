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
            <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
            <CardTitle className="text-xl">¡Cuenta activada!</CardTitle>
            <CardDescription className="text-base">
              Tu cuenta ha sido configurada correctamente. Redirigiendo al portal...
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

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md rounded-2xl">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
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
                "Activar cuenta"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default PatientInvitation;

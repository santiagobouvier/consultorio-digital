import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { AlertCircle, CheckCircle, Loader2, UserCheck } from "lucide-react";
import LoadingPage from "@/components/LoadingPage";

export default function ProfessionalInvitation() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const token = searchParams.get("token");
  
  const [loading, setLoading] = useState(true);
  const [validating, setValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inviteData, setInviteData] = useState<{
    name: string;
    email: string;
    businessName?: string;
  } | null>(null);
  
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!token) {
      setError("No se proporcionó un token de invitación.");
      setLoading(false);
      return;
    }

    validateToken();
  }, [token]);

  const validateToken = async () => {
    try {
      // Use secure function to validate token (prevents enumeration attacks)
      const { data: invite, error: inviteError } = await supabase
        .rpc("validate_professional_invite", { p_token: token })
        .maybeSingle();

      if (inviteError || !invite) {
        setError("Este enlace de invitación no es válido.");
        setLoading(false);
        return;
      }

      // Now fetch business name separately (this is safe as business data is not sensitive)
      const { data: business } = await supabase
        .from("businesses")
        .select("name")
        .eq("id", invite.business_id)
        .maybeSingle();

      if (invite.used_at) {
        setError("Esta invitación ya fue utilizada. Si necesitas acceso, pide al administrador que te envíe una nueva invitación.");
        setLoading(false);
        return;
      }

      if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
        setError("Esta invitación ha expirado. Pide al administrador del consultorio que te envíe una nueva.");
        setLoading(false);
        return;
      }

      setInviteData({
        name: invite.name,
        email: invite.email,
        businessName: business?.name
      });
      setName(invite.name);
      setLoading(false);
    } catch (err) {
      console.error("Error validating token:", err);
      setError("Error al validar la invitación.");
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password.length < 6) {
      toast({
        title: "Contraseña muy corta",
        description: "La contraseña debe tener al menos 6 caracteres.",
        variant: "destructive",
      });
      return;
    }

    if (password !== confirmPassword) {
      toast({
        title: "Las contraseñas no coinciden",
        description: "Por favor verifica que ambas contraseñas sean iguales.",
        variant: "destructive",
      });
      return;
    }

    setValidating(true);

    try {
      const response = await supabase.functions.invoke("activate-professional-account", {
        body: { token, password, name },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      const data = response.data;

      if (data.error) {
        throw new Error(data.error);
      }

      setSuccess(true);

      // Sign in the user
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: data.email,
        password,
      });

      if (signInError) {
        toast({
          title: "Cuenta activada",
          description: "Tu cuenta fue activada. Por favor inicia sesión.",
        });
        setTimeout(() => navigate("/auth"), 2000);
        return;
      }

      toast({
        title: "¡Bienvenido!",
        description: "Tu cuenta ha sido activada correctamente.",
      });

      setTimeout(() => navigate("/dashboard"), 1500);
    } catch (err: any) {
      console.error("Error activating account:", err);
      toast({
        title: "Error",
        description: err.message || "No se pudo activar la cuenta.",
        variant: "destructive",
      });
    } finally {
      setValidating(false);
    }
  };

  if (loading) {
    return <LoadingPage />;
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertCircle className="h-6 w-6 text-destructive" />
            </div>
            <CardTitle>Invitación no válida</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Button variant="outline" onClick={() => navigate("/")}>
              Ir al inicio
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              <CheckCircle className="h-6 w-6 text-primary" />
            </div>
            <CardTitle>¡Cuenta activada!</CardTitle>
            <CardDescription>
              Redirigiendo al panel del consultorio...
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
            <UserCheck className="h-6 w-6 text-primary" />
          </div>
          <CardTitle>Activa tu cuenta profesional</CardTitle>
          <CardDescription>
            {inviteData?.businessName 
              ? `Has sido invitado a unirte al consultorio "${inviteData.businessName}"`
              : "Has sido invitado a unirte a un consultorio"
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={inviteData?.email || ""}
                disabled
                className="bg-muted"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Nombre</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Tu nombre completo"
                disabled={validating}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                disabled={validating}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmar contraseña</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repite tu contraseña"
                disabled={validating}
              />
            </div>

            <Button type="submit" className="w-full" disabled={validating}>
              {validating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Activando...
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
}

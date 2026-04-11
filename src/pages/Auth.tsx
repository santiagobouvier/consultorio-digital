import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { ArrowLeft, Building2, Mail, Eye, EyeOff } from "lucide-react";
import { useHostnameBusiness } from "@/hooks/use-hostname-business";
import { Logo } from "@/components/Logo";
import { Separator } from "@/components/ui/separator";

const Auth = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);
  const navigate = useNavigate();

  const { business: hostnameBusiness, loading: businessLoading } = useHostnameBusiness();

  const redirectByRole = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: superAdminRole } = await supabase
      .from("user_roles").select("role").eq("user_id", user.id).eq("role", "super_admin").maybeSingle();
    if (superAdminRole) { navigate("/saas-admin"); return; }

    const { data: patientRole } = await supabase
      .from("user_roles").select("role").eq("user_id", user.id).eq("role", "patient").maybeSingle();
    if (patientRole) { navigate("/portal-paciente"); return; }

    const { data: professionalRole } = await supabase
      .from("user_roles").select("role, business_id").eq("user_id", user.id).eq("role", "professional").maybeSingle();
    if (professionalRole) { navigate("/dashboard"); return; }

    const { data: business } = await supabase
      .from("businesses").select("id, onboarding_completed, name").eq("owner_user_id", user.id).maybeSingle();
    if (business) {
      navigate(business.onboarding_completed ? "/dashboard" : "/onboarding-consultorio");
    } else {
      navigate("/configurar-negocio");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      toast.success("¡Bienvenido de nuevo!");
      await redirectByRole();
    } catch (error: any) {
      toast.error(error.message || "Ocurrió un error");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) {
        toast.error("Error al iniciar sesión con Google");
        return;
      }
      if (result.redirected) return;
      // Session set — redirect by role
      toast.success("¡Bienvenido!");
      await redirectByRole();
    } catch (error: any) {
      toast.error(error.message || "Error con Google");
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail.trim()) {
      toast.error("Ingresá tu email");
      return;
    }
    setForgotLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setForgotSent(true);
    } catch (error: any) {
      toast.error(error.message || "No se pudo enviar el email");
    } finally {
      setForgotLoading(false);
    }
  };

  const showContextualLogin = hostnameBusiness && !businessLoading;

  return (
    <div className="min-h-screen flex items-center justify-center bg-[hsl(180,15%,4%)] p-4">
      {/* Background glow */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse 60% 40% at 50% 0%, hsla(176,80%,40%,0.1), transparent)" }}
      />

      <div className="relative z-10 w-full max-w-md">
        {/* Logo */}
        <div className="flex justify-center mb-2">
          <Logo variant="full" size="4xl" showTagline={false} />
        </div>

        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm text-white/40 hover:text-white/70 mb-4 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver al inicio
        </Link>

        {/* Contextual business header */}
        {showContextualLogin && (
          <div className="mb-4 rounded-xl border border-[hsla(176,80%,40%,0.2)] bg-[hsla(176,80%,40%,0.05)] p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[hsla(176,80%,40%,0.1)] flex items-center justify-center">
              <Building2 className="w-5 h-5 text-[hsl(176,80%,40%)]" />
            </div>
            <div>
              <p className="text-sm text-white/50">Ingresando a</p>
              <p className="font-semibold text-white">{hostnameBusiness.name}</p>
            </div>
          </div>
        )}

        <div
          className="rounded-2xl border border-white/10 shadow-2xl"
          style={{
            backgroundColor: '#111111',
            boxShadow: '0 8px 60px rgba(0, 165, 160, 0.08), 0 0 120px rgba(0, 165, 160, 0.04)',
          }}
        >
          <div className="p-6 pb-2 text-center space-y-1">
            <h2 className="text-2xl font-bold text-white">
              {showForgotPassword ? "Recuperar acceso" : "Bienvenido"}
            </h2>
            <p className="text-sm text-white/50">
              {showForgotPassword
                ? "Te enviaremos un email para restablecer tu contraseña"
                : showContextualLogin
                  ? `Iniciá sesión en ${hostnameBusiness.name}`
                  : "Iniciá sesión en tu cuenta profesional"
              }
            </p>
          </div>
          <CardContent>
            {showForgotPassword ? (
              forgotSent ? (
                <div className="text-center space-y-4 py-4">
                  <div className="mx-auto w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                    <Mail className="w-7 h-7 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">¡Email enviado!</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Revisá tu bandeja de entrada en <strong>{forgotEmail}</strong> y seguí el enlace para restablecer tu contraseña.
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => { setShowForgotPassword(false); setForgotSent(false); setForgotEmail(""); }}
                  >
                    Volver a iniciar sesión
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleForgotPassword} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="forgot-email">Correo electrónico</Label>
                    <Input
                      id="forgot-email"
                      type="email"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      required
                      placeholder="maria@example.com"
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={forgotLoading}>
                    {forgotLoading ? "Enviando..." : "Enviar email de recuperación"}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="w-full text-muted-foreground"
                    onClick={() => setShowForgotPassword(false)}
                  >
                    Volver a iniciar sesión
                  </Button>
                </form>
              )
            ) : (
              <>
                {/* Google Login */}
                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-11 gap-3 font-medium"
                  onClick={handleGoogleLogin}
                  disabled={googleLoading}
                >
                  {googleLoading ? (
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
                  ) : (
                    <svg className="h-5 w-5" viewBox="0 0 24 24">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                    </svg>
                  )}
                  Continuar con Google
                </Button>

                <div className="relative my-5">
                  <Separator />
                  <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-3 text-xs text-muted-foreground">
                    o con email
                  </span>
                </div>

                {/* Email Login */}
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Correo electrónico</Label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      placeholder="maria@example.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="password">Contraseña</Label>
                      <button
                        type="button"
                        className="text-xs text-primary hover:underline"
                        onClick={() => setShowForgotPassword(true)}
                      >
                        ¿Olvidaste tu contraseña?
                      </button>
                    </div>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        minLength={6}
                        placeholder="••••••"
                        className="pr-10"
                      />
                      <button
                        type="button"
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        onClick={() => setShowPassword(!showPassword)}
                        tabIndex={-1}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <Button type="submit" className="w-full h-11" disabled={loading}>
                    {loading ? "Aguardá un momento..." : "Iniciar sesión"}
                  </Button>
                </form>

                <div className="mt-5 text-center text-sm">
                  <span className="text-muted-foreground">¿Necesitás un consultorio? </span>
                  <a
                    href="https://wa.me/59891093977?text=Hola,%20me%20interesa%20Tu%20Consultorio%20Digital."
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline font-medium"
                  >
                    Hablemos
                  </a>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Auth;

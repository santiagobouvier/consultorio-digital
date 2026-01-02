import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { ArrowLeft, Building2 } from "lucide-react";
import { useHostnameBusiness } from "@/hooks/use-hostname-business";
import { Logo } from "@/components/Logo";

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  
  const { business: hostnameBusiness, loading: businessLoading } = useHostnameBusiness();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        
        toast.success("¡Bienvenido de nuevo!");
        
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          // Check if user is super_admin
          const { data: superAdminRole } = await supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", user.id)
            .eq("role", "super_admin")
            .maybeSingle();

          if (superAdminRole) {
            navigate("/saas-admin");
            return;
          }

          // Check if user has patient role
          const { data: patientRole } = await supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", user.id)
            .eq("role", "patient")
            .maybeSingle();

          if (patientRole) {
            navigate("/portal-paciente");
            return;
          }

          // Check if user is a professional (not owner) - goes straight to dashboard
          const { data: professionalRole } = await supabase
            .from("user_roles")
            .select("role, business_id")
            .eq("user_id", user.id)
            .eq("role", "professional")
            .maybeSingle();

          if (professionalRole) {
            navigate("/dashboard");
            return;
          }

          // Check if user has a business configured (owner flow)
          const { data: business } = await supabase
            .from("businesses")
            .select("id, onboarding_completed, name")
            .eq("owner_user_id", user.id)
            .maybeSingle();
          
          if (business) {
            // Owner: check if onboarding is complete
            if (!business.onboarding_completed) {
              navigate("/onboarding-consultorio");
            } else {
              navigate("/dashboard");
            }
          } else {
            // New user without business - create one first
            navigate("/configurar-negocio");
          }
        }
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { name },
            emailRedirectTo: `${window.location.origin}/dashboard`,
          },
        });
        if (error) throw error;
        toast.success("¡Cuenta creada! Ya podés iniciar sesión.");
        setIsLogin(true);
      }
    } catch (error: any) {
      toast.error(error.message || "Ocurrió un error");
    } finally {
      setLoading(false);
    }
  };

  const showContextualLogin = hostnameBusiness && !businessLoading;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-secondary/30 to-background p-4">
      <div className="w-full max-w-md">
        {/* Logo centered at top */}
        <div className="flex justify-center mb-2">
          <Logo variant="full" size="4xl" showTagline={false} />
        </div>

        <Link 
          to="/" 
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver al inicio
        </Link>
        
        {/* Contextual business header */}
        {showContextualLogin && (
          <Card className="mb-4 border-primary/20 bg-primary/5">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Building2 className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Ingresando a</p>
                <p className="font-semibold text-foreground">{hostnameBusiness.name}</p>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-bold text-center">
              {isLogin ? "Bienvenido" : "Crear cuenta"}
            </CardTitle>
            <CardDescription className="text-center">
              {showContextualLogin 
                ? `Iniciá sesión en ${hostnameBusiness.name}`
                : isLogin 
                  ? "Iniciá sesión en tu cuenta profesional" 
                  : "Comenzá a gestionar tu consultorio"
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {!isLogin && (
                <div className="space-y-2">
                  <Label htmlFor="name">Nombre completo</Label>
                  <Input
                    id="name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    placeholder="Dr. María González"
                  />
                </div>
              )}
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
                <Label htmlFor="password">Contraseña</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  placeholder="••••••"
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Aguardá un momento..." : isLogin ? "Iniciar sesión" : "Registrarse"}
              </Button>
            </form>
            <div className="mt-4 text-center text-sm">
              <span className="text-muted-foreground">¿Necesitás un consultorio? </span>
              <a
                href="https://wa.me/59891093977?text=Hola,%20me%20interesa%20Tu%20Consultorio%20Digital."
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                Hablemos
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Auth;

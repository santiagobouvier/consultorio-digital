import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { AlertCircle, CheckCircle, Loader2, UserPlus, Building2 } from "lucide-react";
import { getPlanConfig } from "@/hooks/use-plan-limits";
import LoadingPage from "@/components/LoadingPage";

interface BusinessInfo {
  id: string;
  name: string;
  planCode: string;
  planName: string;
  currentProfessionals: number;
  maxProfessionals: number | null;
  canAddMore: boolean;
}

export default function ProfessionalRegister() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const businessSlug = searchParams.get("business");
  
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [businessInfo, setBusinessInfo] = useState<BusinessInfo | null>(null);
  
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!businessSlug) {
      setError("Este enlace de registro no es válido. Consultá con tu consultorio.");
      setLoading(false);
      return;
    }

    validateBusiness();
  }, [businessSlug]);

  const validateBusiness = async () => {
    try {
      // Fetch business by public_slug
      const { data: business, error: bizError } = await supabase
        .from("businesses")
        .select("id, name, plan_code, custom_max_professionals, custom_max_patients")
        .eq("public_slug", businessSlug)
        .eq("is_active", true)
        .maybeSingle();

      if (bizError || !business) {
        setError("Este enlace de registro no es válido. Consultá con tu consultorio.");
        setLoading(false);
        return;
      }

      // Get plan config
      const planCode = business.plan_code || "individual";
      const customLimits = planCode === "custom" ? {
        maxProfessionals: business.custom_max_professionals ?? null,
        maxPatients: business.custom_max_patients ?? null,
      } : undefined;
      const config = getPlanConfig(planCode, customLimits);

      // Count current professionals
      const { count: profCount } = await supabase
        .from("user_roles")
        .select("*", { count: "exact", head: true })
        .eq("business_id", business.id)
        .in("role", ["owner", "professional"]);

      const currentProfessionals = profCount || 0;
      const canAddMore = config.maxProfessionals === null || currentProfessionals < config.maxProfessionals;

      setBusinessInfo({
        id: business.id,
        name: business.name,
        planCode,
        planName: config.name,
        currentProfessionals,
        maxProfessionals: config.maxProfessionals,
        canAddMore,
      });
      setLoading(false);
    } catch (err) {
      console.error("Error validating business:", err);
      setError("Error al validar el consultorio. Intentá de nuevo más tarde.");
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!businessInfo) return;

    // Validations
    if (!name.trim()) {
      toast({
        title: "Nombre requerido",
        description: "Por favor ingresá tu nombre completo.",
        variant: "destructive",
      });
      return;
    }

    if (!email.trim() || !email.includes("@")) {
      toast({
        title: "Email inválido",
        description: "Por favor ingresá un email válido.",
        variant: "destructive",
      });
      return;
    }

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
        description: "Por favor verificá que ambas contraseñas sean iguales.",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);

    try {
      const response = await supabase.functions.invoke("register-professional", {
        body: { 
          businessSlug,
          name: name.trim(),
          email: email.trim().toLowerCase(),
          password 
        },
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
        email: email.trim().toLowerCase(),
        password,
      });

      if (signInError) {
        toast({
          title: "Cuenta creada",
          description: "Tu cuenta fue creada. Por favor iniciá sesión.",
        });
        setTimeout(() => navigate("/auth"), 2000);
        return;
      }

      toast({
        title: "¡Bienvenido!",
        description: "Tu cuenta ha sido creada correctamente.",
      });

      setTimeout(() => navigate("/dashboard"), 1500);
    } catch (err: any) {
      console.error("Error registering:", err);
      toast({
        title: "Error",
        description: err.message || "No se pudo crear la cuenta.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
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
            <CardTitle>Enlace no válido</CardTitle>
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

  if (businessInfo && !businessInfo.canAddMore) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-orange-500/10 flex items-center justify-center">
              <AlertCircle className="h-6 w-6 text-orange-500" />
            </div>
            <CardTitle>Límite de profesionales alcanzado</CardTitle>
            <CardDescription>
              El consultorio "{businessInfo.name}" ya alcanzó el máximo de profesionales para su plan actual ({businessInfo.planName}).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-center text-muted-foreground">
              Contactá al administrador del consultorio para que actualice su plan o libere un espacio.
            </p>
            <div className="flex justify-center">
              <Button variant="outline" onClick={() => navigate("/")}>
                Ir al inicio
              </Button>
            </div>
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
            <CardTitle>¡Cuenta creada!</CardTitle>
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
            <UserPlus className="h-6 w-6 text-primary" />
          </div>
          <CardTitle>Registrarse como profesional</CardTitle>
          <CardDescription className="space-y-2">
            <div className="flex items-center justify-center gap-2 mt-2">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{businessInfo?.name}</span>
            </div>
            <p className="text-xs">
              Creá tu cuenta para unirte al consultorio
            </p>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nombre completo *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Tu nombre completo"
                disabled={submitting}
                className="h-11"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@email.com"
                disabled={submitting}
                className="h-11"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Contraseña *</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                disabled={submitting}
                className="h-11"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmar contraseña *</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repetí tu contraseña"
                disabled={submitting}
                className="h-11"
              />
            </div>

            <Button type="submit" className="w-full h-11" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creando cuenta...
                </>
              ) : (
                "Crear mi cuenta"
              )}
            </Button>
          </form>

          <div className="mt-4 text-center">
            <p className="text-xs text-muted-foreground">
              ¿Ya tenés cuenta?{" "}
              <Button variant="link" className="p-0 h-auto text-xs" onClick={() => navigate("/auth")}>
                Iniciá sesión
              </Button>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
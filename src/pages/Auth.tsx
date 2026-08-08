import { useState, useEffect, useCallback } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { ArrowLeft, Building2, Mail, Eye, EyeOff, Sparkles, CheckCircle2 } from "lucide-react";
import { useHostnameBusiness } from "@/hooks/use-hostname-business";
import { getPlanDefinition } from "@/lib/plan-definitions";
import { getPostLoginDestination, getUserAccessPriority } from "@/lib/post-login-routing";
import { useAuth } from "@/contexts/AuthContext";
import logoWhite from "@/assets/logo-consultorio-digital-white.png";
import authBgConsultorio from "@/assets/auth-bg-consultorio.jpg";
import digitalBuildersLogo from "@/assets/logo-digitalbuilders.webp";
import { triggerClinicEntrance } from "@/components/ClinicEntranceSplash";

const REMEMBER_EMAIL_KEY = "auth_remembered_email";

const Auth = () => {
  const [searchParams] = useSearchParams();
  const selectedPlan = searchParams.get("plan");
  const billingPeriod = searchParams.get("billing") || "annual";
  const sessionStatus = searchParams.get("session");

  const [email, setEmail] = useState(() => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem(REMEMBER_EMAIL_KEY) || "";
  });
  const [rememberEmail, setRememberEmail] = useState(() => {
    if (typeof window === "undefined") return false;
    return !!localStorage.getItem(REMEMBER_EMAIL_KEY);
  });
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);
  const [isSignUp, setIsSignUp] = useState(!!selectedPlan);
  const [awaitingVerification, setAwaitingVerification] = useState(false);
  const [emailVerified, setEmailVerified] = useState(false);
  const [inviteSent, setInviteSent] = useState(false);
  const navigate = useNavigate();

  const { business: hostnameBusiness, loading: businessLoading } = useHostnameBusiness();
  // AuthContext es la fuente de verdad primaria para isSuperAdmin (resuelta
  // localmente vía email shortcut + RPC cacheada). Si el routing por RPC falla,
  // usamos este valor como fallback para no perder al super admin en /configurar-negocio.
  const { isSuperAdmin: ctxIsSuperAdmin } = useAuth();

  const planDef = selectedPlan ? getPlanDefinition(selectedPlan) : null;

  useEffect(() => {
    if (sessionStatus === "expired") {
      toast.error("Tu sesión expiró, por favor ingresá de nuevo");
    }
  }, [sessionStatus]);

  // Anti-loop guard — prevent multiple concurrent redirects
  const [redirecting, setRedirecting] = useState(false);

  const redirectByRole = useCallback(async () => {
    if (redirecting) return;
    setRedirecting(true);

    try {
      // Usar la sesión cacheada (localStorage, instantánea) en vez de getUser()
      // que hace un fetch HTTP lento y, según el propio AuthContext, puede
      // generar loops/bloqueos de UI en mobile/red lenta.
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) return;

      try {
        // Bloquear usuarios que solo tienen rol "patient" — esta app es exclusiva
        // para profesionales/admins. Los pacientes deben entrar por /portal/:slug.
        const priority = await getUserAccessPriority(user.id);
        if (priority.isPatientOnly) {
          await supabase.auth.signOut();
          toast.error(
            "Este acceso es exclusivo para profesionales. Si sos paciente, ingresá desde el portal de tu consultorio.",
            { duration: 8000 },
          );
          return;
        }

        const destination = await getPostLoginDestination(user.id);
        // Entrada con marca: al aterrizar en el panel tras el login, se
        // muestra la bienvenida animada del consultorio (una sola vez).
        if (destination.startsWith("/dashboard")) {
          triggerClinicEntrance();
        }
        navigate(destination, { replace: true });
      } catch (err) {
        // Fallback: si las consultas de routing fallan, no dejamos al usuario
        // varado en /configurar-negocio. Usamos el AuthContext que ya tiene
        // isSuperAdmin resuelto sin llamadas extra (email shortcut o RPC cacheada).
        console.error("[Auth] redirectByRole falló, usando fallback de AuthContext:", err);
        if (ctxIsSuperAdmin) {
          navigate("/saas-admin", { replace: true });
        } else {
          triggerClinicEntrance();
          navigate("/dashboard", { replace: true });
        }
      }
    } finally {
      setRedirecting(false);
    }
  }, [navigate, redirecting, ctxIsSuperAdmin]);

  // Poll for email verification when awaiting
  useEffect(() => {
    if (!awaitingVerification) return;
    
    const interval = setInterval(async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setEmailVerified(true);
        clearInterval(interval);
        setTimeout(() => redirectByRole(), 2000);
      }
    }, 3000);

    // Also listen for auth state changes (e.g. user clicks link in same browser)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") {
        setEmailVerified(true);
        clearInterval(interval);
        setTimeout(() => redirectByRole(), 2000);
      }
    });

    return () => {
      clearInterval(interval);
      subscription.unsubscribe();
    };
  }, [awaitingVerification, redirectByRole]);

  // If user already has a session, redirect immediately (don't show the form)
  // Single listener — no duplicate onAuthStateChange
  // NOTA: NO auto-redirigimos al detectar sesión activa. El usuario siempre
  // debe iniciar sesión manualmente apretando el botón. Esto evita el comportamiento
  // confuso de la PWA que entraba directo al dashboard sin pedir credenciales.

  // GUARDIA DE ACCESO: Si hay una sesión activa de un usuario que solo tiene
  // rol "patient", lo deslogueamos automáticamente al cargar /auth. Este login
  // es exclusivo para profesionales/admin del SaaS — los pacientes deben usar
  // /portal/:slug. Sin redirección automática (no sabemos a qué portal van).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (cancelled || !session?.user) return;
      try {
        const priority = await getUserAccessPriority(session.user.id);
        if (cancelled) return;
        if (priority.isPatientOnly) {
          await supabase.auth.signOut();
          toast.error(
            "Este acceso es exclusivo para profesionales. Si sos paciente, ingresá desde el portal de tu consultorio.",
            { duration: 8000 },
          );
        }
      } catch {
        /* ignore — al fallar la verificación dejamos que el usuario opere normal */
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isSignUp) {
        // Registro público desde la landing → enviar invitación por email.
        // Reutilizamos la edge function create-business-owner en modo "invite"
        // (mismo flujo que SaasAdmin "Invitación real"). El usuario recibe
        // un email con link para definir contraseña y configurar el consultorio.
        const planForInvite = selectedPlan || "esencial";
        const { data, error } = await supabase.functions.invoke("create-business-owner", {
          body: {
            businessName: "Consultorio (pendiente de configurar)",
            ownerEmail: email.trim().toLowerCase(),
            planCode: planForInvite,
            mode: "invite",
          },
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        setInviteSent(true);
        toast.success("Te enviamos el link de activación por email");
        return;
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        // Persistir solo el email si tildaron "Recordar mi email" — nunca la sesión.
        if (rememberEmail) {
          localStorage.setItem(REMEMBER_EMAIL_KEY, email);
        } else {
          localStorage.removeItem(REMEMBER_EMAIL_KEY);
        }
        toast.success("¡Bienvenido de nuevo!");
        await redirectByRole();
      }
    } catch (error: any) {
      toast.error(error.message || "Ocurrió un error");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    try {
      if (selectedPlan) {
        localStorage.setItem("pending_plan", selectedPlan);
        localStorage.setItem("pending_billing", billingPeriod);
      }

      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: `${window.location.origin}/auth/callback`,
      });
      if (result.error) {
        toast.error("Error al iniciar sesión con Google");
        return;
      }
      if (result.redirected) return;

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

  // Verification waiting screen
  if (awaitingVerification) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[hsl(180,15%,4%)] p-4">
        <div
          className="fixed inset-0 pointer-events-none"
          style={{ background: "radial-gradient(ellipse 60% 40% at 50% 0%, hsla(176,80%,40%,0.1), transparent)" }}
        />
        <div className="relative z-10 w-full max-w-md">
          <div className="flex justify-center mb-6">
            <div className="relative animate-float-soft" style={{ willChange: "transform" }}>
              <div
                className="absolute inset-0 -z-10 blur-2xl opacity-25"
                style={{
                  background:
                    "radial-gradient(ellipse at center, hsla(176,80%,40%,0.35), transparent 75%)",
                }}
                aria-hidden
              />
              <img
                src={logoWhite}
                alt="Consultorio Digital"
                className="h-40 sm:h-48 w-auto object-contain select-none"
                draggable={false}
                decoding="async"
                loading="eager"
                style={{ filter: "drop-shadow(0 16px 32px rgba(0,165,160,0.18))" }}
              />
            </div>
          </div>
          <div
            className="rounded-2xl border border-white/10 shadow-2xl p-8 text-center"
            style={{ backgroundColor: '#111111' }}
          >
            {emailVerified ? (
              <>
                <div className="mx-auto w-16 h-16 rounded-full bg-[hsla(160,80%,50%,0.15)] flex items-center justify-center mb-4 animate-in zoom-in duration-300">
                  <CheckCircle2 className="w-8 h-8 text-[hsl(160,80%,50%)]" />
                </div>
                <h2 className="text-xl font-bold text-white mb-2">¡Email confirmado!</h2>
                <p className="text-sm text-white/50">Redirigiendo...</p>
              </>
            ) : (
              <>
                <div className="mx-auto w-16 h-16 rounded-full bg-[hsla(176,80%,40%,0.1)] flex items-center justify-center mb-4">
                  <Mail className="w-8 h-8 text-[hsl(176,80%,40%)] animate-pulse" />
                </div>
                <h2 className="text-xl font-bold text-white mb-2">Revisá tu email</h2>
                <p className="text-sm text-white/50 mb-1">
                  Enviamos un link de verificación a
                </p>
                <p className="text-sm font-medium text-white mb-4">{email}</p>
                <p className="text-xs text-white/30">
                  Hacé clic en el link del email para continuar. Esta pantalla se actualiza automáticamente.
                </p>
                <div className="mt-6 flex items-center justify-center gap-2 text-white/20">
                  <div className="w-1.5 h-1.5 rounded-full bg-white/30 animate-bounce" style={{ animationDelay: "0ms" }} />
                  <div className="w-1.5 h-1.5 rounded-full bg-white/30 animate-bounce" style={{ animationDelay: "150ms" }} />
                  <div className="w-1.5 h-1.5 rounded-full bg-white/30 animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Pantalla de confirmación de invitación enviada
  if (inviteSent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[hsl(180,15%,4%)] p-4">
        <div
          className="fixed inset-0 pointer-events-none"
          style={{ background: "radial-gradient(ellipse 60% 40% at 50% 0%, hsla(176,80%,40%,0.1), transparent)" }}
        />
        <div className="relative z-10 w-full max-w-md">
          <div className="flex justify-center mb-6">
            <img
              src={logoWhite}
              alt="Consultorio Digital"
              className="h-32 sm:h-40 w-auto object-contain select-none"
              draggable={false}
              style={{ filter: "drop-shadow(0 16px 32px rgba(0,165,160,0.18))" }}
            />
          </div>
          <div
            className="rounded-2xl border border-white/10 shadow-2xl p-8 text-center"
            style={{ backgroundColor: '#111111' }}
          >
            <div className="mx-auto w-16 h-16 rounded-full bg-[hsla(160,80%,50%,0.15)] flex items-center justify-center mb-4">
              <Mail className="w-8 h-8 text-[hsl(160,80%,50%)]" />
            </div>
            <h2 className="text-xl font-bold text-white mb-3">¡Revisá tu email!</h2>
            <p className="text-sm text-white/60 mb-2">
              Te enviamos un email a
            </p>
            <p className="text-sm font-semibold text-white mb-4 break-all">{email}</p>
            <p className="text-sm text-white/60">
              con el link para activar tu cuenta y configurar tu consultorio.
            </p>
            <p className="text-xs text-white/40 mt-6">
              Si no lo ves, revisá la carpeta de spam o promociones.
            </p>
            <Button
              variant="outline"
              className="w-full mt-6 border-white/10 text-white/70 hover:bg-white/5 hover:text-white"
              onClick={() => { setInviteSent(false); setIsSignUp(false); setEmail(""); }}
            >
              Volver a iniciar sesión
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[hsl(180,15%,4%)]">
      {/* Imagen de fondo de consultorio — SOLO desktop, mobile queda limpio */}
      <div
        className="fixed inset-0 pointer-events-none bg-cover bg-center hidden lg:block"
        style={{
          backgroundImage: `url(${authBgConsultorio})`,
          opacity: 0.22,
        }}
        aria-hidden
      />
      {/* Viñeta sutil sólo en bordes para mantener foco en el centro */}
      <div
        className="fixed inset-0 pointer-events-none hidden lg:block"
        style={{
          background:
            "radial-gradient(ellipse 90% 80% at 50% 50%, hsla(180,15%,4%,0.25) 20%, hsla(180,15%,4%,0.7) 100%)",
        }}
        aria-hidden
      />
      {/* Glow sutil teal arriba */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse 60% 40% at 50% 0%, hsla(176,80%,40%,0.06), transparent)" }}
        aria-hidden
      />

      {/* Contenido principal centrado. En mobile ocupa al menos toda la pantalla (card centrado vertical).
          En desktop también centra logo+card como fila. flex-1 lo hace ocupar el espacio antes del footer. */}
      <main className="relative z-10 flex-1 w-full flex flex-col lg:flex-row items-center justify-center lg:gap-10 xl:gap-16 px-4 py-8 lg:py-0 min-h-screen lg:min-h-0">
        {/* Logo grande flotante a la izquierda — solo desktop */}
        <div className="hidden lg:flex shrink-0 justify-center" aria-hidden>
          <div className="relative animate-float-soft" style={{ willChange: "transform" }}>
            <div
              className="absolute inset-0 -z-10 blur-2xl opacity-25"
              style={{
                background:
                  "radial-gradient(ellipse at center, hsla(176,80%,40%,0.35), transparent 75%)",
              }}
            />
            <img
              src={logoWhite}
              alt=""
              className="h-80 xl:h-96 w-auto object-contain select-none"
              draggable={false}
              decoding="async"
              loading="eager"
              style={{ filter: "drop-shadow(0 16px 32px rgba(0,165,160,0.18))" }}
            />
          </div>
        </div>

        {/* Columna del card (incluye Volver, badges y card) */}
        <div className="w-full max-w-md lg:max-w-sm mx-auto lg:mx-0 flex flex-col items-center justify-center lg:justify-start">
        <Link
          to="/acceso"
          className="self-start inline-flex items-center gap-2 text-sm text-white/40 hover:text-white/70 mb-4 transition-colors absolute top-4 left-4 lg:static"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver
        </Link>

        {/* Plan badge */}
        {selectedPlan && planDef && (
          <div className="w-full mb-4 rounded-xl border border-[hsla(160,80%,50%,0.3)] bg-[hsla(160,80%,50%,0.05)] p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[hsla(160,80%,50%,0.1)] flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-[hsl(160,80%,50%)]" />
              </div>
              <div>
                <p className="text-sm text-white/50">Plan seleccionado</p>
                <p className="font-semibold text-white">{planDef.name}</p>
              </div>
            </div>
            <p className="text-xs text-[hsl(160,80%,50%)] mt-2 ml-13">
              ✨ 7 días gratis, sin tarjeta requerida
            </p>
          </div>
        )}

        {/* Contextual business header */}
        {showContextualLogin && (
          <div className="w-full mb-4 rounded-xl border border-[hsla(176,80%,40%,0.2)] bg-[hsla(176,80%,40%,0.05)] p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[hsla(176,80%,40%,0.1)] flex items-center justify-center">
              <Building2 className="w-5 h-5 text-[hsl(176,80%,40%)]" />
            </div>
            <div>
              <p className="text-sm text-white/50">Ingresando a</p>
              <p className="font-semibold text-white">{hostnameBusiness.name}</p>
            </div>
          </div>
        )}

        {/* Logo Consultorio Digital — SOLO mobile y tablet, justo arriba del card */}
        <div className="lg:hidden flex justify-center mb-2" aria-hidden>
          <div className="relative animate-float-soft" style={{ willChange: "transform" }}>
            <div
              className="absolute inset-0 -z-10 blur-2xl opacity-30"
              style={{
                background:
                  "radial-gradient(ellipse at center, hsla(176,80%,40%,0.4), transparent 75%)",
              }}
            />
            <img
              src={logoWhite}
              alt=""
              className="h-40 sm:h-48 w-auto object-contain select-none"
              draggable={false}
              decoding="async"
              loading="eager"
              style={{ filter: "drop-shadow(0 12px 28px rgba(0,165,160,0.2))" }}
            />
          </div>
        </div>

        <div
          className="w-full rounded-2xl border border-white/10 shadow-2xl"
          style={{
            backgroundColor: '#111111',
            boxShadow: '0 8px 60px rgba(0, 165, 160, 0.08), 0 0 120px rgba(0, 165, 160, 0.04)',
          }}
        >
          <div className="p-6 pb-2 text-center space-y-3">
            <h2 className="text-2xl font-bold text-white">
              {showForgotPassword ? "Recuperar acceso" : isSignUp ? "Crear cuenta" : "Bienvenido/a"}
            </h2>
            <p className="text-sm text-white/50">
              {showForgotPassword
                ? "Te enviaremos un email para restablecer tu contraseña"
                : isSignUp
                  ? "Ingresá tu email y te enviamos un link para activar tu cuenta"
                  : showContextualLogin
                    ? `Iniciá sesión en ${hostnameBusiness.name}`
                    : "Iniciá sesión en tu cuenta profesional"
              }
            </p>
          </div>
          <div className="p-6 pt-4">
            {showForgotPassword ? (
              forgotSent ? (
                <div className="text-center space-y-4 py-4">
                  <div className="mx-auto w-14 h-14 rounded-full bg-[hsla(176,80%,40%,0.1)] flex items-center justify-center">
                    <Mail className="w-7 h-7 text-[hsl(176,80%,40%)]" />
                  </div>
                  <div>
                    <p className="font-medium text-white">¡Email enviado!</p>
                    <p className="text-sm text-white/50 mt-1">
                      Revisá tu bandeja de entrada en <strong>{forgotEmail}</strong> y seguí el enlace para restablecer tu contraseña.
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    className="w-full border-white/10 text-white/70 hover:bg-white/5 hover:text-white"
                    onClick={() => { setShowForgotPassword(false); setForgotSent(false); setForgotEmail(""); }}
                  >
                    Volver a iniciar sesión
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleForgotPassword} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="forgot-email" className="text-white/70">Correo electrónico</Label>
                    <Input
                      id="forgot-email"
                      type="email"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      required
                      placeholder="maria@example.com"
                      className="bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-[hsl(176,80%,40%)]"
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={forgotLoading} style={{ backgroundColor: '#00a5a0' }}>
                    {forgotLoading ? "Enviando..." : "Enviar email de recuperación"}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="w-full text-white/40 hover:text-white/70 hover:bg-white/5"
                    onClick={() => setShowForgotPassword(false)}
                  >
                    Volver a iniciar sesión
                  </Button>
                </form>
              )
            ) : (
              <>
                {/* Email Form — método principal */}
                <form onSubmit={handleSubmit} className="space-y-4">
                  {isSignUp && false && (
                    <div className="space-y-2">
                      <Label htmlFor="name" className="text-white/70">Nombre completo</Label>
                      <Input
                        id="name"
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                        placeholder="María García"
                        className="bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-[hsl(176,80%,40%)]"
                      />
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-white/70">Correo electrónico</Label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      placeholder="maria@example.com"
                      className="bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-[hsl(176,80%,40%)]"
                    />
                  </div>
                  {!isSignUp && <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="password" className="text-white/70">Contraseña</Label>
                      {!isSignUp && (
                        <button
                          type="button"
                          className="text-xs text-[hsl(176,80%,40%)] hover:underline"
                          onClick={() => setShowForgotPassword(true)}
                        >
                          ¿Olvidaste tu contraseña?
                        </button>
                      )}
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
                        className="pr-10 bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-[hsl(176,80%,40%)]"
                      />
                      <button
                        type="button"
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                        onClick={() => setShowPassword(!showPassword)}
                        tabIndex={-1}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>}
                  {!isSignUp && (
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="remember-email"
                        checked={rememberEmail}
                        onCheckedChange={(checked) => setRememberEmail(checked === true)}
                        className="border-white/20 data-[state=checked]:bg-[hsl(176,80%,40%)] data-[state=checked]:border-[hsl(176,80%,40%)]"
                      />
                      <Label
                        htmlFor="remember-email"
                        className="text-xs text-white/60 cursor-pointer select-none"
                      >
                        Recordar mi email en este dispositivo
                      </Label>
                    </div>
                  )}
                  <Button
                    type="submit"
                    className="w-full h-11 font-semibold text-white"
                    disabled={loading}
                    style={{ backgroundColor: '#00a5a0', boxShadow: '0 4px 20px rgba(0,165,160,0.3)' }}
                  >
                    {loading ? "Aguardá un momento..." : isSignUp ? "Enviar link de activación" : "Iniciar sesión"}
                  </Button>
                  {isSignUp && (
                    <p className="text-[11px] text-white/40 text-center leading-relaxed">
                      Al crear tu cuenta aceptás los{" "}
                      <a href="/terminos" target="_blank" rel="noopener noreferrer" className="underline hover:text-white/70">
                        Términos y Condiciones
                      </a>{" "}
                      y la{" "}
                      <a href="/privacidad" target="_blank" rel="noopener noreferrer" className="underline hover:text-white/70">
                        Política de Privacidad
                      </a>.
                    </p>
                  )}
                </form>

                <div className="mt-5 text-center text-sm">
                  {isSignUp ? (
                    <>
                      <span className="text-white/40">¿Ya tenés cuenta? </span>
                      <button
                        onClick={() => setIsSignUp(false)}
                        className="text-[hsl(176,80%,40%)] hover:underline font-medium"
                      >
                        Iniciá sesión
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="text-white/40">¿No tenés cuenta? </span>
                      <button
                        onClick={() => navigate("/#pricing")}
                        className="text-[hsl(176,80%,40%)] hover:underline font-medium"
                      >
                        Registrate gratis
                      </button>
                    </>
                  )}
                </div>

                {/* Login alternativo — Google secundario (solo en login, no en signup) */}
                {!isSignUp && (
                <div className="mt-5 pt-4 border-t border-white/5">
                  <button
                    type="button"
                    onClick={handleGoogleLogin}
                    disabled={googleLoading}
                    className="mx-auto flex items-center gap-2 text-xs text-white/40 hover:text-white/80 transition-colors disabled:opacity-50"
                  >
                    <span>O ingresá con</span>
                    {googleLoading ? (
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-transparent" />
                    ) : (
                      <svg className="h-4 w-4" viewBox="0 0 24 24" aria-label="Google">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                      </svg>
                    )}
                    <span className="font-medium">Google</span>
                  </button>
                </div>
                )}
              </>
            )}
          </div>
        </div>
        </div>
      </main>

      {/* Footer "Powered by" — transparente, minimalista, igual al panel SaaS Admin pero más chico */}
      <footer className="relative z-10 w-full">
        <div className="max-w-7xl mx-auto px-4 pt-3 pb-10 flex items-center justify-center gap-2">
          <span className="text-[9px] font-medium uppercase tracking-[0.2em] text-white/30">
            Powered by
          </span>
          <a
            href="https://digitalbuilders.net"
            target="_blank"
            rel="noopener noreferrer"
            className="opacity-50 hover:opacity-90 transition-opacity inline-flex items-center"
            title="Digital Builders"
          >
            <img
              src={digitalBuildersLogo}
              alt="Digital Builders"
              className="h-6 w-auto object-contain"
            />
          </a>
        </div>
      </footer>
    </div>
  );
};

export default Auth;

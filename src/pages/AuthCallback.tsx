import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/Logo";
import { CheckCircle2 } from "lucide-react";
import { isCurrentUserSuperAdmin } from "@/lib/admin-access";

/**
 * Handles Supabase auth redirects (email verification, OAuth callbacks).
 * Establishes session from URL tokens, then redirects ONCE based on user state.
 */
const AuthCallback = () => {
  const navigate = useNavigate();
  const hasRedirected = useRef(false);

  useEffect(() => {
    // Guard: only run once
    if (hasRedirected.current) return;

    const handleCallback = async () => {
      const { data: { session }, error } = await supabase.auth.getSession();

      if (error || !session?.user) {
        // Token exchange may be async — listen for state change
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
          if (event === "SIGNED_IN" && newSession?.user && !hasRedirected.current) {
            hasRedirected.current = true;
            subscription.unsubscribe();
            // Fire and forget — no await inside callback
            redirectByState(newSession.user.id);
          }
        });

        // Timeout fallback
        setTimeout(() => {
          subscription.unsubscribe();
          if (!hasRedirected.current) {
            hasRedirected.current = true;
            navigate("/auth", { replace: true });
          }
        }, 10000);
        return;
      }

      hasRedirected.current = true;
      await redirectByState(session.user.id);
    };

    const redirectByState = async (userId: string) => {
      // Check super_admin
      const isSuperAdmin = await isCurrentUserSuperAdmin(userId);
      if (isSuperAdmin) { navigate("/saas-admin", { replace: true }); return; }

      // Check patient
      const { data: patientRole } = await supabase
        .from("user_roles").select("role").eq("user_id", userId).eq("role", "patient").maybeSingle();
      if (patientRole) { navigate("/portal-paciente", { replace: true }); return; }

      // Check professional
      const { data: professionalRole } = await supabase
        .from("user_roles").select("role").eq("user_id", userId).eq("role", "professional").maybeSingle();
      if (professionalRole) { navigate("/dashboard", { replace: true }); return; }

      // Check business
      const { data: business } = await supabase
        .from("businesses").select("id, onboarding_completed, is_demo").eq("owner_user_id", userId).maybeSingle();

      if (business) {
        if (!business.onboarding_completed) {
          navigate("/onboarding-consultorio", { replace: true });
          return;
        }
        const { data: subs } = await supabase
          .from("subscriptions")
          .select("status, mercadopago_preapproval_id")
          .eq("business_id", business.id);

        const hasActivatedAccess =
          business.is_demo ||
          (subs ?? []).some(
            (s) => s.status === "active" || !!s.mercadopago_preapproval_id,
          );

        if (hasActivatedAccess) {
          navigate("/dashboard", { replace: true });
        } else {
          navigate("/activar-prueba", { replace: true });
        }
      } else {
        navigate("/configurar-negocio", { replace: true });
      }
    };

    handleCallback();
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[hsl(180,15%,4%)] p-4">
      <div
        className="fixed inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse 60% 40% at 50% 0%, hsla(176,80%,40%,0.1), transparent)" }}
      />
      <div className="relative z-10 w-full max-w-md text-center">
        <div className="flex justify-center mb-6">
          <Logo variant="full" size="4xl" showTagline={false} />
        </div>
        <div
          className="rounded-2xl border border-white/10 shadow-2xl p-8"
          style={{ backgroundColor: '#111111' }}
        >
          <div className="mx-auto w-16 h-16 rounded-full bg-[hsla(160,80%,50%,0.15)] flex items-center justify-center mb-4 animate-in zoom-in duration-300">
            <CheckCircle2 className="w-8 h-8 text-[hsl(160,80%,50%)]" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">¡Email confirmado!</h2>
          <p className="text-sm text-white/50">Redirigiendo...</p>
          <div className="mt-6 flex items-center justify-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-white/30 animate-bounce" style={{ animationDelay: "0ms" }} />
            <div className="w-1.5 h-1.5 rounded-full bg-white/30 animate-bounce" style={{ animationDelay: "150ms" }} />
            <div className="w-1.5 h-1.5 rounded-full bg-white/30 animate-bounce" style={{ animationDelay: "300ms" }} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthCallback;

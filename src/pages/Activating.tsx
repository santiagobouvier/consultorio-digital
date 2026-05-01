import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/Logo";
import { Loader2, CheckCircle2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isCurrentUserSuperAdmin } from "@/lib/admin-access";
import { resolveSubscriptionStatus } from "@/lib/subscription-status";

const MAX_POLL_MS = 30_000;
const POLL_INTERVAL_MS = 2_000;

const Activating = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [timedOut, setTimedOut] = useState(false);
  const [activated, setActivated] = useState(false);
  const polling = useRef(false);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    const poll = async () => {
      if (polling.current) return;
      polling.current = true;

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        // Wait for session — user might be returning from MP redirect
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
          if (event === "SIGNED_IN" && session?.user) {
            subscription.unsubscribe();
            startPolling(session.user.id);
          }
        });
        timer = setTimeout(() => {
          subscription.unsubscribe();
          if (!cancelled) navigate("/auth", { replace: true });
        }, 8000);
        return;
      }

      startPolling(user.id);
    };

    const startPolling = async (userId: string) => {
      const isSuperAdmin = await isCurrentUserSuperAdmin(userId);

      if (cancelled) return;
      if (isSuperAdmin) {
        navigate("/saas-admin", { replace: true });
        return;
      }

      const startTime = Date.now();

      const { data: business } = await supabase
        .from("businesses")
        .select("id")
        .eq("owner_user_id", userId)
        .maybeSingle();

      if (!business) {
        if (!cancelled) navigate("/configurar-negocio", { replace: true });
        return;
      }

      const check = async () => {
        if (cancelled) return;

        const { data: subscription } = await supabase
          .from("subscriptions")
          .select("status, trial_ends_at, current_period_end, created_at")
          .eq("business_id", business.id)
          .maybeSingle();

        const resolvedStatus = resolveSubscriptionStatus(subscription);

        if (resolvedStatus === "active" || resolvedStatus === "trial") {
          setActivated(true);
          setTimeout(() => {
            if (!cancelled) navigate("/dashboard?subscription=success", { replace: true });
          }, 1500);
          return;
        }

        if (Date.now() - startTime >= MAX_POLL_MS) {
          setTimedOut(true);
          return;
        }

        timer = setTimeout(check, POLL_INTERVAL_MS);
      };

      check();
    };

    poll();
    return () => { cancelled = true; clearTimeout(timer); };
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[hsl(180,15%,4%)] p-4">
      <div
        className="fixed inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse 60% 40% at 50% 0%, hsla(176,80%,40%,0.1), transparent)" }}
      />

      <div className="relative z-10 w-full max-w-md text-center space-y-8">
        <Logo variant="full" size="4xl" showTagline={false} />

        <div
          className="rounded-2xl border border-white/10 p-8 space-y-6"
          style={{ backgroundColor: "#111111" }}
        >
          {activated ? (
            <>
              <CheckCircle2 className="w-16 h-16 mx-auto text-[hsl(160,80%,50%)]" />
              <h2 className="text-xl font-bold text-white">¡Cuenta activada!</h2>
              <p className="text-sm text-white/50">Redirigiendo al dashboard...</p>
            </>
          ) : timedOut ? (
            <>
              <h2 className="text-xl font-bold text-white">Tu suscripción está siendo procesada</h2>
              <p className="text-sm text-white/50">
                Puede tomar unos minutos. Entrá a tu cuenta en un momento.
              </p>
              <Button
                onClick={() => navigate("/dashboard", { replace: true })}
                className="w-full h-12 font-semibold text-white text-base"
                style={{ backgroundColor: "#00a5a0" }}
              >
                <ArrowRight className="w-5 h-5 mr-2" />
                Ir al dashboard
              </Button>
            </>
          ) : (
            <>
              <Loader2 className="w-16 h-16 mx-auto text-[hsl(176,80%,40%)] animate-spin" />
              <h2 className="text-xl font-bold text-white">Estamos activando tu cuenta...</h2>
              <p className="text-sm text-white/50">
                Esto puede tomar unos segundos. No cierres esta ventana.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Activating;

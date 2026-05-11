import { useNavigate } from "react-router-dom";
import { useSubscriptionStatus } from "@/hooks/use-subscription-status";
import { useBusinessIdContext } from "@/contexts/BusinessIdContext";
import { Clock, Sparkles } from "lucide-react";

interface TrialBannerProps {
  businessId?: string | null;
}

export function TrialBanner({ businessId: propBusinessId }: TrialBannerProps) {
  const navigate = useNavigate();
  const { businessId: ctxBusinessId } = useBusinessIdContext();
  const effectiveBusinessId = propBusinessId || ctxBusinessId;
  const { status, trialDaysLeft } = useSubscriptionStatus(effectiveBusinessId);

  if (status !== "trial" || trialDaysLeft === null) return null;

  const isLessThanOneDay = trialDaysLeft < 1;
  const label = isLessThanOneDay
    ? "Menos de 24hs de prueba gratuita"
    : `${trialDaysLeft} ${trialDaysLeft === 1 ? "día" : "días"} de prueba gratuita restantes`;

  return (
    <button
      onClick={() => navigate("/billing")}
      className="w-full text-left cursor-pointer"
    >
      <div className="flex items-center gap-2 px-4 py-2 bg-primary/10 border-b border-primary/20 hover:bg-primary/15 transition-colors">
        {isLessThanOneDay ? (
          <Clock className="w-4 h-4 text-primary flex-shrink-0" />
        ) : (
          <Sparkles className="w-4 h-4 text-primary flex-shrink-0" />
        )}
        <span className="text-sm font-medium text-primary">
          {label}
        </span>
      </div>
    </button>
  );
}

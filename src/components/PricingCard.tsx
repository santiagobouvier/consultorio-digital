import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Check, X, Crown } from "lucide-react";
import { formatPrice } from "@/lib/plan-definitions";

interface PricingFeature {
  text: string;
  included: boolean;
}

interface PricingCardProps {
  name: string;
  description: string;
  professionals?: string;
  patients?: string;
  price: string;
  priceNote?: string;
  savingsNote?: string;
  annualSavings?: number;
  buttonText: string;
  buttonLink: string;
  buyText?: string;
  buyLink?: string;
  isExternal?: boolean;
  isHighlighted?: boolean;
  highlightLabel?: string;
  /** Los diferenciales del plan: se muestran grandes y con peso propio. */
  keyFeatures?: PricingFeature[];
  /** Sello para el plan tope de gama (sin ser el destacado de venta). */
  premium?: boolean;
  features?: PricingFeature[];
}

const PricingCard = ({
  name,
  description,
  price,
  priceNote,
  savingsNote,
  annualSavings = 0,
  buttonText,
  buttonLink,
  buyText,
  buyLink,
  isExternal = false,
  isHighlighted = false,
  highlightLabel,
  keyFeatures = [],
  premium = false,
  features = [],
}: PricingCardProps) => {
  return (
    <div
      className={`relative p-6 sm:p-7 md:p-8 rounded-xl sm:rounded-2xl border transition-all duration-300 flex flex-col ${
        isHighlighted
          ? "border-[#00c78a]/50"
          : premium
          ? "border-white/20 hover:border-white/30"
          : "border-white/5 hover:border-white/10"
      }`}
      style={{
        backgroundColor: isHighlighted ? "rgba(0, 199, 138, 0.05)" : "#111111",
        boxShadow: isHighlighted
          ? "0 8px 40px rgba(0, 199, 138, 0.15)"
          : premium
          ? "0 8px 40px rgba(255, 255, 255, 0.06)"
          : "0 4px 20px rgba(0, 0, 0, 0.3)",
      }}
    >
      {/* Highlight Label */}
      {isHighlighted && highlightLabel && (
        <div
          className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 sm:px-4 py-1 rounded-full text-xs font-semibold text-black"
          style={{ backgroundColor: "#00c78a" }}
        >
          {highlightLabel}
        </div>
      )}

      {/* Plan Name */}
      <div className="flex items-center gap-2 mb-2">
        <h3 className="text-lg sm:text-xl font-bold text-white tracking-tight">{name}</h3>
        {premium && (
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-amber-300/90 bg-amber-400/10 border border-amber-400/25 rounded-full px-2 py-0.5">
            <Crown className="w-3 h-3" /> El más completo
          </span>
        )}
      </div>

      {/* Description */}
      <p className="text-gray-500 text-sm mb-5 sm:mb-6 font-light">{description}</p>

      {/* Price */}
      <div className="mb-5 sm:mb-6">
        <span
          className="text-2xl sm:text-3xl md:text-4xl font-bold"
          style={{ color: isHighlighted ? "#00c78a" : "white" }}
        >
          {price}
        </span>
        {priceNote && (
          <span className="text-gray-500 text-xs sm:text-sm ml-1 sm:ml-2">{priceNote}</span>
        )}
        {annualSavings > 0 && (
          <p className="text-xs sm:text-sm mt-2 font-semibold" style={{ color: "#00c78a" }}>
            Ahorrás {formatPrice(annualSavings)} al año
          </p>
        )}
        {savingsNote && (
          <p className="text-xs mt-1 font-light text-gray-500">{savingsNote}</p>
        )}
      </div>

      {/* ── Lo que define este plan: los diferenciales, en grande ── */}
      {keyFeatures.length > 0 && (
        <div className="mb-5 sm:mb-6">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-500 mb-2">
            Lo que define este plan
          </p>
          <div className="space-y-2">
            {keyFeatures.map((f) => (
              <div
                key={f.text}
                className={`flex items-start gap-2.5 rounded-lg px-3 py-2.5 border text-sm ${
                  f.included
                    ? "bg-[#00c78a]/[0.07] border-[#00c78a]/25 text-white font-medium"
                    : "bg-white/[0.02] border-dashed border-white/10 text-gray-600 line-through"
                }`}
              >
                {f.included ? (
                  <span className="mt-0.5 w-4 h-4 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: "#00c78a" }}>
                    <Check className="w-3 h-3 text-black" strokeWidth={3} />
                  </span>
                ) : (
                  <X className="mt-0.5 w-4 h-4 flex-shrink-0 text-gray-600" />
                )}
                <span className="leading-snug">{f.text}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CTA Button */}
      {isExternal ? (
        <a href={buttonLink} target="_blank" rel="noopener noreferrer" className="block">
          <Button
            className="w-full h-11 sm:h-12 text-sm font-semibold rounded-xl transition-all duration-300"
            variant={isHighlighted ? "default" : "outline"}
            style={
              isHighlighted
                ? { backgroundColor: "#00c78a", boxShadow: "0 4px 20px rgba(0, 199, 138, 0.3)" }
                : { borderColor: "rgba(255, 255, 255, 0.2)", color: "white", backgroundColor: "transparent" }
            }
          >
            {buttonText}
          </Button>
        </a>
      ) : (
        <Link to={buttonLink}>
          <Button
            className="w-full h-11 sm:h-12 text-sm font-semibold rounded-xl transition-all duration-300"
            variant={isHighlighted ? "default" : "outline"}
            style={
              isHighlighted
                ? { backgroundColor: "#00c78a", boxShadow: "0 4px 20px rgba(0, 199, 138, 0.3)" }
                : { borderColor: "rgba(255, 255, 255, 0.2)", color: "white", backgroundColor: "transparent" }
            }
          >
            {buttonText}
          </Button>
        </Link>
      )}

      {/* Buy Now link */}
      {buyText && buyLink && (
        <Link to={buyLink}>
          <button className="w-full mt-2 text-xs text-gray-500 hover:text-white transition-colors underline underline-offset-2">
            {buyText}
          </button>
        </Link>
      )}

      {/* ── Base común: todo lo que viene en cualquier plan ── */}
      <div className="mt-5 sm:mt-6 pt-5 sm:pt-6 border-t border-white/10 flex-1">
        {features.length > 0 && (
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-600 mb-2.5">
            Además, en todos los planes
          </p>
        )}
        <div className="space-y-2 sm:space-y-2.5">
          {features.map((feature) => (
            <div
              key={feature.text}
              className={`flex items-center gap-2 text-xs sm:text-sm ${
                feature.included ? "text-gray-400" : "text-gray-600 line-through"
              }`}
            >
              {feature.included ? (
                <Check className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "#00c78a" }} />
              ) : (
                <X className="w-3.5 h-3.5 flex-shrink-0 text-gray-600" />
              )}
              <span>{feature.text}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default PricingCard;

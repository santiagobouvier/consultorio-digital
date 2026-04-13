import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Check, X } from "lucide-react";

interface PricingFeature {
  text: string;
  included: boolean;
}

interface PricingCardProps {
  name: string;
  description: string;
  professionals: string;
  patients: string;
  price: string;
  priceNote?: string;
  savingsNote?: string;
  buttonText: string;
  buttonLink: string;
  isExternal?: boolean;
  isHighlighted?: boolean;
  highlightLabel?: string;
  features?: PricingFeature[];
}

const PricingCard = ({
  name,
  description,
  professionals,
  patients,
  price,
  priceNote,
  savingsNote,
  buttonText,
  buttonLink,
  isExternal = false,
  isHighlighted = false,
  highlightLabel,
  features = [],
}: PricingCardProps) => {
  return (
    <div
      className={`relative p-6 sm:p-7 md:p-8 rounded-xl sm:rounded-2xl border transition-all duration-300 flex flex-col ${
        isHighlighted
          ? "border-[#00c78a]/50"
          : "border-white/5 hover:border-white/10"
      }`}
      style={{
        backgroundColor: isHighlighted ? "rgba(0, 199, 138, 0.05)" : "#111111",
        boxShadow: isHighlighted
          ? "0 8px 40px rgba(0, 199, 138, 0.15)"
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
      <h3 className="text-lg sm:text-xl font-bold text-white mb-2 tracking-tight">
        {name}
      </h3>

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
        {savingsNote && (
          <p className="text-xs mt-2 font-light" style={{ color: "#00c78a" }}>
            {savingsNote}
          </p>
        )}
      </div>

      {/* Professionals & Patients */}
      <div className="space-y-2 mb-5 sm:mb-6 text-sm">
        <div className="flex items-center gap-2 text-gray-300">
          <Check className="w-4 h-4" style={{ color: "#00c78a" }} />
          <span>{professionals}</span>
        </div>
        <div className="flex items-center gap-2 text-gray-300">
          <Check className="w-4 h-4" style={{ color: "#00c78a" }} />
          <span>{patients}</span>
        </div>
      </div>

      {/* CTA Button */}
      {isExternal ? (
        <a href={buttonLink} target="_blank" rel="noopener noreferrer" className="block">
          <Button
            className="w-full h-11 sm:h-12 text-sm font-semibold rounded-xl transition-all duration-300"
            variant={isHighlighted ? "default" : "outline"}
            style={
              isHighlighted
                ? {
                    backgroundColor: "#00c78a",
                    boxShadow: "0 4px 20px rgba(0, 199, 138, 0.3)",
                  }
                : {
                    borderColor: "rgba(255, 255, 255, 0.2)",
                    color: "white",
                    backgroundColor: "transparent",
                  }
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
                ? {
                    backgroundColor: "#00c78a",
                    boxShadow: "0 4px 20px rgba(0, 199, 138, 0.3)",
                  }
                : {
                    borderColor: "rgba(255, 255, 255, 0.2)",
                    color: "white",
                    backgroundColor: "transparent",
                  }
            }
          >
            {buttonText}
          </Button>
        </Link>
      )}

      {/* Features List */}
      <div className="mt-5 sm:mt-6 pt-5 sm:pt-6 border-t border-white/10 space-y-2 sm:space-y-2.5 flex-1">
        {features.map((feature) => (
          <div key={feature.text} className={`flex items-center gap-2 text-xs sm:text-sm ${feature.included ? 'text-gray-400' : 'text-gray-600 line-through'}`}>
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
  );
};

export default PricingCard;

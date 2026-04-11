import { useScrollReveal } from "@/hooks/use-scroll-reveal";
import { cn } from "@/lib/utils";
import type { ReactNode, CSSProperties } from "react";

interface ScrollRevealProps {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  delay?: number;
  direction?: "up" | "left" | "right" | "scale";
}

const transforms = {
  up: "translateY(40px)",
  left: "translateX(-40px)",
  right: "translateX(40px)",
  scale: "scale(0.92)",
};

export function ScrollReveal({
  children,
  className,
  style,
  delay = 0,
  direction = "up",
}: ScrollRevealProps) {
  const { ref, isVisible } = useScrollReveal();

  return (
    <div
      ref={ref}
      className={cn(className)}
      style={{
        ...style,
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? "none" : transforms[direction],
        transition: `opacity 0.7s cubic-bezier(0.16,1,0.3,1) ${delay}ms, transform 0.7s cubic-bezier(0.16,1,0.3,1) ${delay}ms`,
        willChange: "opacity, transform",
      }}
    >
      {children}
    </div>
  );
}

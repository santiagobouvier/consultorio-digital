import logoFull from "@/assets/logo-tuconsultorio.png";

interface LogoProps {
  variant?: "full" | "compact" | "icon";
  showTagline?: boolean;
  className?: string;
  size?: "sm" | "md" | "lg" | "xl" | "2xl";
}

const sizeClasses = {
  sm: "h-8",
  md: "h-10",
  lg: "h-14",
  xl: "h-20",
  "2xl": "h-32",
};

export const Logo = ({ 
  variant = "full", 
  showTagline = false, 
  className = "",
  size = "md"
}: LogoProps) => {
  if (variant === "icon") {
    // Solo el ícono del calendario (usando la imagen pero más pequeña)
    return (
      <img 
        src={logoFull} 
        alt="Tu Consultorio Digital" 
        className={`${sizeClasses[size]} w-auto object-contain ${className}`}
      />
    );
  }

  if (variant === "compact") {
    // Logo sin bajada, para usar en header/sidebar
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <img 
          src={logoFull} 
          alt="Tu Consultorio Digital" 
          className={`${sizeClasses[size]} w-auto object-contain`}
        />
      </div>
    );
  }

  // Full logo con opción de tagline
  return (
    <div className={`flex flex-col items-center ${className}`}>
      <img 
        src={logoFull} 
        alt="Tu Consultorio Digital" 
        className={`${sizeClasses[size]} w-auto object-contain`}
      />
      {showTagline && (
        <p className="text-xs text-muted-foreground mt-1 tracking-wider uppercase">
          Bien gestionado
        </p>
      )}
    </div>
  );
};

export default Logo;

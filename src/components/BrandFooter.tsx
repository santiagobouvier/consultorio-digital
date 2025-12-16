interface BrandFooterProps {
  className?: string;
}

export const BrandFooter = ({ className = "" }: BrandFooterProps) => {
  return (
    <footer className={`py-8 mt-auto ${className}`}>
      <div className="max-w-[1400px] mx-auto px-4 sm:px-10 flex items-center justify-center">
        <img 
          src="/assets/logo-footer.png" 
          alt="Tu Consultorio Digital" 
          className="w-[200px] sm:w-[300px] opacity-60"
        />
      </div>
    </footer>
  );
};

export default BrandFooter;

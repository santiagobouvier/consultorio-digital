import ofertaValorPdf from "@/assets/oferta-valor-2026.pdf.asset.json";

interface BrandFooterProps {
  className?: string;
}

export const BrandFooter = ({ className = "" }: BrandFooterProps) => {
  return (
    <footer className={`py-10 mt-auto ${className}`}>
      <div className="max-w-[1400px] mx-auto px-4 sm:px-10 flex flex-col items-center justify-center gap-4">
        <img 
          src="/assets/logo-footer.png" 
          alt="Tu Consultorio Digital" 
          className="w-[200px] sm:w-[300px] opacity-60"
        />
        <a
          href={ofertaValorPdf.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-gray-500 hover:text-[#00a5a0] transition-colors"
        >
          Ver propuesta de valor 2026
        </a>
      </div>
    </footer>
  );
};

export default BrandFooter;

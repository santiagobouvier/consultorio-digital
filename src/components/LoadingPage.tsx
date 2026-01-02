import logoLoading from "@/assets/logo-loading.png";

const LoadingPage = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-black">
      <div className="flex flex-col items-center gap-6 animate-fade-in">
        <img 
          src={logoLoading} 
          alt="Cargando..." 
          className="w-48 h-48 object-contain animate-pulse"
        />
      </div>
    </div>
  );
};

export default LoadingPage;

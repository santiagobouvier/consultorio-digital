import logoLoading from "@/assets/logo-loading.png";

const LoadingPage = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-black">
      <div className="flex flex-col items-center gap-6">
        <img 
          src={logoLoading} 
          alt="Cargando..." 
          className="w-32 h-32 object-contain animate-pulse"
        />
      </div>
    </div>
  );
};

export default LoadingPage;

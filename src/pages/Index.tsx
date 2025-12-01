import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const Index = () => {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-primary/5 to-background">
      <div className="text-center space-y-6 px-4">
        <h1 className="text-5xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
          Gestión de Consultorio de Salud Mental
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          Agenda profesional y gestión de pacientes para profesionales de salud mental en Uruguay
        </p>
        <Link to="/auth">
          <Button size="lg" className="mt-4">Comenzar</Button>
        </Link>
      </div>
    </div>
  );
};

export default Index;

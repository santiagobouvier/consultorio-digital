import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Lock, ArrowLeft, LogIn } from "lucide-react";

const PublicBooking = () => {
  const { slug } = useParams();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-muted flex items-center justify-center">
            <Lock className="h-8 w-8 text-muted-foreground" />
          </div>
          <CardTitle>Agenda privada</CardTitle>
          <CardDescription>
            La agenda de este consultorio es privada y solo está disponible para pacientes registrados.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground text-center">
            Si ya sos paciente del consultorio, iniciá sesión en tu portal para reservar citas.
          </p>
          <p className="text-sm text-muted-foreground text-center">
            Si querés ser atendido, podés solicitar una consulta desde la página del consultorio.
          </p>
          
          <div className="flex flex-col gap-2 pt-4">
            <Button onClick={() => navigate("/auth")} className="w-full gap-2">
              <LogIn className="h-4 w-4" />
              Iniciar sesión
            </Button>
            <Button 
              variant="outline" 
              onClick={() => navigate(`/consultorio/${slug}`)}
              className="w-full gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Volver al consultorio
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PublicBooking;

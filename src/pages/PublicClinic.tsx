import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "lucide-react";

const PublicClinic = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [clinicData, setClinicData] = useState<any>(null);

  useEffect(() => {
    loadClinicData();
  }, [slug]);

  const loadClinicData = async () => {
    try {
      setLoading(true);
      
      // First try to find business by public_slug
      const { data: business, error: businessError } = await supabase
        .from("businesses")
        .select("owner_user_id")
        .eq("public_slug", slug)
        .single();

      if (businessError) throw businessError;

      // Then get clinic settings
      const { data: settings, error: settingsError } = await supabase
        .from("clinic_settings")
        .select("*")
        .eq("user_id", business.owner_user_id)
        .single();

      if (settingsError) throw settingsError;

      setClinicData(settings);
    } catch (error) {
      console.error("Error loading clinic:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Cargando...</p>
      </div>
    );
  }

  if (!clinicData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Consultorio no encontrado</CardTitle>
            <CardDescription>
              No se pudo encontrar la información de este consultorio.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Cover Image */}
      {clinicData.cover_image_url && (
        <div 
          className="h-64 bg-cover bg-center"
          style={{ backgroundImage: `url(${clinicData.cover_image_url})` }}
        />
      )}

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Logo and Header */}
        <div className="flex flex-col items-center text-center mb-8 -mt-16">
          {clinicData.logo_url && (
            <img 
              src={clinicData.logo_url} 
              alt="Logo"
              className="w-32 h-32 rounded-full border-4 border-background shadow-lg mb-4 object-cover"
            />
          )}
          <h1 className="text-4xl font-bold text-foreground mb-2">
            {clinicData.clinic_name || "Consultorio"}
          </h1>
          {clinicData.specialty && (
            <p className="text-xl text-muted-foreground">
              {clinicData.specialty}
            </p>
          )}
        </div>

        {/* Welcome Message */}
        {clinicData.welcome_message && (
          <Card className="mb-8">
            <CardContent className="pt-6">
              <p className="text-foreground whitespace-pre-wrap">
                {clinicData.welcome_message}
              </p>
            </CardContent>
          </Card>
        )}

        {/* CTA Button */}
        <div className="flex justify-center">
          <Button 
            size="lg"
            onClick={() => navigate(`/consultorio/${slug}/reservar`)}
            className="gap-2"
          >
            <Calendar className="h-5 w-5" />
            Reservar una cita
          </Button>
        </div>
      </div>
    </div>
  );
};

export default PublicClinic;
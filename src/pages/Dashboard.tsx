import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "@/hooks/use-toast";
import { Users, CalendarPlus, CalendarDays, UserPlus, Bell, LogOut, Camera } from "lucide-react";
import { PatientForm } from "@/components/PatientForm";
import { CreateAppointmentModal } from "@/components/CreateAppointmentModal";

const Dashboard = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [userName, setUserName] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [activePatientsCount, setActivePatientsCount] = useState(0);
  const [todayAppointmentsCount, setTodayAppointmentsCount] = useState(0);
  const [todayAppointments, setTodayAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPatientForm, setShowPatientForm] = useState(false);
  const [showAppointmentModal, setShowAppointmentModal] = useState(false);

  const statusMap: Record<string, string> = {
    pending: "pendiente",
    confirmed: "confirmada",
    cancelled: "cancelada",
    attended: "atendida",
    no_show: "ausencia",
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      setUserId(user.id);

      const { data: profile } = await supabase
        .from("profiles")
        .select("name, avatar_url")
        .eq("id", user.id)
        .single();

      if (profile) {
        setUserName(profile.name);
        setAvatarUrl(profile.avatar_url);
      }

      const { data: business } = await supabase
        .from("businesses")
        .select("id")
        .eq("owner_user_id", user.id)
        .maybeSingle();

      if (!business) {
        navigate("/configurar-negocio");
        return;
      }

      const { count: patientsCount } = await supabase
        .from("patients")
        .select("*", { count: "exact", head: true })
        .eq("business_id", business.id)
        .eq("is_active", true);

      setActivePatientsCount(patientsCount || 0);

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const { count: appointmentsCount } = await supabase
        .from("appointments")
        .select("*", { count: "exact", head: true })
        .eq("business_id", business.id)
        .gte("start_at", today.toISOString())
        .lt("start_at", tomorrow.toISOString())
        .not("status", "in", '("cancelled","no_show")');

      setTodayAppointmentsCount(appointmentsCount || 0);

      const { data: appointments } = await supabase
        .from("appointments")
        .select(`
          id,
          start_at,
          status,
          contact_name,
          patient_id,
          patients (full_name)
        `)
        .eq("business_id", business.id)
        .gte("start_at", today.toISOString())
        .lt("start_at", tomorrow.toISOString())
        .order("start_at", { ascending: true })
        .limit(5);

      setTodayAppointments(appointments || []);
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
      toast({
        title: "Error",
        description: "No se pudo cargar la información del dashboard",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      navigate("/auth");
    } catch (error) {
      console.error("Error signing out:", error);
      toast({
        title: "Error",
        description: "No se pudo cerrar sesión",
        variant: "destructive",
      });
    }
  };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !userId) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast({
        title: "Error",
        description: "Por favor selecciona una imagen",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast({
        title: "Error",
        description: "La imagen debe ser menor a 2MB",
        variant: "destructive",
      });
      return;
    }

    try {
      setUploadingAvatar(true);

      const fileExt = file.name.split(".").pop();
      const fileName = `${userId}/avatar.${fileExt}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from("avatars")
        .getPublicUrl(fileName);

      // Add cache buster to URL
      const urlWithCacheBuster = `${publicUrl}?t=${Date.now()}`;

      // Update profile with new avatar URL
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_url: urlWithCacheBuster })
        .eq("id", userId);

      if (updateError) throw updateError;

      setAvatarUrl(urlWithCacheBuster);
      toast({
        title: "Éxito",
        description: "Foto de perfil actualizada",
      });
    } catch (error) {
      console.error("Error uploading avatar:", error);
      toast({
        title: "Error",
        description: "No se pudo subir la imagen",
        variant: "destructive",
      });
    } finally {
      setUploadingAvatar(false);
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const formatTime = (datetime: string) => {
    const date = new Date(datetime);
    return date.toLocaleTimeString("es-UY", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <p className="text-muted-foreground">Cargando...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto p-4 sm:p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Avatar with upload */}
            <div className="relative group">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
              />
              <Avatar
                className="h-14 w-14 cursor-pointer ring-2 ring-border group-hover:ring-primary transition-all"
                onClick={handleAvatarClick}
              >
                <AvatarImage src={avatarUrl || undefined} alt={userName} />
                <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                  {getInitials(userName)}
                </AvatarFallback>
              </Avatar>
              <div 
                className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                onClick={handleAvatarClick}
              >
                {uploadingAvatar ? (
                  <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Camera className="h-5 w-5 text-white" />
                )}
              </div>
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-foreground">
                Hola, {userName}
              </h1>
              <p className="text-muted-foreground text-sm">
                Bienvenido a tu panel
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/recordatorios-pendientes")}
              className="text-muted-foreground hover:text-foreground"
            >
              <Bell className="h-5 w-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleLogout}
              className="text-muted-foreground hover:text-destructive"
            >
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          <Card className="bg-card border-border shadow-sm">
            <CardContent className="p-4 sm:p-6 text-center">
              <p className="text-xs sm:text-sm text-muted-foreground font-medium uppercase tracking-wide">
                Pacientes activos
              </p>
              <p className="text-3xl sm:text-4xl font-bold text-foreground mt-2">
                {activePatientsCount}
              </p>
            </CardContent>
          </Card>
          <Card className="bg-card border-border shadow-sm">
            <CardContent className="p-4 sm:p-6 text-center">
              <p className="text-xs sm:text-sm text-muted-foreground font-medium uppercase tracking-wide">
                Citas de hoy
              </p>
              <p className="text-3xl sm:text-4xl font-bold text-foreground mt-2">
                {todayAppointmentsCount}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Main Actions */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          <Card 
            className="bg-card border-border shadow-sm hover:shadow-md transition-shadow cursor-pointer group"
            onClick={() => setShowPatientForm(true)}
          >
            <CardContent className="p-4 sm:p-6 flex flex-col items-center justify-center text-center min-h-[100px] sm:min-h-[120px]">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-primary/10 flex items-center justify-center mb-2 sm:mb-3 group-hover:bg-primary/20 transition-colors">
                <UserPlus className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
              </div>
              <p className="font-semibold text-sm sm:text-base text-foreground">Crear paciente</p>
            </CardContent>
          </Card>

          <Card 
            className="bg-card border-border shadow-sm hover:shadow-md transition-shadow cursor-pointer group"
            onClick={() => setShowAppointmentModal(true)}
          >
            <CardContent className="p-4 sm:p-6 flex flex-col items-center justify-center text-center min-h-[100px] sm:min-h-[120px]">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-primary/10 flex items-center justify-center mb-2 sm:mb-3 group-hover:bg-primary/20 transition-colors">
                <CalendarPlus className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
              </div>
              <p className="font-semibold text-sm sm:text-base text-foreground">Crear cita</p>
            </CardContent>
          </Card>

          <Card 
            className="bg-card border-border shadow-sm hover:shadow-md transition-shadow cursor-pointer group"
            onClick={() => navigate("/patients")}
          >
            <CardContent className="p-4 sm:p-6 flex flex-col items-center justify-center text-center min-h-[100px] sm:min-h-[120px]">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-secondary flex items-center justify-center mb-2 sm:mb-3 group-hover:bg-secondary/80 transition-colors">
                <Users className="h-5 w-5 sm:h-6 sm:w-6 text-secondary-foreground" />
              </div>
              <p className="font-semibold text-sm sm:text-base text-foreground">Ver pacientes</p>
            </CardContent>
          </Card>

          <Card 
            className="bg-card border-border shadow-sm hover:shadow-md transition-shadow cursor-pointer group"
            onClick={() => navigate("/agenda")}
          >
            <CardContent className="p-4 sm:p-6 flex flex-col items-center justify-center text-center min-h-[100px] sm:min-h-[120px]">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-secondary flex items-center justify-center mb-2 sm:mb-3 group-hover:bg-secondary/80 transition-colors">
                <CalendarDays className="h-5 w-5 sm:h-6 sm:w-6 text-secondary-foreground" />
              </div>
              <p className="font-semibold text-sm sm:text-base text-foreground">Ver agenda</p>
            </CardContent>
          </Card>
        </div>

        {/* Today's Appointments */}
        {todayAppointments.length > 0 && (
          <Card className="bg-card border-border shadow-sm">
            <CardHeader className="pb-2 px-4 sm:px-6 pt-4 sm:pt-6">
              <CardTitle className="text-base sm:text-lg font-semibold">
                Próximas citas de hoy
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 sm:px-6 pb-4 sm:pb-6">
              <div className="space-y-2">
                {todayAppointments.map((appointment) => (
                  <div 
                    key={appointment.id} 
                    className="flex items-center justify-between py-2 border-b border-border last:border-0"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-sm font-medium text-primary whitespace-nowrap">
                        {formatTime(appointment.start_at)}
                      </span>
                      <span className="text-sm text-foreground truncate">
                        {appointment.patients?.full_name || appointment.contact_name}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground capitalize whitespace-nowrap ml-2">
                      {statusMap[appointment.status] || appointment.status}
                    </span>
                  </div>
                ))}
              </div>
              {todayAppointmentsCount > 5 && (
                <Button 
                  variant="ghost" 
                  className="w-full mt-3 text-sm"
                  onClick={() => navigate("/agenda")}
                >
                  Ver todas las citas
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {todayAppointments.length === 0 && (
          <Card className="bg-card border-border shadow-sm">
            <CardContent className="p-6 text-center">
              <p className="text-muted-foreground text-sm">
                No hay citas programadas para hoy
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Modals */}
      <PatientForm
        open={showPatientForm}
        onOpenChange={setShowPatientForm}
        onSuccess={() => {
          setShowPatientForm(false);
          fetchDashboardData();
        }}
      />

      <CreateAppointmentModal
        open={showAppointmentModal}
        onOpenChange={setShowAppointmentModal}
        patientId={null}
        onSuccess={fetchDashboardData}
      />
    </div>
  );
};

export default Dashboard;

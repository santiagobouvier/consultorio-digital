import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { Users, CalendarPlus, CalendarDays, UserPlus, Bell } from "lucide-react";

const Dashboard = () => {
  const navigate = useNavigate();
  const [userName, setUserName] = useState("");
  const [activePatientsCount, setActivePatientsCount] = useState(0);
  const [todayAppointmentsCount, setTodayAppointmentsCount] = useState(0);
  const [todayAppointments, setTodayAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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

      const { data: profile } = await supabase
        .from("profiles")
        .select("name")
        .eq("id", user.id)
        .single();

      if (profile) {
        setUserName(profile.name);
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

  const formatTime = (datetime: string) => {
    const date = new Date(datetime);
    return date.toLocaleTimeString("es-UY", {
      hour: "2-digit",
      minute: "2-digit",
    });
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
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
              Hola, {userName}
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Bienvenido a tu panel
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/recordatorios-pendientes")}
            className="text-muted-foreground hover:text-foreground"
          >
            <Bell className="h-5 w-5" />
          </Button>
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
            onClick={() => navigate("/patients?new=true")}
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
            onClick={() => navigate("/agenda?new=true")}
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
    </div>
  );
};

export default Dashboard;

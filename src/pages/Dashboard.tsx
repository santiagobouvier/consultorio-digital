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
import { Bell, Building2, Inbox } from "lucide-react";

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

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      // Get user profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("name")
        .eq("id", user.id)
        .single();

      if (profile) {
        setUserName(profile.name);
      }

      // Get user's business
      const { data: business } = await supabase
        .from("businesses")
        .select("id")
        .eq("owner_user_id", user.id)
        .maybeSingle();

      if (!business) {
        // Redirect silently to business setup
        navigate("/configurar-negocio");
        return;
      }

      // Get active patients count
      const { count: patientsCount } = await supabase
        .from("patients")
        .select("*", { count: "exact", head: true })
        .eq("business_id", business.id)
        .eq("is_active", true);

      setActivePatientsCount(patientsCount || 0);

      // Get today's date range
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      // Get today's appointments count
      const { count: appointmentsCount } = await supabase
        .from("appointments")
        .select("*", { count: "exact", head: true })
        .eq("business_id", business.id)
        .gte("start_at", today.toISOString())
        .lt("start_at", tomorrow.toISOString())
        .not("status", "in", '("cancelled","no_show")');

      setTodayAppointmentsCount(appointmentsCount || 0);

      // Get today's appointments with patient data
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
        .order("start_at", { ascending: true });

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
      <div className="min-h-screen bg-background p-8">
        <div className="max-w-7xl mx-auto">
          <p className="text-muted-foreground">Cargando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Greeting */}
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Hola, {userName}</h1>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => navigate("/mi-consultorio")}
            >
              <Building2 className="h-4 w-4 mr-2" />
              Mi Consultorio
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate("/recordatorios-pendientes")}
            >
              <Bell className="h-4 w-4 mr-2" />
              Recordatorios
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate("/solicitudes")}
            >
              <Inbox className="h-4 w-4 mr-2" />
              Solicitudes
            </Button>
          </div>
        </div>

        {/* Metrics Cards */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Pacientes activos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold">{activePatientsCount}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Citas de hoy</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold">{todayAppointmentsCount}</div>
            </CardContent>
          </Card>
        </div>

        {/* Today's Appointments Table */}
        <Card>
          <CardHeader>
            <CardTitle>Citas de hoy</CardTitle>
          </CardHeader>
          <CardContent>
            {todayAppointments.length === 0 ? (
              <p className="text-muted-foreground">No hay citas programadas para hoy</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Hora</TableHead>
                    <TableHead>Paciente/Contacto</TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {todayAppointments.map((appointment) => (
                    <TableRow key={appointment.id}>
                      <TableCell>{formatTime(appointment.start_at)}</TableCell>
                      <TableCell>
                        {appointment.patients?.full_name || appointment.contact_name}
                      </TableCell>
                      <TableCell>{statusMap[appointment.status] || appointment.status}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Navigation Buttons */}
        <div className="flex gap-4">
          <Button onClick={() => navigate("/patients")}>Ver pacientes</Button>
          <Button onClick={() => navigate("/agenda")} variant="outline">
            Ver agenda
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;

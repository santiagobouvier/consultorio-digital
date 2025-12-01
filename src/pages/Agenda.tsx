import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { ArrowLeft, Calendar as CalendarIcon } from "lucide-react";

interface AppointmentWithPatient {
  id: string;
  start_at: string;
  end_at: string;
  status: string;
  modality: string;
  location: string | null;
  patient_id: string | null;
  patients: {
    full_name: string;
  } | null;
}

interface GroupedAppointments {
  [date: string]: AppointmentWithPatient[];
}

const Agenda = () => {
  const navigate = useNavigate();
  const [appointments, setAppointments] = useState<AppointmentWithPatient[]>([]);
  const [filteredAppointments, setFilteredAppointments] = useState<AppointmentWithPatient[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("todas");

  const statusMap: Record<string, string> = {
    pending: "Programada",
    confirmed: "Programada",
    attended: "Realizada",
    cancelled: "Cancelada",
    no_show: "Ausente",
  };

  useEffect(() => {
    fetchAppointments();
  }, []);

  useEffect(() => {
    applyFilter();
  }, [appointments, filter]);

  const fetchAppointments = async () => {
    try {
      setLoading(true);

      // Get current user's business
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
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

      // Get next 7 days range
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const sevenDaysLater = new Date(today);
      sevenDaysLater.setDate(sevenDaysLater.getDate() + 7);

      // Fetch appointments
      const { data, error } = await supabase
        .from("appointments")
        .select(`
          id,
          start_at,
          end_at,
          status,
          modality,
          location,
          patient_id,
          patients (full_name)
        `)
        .eq("business_id", business.id)
        .gte("start_at", today.toISOString())
        .lt("start_at", sevenDaysLater.toISOString())
        .order("start_at", { ascending: true });

      if (error) throw error;

      setAppointments(data || []);
    } catch (error) {
      console.error("Error fetching appointments:", error);
      toast({
        title: "Error",
        description: "No se pudo cargar la agenda",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const applyFilter = () => {
    if (filter === "todas") {
      setFilteredAppointments(appointments);
    } else if (filter === "hoy") {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      setFilteredAppointments(
        appointments.filter((appt) => {
          const apptDate = new Date(appt.start_at);
          return apptDate >= today && apptDate < tomorrow;
        })
      );
    } else if (filter === "futuras") {
      const now = new Date();
      setFilteredAppointments(
        appointments.filter((appt) => new Date(appt.start_at) > now)
      );
    }
  };

  const groupByDate = (appointments: AppointmentWithPatient[]): GroupedAppointments => {
    return appointments.reduce((groups, appointment) => {
      const date = new Date(appointment.start_at).toLocaleDateString("es-UY", {
        weekday: "long",
        day: "2-digit",
        month: "long",
        year: "numeric",
      });

      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(appointment);
      return groups;
    }, {} as GroupedAppointments);
  };

  const formatTime = (datetime: string) => {
    return new Date(datetime).toLocaleTimeString("es-UY", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const groupedAppointments = groupByDate(filteredAppointments);

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
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/dashboard")}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold">Agenda</h1>
              <p className="text-muted-foreground">Próximos 7 días</p>
            </div>
          </div>

          {/* Filter */}
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas</SelectItem>
              <SelectItem value="hoy">Solo hoy</SelectItem>
              <SelectItem value="futuras">Solo futuras</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Appointments by day */}
        {Object.keys(groupedAppointments).length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-8">
                <CalendarIcon className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  No hay citas programadas para los próximos 7 días
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedAppointments).map(([date, dayAppointments]) => (
              <Card key={date}>
                <CardHeader>
                  <CardTitle className="text-lg capitalize">{date}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {dayAppointments.map((appointment) => (
                      <div
                        key={appointment.id}
                        className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                      >
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center gap-3">
                            <span className="font-semibold">
                              {formatTime(appointment.start_at)} - {formatTime(appointment.end_at)}
                            </span>
                            <Badge variant="outline">
                              {appointment.modality === "online" ? "Online" : "Presencial"}
                            </Badge>
                          </div>
                          {appointment.patients ? (
                            <button
                              onClick={() => navigate(`/patients/${appointment.patient_id}`)}
                              className="text-sm text-primary hover:underline font-medium"
                            >
                              {appointment.patients.full_name}
                            </button>
                          ) : (
                            <p className="text-sm text-muted-foreground">Sin paciente asignado</p>
                          )}
                          {appointment.location && (
                            <p className="text-sm text-muted-foreground">
                              📍 {appointment.location}
                            </p>
                          )}
                        </div>
                        <Badge
                          variant={
                            appointment.status === "pending" || appointment.status === "confirmed"
                              ? "default"
                              : appointment.status === "attended"
                              ? "secondary"
                              : "destructive"
                          }
                        >
                          {statusMap[appointment.status] || appointment.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Agenda;
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
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import { ArrowLeft, Calendar as CalendarIcon } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface AppointmentWithPatient {
  id: string;
  start_at: string;
  end_at: string;
  status: string;
  modality: string;
  location: string | null;
  payment_status: string;
  patient_id: string | null;
  patients: {
    full_name: string;
  } | null;
}

interface GroupedAppointments {
  [date: string]: AppointmentWithPatient[];
}

type TimeRange = "today" | "week" | "month";
type ViewType = "list" | "weekly";

const Agenda = () => {
  const navigate = useNavigate();
  const [appointments, setAppointments] = useState<AppointmentWithPatient[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<TimeRange>("week");
  const [viewType, setViewType] = useState<ViewType>("list");

  const statusMap: Record<string, string> = {
    pending: "Programada",
    confirmed: "Programada",
    attended: "Realizada",
    cancelled: "Cancelada",
    no_show: "Ausente",
  };

  const paymentStatusMap: Record<string, string> = {
    pendiente: "Pendiente",
    pagado: "Pagado",
    bonificado: "Bonificado",
  };

  useEffect(() => {
    fetchAppointments();
  }, [timeRange]);

  const getDateRange = () => {
    const now = new Date();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let startDate: Date;
    let endDate: Date;

    switch (timeRange) {
      case "today":
        startDate = today;
        endDate = new Date(today);
        endDate.setDate(endDate.getDate() + 1);
        break;
      case "week":
        startDate = today;
        endDate = new Date(today);
        endDate.setDate(endDate.getDate() + 7);
        break;
      case "month":
        startDate = new Date(today.getFullYear(), today.getMonth(), 1);
        endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        endDate.setHours(23, 59, 59, 999);
        break;
      default:
        startDate = today;
        endDate = new Date(today);
        endDate.setDate(endDate.getDate() + 7);
    }

    return { startDate, endDate };
  };

  const fetchAppointments = async () => {
    try {
      setLoading(true);

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

      const { startDate, endDate } = getDateRange();

      const { data, error } = await supabase
        .from("appointments")
        .select(`
          id,
          start_at,
          end_at,
          status,
          modality,
          location,
          payment_status,
          patient_id,
          patients (full_name)
        `)
        .eq("business_id", business.id)
        .gte("start_at", startDate.toISOString())
        .lt("start_at", endDate.toISOString())
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

  const getStatusVariant = (status: string) => {
    if (status === "pending" || status === "confirmed") return "default";
    if (status === "attended") return "secondary";
    return "destructive";
  };

  const getPaymentVariant = (paymentStatus: string) => {
    if (paymentStatus === "pagado") return "default";
    if (paymentStatus === "bonificado") return "secondary";
    return "outline";
  };

  const groupedAppointments = groupByDate(appointments);

  const renderListView = () => {
    if (Object.keys(groupedAppointments).length === 0) {
      return (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <CalendarIcon className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                No hay citas programadas para este período
              </p>
            </div>
          </CardContent>
        </Card>
      );
    }

    return (
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
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="font-semibold">
                          {formatTime(appointment.start_at)} - {formatTime(appointment.end_at)}
                        </span>
                        <Badge variant="outline">
                          {appointment.modality === "online" ? "Online" : "Presencial"}
                        </Badge>
                        <Badge variant={getPaymentVariant(appointment.payment_status)}>
                          {paymentStatusMap[appointment.payment_status] || appointment.payment_status}
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
                        <p className="text-sm text-muted-foreground">Cita sin paciente asociado</p>
                      )}
                      {appointment.location && (
                        <p className="text-sm text-muted-foreground">
                          📍 {appointment.location}
                        </p>
                      )}
                    </div>
                    <Badge variant={getStatusVariant(appointment.status)}>
                      {statusMap[appointment.status] || appointment.status}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  };

  const renderWeeklyView = () => {
    if (Object.keys(groupedAppointments).length === 0) {
      return (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <CalendarIcon className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                No hay citas programadas para este período
              </p>
            </div>
          </CardContent>
        </Card>
      );
    }

    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Object.entries(groupedAppointments).map(([date, dayAppointments]) => (
          <Card key={date}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium capitalize">{date}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {dayAppointments.map((appointment) => (
                <div
                  key={appointment.id}
                  className="p-3 border rounded-md space-y-1 hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold">
                      {formatTime(appointment.start_at)}
                    </span>
                    <Badge variant={getStatusVariant(appointment.status)} className="text-xs">
                      {statusMap[appointment.status]}
                    </Badge>
                  </div>
                  {appointment.patients ? (
                    <button
                      onClick={() => navigate(`/patients/${appointment.patient_id}`)}
                      className="text-xs text-primary hover:underline font-medium block"
                    >
                      {appointment.patients.full_name}
                    </button>
                  ) : (
                    <p className="text-xs text-muted-foreground">Sin paciente</p>
                  )}
                  <div className="flex items-center gap-1 flex-wrap">
                    <Badge variant="outline" className="text-xs">
                      {appointment.modality === "online" ? "Online" : "Presencial"}
                    </Badge>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex items-center gap-4">
            <Skeleton className="h-10 w-10" />
            <Skeleton className="h-8 w-32" />
          </div>
          <div className="flex gap-4">
            <Skeleton className="h-10 w-48" />
            <Skeleton className="h-10 w-48" />
          </div>
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
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
            <p className="text-muted-foreground">
              {timeRange === "today" && "Citas de hoy"}
              {timeRange === "week" && "Próximos 7 días"}
              {timeRange === "month" && "Este mes"}
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <Select value={timeRange} onValueChange={(value) => setTimeRange(value as TimeRange)}>
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Hoy</SelectItem>
              <SelectItem value="week">Próximos 7 días</SelectItem>
              <SelectItem value="month">Este mes</SelectItem>
            </SelectContent>
          </Select>

          <Tabs value={viewType} onValueChange={(value) => setViewType(value as ViewType)} className="w-full sm:w-auto">
            <TabsList>
              <TabsTrigger value="list">Lista</TabsTrigger>
              <TabsTrigger value="weekly">Semanal</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Views */}
        {viewType === "list" ? renderListView() : renderWeeklyView()}
      </div>
    </div>
  );
};

export default Agenda;
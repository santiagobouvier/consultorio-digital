import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { PatientForm } from "@/components/PatientForm";
import { CreateAppointmentModal } from "@/components/CreateAppointmentModal";
import { WhatsAppButtons } from "@/components/WhatsAppButtons";
import { ReminderModal } from "@/components/ReminderModal";
import { ArrowLeft, Calendar, Edit, Bell } from "lucide-react";

interface Patient {
  id: string;
  business_id: string;
  full_name: string;
  email: string | null;
  whatsapp_phone: string | null;
  reason_for_consultation: string | null;
  private_notes: string | null;
  is_active: boolean;
}

interface Appointment {
  id: string;
  start_at: string;
  end_at: string;
  status: string;
  modality: string;
  location: string | null;
}

const PatientDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [pastAppointments, setPastAppointments] = useState<Appointment[]>([]);
  const [futureAppointments, setFutureAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEditForm, setShowEditForm] = useState(false);
  const [showCreateAppointment, setShowCreateAppointment] = useState(false);
  const [editingNotes, setEditingNotes] = useState(false);
  const [notes, setNotes] = useState("");
  const [reminderModal, setReminderModal] = useState<{
    open: boolean;
    appointmentId: string;
    date: string;
    time: string;
    modality: string;
    location: string | null;
  }>({
    open: false,
    appointmentId: "",
    date: "",
    time: "",
    modality: "",
    location: null,
  });

  const statusMap: Record<string, string> = {
    pending: "Programada",
    confirmed: "Programada",
    cancelled: "Cancelada",
    attended: "Realizada",
    no_show: "Ausente",
  };

  useEffect(() => {
    if (id) {
      fetchPatientData();
    }
  }, [id]);

  const fetchPatientData = async () => {
    if (!id) return;

    try {
      setLoading(true);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      const { data: patientData, error: patientError } = await supabase
        .from("patients")
        .select("*")
        .eq("id", id)
        .single();

      if (patientError) throw patientError;
      if (!patientData) {
        toast({
          title: "Error",
          description: "Paciente no encontrado",
          variant: "destructive",
        });
        navigate("/patients");
        return;
      }

      setPatient(patientData);
      setNotes(patientData.private_notes || "");

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { data: pastData } = await supabase
        .from("appointments")
        .select("id, start_at, end_at, status, modality, location")
        .eq("patient_id", id)
        .lt("start_at", today.toISOString())
        .order("start_at", { ascending: false });

      setPastAppointments(pastData || []);

      const { data: futureData } = await supabase
        .from("appointments")
        .select("id, start_at, end_at, status, modality, location")
        .eq("patient_id", id)
        .gte("start_at", today.toISOString())
        .order("start_at", { ascending: true });

      setFutureAppointments(futureData || []);
    } catch (error) {
      console.error("Error fetching patient data:", error);
      toast({
        title: "Error",
        description: "No se pudo cargar la información del paciente",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleActiveStatus = async () => {
    if (!patient) return;

    try {
      const { error } = await supabase
        .from("patients")
        .update({ is_active: !patient.is_active })
        .eq("id", patient.id);

      if (error) throw error;

      setPatient({ ...patient, is_active: !patient.is_active });
      toast({
        title: "Éxito",
        description: `Paciente marcado como ${!patient.is_active ? "activo" : "inactivo"}`,
      });
    } catch (error) {
      console.error("Error updating patient status:", error);
      toast({
        title: "Error",
        description: "No se pudo actualizar el estado",
        variant: "destructive",
      });
    }
  };

  const saveNotes = async () => {
    if (!patient) return;

    try {
      const { error } = await supabase
        .from("patients")
        .update({ private_notes: notes.trim() || null })
        .eq("id", patient.id);

      if (error) throw error;

      setPatient({ ...patient, private_notes: notes.trim() || null });
      setEditingNotes(false);
      toast({
        title: "Éxito",
        description: "Notas actualizadas correctamente",
      });
    } catch (error) {
      console.error("Error updating notes:", error);
      toast({
        title: "Error",
        description: "No se pudieron actualizar las notas",
        variant: "destructive",
      });
    }
  };

  const formatDateTime = (datetime: string) => {
    const date = new Date(datetime);
    return {
      date: date.toLocaleDateString("es-UY", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }),
      time: date.toLocaleTimeString("es-UY", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <p className="text-muted-foreground">Cargando...</p>
      </div>
    );
  }

  if (!patient) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8 space-y-5 sm:space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/patients")}
              className="shrink-0 mt-1"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-foreground truncate">
                {patient.full_name}
              </h1>
              <Badge
                variant={patient.is_active ? "default" : "secondary"}
                className="mt-2 rounded-full"
              >
                {patient.is_active ? "Activo" : "Inactivo"}
              </Badge>
            </div>
          </div>
          <Button 
            onClick={() => setShowEditForm(true)}
            size="sm"
            className="shrink-0 rounded-xl h-10 px-4"
          >
            <Edit className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Editar</span>
          </Button>
        </div>

        {/* Basic Information */}
        <Card className="mobile-card">
          <CardHeader className="pb-3 px-0 pt-0 sm:px-6 sm:pt-6">
            <CardTitle className="text-lg font-bold">Información básica</CardTitle>
          </CardHeader>
          <CardContent className="px-0 pb-0 sm:px-6 sm:pb-6 space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
              <div>
                <p className="mobile-label">Email</p>
                <p className="mobile-value">{patient.email || "—"}</p>
              </div>
              <div>
                <p className="mobile-label">WhatsApp</p>
                <p className="mobile-value">{patient.whatsapp_phone || "—"}</p>
              </div>
            </div>
            <div>
              <p className="mobile-label">Motivo de consulta</p>
              <p className="mobile-value">{patient.reason_for_consultation || "—"}</p>
            </div>
            <div className="pt-2 border-t border-border">
              <div className="flex items-center justify-between mb-3">
                <p className="mobile-label">Notas privadas</p>
                {!editingNotes && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditingNotes(true)}
                    className="h-8 text-xs"
                  >
                    <Edit className="h-3.5 w-3.5 mr-1" />
                    Editar
                  </Button>
                )}
              </div>
              {editingNotes ? (
                <div className="space-y-3">
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={4}
                    placeholder="Notas solo visibles para el profesional"
                    className="rounded-xl"
                  />
                  <div className="flex gap-2">
                    <Button onClick={saveNotes} className="rounded-xl">Guardar</Button>
                    <Button
                      variant="outline"
                      className="rounded-xl"
                      onClick={() => {
                        setNotes(patient.private_notes || "");
                        setEditingNotes(false);
                      }}
                    >
                      Cancelar
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-foreground whitespace-pre-wrap">
                  {patient.private_notes || "Sin notas"}
                </p>
              )}
            </div>
            <div className="pt-3">
              <Button 
                variant="outline" 
                onClick={toggleActiveStatus}
                className="w-full sm:w-auto rounded-xl h-11"
              >
                {patient.is_active ? "Marcar como inactivo" : "Marcar como activo"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Future Appointments */}
        <Card className="mobile-card">
          <CardHeader className="pb-3 px-0 pt-0 sm:px-6 sm:pt-6">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-lg font-bold">Próximas citas</CardTitle>
              <Button 
                size="sm" 
                onClick={() => setShowCreateAppointment(true)}
                className="rounded-xl h-9 px-3"
              >
                <Calendar className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Nueva cita</span>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="px-0 pb-0 sm:px-6 sm:pb-6">
            {futureAppointments.length === 0 ? (
              <p className="text-muted-foreground text-sm py-4 text-center">
                No hay citas programadas
              </p>
            ) : (
              <div className="space-y-3">
                {futureAppointments.map((appointment) => {
                  const { date, time } = formatDateTime(appointment.start_at);
                  return (
                    <div
                      key={appointment.id}
                      className="mobile-card-compact space-y-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-base font-bold text-foreground">{date}</p>
                          <p className="text-sm text-muted-foreground mt-0.5">{time}</p>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap justify-end">
                          <Badge variant="outline" className="rounded-full text-xs">
                            {appointment.modality === "online" ? "Online" : "Presencial"}
                          </Badge>
                          <Badge className="rounded-full text-xs">
                            {statusMap[appointment.status] || appointment.status}
                          </Badge>
                        </div>
                      </div>
                      {appointment.location && (
                        <p className="text-xs text-muted-foreground">
                          📍 {appointment.location}
                        </p>
                      )}
                      <div className="space-y-2 pt-1">
                        <WhatsAppButtons
                          patientName={patient.full_name}
                          patientPhone={patient.whatsapp_phone}
                          appointmentDate={date}
                          appointmentTime={time}
                          modality={appointment.modality}
                          location={appointment.location}
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full rounded-xl h-10"
                          onClick={() =>
                            setReminderModal({
                              open: true,
                              appointmentId: appointment.id,
                              date,
                              time,
                              modality: appointment.modality,
                              location: appointment.location,
                            })
                          }
                        >
                          <Bell className="h-4 w-4 mr-2" />
                          Recordatorio
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Appointment History */}
        <Card className="mobile-card">
          <CardHeader className="pb-3 px-0 pt-0 sm:px-6 sm:pt-6">
            <CardTitle className="text-lg font-bold">Historial de citas</CardTitle>
          </CardHeader>
          <CardContent className="px-0 pb-0 sm:px-6 sm:pb-6">
            {pastAppointments.length === 0 ? (
              <p className="text-muted-foreground text-sm py-4 text-center">
                No hay citas anteriores
              </p>
            ) : (
              <>
                {/* Mobile List */}
                <div className="md:hidden space-y-2">
                  {pastAppointments.slice(0, 10).map((appointment) => {
                    const { date, time } = formatDateTime(appointment.start_at);
                    return (
                      <div
                        key={appointment.id}
                        className="flex items-center justify-between py-3 border-b border-border last:border-0"
                      >
                        <div>
                          <p className="font-semibold text-sm text-foreground">{date}</p>
                          <p className="text-xs text-muted-foreground">{time} • {appointment.modality === "online" ? "Online" : "Presencial"}</p>
                        </div>
                        <Badge variant="secondary" className="rounded-full text-xs">
                          {statusMap[appointment.status] || appointment.status}
                        </Badge>
                      </div>
                    );
                  })}
                </div>

                {/* Desktop Table */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-3 px-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Fecha</th>
                        <th className="text-left py-3 px-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Hora</th>
                        <th className="text-left py-3 px-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Modalidad</th>
                        <th className="text-left py-3 px-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pastAppointments.map((appointment) => {
                        const { date, time } = formatDateTime(appointment.start_at);
                        return (
                          <tr key={appointment.id} className="border-b border-border last:border-0">
                            <td className="py-3 px-2 text-sm">{date}</td>
                            <td className="py-3 px-2 text-sm">{time}</td>
                            <td className="py-3 px-2 text-sm">
                              {appointment.modality === "online" ? "Online" : "Presencial"}
                            </td>
                            <td className="py-3 px-2">
                              <Badge variant="secondary" className="rounded-full text-xs">
                                {statusMap[appointment.status] || appointment.status}
                              </Badge>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Modals */}
      {patient && (
        <>
          <PatientForm
            open={showEditForm}
            onOpenChange={setShowEditForm}
            patientId={patient.id}
            initialData={{
              full_name: patient.full_name,
              email: patient.email || "",
              whatsapp_phone: patient.whatsapp_phone || "",
              reason_for_consultation: patient.reason_for_consultation || "",
              private_notes: patient.private_notes || "",
              is_active: patient.is_active,
            }}
            onSuccess={() => {
              setShowEditForm(false);
              fetchPatientData();
            }}
          />

          <CreateAppointmentModal
            open={showCreateAppointment}
            onOpenChange={setShowCreateAppointment}
            patientId={patient.id}
            onSuccess={fetchPatientData}
          />

          <ReminderModal
            open={reminderModal.open}
            onOpenChange={(open) =>
              setReminderModal({ ...reminderModal, open })
            }
            appointmentId={reminderModal.appointmentId}
            patientName={patient.full_name}
            patientPhone={patient.whatsapp_phone}
            appointmentDate={reminderModal.date}
            appointmentTime={reminderModal.time}
            modality={reminderModal.modality}
            location={reminderModal.location}
          />
        </>
      )}
    </div>
  );
};

export default PatientDetail;

import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { PatientForm } from "@/components/PatientForm";
import { ArrowLeft, Calendar, Edit } from "lucide-react";

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
  start_datetime: string;
  status: string;
  service_id: string;
  services: {
    name: string;
  };
}

const PatientDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [pastAppointments, setPastAppointments] = useState<Appointment[]>([]);
  const [futureAppointments, setFutureAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEditForm, setShowEditForm] = useState(false);
  const [editingNotes, setEditingNotes] = useState(false);
  const [notes, setNotes] = useState("");

  const statusMap: Record<string, string> = {
    pending: "pendiente",
    confirmed: "confirmada",
    cancelled: "cancelada",
    attended: "atendida",
    no_show: "ausencia",
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

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      // Get patient
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

      // Get appointments
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Past appointments
      const { data: pastData } = await supabase
        .from("appointments")
        .select(`
          id,
          start_datetime,
          status,
          service_id,
          services (name)
        `)
        .eq("patient_id", id)
        .lt("start_datetime", today.toISOString())
        .order("start_datetime", { ascending: false });

      setPastAppointments(pastData || []);

      // Future appointments
      const { data: futureData } = await supabase
        .from("appointments")
        .select(`
          id,
          start_datetime,
          status,
          service_id,
          services (name)
        `)
        .eq("patient_id", id)
        .gte("start_datetime", today.toISOString())
        .order("start_datetime", { ascending: true });

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
      <div className="min-h-screen bg-background p-8">
        <div className="max-w-7xl mx-auto">
          <p className="text-muted-foreground">Cargando...</p>
        </div>
      </div>
    );
  }

  if (!patient) {
    return null;
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
              onClick={() => navigate("/patients")}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold">{patient.full_name}</h1>
              <Badge
                variant={patient.is_active ? "default" : "secondary"}
                className="mt-2"
              >
                {patient.is_active ? "Activo" : "Inactivo"}
              </Badge>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowEditForm(true)}>
              <Edit className="h-4 w-4 mr-2" />
              Editar información
            </Button>
            <Button variant="outline" onClick={toggleActiveStatus}>
              {patient.is_active ? "Marcar como inactivo" : "Marcar como activo"}
            </Button>
          </div>
        </div>

        {/* Basic Information */}
        <Card>
          <CardHeader>
            <CardTitle>Información básica</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Email</p>
                <p className="font-medium">{patient.email || "-"}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Teléfono WhatsApp</p>
                <p className="font-medium">{patient.whatsapp_phone || "-"}</p>
              </div>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Motivo de consulta</p>
              <p className="font-medium">{patient.reason_for_consultation || "-"}</p>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-muted-foreground">Notas privadas</p>
                {!editingNotes && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditingNotes(true)}
                  >
                    <Edit className="h-4 w-4 mr-1" />
                    Editar
                  </Button>
                )}
              </div>
              {editingNotes ? (
                <div className="space-y-2">
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={4}
                    placeholder="Notas solo visibles para el profesional"
                  />
                  <div className="flex gap-2">
                    <Button onClick={saveNotes}>Guardar</Button>
                    <Button
                      variant="outline"
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
                <p className="font-medium whitespace-pre-wrap">
                  {patient.private_notes || "-"}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Future Appointments */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Próximas citas</CardTitle>
              <Button size="sm" onClick={() => navigate("/appointments")}>
                <Calendar className="h-4 w-4 mr-2" />
                Crear nueva cita
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {futureAppointments.length === 0 ? (
              <p className="text-muted-foreground">No hay citas programadas</p>
            ) : (
              <div className="space-y-3">
                {futureAppointments.map((appointment) => {
                  const { date, time } = formatDateTime(appointment.start_datetime);
                  return (
                    <div
                      key={appointment.id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div>
                        <p className="font-medium">{date} - {time}</p>
                        <p className="text-sm text-muted-foreground">
                          {appointment.services.name}
                        </p>
                      </div>
                      <Badge>
                        {statusMap[appointment.status] || appointment.status}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Appointment History */}
        <Card>
          <CardHeader>
            <CardTitle>Historial de citas</CardTitle>
          </CardHeader>
          <CardContent>
            {pastAppointments.length === 0 ? (
              <p className="text-muted-foreground">No hay citas anteriores</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Hora</TableHead>
                    <TableHead>Servicio</TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pastAppointments.map((appointment) => {
                    const { date, time } = formatDateTime(appointment.start_datetime);
                    return (
                      <TableRow key={appointment.id}>
                        <TableCell>{date}</TableCell>
                        <TableCell>{time}</TableCell>
                        <TableCell>{appointment.services.name}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">
                            {statusMap[appointment.status] || appointment.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Edit Patient Form */}
      {patient && (
        <PatientForm
          open={showEditForm}
          onOpenChange={setShowEditForm}
          businessId={patient.business_id}
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
      )}
    </div>
  );
};

export default PatientDetail;

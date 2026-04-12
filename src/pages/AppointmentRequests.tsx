import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { ArrowLeft, Check, X, MessageCircle } from "lucide-react";
import LoadingPage from "@/components/LoadingPage";
import { useBusinessId } from "@/hooks/use-business-id";
import { ListPagination, usePagination, ITEMS_PER_PAGE } from "@/components/ListPagination";

const AppointmentRequests = () => {
  const navigate = useNavigate();
  const [requests, setRequests] = useState<any[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  
  const { businessId, loading: businessLoading } = useBusinessId();

  useEffect(() => {
    if (businessId) {
      loadRequests();
    }
  }, [businessId]);

  const loadRequests = async () => {
    try {
      setDataLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) return;

      const { data, error } = await supabase
        .from("appointment_requests")
        .select("*")
        .eq("clinic_user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setRequests(data || []);
    } catch (error) {
      console.error("Error loading requests:", error);
      toast({
        title: "Error",
        description: "No se pudieron cargar las solicitudes",
        variant: "destructive",
      });
    } finally {
      setDataLoading(false);
    }
  };

  const loading = businessLoading || dataLoading;

  const handleAccept = async (request: any) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get business
      const { data: business, error: businessError } = await supabase
        .from("businesses")
        .select("id")
        .eq("owner_user_id", user.id)
        .single();

      if (businessError) throw businessError;

      // Check if patient exists
      let patientId = null;
      const { data: existingPatient } = await supabase
        .from("patients")
        .select("id")
        .eq("business_id", business.id)
        .eq("email", request.email)
        .single();

      if (existingPatient) {
        patientId = existingPatient.id;
      } else {
        // Create new patient
        const { data: newPatient, error: patientError } = await supabase
          .from("patients")
          .insert({
            business_id: business.id,
            full_name: request.name,
            email: request.email,
            whatsapp_phone: request.phone,
            reason_for_consultation: request.message,
          })
          .select()
          .single();

        if (patientError) throw patientError;
        patientId = newPatient.id;
      }

      // Create appointment
      const endDatetime = new Date(request.requested_datetime);
      endDatetime.setHours(endDatetime.getHours() + 1);

      const { error: appointmentError } = await supabase
        .from("appointments")
        .insert({
          business_id: business.id,
          patient_id: patientId,
          start_at: request.requested_datetime,
          end_at: endDatetime.toISOString(),
          contact_name: request.name,
          contact_email: request.email,
          contact_phone: request.phone,
          notes: request.message,
          status: "confirmed",
          source: "web",
        });

      if (appointmentError) throw appointmentError;

      // Update request status
      const { error: updateError } = await supabase
        .from("appointment_requests")
        .update({ status: "accepted" })
        .eq("id", request.id);

      if (updateError) throw updateError;

      toast({
        title: "Cita creada",
        description: "La solicitud fue aceptada y la cita fue creada",
      });

      loadRequests();
    } catch (error) {
      console.error("Error accepting request:", error);
      toast({
        title: "Error",
        description: "No se pudo aceptar la solicitud",
        variant: "destructive",
      });
    }
  };

  const handleReject = async (requestId: string) => {
    try {
      const { error } = await supabase
        .from("appointment_requests")
        .update({ status: "rejected" })
        .eq("id", requestId);

      if (error) throw error;

      toast({
        title: "Solicitud rechazada",
        description: "La solicitud fue marcada como rechazada",
      });

      loadRequests();
    } catch (error) {
      console.error("Error rejecting request:", error);
      toast({
        title: "Error",
        description: "No se pudo rechazar la solicitud",
        variant: "destructive",
      });
    }
  };

  const getWhatsAppLink = (request: any) => {
    const datetime = new Date(request.requested_datetime);
    const formattedDate = format(datetime, "dd/MM/yyyy", { locale: es });
    const formattedTime = format(datetime, "HH:mm", { locale: es });
    const message = `Hola ${request.name}, recibí tu solicitud de cita para ${formattedDate} a las ${formattedTime}.`;
    return `https://wa.me/${request.phone.replace(/\D/g, "")}?text=${encodeURIComponent(message)}`;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="outline">Pendiente</Badge>;
      case "accepted":
        return <Badge className="bg-green-500">Aceptada</Badge>;
      case "rejected":
        return <Badge variant="destructive">Rechazada</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  if (loading) {
    return <LoadingPage />;
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="container mx-auto max-w-6xl">
        <div className="mb-6">
          <Button variant="ghost" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver al panel
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Solicitudes de citas</CardTitle>
            <CardDescription>
              Gestiona las solicitudes de citas de pacientes
            </CardDescription>
          </CardHeader>
          <CardContent>
            {requests.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No hay solicitudes de citas
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Contacto</TableHead>
                      <TableHead>Fecha/Hora</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {requests.map((request) => (
                      <TableRow key={request.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{request.name}</p>
                            {request.message && (
                              <p className="text-sm text-muted-foreground">
                                {request.message}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <p>{request.email}</p>
                            <p>{request.phone}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          {format(
                            new Date(request.requested_datetime),
                            "dd/MM/yyyy HH:mm",
                            { locale: es }
                          )}
                        </TableCell>
                        <TableCell>{getStatusBadge(request.status)}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            {request.status === "pending" && (
                              <>
                                <Button
                                  size="sm"
                                  onClick={() => handleAccept(request)}
                                  title="Aceptar"
                                >
                                  <Check className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => handleReject(request.id)}
                                  title="Rechazar"
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => window.open(getWhatsAppLink(request), "_blank")}
                              title="Contactar por WhatsApp"
                            >
                              <MessageCircle className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AppointmentRequests;
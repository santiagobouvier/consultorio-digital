import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { PatientForm } from "@/components/PatientForm";
import { Search, Plus, ArrowLeft } from "lucide-react";

interface Patient {
  id: string;
  full_name: string;
  email: string | null;
  whatsapp_phone: string | null;
  is_active: boolean;
  last_appointment?: string | null;
  next_appointment?: string | null;
}

const Patients = () => {
  const navigate = useNavigate();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [filteredPatients, setFilteredPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showForm, setShowForm] = useState(false);
  const [businessId, setBusinessId] = useState<string>("");

  useEffect(() => {
    fetchPatients();
  }, []);

  useEffect(() => {
    filterPatients();
  }, [patients, searchTerm, statusFilter]);

  const fetchPatients = async () => {
    try {
      setLoading(true);

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      // Get user's business
      const { data: business } = await supabase
        .from("businesses")
        .select("id")
        .eq("owner_user_id", user.id)
        .single();

      if (!business) {
        toast({
          title: "Error",
          description: "No se encontró el negocio asociado",
          variant: "destructive",
        });
        return;
      }

      setBusinessId(business.id);

      // Get patients
      const { data: patientsData } = await supabase
        .from("patients")
        .select("*")
        .eq("business_id", business.id)
        .order("full_name", { ascending: true });

      if (!patientsData) {
        setPatients([]);
        return;
      }

      // Get appointments data for each patient
      const patientsWithAppointments = await Promise.all(
        patientsData.map(async (patient) => {
          const today = new Date();
          today.setHours(0, 0, 0, 0);

          // Last appointment (attended)
          const { data: lastAppt } = await supabase
            .from("appointments")
            .select("start_datetime")
            .eq("patient_id", patient.id)
            .eq("status", "attended")
            .lt("start_datetime", today.toISOString())
            .order("start_datetime", { ascending: false })
            .limit(1)
            .maybeSingle();

          // Next appointment (future)
          const { data: nextAppt } = await supabase
            .from("appointments")
            .select("start_datetime")
            .eq("patient_id", patient.id)
            .not("status", "in", '("cancelled","no_show")')
            .gte("start_datetime", today.toISOString())
            .order("start_datetime", { ascending: true })
            .limit(1)
            .maybeSingle();

          return {
            ...patient,
            last_appointment: lastAppt?.start_datetime || null,
            next_appointment: nextAppt?.start_datetime || null,
          };
        })
      );

      setPatients(patientsWithAppointments);
    } catch (error) {
      console.error("Error fetching patients:", error);
      toast({
        title: "Error",
        description: "No se pudo cargar la lista de pacientes",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const filterPatients = () => {
    let filtered = [...patients];

    // Search filter
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.full_name.toLowerCase().includes(search) ||
          p.email?.toLowerCase().includes(search)
      );
    }

    // Status filter
    if (statusFilter === "active") {
      filtered = filtered.filter((p) => p.is_active);
    } else if (statusFilter === "inactive") {
      filtered = filtered.filter((p) => !p.is_active);
    }

    setFilteredPatients(filtered);
  };

  const formatDate = (datetime: string | null) => {
    if (!datetime) return "-";
    const date = new Date(datetime);
    return date.toLocaleDateString("es-UY", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
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
            <h1 className="text-3xl font-bold">Gestión de Pacientes</h1>
          </div>
          <Button onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nuevo paciente
          </Button>
        </div>

        {/* Filters */}
        <div className="flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre o email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="active">Solo activos</SelectItem>
              <SelectItem value="inactive">Solo inactivos</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        {filteredPatients.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">
            No se encontraron pacientes
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre completo</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>WhatsApp</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Última consulta</TableHead>
                <TableHead>Próxima consulta</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPatients.map((patient) => (
                <TableRow key={patient.id}>
                  <TableCell className="font-medium">
                    {patient.full_name}
                  </TableCell>
                  <TableCell>{patient.email || "-"}</TableCell>
                  <TableCell>{patient.whatsapp_phone || "-"}</TableCell>
                  <TableCell>
                    <Badge variant={patient.is_active ? "default" : "secondary"}>
                      {patient.is_active ? "Activo" : "Inactivo"}
                    </Badge>
                  </TableCell>
                  <TableCell>{formatDate(patient.last_appointment)}</TableCell>
                  <TableCell>{formatDate(patient.next_appointment)}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(`/patients/${patient.id}`)}
                    >
                      Ver detalle
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Create Patient Form */}
      <PatientForm
        open={showForm}
        onOpenChange={setShowForm}
        businessId={businessId}
        onSuccess={() => {
          setShowForm(false);
          fetchPatients();
        }}
      />
    </div>
  );
};

export default Patients;

import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { PatientForm } from "@/components/PatientForm";
import { Search, Plus, ArrowLeft, ChevronRight, Smartphone } from "lucide-react";
import { useBusinessId } from "@/hooks/use-business-id";
import LoadingPage from "@/components/LoadingPage";

interface Patient {
  id: string;
  full_name: string;
  email: string | null;
  whatsapp_phone: string | null;
  is_active: boolean;
  auth_user_id: string | null;
  last_appointment?: string | null;
  next_appointment?: string | null;
}

const Patients = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [filteredPatients, setFilteredPatients] = useState<Patient[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>(() => {
    return searchParams.get("portal") === "true" ? "portal" : "all";
  });
  const [showForm, setShowForm] = useState(false);
  const [businessName, setBusinessName] = useState<string | null>(null);
  
  const { businessId, loading: businessLoading, isSuperAdmin } = useBusinessId();

  useEffect(() => {
    if (businessId) {
      fetchPatients();
      fetchBusinessName();
    }
  }, [businessId]);

  const fetchBusinessName = async () => {
    if (!businessId) return;
    const { data } = await supabase
      .from("businesses")
      .select("name")
      .eq("id", businessId)
      .maybeSingle();
    setBusinessName(data?.name || null);
  };

  useEffect(() => {
    filterPatients();
  }, [patients, searchTerm, statusFilter]);

  const fetchPatients = async () => {
    if (!businessId) return;
    
    try {
      setDataLoading(true);

      // Single optimized query: fetch patients + last/next appointment via RPC or subselect
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayISO = today.toISOString();

      const { data: patientsData } = await supabase
        .from("patients")
        .select("*")
        .eq("business_id", businessId)
        .order("full_name", { ascending: true });

      if (!patientsData || patientsData.length === 0) {
        setPatients([]);
        return;
      }

      const patientIds = patientsData.map(p => p.id);

      // Batch fetch: last appointments (attended, before today)
      const { data: lastAppts } = await supabase
        .from("appointments")
        .select("patient_id, start_at")
        .in("patient_id", patientIds)
        .eq("status", "attended")
        .lt("start_at", todayISO)
        .order("start_at", { ascending: false });

      // Batch fetch: next appointments (not cancelled/no_show, from today)
      const { data: nextAppts } = await supabase
        .from("appointments")
        .select("patient_id, start_at")
        .in("patient_id", patientIds)
        .not("status", "in", '("cancelled","no_show")')
        .gte("start_at", todayISO)
        .order("start_at", { ascending: true });

      // Build maps: patient_id -> most recent/next appointment
      const lastMap = new Map<string, string>();
      for (const a of lastAppts || []) {
        if (a.patient_id && !lastMap.has(a.patient_id)) {
          lastMap.set(a.patient_id, a.start_at);
        }
      }

      const nextMap = new Map<string, string>();
      for (const a of nextAppts || []) {
        if (a.patient_id && !nextMap.has(a.patient_id)) {
          nextMap.set(a.patient_id, a.start_at);
        }
      }

      const patientsWithAppointments: Patient[] = patientsData.map(p => ({
        ...p,
        last_appointment: lastMap.get(p.id) || null,
        next_appointment: nextMap.get(p.id) || null,
      }));

      setPatients(patientsWithAppointments);
    } catch (error) {
      console.error("Error fetching patients:", error);
      toast({
        title: "Error",
        description: "No se pudo cargar la lista de pacientes",
        variant: "destructive",
      });
    } finally {
      setDataLoading(false);
    }
  };

  const filterPatients = () => {
    let filtered = [...patients];

    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.full_name.toLowerCase().includes(search) ||
          p.email?.toLowerCase().includes(search)
      );
    }

    if (statusFilter === "active") {
      filtered = filtered.filter((p) => p.is_active);
    } else if (statusFilter === "inactive") {
      filtered = filtered.filter((p) => !p.is_active);
    } else if (statusFilter === "portal") {
      filtered = filtered.filter((p) => p.auth_user_id !== null);
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

  if (businessLoading || dataLoading) {
    return <LoadingPage />;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")} className="shrink-0 h-10 w-10">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold">Pacientes</h1>
              <p className="text-sm text-muted-foreground hidden sm:block">
                {filteredPatients.length} {filteredPatients.length === 1 ? 'paciente' : 'pacientes'}{businessName ? ` - ${businessName}` : ''}
              </p>
            </div>
          </div>
          <Button onClick={() => setShowForm(true)} className="h-11 px-4 rounded-xl font-semibold shrink-0">
            <Plus className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Nuevo</span>
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre o email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 h-12 rounded-xl text-base"
            />
          </div>
          <Select 
            value={statusFilter} 
            onValueChange={(value) => {
              setStatusFilter(value);
              if (value === "portal") {
                setSearchParams({ portal: "true" });
              } else {
                setSearchParams({});
              }
            }}
          >
            <SelectTrigger className="w-full sm:w-[200px] h-12 rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="active">Solo activos</SelectItem>
              <SelectItem value="inactive">Solo inactivos</SelectItem>
              <SelectItem value="portal">
                <span className="flex items-center gap-2">
                  <Smartphone className="h-4 w-4" />
                  Con acceso al portal
                </span>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Content */}
        {filteredPatients.length === 0 ? (
          <Card className="mobile-card">
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">No se encontraron pacientes</p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Mobile List */}
            <div className="md:hidden space-y-3">
              {filteredPatients.map((patient) => (
                <Card
                  key={patient.id}
                  className="mobile-card-compact hover:shadow-md transition-shadow cursor-pointer active:scale-[0.99]"
                  onClick={() => navigate(`/patients/${patient.id}`)}
                >
                  <CardContent className="p-4 flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-base font-semibold text-foreground truncate">{patient.full_name}</p>
                        {patient.auth_user_id && (
                          <span title="Tiene acceso al portal"><Smartphone className="h-4 w-4 text-primary shrink-0" /></span>
                        )}
                        {!patient.is_active && (
                          <Badge variant="secondary" className="text-xs shrink-0 rounded-full">Inactivo</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground truncate">
                        {patient.email || patient.whatsapp_phone || "Sin contacto"}
                      </p>
                    </div>
                    <Button variant="ghost" size="icon" className="shrink-0 h-10 w-10">
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Desktop Table */}
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre completo</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>WhatsApp</TableHead>
                    <TableHead>Portal</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Última consulta</TableHead>
                    <TableHead>Próxima consulta</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPatients.map((patient) => (
                    <TableRow key={patient.id}>
                      <TableCell className="font-medium">{patient.full_name}</TableCell>
                      <TableCell>{patient.email || "-"}</TableCell>
                      <TableCell>{patient.whatsapp_phone || "-"}</TableCell>
                      <TableCell>
                        {patient.auth_user_id ? (
                          <span title="Tiene acceso al portal"><Smartphone className="h-4 w-4 text-primary" /></span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={patient.is_active ? "default" : "secondary"}>
                          {patient.is_active ? "Activo" : "Inactivo"}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatDate(patient.last_appointment)}</TableCell>
                      <TableCell>{formatDate(patient.next_appointment)}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="outline" size="sm" onClick={() => navigate(`/patients/${patient.id}`)}>
                          Ver detalle
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </div>

      <PatientForm
        open={showForm}
        onOpenChange={setShowForm}
        onSuccess={() => {
          setShowForm(false);
          fetchPatients();
        }}
      />
    </div>
  );
};

export default Patients;

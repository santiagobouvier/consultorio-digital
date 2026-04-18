import { useEffect, useState, useMemo } from "react";
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
import { Search, Plus, ChevronRight, Smartphone, Users, UserCheck, UserX, ShieldCheck, Download, User as UserIcon } from "lucide-react";
import { exportCSV, todayDateString } from "@/lib/csv-export";
import { useBusinessId } from "@/hooks/use-business-id";
import LoadingPage from "@/components/LoadingPage";
import { cn } from "@/lib/utils";
import { ListPagination, usePagination, ITEMS_PER_PAGE } from "@/components/ListPagination";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface Patient {
  id: string;
  full_name: string;
  email: string | null;
  whatsapp_phone: string | null;
  is_active: boolean;
  auth_user_id: string | null;
  avatar_url: string | null;
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
  const [currentPage, setCurrentPage] = useState(1);
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
    setCurrentPage(1);
  }, [patients, searchTerm, statusFilter]);

  const fetchPatients = async () => {
    if (!businessId) return;
    try {
      setDataLoading(true);
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

      const { data: lastAppts } = await supabase
        .from("appointments")
        .select("patient_id, start_at")
        .in("patient_id", patientIds)
        .eq("status", "attended")
        .lt("start_at", todayISO)
        .order("start_at", { ascending: false });

      const { data: nextAppts } = await supabase
        .from("appointments")
        .select("patient_id, start_at")
        .in("patient_id", patientIds)
        .not("status", "in", '("cancelled","no_show")')
        .gte("start_at", todayISO)
        .order("start_at", { ascending: true });

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

  // Stats
  const stats = useMemo(() => ({
    total: patients.length,
    active: patients.filter(p => p.is_active).length,
    inactive: patients.filter(p => !p.is_active).length,
    portal: patients.filter(p => p.auth_user_id !== null).length,
  }), [patients]);

  const { paginatedItems: pagePatients, totalPages } = usePagination(filteredPatients, currentPage);

  if (businessLoading || dataLoading) {
    return <LoadingPage />;
  }

  const getInitials = (name: string) => {
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">

        {/* Hero Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-semibold tracking-wide uppercase">
            <Users className="h-3.5 w-3.5" />
            Gestión de pacientes
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground">
            Pacientes
          </h1>
          {businessName && (
            <p className="text-sm text-muted-foreground">{businessName}</p>
          )}
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Total", value: stats.total, icon: Users, color: "text-primary", bg: "bg-primary/10" },
            { label: "Activos", value: stats.active, icon: UserCheck, color: "text-[hsl(var(--success))]", bg: "bg-[hsl(var(--success))]/10" },
            { label: "Inactivos", value: stats.inactive, icon: UserX, color: "text-muted-foreground", bg: "bg-muted" },
            { label: "Portal", value: stats.portal, icon: ShieldCheck, color: "text-[hsl(var(--warning))]", bg: "bg-[hsl(var(--warning))]/10" },
          ].map((stat) => (
            <Card key={stat.label} className="border-border/50 shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-4 flex items-center gap-3">
                <div className={cn("p-2.5 rounded-xl", stat.bg)}>
                  <stat.icon className={cn("h-5 w-5", stat.color)} />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground leading-none">{stat.value}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{stat.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Search + Filters Bar */}
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre o email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-11 h-12 rounded-2xl text-base bg-card border-border/50 shadow-sm focus-visible:ring-primary/30 focus-visible:border-primary/50"
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
            <SelectTrigger className="w-full sm:w-[200px] h-12 rounded-2xl border-border/50 shadow-sm bg-card">
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
          <Button
            variant="outline"
            className="h-12 rounded-2xl border-border/50 shadow-sm bg-card gap-2"
            onClick={() => {
              const headers = ["Nombre", "Email", "WhatsApp", "Motivo de consulta", "Estado", "Tiene portal", "Fecha de registro"];
              const rows = filteredPatients.map((p) => [
                p.full_name,
                p.email || "",
                p.whatsapp_phone || "",
                "",
                p.is_active ? "Activo" : "Inactivo",
                p.auth_user_id ? "Sí" : "No",
                new Date((p as any).created_at || "").toLocaleDateString("es-UY") || "",
              ]);
              exportCSV(headers, rows, `pacientes_${todayDateString()}.csv`);
            }}
          >
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">Exportar CSV</span>
          </Button>
        </div>

        {/* Content */}
        {filteredPatients.length === 0 ? (
          <Card className="border-dashed border-2 border-border/50">
            <CardContent className="py-16 text-center space-y-3">
              <div className="mx-auto w-16 h-16 rounded-2xl bg-muted flex items-center justify-center">
                <Users className="h-8 w-8 text-muted-foreground" />
              </div>
              <p className="text-lg font-medium text-muted-foreground">No se encontraron pacientes</p>
              <p className="text-sm text-muted-foreground/70">Ajustá los filtros o agregá un nuevo paciente</p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Mobile Cards */}
            <div className="md:hidden space-y-2.5">
              {pagePatients.map((patient) => (
                <Card
                  key={patient.id}
                  className="border-border/40 shadow-sm hover:shadow-md active:scale-[0.98] transition-all cursor-pointer group"
                  onClick={() => navigate(`/patients/${patient.id}`)}
                >
                  <CardContent className="p-4 flex items-center gap-3">
                    {/* Avatar */}
                    <Avatar className={cn(
                      "shrink-0 h-11 w-11 rounded-xl",
                      patient.is_active ? "ring-1 ring-primary/20" : "opacity-70"
                    )}>
                      {patient.avatar_url && <AvatarImage src={patient.avatar_url} alt={patient.full_name} className="object-cover" />}
                      <AvatarFallback className={cn(
                        "rounded-xl text-sm font-bold",
                        patient.is_active ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                      )}>
                        {getInitials(patient.full_name) || <UserIcon className="h-5 w-5" />}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="text-[15px] font-semibold text-foreground truncate">{patient.full_name}</p>
                        {patient.auth_user_id && (
                          <Smartphone className="h-3.5 w-3.5 text-primary shrink-0" />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {patient.email || patient.whatsapp_phone || "Sin contacto"}
                      </p>
                    </div>
                    {!patient.is_active && (
                      <Badge variant="secondary" className="text-[10px] shrink-0 rounded-full px-2">Inactivo</Badge>
                    )}
                    <ChevronRight className="h-4 w-4 text-muted-foreground/50 shrink-0 group-hover:text-primary transition-colors" />
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Desktop Table */}
            <div className="hidden md:block">
              <Card className="border-border/40 shadow-sm overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30 hover:bg-muted/30">
                      <TableHead className="font-semibold">Paciente</TableHead>
                      <TableHead className="font-semibold">Contacto</TableHead>
                      <TableHead className="font-semibold text-center">Portal</TableHead>
                      <TableHead className="font-semibold text-center">Estado</TableHead>
                      <TableHead className="font-semibold">Última consulta</TableHead>
                      <TableHead className="font-semibold">Próxima consulta</TableHead>
                      <TableHead className="text-right font-semibold">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pagePatients.map((patient) => (
                      <TableRow
                        key={patient.id}
                        className="cursor-pointer hover:bg-primary/[0.03] transition-colors group"
                        onClick={() => navigate(`/patients/${patient.id}`)}
                      >
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              "shrink-0 w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold",
                              patient.is_active
                                ? "bg-primary/10 text-primary"
                                : "bg-muted text-muted-foreground"
                            )}>
                              {getInitials(patient.full_name)}
                            </div>
                            <span className="font-medium">{patient.full_name}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-0.5">
                            <p className="text-sm">{patient.email || "-"}</p>
                            {patient.whatsapp_phone && (
                              <p className="text-xs text-muted-foreground">{patient.whatsapp_phone}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          {patient.auth_user_id ? (
                            <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">
                              <Smartphone className="h-3 w-3" />
                              Activo
                            </div>
                          ) : (
                            <span className="text-muted-foreground/50">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge
                            variant={patient.is_active ? "default" : "secondary"}
                            className={cn(
                              "rounded-full text-xs",
                              patient.is_active && "bg-[hsl(var(--success))] hover:bg-[hsl(var(--success))]/90"
                            )}
                          >
                            {patient.is_active ? "Activo" : "Inactivo"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">{formatDate(patient.last_appointment)}</TableCell>
                        <TableCell className="text-sm">{formatDate(patient.next_appointment)}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-primary hover:text-primary hover:bg-primary/10 rounded-lg"
                            onClick={(e) => { e.stopPropagation(); navigate(`/patients/${patient.id}`); }}
                          >
                            Ver detalle
                            <ChevronRight className="h-3.5 w-3.5 ml-1" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            </div>

            {/* Pagination */}
            <ListPagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
              totalItems={filteredPatients.length}
              pageSize={ITEMS_PER_PAGE}
            />
          </>
        )}
      </div>

      {/* FAB - Nuevo Paciente */}
      <Button
        onClick={() => setShowForm(true)}
        className="fixed bottom-6 right-6 h-14 w-14 sm:w-auto sm:px-6 rounded-2xl shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 transition-all z-40 group"
      >
        <Plus className="h-6 w-6 sm:h-5 sm:w-5" />
        <span className="hidden sm:inline ml-1 font-semibold">Nuevo paciente</span>
      </Button>

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

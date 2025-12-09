import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { toast } from "@/hooks/use-toast";
import {
  Building2,
  Users,
  UserCog,
  DollarSign,
  Plus,
  ArrowLeft,
  Eye,
  UserPlus,
  Settings,
  Power,
  Loader2,
  AlertTriangle,
  ChevronDown,
  BarChart3,
  Copy,
  Check,
  Filter,
  X,
} from "lucide-react";
import { getPlanName, getPlanConfig, checkProfessionalLimit } from "@/hooks/use-plan-limits";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PlanSelector } from "@/components/PlanSelector";

interface BusinessWithDetails {
  id: string;
  name: string;
  owner_user_id: string;
  public_slug: string;
  created_at: string;
  ownerEmail?: string;
  professionalsCount: number;
  patientsCount: number;
  planCode: string;
  isActive: boolean;
  customMaxProfessionals?: number | null;
  customMaxPatients?: number | null;
}

interface SaasMetrics {
  totalBusinesses: number;
  totalProfessionals: number;
  totalPatients: number;
  estimatedRevenue: number;
}

// Plan pricing for revenue calculation
const PLAN_PRICES: Record<string, number> = {
  individual: 29,
  professional: 59,
  advanced: 99,
  enterprise: 199,
  custom: 0, // Custom plans have variable pricing
};

const SUPER_ADMIN_EMAIL = "santib1997@gmail.com";

type PlanFilter = "all" | "individual" | "professional" | "advanced" | "enterprise" | "custom";
type UsageFilter = "all" | "near_limit" | "at_limit";

// Helper to calculate usage percentage and status
const getUsageStatus = (current: number, max: number | null): { percentage: number; status: "ok" | "warning" | "danger" } => {
  if (max === null) return { percentage: 0, status: "ok" };
  const percentage = (current / max) * 100;
  if (percentage >= 100) return { percentage, status: "danger" };
  if (percentage >= 70) return { percentage, status: "warning" };
  return { percentage, status: "ok" };
};

const SaasAdmin = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [businesses, setBusinesses] = useState<BusinessWithDetails[]>([]);
  const [metrics, setMetrics] = useState<SaasMetrics>({
    totalBusinesses: 0,
    totalProfessionals: 0,
    totalPatients: 0,
    estimatedRevenue: 0,
  });
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showProfessionalsModal, setShowProfessionalsModal] = useState(false);
  const [selectedBusiness, setSelectedBusiness] = useState<BusinessWithDetails | null>(null);
  const [professionals, setProfessionals] = useState<any[]>([]);
  const [creating, setCreating] = useState(false);

  // Filters
  const [planFilter, setPlanFilter] = useState<PlanFilter>("all");
  const [usageFilter, setUsageFilter] = useState<UsageFilter>("all");

  // Create business form state
  const [newBusinessName, setNewBusinessName] = useState("");
  const [newBusinessEmail, setNewBusinessEmail] = useState("");
  const [newBusinessPlan, setNewBusinessPlan] = useState("individual");

  // Create professional form state
  const [showAddProfessionalModal, setShowAddProfessionalModal] = useState(false);
  const [newProfName, setNewProfName] = useState("");
  const [newProfEmail, setNewProfEmail] = useState("");
  const [professionalLimitError, setProfessionalLimitError] = useState<string | null>(null);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    checkAccessAndLoad();
  }, []);

  const checkAccessAndLoad = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      // Verify super_admin role
      const { data: superAdminRole } = await supabase
        .from("user_roles")
        .select("id")
        .eq("user_id", user.id)
        .eq("role", "super_admin")
        .maybeSingle();

      if (!superAdminRole) {
        toast({
          title: "Acceso denegado",
          description: "No tienes permisos para acceder a esta sección",
          variant: "destructive",
        });
        navigate("/dashboard");
        return;
      }

      await loadData();
    } catch (error) {
      console.error("Error checking access:", error);
      navigate("/dashboard");
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);

      // Load all businesses
      const { data: businessesData, error: bizError } = await supabase
        .from("businesses")
        .select("*")
        .order("created_at", { ascending: false });

      if (bizError) throw bizError;

      // Load owner profiles for each business
      const ownerIds = [...new Set(businessesData?.map(b => b.owner_user_id) || [])];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, email")
        .in("id", ownerIds);

      const profileMap = new Map(profiles?.map(p => [p.id, p.email]) || []);

      // Load professionals count per business
      const { data: rolesData } = await supabase
        .from("user_roles")
        .select("business_id, role")
        .in("role", ["owner", "professional"]);

      const profCountMap = new Map<string, number>();
      rolesData?.forEach(r => {
        if (r.business_id) {
          profCountMap.set(r.business_id, (profCountMap.get(r.business_id) || 0) + 1);
        }
      });

      // Load patients count per business
      const { data: patientsData } = await supabase
        .from("patients")
        .select("business_id")
        .eq("is_active", true);

      const patientCountMap = new Map<string, number>();
      patientsData?.forEach(p => {
        patientCountMap.set(p.business_id, (patientCountMap.get(p.business_id) || 0) + 1);
      });

      // Build business list with details
      const businessesWithDetails: BusinessWithDetails[] = (businessesData || []).map(b => ({
        ...b,
        ownerEmail: profileMap.get(b.owner_user_id) || "N/A",
        professionalsCount: profCountMap.get(b.id) || 0,
        patientsCount: patientCountMap.get(b.id) || 0,
        planCode: (b as any).plan_code || "individual",
        isActive: (b as any).is_active !== false,
        customMaxProfessionals: (b as any).custom_max_professionals,
        customMaxPatients: (b as any).custom_max_patients,
      }));

      setBusinesses(businessesWithDetails);

      // Calculate metrics including estimated revenue
      const totalProfessionals = rolesData?.length || 0;
      const totalPatients = patientsData?.length || 0;
      
      // Calculate estimated revenue based on plans
      const estimatedRevenue = businessesWithDetails.reduce((sum, b) => {
        return sum + (PLAN_PRICES[b.planCode] || 0);
      }, 0);

      setMetrics({
        totalBusinesses: businessesWithDetails.length,
        totalProfessionals,
        totalPatients,
        estimatedRevenue,
      });
    } catch (error) {
      console.error("Error loading data:", error);
      toast({
        title: "Error",
        description: "No se pudo cargar la información",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateBusiness = async () => {
    if (!newBusinessName.trim() || !newBusinessEmail.trim()) {
      toast({
        title: "Error",
        description: "Nombre y email son requeridos",
        variant: "destructive",
      });
      return;
    }

    try {
      setCreating(true);

      // Check if user exists
      const { data: existingProfile } = await supabase
        .from("profiles")
        .select("id")
        .eq("email", newBusinessEmail.trim().toLowerCase())
        .maybeSingle();

      let ownerId: string;

      if (existingProfile) {
        ownerId = existingProfile.id;
      } else {
        // Create new user via admin API (edge function)
        const { data: newUser, error: createError } = await supabase.functions.invoke(
          "create-professional-invite",
          {
            body: {
              email: newBusinessEmail.trim().toLowerCase(),
              name: newBusinessName.trim(),
              businessId: null, // Will be set after business creation
              isNewOwner: true,
            },
          }
        );

        if (createError) throw createError;
        ownerId = newUser.userId;
      }

      // Create business
      const slug = newBusinessName
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-]/g, "")
        + "-" + Date.now().toString(36);

      const { data: business, error: bizError } = await supabase
        .from("businesses")
        .insert({
          name: newBusinessName.trim(),
          owner_user_id: ownerId,
          public_slug: slug,
          contact_email: newBusinessEmail.trim().toLowerCase(),
          plan_code: newBusinessPlan,
        })
        .select()
        .single();

      if (bizError) throw bizError;

      // Create owner role
      await supabase.from("user_roles").insert({
        user_id: ownerId,
        role: "owner",
        business_id: business.id,
      });

      toast({
        title: "Consultorio creado",
        description: `El consultorio "${newBusinessName}" ha sido creado exitosamente`,
      });

      setShowCreateModal(false);
      setNewBusinessName("");
      setNewBusinessEmail("");
      setNewBusinessPlan("individual");
      await loadData();
    } catch (error: any) {
      console.error("Error creating business:", error);
      toast({
        title: "Error",
        description: error.message || "No se pudo crear el consultorio",
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  const loadProfessionals = async (business: BusinessWithDetails) => {
    setSelectedBusiness(business);
    setShowProfessionalsModal(true);

    try {
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .eq("business_id", business.id)
        .in("role", ["owner", "professional"]);

      if (roles && roles.length > 0) {
        const userIds = roles.map(r => r.user_id);
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, name, email")
          .in("id", userIds);

        const profsWithRoles = roles.map(r => {
          const profile = profiles?.find(p => p.id === r.user_id);
          return {
            userId: r.user_id,
            role: r.role,
            name: profile?.name || "Sin nombre",
            email: profile?.email || "Sin email",
          };
        });

        setProfessionals(profsWithRoles);
      } else {
        setProfessionals([]);
      }
    } catch (error) {
      console.error("Error loading professionals:", error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los profesionales",
        variant: "destructive",
      });
    }
  };

  const handleAddProfessional = async () => {
    if (!selectedBusiness || !newProfName.trim()) {
      toast({
        title: "Error",
        description: "El nombre es requerido",
        variant: "destructive",
      });
      return;
    }

    try {
      setCreating(true);
      setProfessionalLimitError(null);

      // Check plan limits first
      const limitCheck = await checkProfessionalLimit(selectedBusiness.id);
      if (!limitCheck.canAdd) {
        setProfessionalLimitError(limitCheck.message || "Límite alcanzado");
        setCreating(false);
        return;
      }

      const { data, error } = await supabase.functions.invoke("create-professional-invite", {
        body: {
          email: newProfEmail.trim().toLowerCase() || undefined,
          name: newProfName.trim(),
          businessId: selectedBusiness.id,
        },
      });

      if (error) throw error;

      // If email was provided, show the invite link
      if (newProfEmail && data?.token) {
        const baseUrl = window.location.origin;
        const link = `${baseUrl}/invitar-profesional?token=${data.token}`;
        setInviteLink(link);
        toast({
          title: "Invitación creada",
          description: "Copia el enlace y envíalo al profesional.",
        });
      } else {
        toast({
          title: "Profesional agregado",
          description: "El profesional ha sido agregado al consultorio",
        });
        setShowAddProfessionalModal(false);
        setNewProfName("");
        setNewProfEmail("");
        setProfessionalLimitError(null);
      }
      
      await loadProfessionals(selectedBusiness);
      await loadData();
    } catch (error: any) {
      console.error("Error adding professional:", error);
      toast({
        title: "Error",
        description: error.message || "No se pudo agregar el profesional",
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  const handleChangePlan = async (businessId: string, newPlanCode: string, customLimits?: { maxProfessionals?: number | null; maxPatients?: number | null }) => {
    try {
      const updateData: any = { plan_code: newPlanCode };
      
      if (newPlanCode === "custom" && customLimits) {
        updateData.custom_max_professionals = customLimits.maxProfessionals;
        updateData.custom_max_patients = customLimits.maxPatients;
      }

      const { error } = await supabase
        .from("businesses")
        .update(updateData)
        .eq("id", businessId);

      if (error) throw error;

      toast({
        title: "Plan actualizado",
        description: `El plan ha sido cambiado a ${getPlanName(newPlanCode)}`,
      });

      await loadData();
    } catch (error: any) {
      console.error("Error changing plan:", error);
      toast({
        title: "Error",
        description: error.message || "No se pudo cambiar el plan",
        variant: "destructive",
      });
    }
  };

  const enterBusiness = (businessId: string) => {
    // Store the selected business and redirect to dashboard
    sessionStorage.setItem("saas_selected_business", businessId);
    navigate("/dashboard");
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("es-UY", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  // Filter businesses
  const filteredBusinesses = useMemo(() => {
    return businesses.filter((business) => {
      // Plan filter
      if (planFilter !== "all" && business.planCode !== planFilter) {
        return false;
      }

      // Usage filter
      if (usageFilter !== "all") {
        const customLimits = business.planCode === "custom" ? {
          maxProfessionals: business.customMaxProfessionals ?? null,
          maxPatients: business.customMaxPatients ?? null,
        } : undefined;
        const config = getPlanConfig(business.planCode, customLimits);
        
        const profStatus = getUsageStatus(business.professionalsCount, config.maxProfessionals);
        const patientStatus = getUsageStatus(business.patientsCount, config.maxPatients);

        if (usageFilter === "near_limit") {
          // Show businesses with 70%+ usage in either category
          return profStatus.status === "warning" || profStatus.status === "danger" || 
                 patientStatus.status === "warning" || patientStatus.status === "danger";
        }
        if (usageFilter === "at_limit") {
          // Show businesses at 100% usage
          return profStatus.status === "danger" || patientStatus.status === "danger";
        }
      }

      return true;
    });
  }, [businesses, planFilter, usageFilter]);

  const hasActiveFilters = planFilter !== "all" || usageFilter !== "all";

  const clearFilters = () => {
    setPlanFilter("all");
    setUsageFilter("all");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/dashboard")}
              className="h-10 w-10"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Panel SaaS</h1>
              <p className="text-sm text-muted-foreground">
                Administración global del sistema
              </p>
            </div>
          </div>
          <Badge variant="default" className="bg-primary">
            Super Admin
          </Badge>
        </div>

        {/* Create Business Button */}
        <Button
          className="w-full h-12 rounded-xl font-semibold gap-2"
          onClick={() => setShowCreateModal(true)}
        >
          <Plus className="h-5 w-5" />
          Crear nuevo consultorio
        </Button>

        {/* Businesses Table with Filters */}
        <Card className="mobile-card">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-bold">
                Consultorios
                {hasActiveFilters && (
                  <Badge variant="secondary" className="ml-2">
                    {filteredBusinesses.length} de {businesses.length}
                  </Badge>
                )}
              </CardTitle>
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters} className="h-8 gap-1">
                  <X className="h-3 w-3" />
                  Limpiar
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 pt-0 space-y-4">
            {/* Filters */}
            <div className="flex flex-wrap gap-3 pb-4 border-b">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Filtros:</span>
              </div>
              <Select value={planFilter} onValueChange={(v) => setPlanFilter(v as PlanFilter)}>
                <SelectTrigger className="w-[180px] h-8">
                  <SelectValue placeholder="Plan" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los planes</SelectItem>
                  <SelectItem value="individual">Individual</SelectItem>
                  <SelectItem value="professional">Profesional</SelectItem>
                  <SelectItem value="advanced">Avanzada</SelectItem>
                  <SelectItem value="enterprise">Enterprise</SelectItem>
                  <SelectItem value="custom">Personalizado</SelectItem>
                </SelectContent>
              </Select>
              <Select value={usageFilter} onValueChange={(v) => setUsageFilter(v as UsageFilter)}>
                <SelectTrigger className="w-[180px] h-8">
                  <SelectValue placeholder="Uso del plan" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todo el uso</SelectItem>
                  <SelectItem value="near_limit">Cerca del límite (≥70%)</SelectItem>
                  <SelectItem value="at_limit">En el límite (100%)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Consultorio</TableHead>
                    <TableHead className="hidden sm:table-cell">Dueño</TableHead>
                    <TableHead className="hidden md:table-cell">Plan</TableHead>
                    <TableHead className="text-center">Profs.</TableHead>
                    <TableHead className="text-center">Pacientes</TableHead>
                    <TableHead className="hidden lg:table-cell">Creado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredBusinesses.map((business) => {
                    const customLimits = business.planCode === "custom" ? {
                      maxProfessionals: business.customMaxProfessionals ?? null,
                      maxPatients: business.customMaxPatients ?? null,
                    } : undefined;
                    const config = getPlanConfig(business.planCode, customLimits);
                    const profStatus = getUsageStatus(business.professionalsCount, config.maxProfessionals);
                    const patientStatus = getUsageStatus(business.patientsCount, config.maxPatients);

                    return (
                      <TableRow key={business.id}>
                        <TableCell className="font-medium">
                          <div>
                            <p className="font-semibold">{business.name}</p>
                            <p className="text-xs text-muted-foreground sm:hidden">
                              {business.ownerEmail}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell text-sm">
                          {business.ownerEmail}
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <PlanSelector
                            businessId={business.id}
                            currentPlan={business.planCode}
                            customMaxProfessionals={business.customMaxProfessionals}
                            customMaxPatients={business.customMaxPatients}
                            onChangePlan={handleChangePlan}
                          />
                        </TableCell>
                        <TableCell className="text-center">
                          <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md ${
                            profStatus.status === "danger" 
                              ? "bg-destructive/10 text-destructive" 
                              : profStatus.status === "warning"
                                ? "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400"
                                : ""
                          }`}>
                            {profStatus.status === "danger" && (
                              <AlertTriangle className="h-3 w-3" />
                            )}
                            <span className="font-medium">
                              {business.professionalsCount}
                              {config.maxProfessionals !== null 
                                ? `/${config.maxProfessionals}` 
                                : " (∞)"}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md ${
                            patientStatus.status === "danger" 
                              ? "bg-destructive/10 text-destructive" 
                              : patientStatus.status === "warning"
                                ? "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400"
                                : ""
                          }`}>
                            {patientStatus.status === "danger" && (
                              <AlertTriangle className="h-3 w-3" />
                            )}
                            <span className="font-medium">
                              {business.patientsCount}
                              {config.maxPatients !== null 
                                ? `/${config.maxPatients}` 
                                : " (∞)"}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                          {formatDate(business.created_at)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => enterBusiness(business.id)}
                              title="Ingresar al consultorio"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => loadProfessionals(business)}
                              title="Ver profesionales"
                            >
                              <UserCog className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {filteredBusinesses.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        {hasActiveFilters 
                          ? "No hay consultorios que coincidan con los filtros" 
                          : "No hay consultorios registrados"}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Metrics - Now in Collapsible at the end */}
        <Collapsible>
          <CollapsibleTrigger asChild>
            <Button variant="outline" className="w-full justify-between h-12 rounded-xl">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                <span>Ver métricas del sistema</span>
              </div>
              <ChevronDown className="h-4 w-4 transition-transform duration-200 group-data-[state=open]:rotate-180" />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-4">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="mobile-card-compact">
                <CardContent className="p-4 text-center">
                  <Building2 className="h-8 w-8 mx-auto text-primary mb-2" />
                  <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">
                    Consultorios
                  </p>
                  <p className="text-3xl font-bold text-foreground mt-1">
                    {metrics.totalBusinesses}
                  </p>
                </CardContent>
              </Card>

              <Card className="mobile-card-compact">
                <CardContent className="p-4 text-center">
                  <UserCog className="h-8 w-8 mx-auto text-primary mb-2" />
                  <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">
                    Profesionales
                  </p>
                  <p className="text-3xl font-bold text-foreground mt-1">
                    {metrics.totalProfessionals}
                  </p>
                </CardContent>
              </Card>

              <Card className="mobile-card-compact">
                <CardContent className="p-4 text-center">
                  <Users className="h-8 w-8 mx-auto text-primary mb-2" />
                  <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">
                    Pacientes
                  </p>
                  <p className="text-3xl font-bold text-foreground mt-1">
                    {metrics.totalPatients}
                  </p>
                </CardContent>
              </Card>

              <Card className="mobile-card-compact">
                <CardContent className="p-4 text-center">
                  <DollarSign className="h-8 w-8 mx-auto text-green-600 mb-2" />
                  <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">
                    Ingresos est.
                  </p>
                  <p className="text-3xl font-bold text-green-600 mt-1">
                    ${metrics.estimatedRevenue}
                  </p>
                </CardContent>
              </Card>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>

      {/* Create Business Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Crear nuevo consultorio</DialogTitle>
            <DialogDescription>
              Ingresa los datos del nuevo consultorio y su dueño
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="businessName">Nombre del consultorio</Label>
              <Input
                id="businessName"
                value={newBusinessName}
                onChange={(e) => setNewBusinessName(e.target.value)}
                placeholder="Ej: Consultorio Dr. García"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ownerEmail">Email del dueño</Label>
              <Input
                id="ownerEmail"
                type="email"
                value={newBusinessEmail}
                onChange={(e) => setNewBusinessEmail(e.target.value)}
                placeholder="email@ejemplo.com"
              />
              <p className="text-xs text-muted-foreground">
                Si el email ya existe, se asignará ese usuario. Si no, se creará uno nuevo.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="plan">Plan</Label>
              <Select value={newBusinessPlan} onValueChange={setNewBusinessPlan}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar plan" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="individual">Consultorio Individual (1 prof, 80 pac)</SelectItem>
                  <SelectItem value="professional">Consultorio Profesional (3 prof, 300 pac)</SelectItem>
                  <SelectItem value="advanced">Clínica Avanzada (7 prof, 800 pac)</SelectItem>
                  <SelectItem value="enterprise">Enterprise (ilimitado)</SelectItem>
                  <SelectItem value="custom">Personalizado (límites manuales)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setShowCreateModal(false)}
            >
              Cancelar
            </Button>
            <Button
              className="flex-1"
              onClick={handleCreateBusiness}
              disabled={creating}
            >
              {creating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Crear consultorio
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Professionals Modal */}
      <Dialog open={showProfessionalsModal} onOpenChange={setShowProfessionalsModal}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              Profesionales de {selectedBusiness?.name}
            </DialogTitle>
            <DialogDescription>
              Gestiona el equipo de profesionales de este consultorio
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {professionals.map((prof) => (
                <div
                  key={prof.userId}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                >
                  <div>
                    <p className="font-medium">{prof.name}</p>
                    <p className="text-sm text-muted-foreground">{prof.email}</p>
                  </div>
                  <Badge variant={prof.role === "owner" ? "default" : "secondary"}>
                    {prof.role === "owner" ? "Dueño" : "Profesional"}
                  </Badge>
                </div>
              ))}
              {professionals.length === 0 && (
                <p className="text-center text-muted-foreground py-4">
                  No hay profesionales registrados
                </p>
              )}
            </div>
            <Button
              className="w-full mt-4 gap-2"
              onClick={() => setShowAddProfessionalModal(true)}
            >
              <UserPlus className="h-4 w-4" />
              Agregar profesional
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Professional Modal */}
      <Dialog 
        open={showAddProfessionalModal} 
        onOpenChange={(open) => {
          if (!open) {
            setInviteLink(null);
            setCopied(false);
            setNewProfName("");
            setNewProfEmail("");
            setProfessionalLimitError(null);
          }
          setShowAddProfessionalModal(open);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {inviteLink ? "Enlace de invitación" : "Agregar profesional"}
            </DialogTitle>
            <DialogDescription>
              {inviteLink 
                ? "Copia el enlace y envíalo al profesional por WhatsApp o email."
                : `Agrega un nuevo profesional a ${selectedBusiness?.name}`
              }
            </DialogDescription>
          </DialogHeader>

          {!inviteLink ? (
            <>
              <div className="space-y-4 py-4">
                {professionalLimitError && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>{professionalLimitError}</AlertDescription>
                  </Alert>
                )}
                <div className="space-y-2">
                  <Label htmlFor="profName">Nombre</Label>
                  <Input
                    id="profName"
                    value={newProfName}
                    onChange={(e) => setNewProfName(e.target.value)}
                    placeholder="Nombre completo"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="profEmail">Email (opcional)</Label>
                  <Input
                    id="profEmail"
                    type="email"
                    value={newProfEmail}
                    onChange={(e) => setNewProfEmail(e.target.value)}
                    placeholder="email@ejemplo.com"
                  />
                  <p className="text-xs text-muted-foreground">
                    Si se proporciona email, se generará un link de invitación
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowAddProfessionalModal(false)}
                >
                  Cancelar
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleAddProfessional}
                  disabled={creating}
                >
                  {creating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Agregar
                </Button>
              </div>
            </>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Enlace de invitación</Label>
                <div className="p-3 bg-muted rounded-md text-sm break-all font-mono">
                  {inviteLink}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setShowAddProfessionalModal(false);
                    setInviteLink(null);
                    setCopied(false);
                    setNewProfName("");
                    setNewProfEmail("");
                  }}
                >
                  Cerrar
                </Button>
                <Button 
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(inviteLink);
                      setCopied(true);
                      toast({
                        title: "Enlace copiado",
                        description: "El enlace ha sido copiado al portapapeles.",
                      });
                      setTimeout(() => setCopied(false), 2000);
                    } catch {
                      toast({
                        title: "Error",
                        description: "No se pudo copiar el enlace.",
                        variant: "destructive",
                      });
                    }
                  }} 
                  className="gap-2"
                >
                  {copied ? (
                    <>
                      <Check className="h-4 w-4" />
                      Copiado
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" />
                      Copiar enlace
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SaasAdmin;

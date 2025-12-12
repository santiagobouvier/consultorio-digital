import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
  Globe,
  Shield,
  Sparkles,
  Play,
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
  billingPeriod: string;
  // Private clinic fields - used for custom domain/subdomain patient portal add-on
  isPrivateClinic: boolean;
  customSubdomain?: string | null;
  customDomain?: string | null;
  // Demo flag
  isDemo: boolean;
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

  // Private clinic modal state
  const [showPrivateClinicModal, setShowPrivateClinicModal] = useState(false);
  const [editingPrivateClinic, setEditingPrivateClinic] = useState<{
    isPrivateClinic: boolean;
    customSubdomain: string;
    customDomain: string;
  }>({ isPrivateClinic: false, customSubdomain: "", customDomain: "" });
  const [savingPrivateClinic, setSavingPrivateClinic] = useState(false);

  // Demo creation state
  const [creatingDemo, setCreatingDemo] = useState(false);

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
        billingPeriod: (b as any).billing_period || "annual",
        // Private clinic fields for custom domain patient portal
        isPrivateClinic: (b as any).is_private_clinic || false,
        customSubdomain: (b as any).custom_subdomain || null,
        customDomain: (b as any).custom_domain || null,
        // Demo flag
        isDemo: (b as any).is_demo || false,
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

  // Open private clinic modal with business data
  const openPrivateClinicModal = (business: BusinessWithDetails) => {
    setSelectedBusiness(business);
    setEditingPrivateClinic({
      isPrivateClinic: business.isPrivateClinic,
      customSubdomain: business.customSubdomain || "",
      customDomain: business.customDomain || "",
    });
    setShowPrivateClinicModal(true);
  };

  // Helper to compute portal URL based on private clinic settings
  const getPortalUrl = (business: BusinessWithDetails): string => {
    if (business.customDomain) {
      return `https://${business.customDomain}`;
    }
    if (business.customSubdomain) {
      // TODO: Replace with actual SaaS base domain when configured
      return `https://${business.customSubdomain}.tudominio.com`;
    }
    return `${window.location.origin}/portal-paciente`;
  };

  // Save private clinic settings
  const handleSavePrivateClinic = async () => {
    if (!selectedBusiness) return;

    try {
      setSavingPrivateClinic(true);

      const { error } = await supabase
        .from("businesses")
        .update({
          is_private_clinic: editingPrivateClinic.isPrivateClinic,
          custom_subdomain: editingPrivateClinic.customSubdomain.trim() || null,
          custom_domain: editingPrivateClinic.customDomain.trim() || null,
        })
        .eq("id", selectedBusiness.id);

      if (error) throw error;

      toast({
        title: "Configuración guardada",
        description: "Los datos del consultorio privado se actualizaron correctamente",
      });

      setShowPrivateClinicModal(false);
      await loadData();
    } catch (error: any) {
      console.error("Error saving private clinic settings:", error);
      toast({
        title: "Error",
        description: error.message || "No se pudo guardar la configuración",
        variant: "destructive",
      });
    } finally {
      setSavingPrivateClinic(false);
    }
  };

  const enterBusiness = (businessIdToEnter: string) => {
    // Store the selected business and redirect to dashboard
    sessionStorage.setItem("saas_selected_business", businessIdToEnter);
    navigate("/dashboard");
  };

  // Check if demo business exists
  const demoBusinessExists = businesses.some(b => b.isDemo);
  const demoBusiness = businesses.find(b => b.isDemo);

  // Create demo business with all sample data
  const handleCreateDemo = async () => {
    try {
      setCreatingDemo(true);

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No user");

      // 1. Create demo business
      const { data: business, error: bizError } = await supabase
        .from("businesses")
        .insert({
          name: "Demo Psicología",
          owner_user_id: user.id,
          public_slug: "demo-psicologia-" + Date.now().toString(36),
          contact_email: "demo@demo.local",
          plan_code: "professional",
          specialty: "Psicología",
          timezone: "America/Montevideo",
          is_active: true,
          onboarding_completed: true,
          is_demo: true,
        })
        .select()
        .single();

      if (bizError) throw bizError;
      const businessId = business.id;

      // 2. Create clinic settings
      await supabase.from("clinic_settings").insert({
        user_id: user.id,
        clinic_name: "Demo Psicología",
        specialty: "Psicología clínica y terapia",
        welcome_message: "Bienvenido/a al consultorio demo. Este es un espacio de demostración para explorar todas las funcionalidades del sistema.",
      });

      // 3. Create demo patients
      const patients = [
        { full_name: "Sofía Martínez", email: "sofia.demo@demo.local", whatsapp_phone: "+598991111111" },
        { full_name: "Juan Rodríguez", email: "juan.demo@demo.local", whatsapp_phone: "+598992222222" },
        { full_name: "Camila Fernández", email: "camila.demo@demo.local", whatsapp_phone: "+598993333333" },
      ];

      const { data: createdPatients, error: patErr } = await supabase
        .from("patients")
        .insert(patients.map(p => ({ ...p, business_id: businessId, is_active: true })))
        .select();

      if (patErr) throw patErr;

      // 4. Create appointments (mix of statuses)
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dayAfter = new Date(now);
      dayAfter.setDate(dayAfter.getDate() + 3);
      const lastWeek1 = new Date(now);
      lastWeek1.setDate(lastWeek1.getDate() - 5);
      const lastWeek2 = new Date(now);
      lastWeek2.setDate(lastWeek2.getDate() - 7);
      const lastWeek3 = new Date(now);
      lastWeek3.setDate(lastWeek3.getDate() - 3);

      const setTime = (d: Date, h: number, m: number) => {
        const nd = new Date(d);
        nd.setHours(h, m, 0, 0);
        return nd;
      };

      const appointments = [
        // Future appointments
        { patient_id: createdPatients[0].id, start_at: setTime(tomorrow, 10, 0).toISOString(), end_at: setTime(tomorrow, 11, 0).toISOString(), status: "confirmed", modality: "presencial" },
        { patient_id: createdPatients[1].id, start_at: setTime(dayAfter, 15, 0).toISOString(), end_at: setTime(dayAfter, 16, 0).toISOString(), status: "pending", modality: "online" },
        // Past appointments
        { patient_id: createdPatients[0].id, start_at: setTime(lastWeek1, 11, 0).toISOString(), end_at: setTime(lastWeek1, 12, 0).toISOString(), status: "attended", modality: "presencial" },
        { patient_id: createdPatients[2].id, start_at: setTime(lastWeek2, 9, 0).toISOString(), end_at: setTime(lastWeek2, 10, 0).toISOString(), status: "attended", modality: "online" },
        // Cancelled
        { patient_id: createdPatients[1].id, start_at: setTime(lastWeek3, 14, 0).toISOString(), end_at: setTime(lastWeek3, 15, 0).toISOString(), status: "cancelled", modality: "presencial" },
      ];

      await supabase.from("appointments").insert(
        appointments.map(a => ({ ...a, business_id: businessId }))
      );

      // 5. Create payments with varied statuses
      const dueGreen = new Date(now);
      dueGreen.setDate(dueGreen.getDate() + 15);
      const dueOrange = new Date(now);
      dueOrange.setDate(dueOrange.getDate() + 3);
      const dueRed = new Date(now);
      dueRed.setDate(dueRed.getDate() - 5);

      const payments = [
        // Green - Al día (paid)
        { patient_id: createdPatients[0].id, amount: 1500, due_date: dueGreen.toISOString(), status: "paid", paid_at: new Date().toISOString(), currency: "UYU" },
        // Orange - Por vencer
        { patient_id: createdPatients[1].id, amount: 1500, due_date: dueOrange.toISOString(), status: "pending", paid_at: null, currency: "UYU" },
        // Red - Vencido
        { patient_id: createdPatients[2].id, amount: 1500, due_date: dueRed.toISOString(), status: "pending", paid_at: null, currency: "UYU" },
      ];

      await supabase.from("payments").insert(
        payments.map(p => ({ ...p, business_id: businessId, recurrence_type: "one_time" }))
      );

      // 6. Create availability slots for next 7 days (weekdays only)
      const slots: any[] = [];
      for (let i = 1; i <= 7; i++) {
        const slotDate = new Date(now);
        slotDate.setDate(slotDate.getDate() + i);
        const dayOfWeek = slotDate.getDay();
        // Skip weekends (0 = Sunday, 6 = Saturday)
        if (dayOfWeek === 0 || dayOfWeek === 6) continue;

        const dateStr = slotDate.toISOString().split("T")[0];
        // Morning slot
        slots.push({
          business_id: businessId,
          date: dateStr,
          start_time: "09:00",
          end_time: "12:00",
          modality: "presencial",
          status: "available",
        });
        // Afternoon slot
        slots.push({
          business_id: businessId,
          date: dateStr,
          start_time: "14:00",
          end_time: "18:00",
          modality: "online",
          status: "available",
        });
      }

      if (slots.length > 0) {
        await supabase.from("availability_slots").insert(slots);
      }

      toast({
        title: "Demo creado",
        description: "El consultorio demo ha sido creado con todos los datos de ejemplo.",
      });

      await loadData();
    } catch (error: any) {
      console.error("Error creating demo:", error);
      toast({
        title: "Error",
        description: error.message || "No se pudo crear el demo",
        variant: "destructive",
      });
    } finally {
      setCreatingDemo(false);
    }
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

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Button
            className="flex-1 h-12 rounded-xl font-semibold gap-2"
            onClick={() => setShowCreateModal(true)}
          >
            <Plus className="h-5 w-5" />
            Crear nuevo consultorio
          </Button>
          
          {/* Demo Button */}
          {demoBusinessExists ? (
            <Button
              variant="outline"
              className="flex-1 h-12 rounded-xl font-semibold gap-2 border-amber-500/50 text-amber-600 hover:bg-amber-500/10"
              onClick={() => demoBusiness && enterBusiness(demoBusiness.id)}
            >
              <Play className="h-5 w-5" />
              Entrar a DEMO
            </Button>
          ) : (
            <Button
              variant="outline"
              className="flex-1 h-12 rounded-xl font-semibold gap-2 border-amber-500/50 text-amber-600 hover:bg-amber-500/10"
              onClick={handleCreateDemo}
              disabled={creatingDemo}
            >
              {creatingDemo ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Sparkles className="h-5 w-5" />
              )}
              {creatingDemo ? "Creando demo..." : "Crear consultorio DEMO"}
            </Button>
          )}
        </div>

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
                    <TableHead className="hidden lg:table-cell text-center">Privado</TableHead>
                    <TableHead className="hidden lg:table-cell text-center">Estado</TableHead>
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
                    
                    // Overall status: worst of prof and patient status
                    const overallStatus = profStatus.status === "danger" || patientStatus.status === "danger" 
                      ? "danger" 
                      : profStatus.status === "warning" || patientStatus.status === "warning"
                        ? "warning"
                        : "ok";

                    return (
                      <TableRow key={business.id} className={!business.isActive ? "opacity-60" : ""}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="font-semibold truncate">{business.name}</p>
                                {business.isDemo && (
                                  <Badge className="text-xs shrink-0 bg-amber-500/20 text-amber-600 hover:bg-amber-500/30 border-amber-500/30">
                                    <Sparkles className="h-3 w-3 mr-1" />
                                    DEMO
                                  </Badge>
                                )}
                                {!business.isActive && (
                                  <Badge variant="secondary" className="text-xs shrink-0">
                                    Inactivo
                                  </Badge>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground sm:hidden truncate">
                                {business.ownerEmail}
                              </p>
                              <div className="flex items-center gap-2 mt-0.5 md:hidden">
                                <Badge variant="outline" className="text-xs">
                                  {getPlanName(business.planCode)}
                                </Badge>
                                <span className="text-xs text-muted-foreground">
                                  {business.billingPeriod === "monthly" ? "Mensual" : "Anual"}
                                </span>
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell text-sm">
                          {business.ownerEmail}
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <div className="space-y-1">
                            <PlanSelector
                              businessId={business.id}
                              currentPlan={business.planCode}
                              customMaxProfessionals={business.customMaxProfessionals}
                              customMaxPatients={business.customMaxPatients}
                              onChangePlan={handleChangePlan}
                            />
                            <p className="text-xs text-muted-foreground">
                              {business.billingPeriod === "monthly" ? "Mensual" : "Anual"}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md ${
                            profStatus.status === "danger" 
                              ? "bg-destructive/10 text-destructive" 
                              : profStatus.status === "warning"
                                ? "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400"
                                : "bg-green-500/10 text-green-700 dark:text-green-400"
                          }`}>
                            {profStatus.status === "danger" && (
                              <AlertTriangle className="h-3 w-3" />
                            )}
                            <span className="font-medium text-sm">
                              {business.professionalsCount}
                              {config.maxProfessionals !== null 
                                ? `/${config.maxProfessionals}` 
                                : " ∞"}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md ${
                            patientStatus.status === "danger" 
                              ? "bg-destructive/10 text-destructive" 
                              : patientStatus.status === "warning"
                                ? "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400"
                                : "bg-green-500/10 text-green-700 dark:text-green-400"
                          }`}>
                            {patientStatus.status === "danger" && (
                              <AlertTriangle className="h-3 w-3" />
                            )}
                            <span className="font-medium text-sm">
                              {business.patientsCount}
                              {config.maxPatients !== null 
                                ? `/${config.maxPatients}` 
                                : " ∞"}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-center">
                          {business.isPrivateClinic ? (
                            <Badge 
                              variant="default" 
                              className="bg-primary/10 text-primary hover:bg-primary/20 cursor-pointer gap-1"
                              onClick={() => openPrivateClinicModal(business)}
                            >
                              <Shield className="h-3 w-3" />
                              Sí
                            </Badge>
                          ) : (
                            <Badge 
                              variant="secondary" 
                              className="cursor-pointer"
                              onClick={() => openPrivateClinicModal(business)}
                            >
                              No
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-center">
                          <Badge 
                            variant={overallStatus === "ok" ? "default" : "secondary"}
                            className={
                              overallStatus === "danger" 
                                ? "bg-destructive/10 text-destructive hover:bg-destructive/20"
                                : overallStatus === "warning"
                                  ? "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 hover:bg-yellow-500/20"
                                  : "bg-green-500/10 text-green-700 dark:text-green-400 hover:bg-green-500/20"
                            }
                          >
                            {overallStatus === "danger" 
                              ? "Límite" 
                              : overallStatus === "warning" 
                                ? "Cerca" 
                                : "OK"}
                          </Badge>
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
                              onClick={() => openPrivateClinicModal(business)}
                              title="Configurar dominio privado"
                            >
                              <Globe className="h-4 w-4" />
                            </Button>
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
                      <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
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

      {/* Private Clinic Settings Modal */}
      <Dialog open={showPrivateClinicModal} onOpenChange={setShowPrivateClinicModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              Consultorio Privado
            </DialogTitle>
            <DialogDescription>
              Configura el dominio personalizado para el portal de pacientes de {selectedBusiness?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Private Clinic Toggle */}
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <div className="space-y-0.5">
                <Label className="text-sm font-semibold">Consultorio privado</Label>
                <p className="text-xs text-muted-foreground">
                  Activa para habilitar dominio personalizado
                </p>
              </div>
              <Switch
                checked={editingPrivateClinic.isPrivateClinic}
                onCheckedChange={(checked) =>
                  setEditingPrivateClinic({ ...editingPrivateClinic, isPrivateClinic: checked })
                }
              />
            </div>

            {/* Subdomain */}
            <div className="space-y-2">
              <Label htmlFor="customSubdomain">Subdominio personalizado</Label>
              <div className="flex items-center gap-1">
                <Input
                  id="customSubdomain"
                  value={editingPrivateClinic.customSubdomain}
                  onChange={(e) =>
                    setEditingPrivateClinic({ ...editingPrivateClinic, customSubdomain: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") })
                  }
                  placeholder="psilaura"
                  className="flex-1"
                />
                <span className="text-sm text-muted-foreground whitespace-nowrap">.tudominio.com</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Solo letras minúsculas, números y guiones
              </p>
            </div>

            {/* Custom Domain */}
            <div className="space-y-2">
              <Label htmlFor="customDomain">Dominio propio (opcional)</Label>
              <Input
                id="customDomain"
                value={editingPrivateClinic.customDomain}
                onChange={(e) =>
                  setEditingPrivateClinic({ ...editingPrivateClinic, customDomain: e.target.value.toLowerCase() })
                }
                placeholder="psicologalaura.com"
              />
              <p className="text-xs text-muted-foreground">
                Dominio completo si el cliente tiene uno propio
              </p>
            </div>

            {/* Computed Portal URL (read-only) */}
            {selectedBusiness && (editingPrivateClinic.customDomain || editingPrivateClinic.customSubdomain) && (
              <div className="space-y-2">
                <Label>URL del portal (calculada)</Label>
                <div className="p-3 bg-muted rounded-md text-sm font-mono break-all">
                  {editingPrivateClinic.customDomain 
                    ? `https://${editingPrivateClinic.customDomain}`
                    : editingPrivateClinic.customSubdomain
                      ? `https://${editingPrivateClinic.customSubdomain}.tudominio.com`
                      : "—"
                  }
                </div>
                <p className="text-xs text-muted-foreground">
                  ⚠️ Esta URL es solo informativa. La configuración real de DNS se hará más adelante.
                </p>
              </div>
            )}
          </div>
          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setShowPrivateClinicModal(false)}
            >
              Cancelar
            </Button>
            <Button
              className="flex-1"
              onClick={handleSavePrivateClinic}
              disabled={savingPrivateClinic}
            >
              {savingPrivateClinic && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Guardar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SaasAdmin;

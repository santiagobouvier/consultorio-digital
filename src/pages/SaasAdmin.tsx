import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
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
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
  Trash2,
  Pencil,
  Search,
  MoreHorizontal,
  LogIn,
  Calendar,
  Rows3,
  LayoutGrid,
} from "lucide-react";
import { getPlanName, getPlanConfig, checkProfessionalLimit } from "@/hooks/use-plan-limits";
import { 
  PLAN_DEFINITIONS, 
  PLAN_ORDER, 
  getPlanPrice, 
  normalizePlanCode 
} from "@/lib/plan-definitions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PlanSelector } from "@/components/PlanSelector";
import { useIsMobile } from "@/hooks/use-mobile";

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
  isPrivateClinic: boolean;
  customSubdomain?: string | null;
  customDomain?: string | null;
  isDemo: boolean;
}

interface SaasMetrics {
  totalBusinesses: number;
  totalProfessionals: number;
  totalPatients: number;
  estimatedRevenue: number;
}

const getPlanMonthlyRevenue = (planCode: string, billingCycle: string): number => {
  const normalizedCode = normalizePlanCode(planCode);
  return getPlanPrice(normalizedCode, billingCycle === "monthly" ? "monthly" : "annual");
};

type PlanFilter = "all" | "esencial" | "inicial" | "profesional" | "equipo" | "clinica" | "personalizado";
type UsageFilter = "all" | "near_limit" | "at_limit";

const getUsageStatus = (current: number, max: number | null): { percentage: number; status: "ok" | "warning" | "danger" } => {
  if (max === null) return { percentage: 0, status: "ok" };
  const percentage = (current / max) * 100;
  if (percentage >= 100) return { percentage, status: "danger" };
  if (percentage >= 70) return { percentage, status: "warning" };
  return { percentage, status: "ok" };
};

const SaasAdmin = () => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
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
  const [compactMode, setCompactMode] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Create business form state
  const [newBusinessName, setNewBusinessName] = useState("");
  const [newBusinessEmail, setNewBusinessEmail] = useState("");
  const [newBusinessPlan, setNewBusinessPlan] = useState("inicial");

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

  // Delete modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [businessToDelete, setBusinessToDelete] = useState<BusinessWithDetails | null>(null);
  const [deleteConfirmChecked, setDeleteConfirmChecked] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Edit modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [businessToEdit, setBusinessToEdit] = useState<BusinessWithDetails | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPlan, setEditPlan] = useState("");
  const [editIsActive, setEditIsActive] = useState(true);
  const [saving, setSaving] = useState(false);

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

      const { data: businessesData, error: bizError } = await supabase
        .from("businesses")
        .select("*")
        .order("created_at", { ascending: false });

      if (bizError) throw bizError;

      const ownerIds = [...new Set(businessesData?.map(b => b.owner_user_id) || [])];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, email")
        .in("id", ownerIds);

      const profileMap = new Map(profiles?.map(p => [p.id, p.email]) || []);

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

      const { data: patientsData } = await supabase
        .from("patients")
        .select("business_id")
        .eq("is_active", true);

      const patientCountMap = new Map<string, number>();
      patientsData?.forEach(p => {
        patientCountMap.set(p.business_id, (patientCountMap.get(p.business_id) || 0) + 1);
      });

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
        isPrivateClinic: (b as any).is_private_clinic || false,
        customSubdomain: (b as any).custom_subdomain || null,
        customDomain: (b as any).custom_domain || null,
        isDemo: (b as any).is_demo || false,
      }));

      setBusinesses(businessesWithDetails);

      const totalProfessionals = rolesData?.length || 0;
      const totalPatients = patientsData?.length || 0;
      
      const estimatedRevenue = businessesWithDetails.reduce((sum, b) => {
        return sum + getPlanMonthlyRevenue(b.planCode, b.billingPeriod);
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

      const { data: existingProfile } = await supabase
        .from("profiles")
        .select("id")
        .eq("email", newBusinessEmail.trim().toLowerCase())
        .maybeSingle();

      let ownerId: string;

      if (existingProfile) {
        ownerId = existingProfile.id;
      } else {
        const { data: newUser, error: createError } = await supabase.functions.invoke(
          "create-professional-invite",
          {
            body: {
              email: newBusinessEmail.trim().toLowerCase(),
              name: newBusinessName.trim(),
              businessId: null,
              isNewOwner: true,
            },
          }
        );

        if (createError) throw createError;
        ownerId = newUser.userId;
      }

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
      setNewBusinessPlan("inicial");
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

  const openPrivateClinicModal = (business: BusinessWithDetails) => {
    setSelectedBusiness(business);
    setEditingPrivateClinic({
      isPrivateClinic: business.isPrivateClinic,
      customSubdomain: business.customSubdomain || "",
      customDomain: business.customDomain || "",
    });
    setShowPrivateClinicModal(true);
  };

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
    sessionStorage.setItem("saas_selected_business", businessIdToEnter);
    navigate("/dashboard");
  };

  // Delete business cascade
  const openDeleteModal = (business: BusinessWithDetails) => {
    setBusinessToDelete(business);
    setDeleteConfirmChecked(false);
    setShowDeleteModal(true);
  };

  const handleDeleteBusiness = async () => {
    if (!businessToDelete || !deleteConfirmChecked) return;

    try {
      setDeleting(true);
      const businessId = businessToDelete.id;

      // Delete in order to respect foreign keys
      // 1. scheduled_reminders (depends on appointments)
      const { data: appointmentIds } = await supabase
        .from("appointments")
        .select("id")
        .eq("business_id", businessId);
      
      if (appointmentIds && appointmentIds.length > 0) {
        const ids = appointmentIds.map(a => a.id);
        await supabase.from("scheduled_reminders").delete().in("appointment_id", ids);
      }

      // 2. Delete payments
      await supabase.from("payments").delete().eq("business_id", businessId);

      // 3. Delete appointments
      await supabase.from("appointments").delete().eq("business_id", businessId);

      // 4. Delete availability_slots
      await supabase.from("availability_slots").delete().eq("business_id", businessId);

      // 5. Delete patient_portal_invites (depends on patients)
      const { data: patientIds } = await supabase
        .from("patients")
        .select("id")
        .eq("business_id", businessId);
      
      if (patientIds && patientIds.length > 0) {
        const ids = patientIds.map(p => p.id);
        await supabase.from("patient_portal_invites").delete().in("patient_id", ids);
      }

      // 6. Delete patients
      await supabase.from("patients").delete().eq("business_id", businessId);

      // 7. Delete services
      await supabase.from("services").delete().eq("business_id", businessId);

      // 8. Delete professional_portal_invites
      await supabase.from("professional_portal_invites").delete().eq("business_id", businessId);

      // 9. Delete user_roles for this business (except super_admin which has no business_id)
      await supabase.from("user_roles").delete().eq("business_id", businessId);

      // 10. Finally delete the business
      const { error: bizError } = await supabase
        .from("businesses")
        .delete()
        .eq("id", businessId);

      if (bizError) throw bizError;

      toast({
        title: "Consultorio eliminado",
        description: `El consultorio "${businessToDelete.name}" y todos sus datos han sido eliminados`,
      });

      setShowDeleteModal(false);
      setBusinessToDelete(null);
      await loadData();
    } catch (error: any) {
      console.error("Error deleting business:", error);
      toast({
        title: "Error",
        description: "No se pudo eliminar. Probá de nuevo.",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  };

  // Edit business
  const openEditModal = (business: BusinessWithDetails) => {
    setBusinessToEdit(business);
    setEditName(business.name);
    setEditEmail(business.ownerEmail || "");
    setEditPlan(business.planCode);
    setEditIsActive(business.isActive);
    setShowEditModal(true);
  };

  const handleEditBusiness = async () => {
    if (!businessToEdit || !editName.trim()) {
      toast({
        title: "Error",
        description: "El nombre es requerido",
        variant: "destructive",
      });
      return;
    }

    try {
      setSaving(true);

      const { error } = await supabase
        .from("businesses")
        .update({
          name: editName.trim(),
          plan_code: editPlan,
          is_active: editIsActive,
        })
        .eq("id", businessToEdit.id);

      if (error) throw error;

      toast({
        title: "Consultorio actualizado",
        description: `Los cambios en "${editName}" han sido guardados`,
      });

      setShowEditModal(false);
      setBusinessToEdit(null);
      await loadData();
    } catch (error: any) {
      console.error("Error updating business:", error);
      toast({
        title: "Error",
        description: error.message || "No se pudo actualizar el consultorio",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const demoBusinessExists = businesses.some(b => b.isDemo);
  const demoBusiness = businesses.find(b => b.isDemo);

  const handleCreateDemo = async () => {
    try {
      setCreatingDemo(true);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No user");

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

      await supabase.from("clinic_settings").insert({
        user_id: user.id,
        clinic_name: "Demo Psicología",
        specialty: "Psicología clínica y terapia",
        welcome_message: "Bienvenido/a al consultorio demo. Este es un espacio de demostración para explorar todas las funcionalidades del sistema.",
      });

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
        { patient_id: createdPatients[0].id, start_at: setTime(tomorrow, 10, 0).toISOString(), end_at: setTime(tomorrow, 11, 0).toISOString(), status: "confirmed", modality: "presencial" },
        { patient_id: createdPatients[1].id, start_at: setTime(dayAfter, 15, 0).toISOString(), end_at: setTime(dayAfter, 16, 0).toISOString(), status: "pending", modality: "online" },
        { patient_id: createdPatients[0].id, start_at: setTime(lastWeek1, 11, 0).toISOString(), end_at: setTime(lastWeek1, 12, 0).toISOString(), status: "attended", modality: "presencial" },
        { patient_id: createdPatients[2].id, start_at: setTime(lastWeek2, 9, 0).toISOString(), end_at: setTime(lastWeek2, 10, 0).toISOString(), status: "attended", modality: "online" },
        { patient_id: createdPatients[1].id, start_at: setTime(lastWeek3, 14, 0).toISOString(), end_at: setTime(lastWeek3, 15, 0).toISOString(), status: "cancelled", modality: "presencial" },
      ];

      await supabase.from("appointments").insert(
        appointments.map(a => ({ ...a, business_id: businessId }))
      );

      const dueGreen = new Date(now);
      dueGreen.setDate(dueGreen.getDate() + 15);
      const dueOrange = new Date(now);
      dueOrange.setDate(dueOrange.getDate() + 3);
      const dueRed = new Date(now);
      dueRed.setDate(dueRed.getDate() - 5);

      const payments = [
        { patient_id: createdPatients[0].id, amount: 1500, due_date: dueGreen.toISOString(), status: "paid", paid_at: new Date().toISOString(), currency: "UYU" },
        { patient_id: createdPatients[1].id, amount: 1500, due_date: dueOrange.toISOString(), status: "pending", paid_at: null, currency: "UYU" },
        { patient_id: createdPatients[2].id, amount: 1500, due_date: dueRed.toISOString(), status: "pending", paid_at: null, currency: "UYU" },
      ];

      await supabase.from("payments").insert(
        payments.map(p => ({ ...p, business_id: businessId, recurrence_type: "one_time" }))
      );

      const slots: any[] = [];
      for (let i = 1; i <= 7; i++) {
        const slotDate = new Date(now);
        slotDate.setDate(slotDate.getDate() + i);
        const dayOfWeek = slotDate.getDay();
        if (dayOfWeek === 0 || dayOfWeek === 6) continue;

        const dateStr = slotDate.toISOString().split("T")[0];
        slots.push({
          business_id: businessId,
          date: dateStr,
          start_time: "09:00",
          end_time: "12:00",
          modality: "presencial",
          status: "available",
        });
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

  // Filter businesses with search
  const filteredBusinesses = useMemo(() => {
    return businesses.filter((business) => {
      // Search filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesName = business.name.toLowerCase().includes(query);
        const matchesEmail = business.ownerEmail?.toLowerCase().includes(query);
        if (!matchesName && !matchesEmail) return false;
      }

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
          return profStatus.status === "warning" || profStatus.status === "danger" || 
                 patientStatus.status === "warning" || patientStatus.status === "danger";
        }
        if (usageFilter === "at_limit") {
          return profStatus.status === "danger" || patientStatus.status === "danger";
        }
      }

      return true;
    });
  }, [businesses, planFilter, usageFilter, searchQuery]);

  const hasActiveFilters = planFilter !== "all" || usageFilter !== "all" || searchQuery.trim() !== "";

  const clearFilters = () => {
    setPlanFilter("all");
    setUsageFilter("all");
    setSearchQuery("");
  };

  // Business Card Component for Mobile
  const BusinessCard = ({ business }: { business: BusinessWithDetails }) => {
    const customLimits = business.planCode === "custom" ? {
      maxProfessionals: business.customMaxProfessionals ?? null,
      maxPatients: business.customMaxPatients ?? null,
    } : undefined;
    const config = getPlanConfig(business.planCode, customLimits);
    const profStatus = getUsageStatus(business.professionalsCount, config.maxProfessionals);
    const patientStatus = getUsageStatus(business.patientsCount, config.maxPatients);

    return (
      <Card className="overflow-hidden">
        <CardContent className="p-4 space-y-4">
          {/* Header - Name + Plan prominently */}
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-lg leading-tight">{business.name}</h3>
              {business.isDemo && (
                <Badge variant="outline" className="text-xs border-amber-500 text-amber-600 shrink-0">
                  Demo
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs font-medium">
                {getPlanName(business.planCode)}
              </Badge>
              <span className="text-xs text-muted-foreground">{business.ownerEmail}</span>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className={`p-3 rounded-lg text-center ${
              profStatus.status === "danger" 
                ? "bg-destructive/10" 
                : profStatus.status === "warning"
                  ? "bg-yellow-500/10"
                  : "bg-green-500/10"
            }`}>
              <p className="text-xs text-muted-foreground mb-1">Profesionales</p>
              <p className={`font-bold text-lg ${
                profStatus.status === "danger" 
                  ? "text-destructive" 
                  : profStatus.status === "warning"
                    ? "text-yellow-700 dark:text-yellow-400"
                    : "text-green-700 dark:text-green-400"
              }`}>
                {business.professionalsCount}
                <span className="text-sm font-normal">
                  {config.maxProfessionals !== null ? `/${config.maxProfessionals}` : " ∞"}
                </span>
              </p>
            </div>
            <div className={`p-3 rounded-lg text-center ${
              patientStatus.status === "danger" 
                ? "bg-destructive/10" 
                : patientStatus.status === "warning"
                  ? "bg-yellow-500/10"
                  : "bg-green-500/10"
            }`}>
              <p className="text-xs text-muted-foreground mb-1">Pacientes</p>
              <p className={`font-bold text-lg ${
                patientStatus.status === "danger" 
                  ? "text-destructive" 
                  : patientStatus.status === "warning"
                    ? "text-yellow-700 dark:text-yellow-400"
                    : "text-green-700 dark:text-green-400"
              }`}>
                {business.patientsCount}
                <span className="text-sm font-normal">
                  {config.maxPatients !== null ? `/${config.maxPatients}` : " ∞"}
                </span>
              </p>
            </div>
          </div>

          {/* Actions - Icon buttons with tooltips for mobile */}
          <div className="flex items-center justify-between pt-2 border-t">
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10"
                onClick={() => enterBusiness(business.id)}
                title="Ver consultorio"
              >
                <Eye className="h-5 w-5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10"
                onClick={() => openEditModal(business)}
                title="Editar"
              >
                <Pencil className="h-5 w-5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10"
                onClick={() => loadProfessionals(business)}
                title="Ver profesionales"
              >
                <UserCog className="h-5 w-5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10"
                onClick={() => openPrivateClinicModal(business)}
                title="Configurar dominio"
              >
                <Globe className="h-5 w-5" />
              </Button>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={() => openDeleteModal(business)}
              title="Eliminar"
            >
              <Trash2 className="h-5 w-5" />
            </Button>
          </div>
        </CardContent>
      </Card>
    );
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
      <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Header - Desktop Premium */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/dashboard")}
              className="h-10 w-10 shrink-0"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl lg:text-3xl font-bold text-foreground">Panel SaaS</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Administración global del sistema
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="default" className="bg-primary h-7 px-3">
              <Shield className="h-3.5 w-3.5 mr-1.5" />
              Super Admin
            </Badge>
          </div>
        </div>

        {/* Stats Cards - Desktop Grid */}
        {!isMobile && (
          <div className="grid grid-cols-4 gap-4">
            <div className="stat-card">
              <div className="flex items-center justify-between">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Building2 className="h-5 w-5 text-primary" />
                </div>
              </div>
              <p className="stat-card-value mt-4">{metrics.totalBusinesses}</p>
              <p className="stat-card-label">Consultorios</p>
            </div>
            <div className="stat-card">
              <div className="flex items-center justify-between">
                <div className="h-10 w-10 rounded-lg bg-secondary flex items-center justify-center">
                  <UserCog className="h-5 w-5 text-secondary-foreground" />
                </div>
              </div>
              <p className="stat-card-value mt-4">{metrics.totalProfessionals}</p>
              <p className="stat-card-label">Profesionales</p>
            </div>
            <div className="stat-card">
              <div className="flex items-center justify-between">
                <div className="h-10 w-10 rounded-lg bg-secondary flex items-center justify-center">
                  <Users className="h-5 w-5 text-secondary-foreground" />
                </div>
              </div>
              <p className="stat-card-value mt-4">{metrics.totalPatients}</p>
              <p className="stat-card-label">Pacientes</p>
            </div>
            <div className="stat-card">
              <div className="flex items-center justify-between">
                <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                  <DollarSign className="h-5 w-5 text-green-600" />
                </div>
              </div>
              <p className="stat-card-value mt-4 text-green-600">${metrics.estimatedRevenue.toLocaleString()}</p>
              <p className="stat-card-label">MRR Estimado</p>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className={`flex flex-col sm:flex-row gap-3 ${isMobile ? 'sticky top-0 z-10 bg-background pb-3 -mx-4 px-4 pt-2 border-b' : ''}`}>
          <Button
            className={`${isMobile ? 'flex-1 h-12 rounded-xl' : 'h-10 px-5'} font-semibold gap-2`}
            onClick={() => setShowCreateModal(true)}
          >
            <Plus className="h-4 w-4" />
            Crear nuevo consultorio
          </Button>
          
          {demoBusinessExists ? (
            <Button
              variant="outline"
              className={`${isMobile ? 'flex-1 h-12 rounded-xl' : 'h-10 px-5'} font-semibold gap-2 border-amber-500/50 text-amber-600 hover:bg-amber-500/10`}
              onClick={() => demoBusiness && enterBusiness(demoBusiness.id)}
            >
              <Play className="h-4 w-4" />
              Entrar a DEMO
            </Button>
          ) : (
            <Button
              variant="outline"
              className={`${isMobile ? 'flex-1 h-12 rounded-xl' : 'h-10 px-5'} font-semibold gap-2 border-amber-500/50 text-amber-600 hover:bg-amber-500/10`}
              onClick={handleCreateDemo}
              disabled={creatingDemo}
            >
              {creatingDemo ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              {creatingDemo ? "Creando demo..." : "Crear consultorio DEMO"}
            </Button>
          )}
        </div>

        {/* Businesses Section */}
        <TooltipProvider>
        <div className={isMobile ? "mobile-card" : "desktop-card overflow-hidden"}>
          {/* Premium Header Bar */}
          <div className="p-4 lg:px-6 lg:py-5 border-b border-border bg-muted/30">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              {/* Left side: Title + Counter */}
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-semibold text-foreground">
                  Consultorios
                </h2>
                <span className="text-sm text-muted-foreground">
                  Mostrando {filteredBusinesses.length} {filteredBusinesses.length === 1 ? 'consultorio' : 'consultorios'}
                  {hasActiveFilters && ` de ${businesses.length}`}
                </span>
              </div>
              
              {/* Right side: Search + Filters + Density Toggle */}
              <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 h-9 w-full sm:w-[200px] bg-background"
                  />
                </div>
                
                {/* Filters */}
                <div className="flex gap-2 items-center">
                  <Select value={planFilter} onValueChange={(v) => setPlanFilter(v as PlanFilter)}>
                    <SelectTrigger className="w-[140px] h-9 bg-background">
                      <SelectValue placeholder="Plan" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      {PLAN_ORDER.map(code => (
                        <SelectItem key={code} value={code}>
                          {PLAN_DEFINITIONS[code].name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={usageFilter} onValueChange={(v) => setUsageFilter(v as UsageFilter)}>
                    <SelectTrigger className="w-[130px] h-9 bg-background">
                      <SelectValue placeholder="Estado" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="near_limit">Cerca del límite</SelectItem>
                      <SelectItem value="at_limit">En el límite</SelectItem>
                    </SelectContent>
                  </Select>
                  
                  {hasActiveFilters && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={clearFilters} 
                      className="h-9 px-2 text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                  
                  {/* Density Toggle - Desktop only */}
                  {!isMobile && (
                    <div className="hidden lg:flex items-center border-l border-border pl-3 ml-1">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant={compactMode ? "secondary" : "ghost"}
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => setCompactMode(true)}
                          >
                            <Rows3 className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Compacto</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant={!compactMode ? "secondary" : "ghost"}
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => setCompactMode(false)}
                          >
                            <LayoutGrid className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Cómodo</TooltipContent>
                      </Tooltip>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Table Content */}
          <div className="p-0">
            {/* Mobile: Cards View */}
            {isMobile ? (
              <div className="space-y-3 p-4">
                {filteredBusinesses.map((business) => (
                  <BusinessCard key={business.id} business={business} />
                ))}
                {filteredBusinesses.length === 0 && (
                  <div className="empty-state py-12">
                    <Building2 className="empty-state-icon" />
                    <p className="empty-state-title">
                      {hasActiveFilters ? "Sin resultados" : "Sin consultorios"}
                    </p>
                    <p className="empty-state-description">
                      {hasActiveFilters 
                        ? "No hay consultorios que coincidan con los filtros" 
                        : "Aún no hay consultorios registrados"}
                    </p>
                    {!hasActiveFilters && (
                      <Button onClick={() => setShowCreateModal(true)} className="gap-2 mt-4">
                        <Plus className="h-4 w-4" />
                        Crear consultorio
                      </Button>
                    )}
                  </div>
                )}
              </div>
            ) : (
              /* Desktop: Premium DataGrid */
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="sticky top-0 z-10 bg-muted/80 backdrop-blur-sm shadow-[0_1px_0_0_hsl(var(--border))]">
                    <TableRow className="hover:bg-transparent border-0">
                      <TableHead className={`pl-6 font-semibold text-xs uppercase tracking-wide text-muted-foreground ${compactMode ? 'py-2.5' : 'py-3.5'}`}>
                        Consultorio
                      </TableHead>
                      <TableHead className={`font-semibold text-xs uppercase tracking-wide text-muted-foreground ${compactMode ? 'py-2.5' : 'py-3.5'}`}>
                        Dueño
                      </TableHead>
                      <TableHead className={`font-semibold text-xs uppercase tracking-wide text-muted-foreground ${compactMode ? 'py-2.5' : 'py-3.5'}`}>
                        Plan
                      </TableHead>
                      <TableHead className={`font-semibold text-xs uppercase tracking-wide text-muted-foreground ${compactMode ? 'py-2.5' : 'py-3.5'}`}>
                        Uso
                      </TableHead>
                      <TableHead className={`text-center font-semibold text-xs uppercase tracking-wide text-muted-foreground ${compactMode ? 'py-2.5' : 'py-3.5'}`}>
                        Estado
                      </TableHead>
                      <TableHead className={`pr-6 text-right font-semibold text-xs uppercase tracking-wide text-muted-foreground ${compactMode ? 'py-2.5' : 'py-3.5'}`}>
                        Acciones
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredBusinesses.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="h-48">
                          <div className="empty-state py-8">
                            <Building2 className="empty-state-icon" />
                            <p className="empty-state-title">
                              {hasActiveFilters ? "Sin resultados" : "Sin consultorios"}
                            </p>
                            <p className="empty-state-description">
                              {hasActiveFilters 
                                ? "No hay consultorios que coincidan con los filtros" 
                                : "Crea tu primer consultorio para empezar"}
                            </p>
                            {!hasActiveFilters && (
                              <Button onClick={() => setShowCreateModal(true)} className="gap-2 mt-4">
                                <Plus className="h-4 w-4" />
                                Crear consultorio
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : filteredBusinesses.map((business) => {
                      const customLimits = business.planCode === "custom" ? {
                        maxProfessionals: business.customMaxProfessionals ?? null,
                        maxPatients: business.customMaxPatients ?? null,
                      } : undefined;
                      const config = getPlanConfig(business.planCode, customLimits);
                      const profStatus = getUsageStatus(business.professionalsCount, config.maxProfessionals);
                      const patientStatus = getUsageStatus(business.patientsCount, config.maxPatients);
                      const worstStatus = profStatus.status === "danger" || patientStatus.status === "danger" 
                        ? "danger" 
                        : profStatus.status === "warning" || patientStatus.status === "warning"
                          ? "warning"
                          : "ok";

                      return (
                        <TableRow 
                          key={business.id} 
                          className={`group border-b border-border/50 transition-colors hover:bg-muted/40 ${compactMode ? '' : ''}`}
                        >
                          {/* Consultorio */}
                          <TableCell className={`pl-6 ${compactMode ? 'py-2.5' : 'py-4'}`}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="flex items-center gap-3 cursor-default">
                                  <div className={`rounded-lg bg-primary/10 flex items-center justify-center shrink-0 ${compactMode ? 'h-8 w-8' : 'h-10 w-10'}`}>
                                    <Building2 className={`text-primary ${compactMode ? 'h-4 w-4' : 'h-5 w-5'}`} />
                                  </div>
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                      <span className={`font-medium text-foreground truncate max-w-[200px] ${compactMode ? 'text-sm' : 'text-base'}`}>
                                        {business.name}
                                      </span>
                                      {business.isDemo && (
                                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-amber-500 text-amber-600 shrink-0">
                                          Demo
                                        </Badge>
                                      )}
                                      {business.isPrivateClinic && (
                                        <Shield className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent side="bottom" align="start" className="max-w-xs">
                                <div className="text-xs space-y-1">
                                  <p><strong>Creado:</strong> {formatDate(business.created_at)}</p>
                                  {business.isPrivateClinic && <p><strong>Tipo:</strong> Privado</p>}
                                  {business.customSubdomain && <p><strong>Subdominio:</strong> {business.customSubdomain}</p>}
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          </TableCell>
                          
                          {/* Dueño */}
                          <TableCell className={compactMode ? 'py-2.5' : 'py-4'}>
                            <span className={`text-muted-foreground truncate block max-w-[180px] ${compactMode ? 'text-xs' : 'text-sm'}`}>
                              {business.ownerEmail}
                            </span>
                          </TableCell>
                          
                          {/* Plan */}
                          <TableCell className={compactMode ? 'py-2.5' : 'py-4'}>
                            <PlanSelector
                              businessId={business.id}
                              currentPlan={business.planCode}
                              customMaxProfessionals={business.customMaxProfessionals}
                              customMaxPatients={business.customMaxPatients}
                              onChangePlan={handleChangePlan}
                            />
                          </TableCell>
                          
                          {/* Uso - Combined column */}
                          <TableCell className={compactMode ? 'py-2.5' : 'py-4'}>
                            <div className="flex flex-col gap-1.5 min-w-[120px]">
                              {/* Profesionales */}
                              <div className="flex items-center gap-2">
                                <span className={`text-[10px] text-muted-foreground w-8 shrink-0`}>Profs</span>
                                <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                                  <div 
                                    className={`h-full rounded-full transition-all ${
                                      profStatus.status === "danger" ? "bg-destructive" 
                                      : profStatus.status === "warning" ? "bg-warning"
                                      : "bg-success"
                                    }`}
                                    style={{ width: `${Math.min(profStatus.percentage, 100)}%` }}
                                  />
                                </div>
                                <span className={`text-[10px] tabular-nums w-10 text-right ${
                                  profStatus.status === "danger" ? "text-destructive font-medium" 
                                  : profStatus.status === "warning" ? "text-warning font-medium"
                                  : "text-muted-foreground"
                                }`}>
                                  {business.professionalsCount}/{config.maxProfessionals ?? "∞"}
                                </span>
                              </div>
                              {/* Pacientes */}
                              <div className="flex items-center gap-2">
                                <span className={`text-[10px] text-muted-foreground w-8 shrink-0`}>Pac</span>
                                <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                                  <div 
                                    className={`h-full rounded-full transition-all ${
                                      patientStatus.status === "danger" ? "bg-destructive" 
                                      : patientStatus.status === "warning" ? "bg-warning"
                                      : "bg-success"
                                    }`}
                                    style={{ width: `${Math.min(patientStatus.percentage, 100)}%` }}
                                  />
                                </div>
                                <span className={`text-[10px] tabular-nums w-10 text-right ${
                                  patientStatus.status === "danger" ? "text-destructive font-medium" 
                                  : patientStatus.status === "warning" ? "text-warning font-medium"
                                  : "text-muted-foreground"
                                }`}>
                                  {business.patientsCount}/{config.maxPatients ?? "∞"}
                                </span>
                              </div>
                            </div>
                          </TableCell>
                          
                          {/* Estado */}
                          <TableCell className={`text-center ${compactMode ? 'py-2.5' : 'py-4'}`}>
                            <Badge 
                              variant="secondary"
                              className={`text-[10px] px-2 py-0.5 ${
                                !business.isActive 
                                  ? "bg-muted text-muted-foreground"
                                  : worstStatus === "danger"
                                    ? "bg-destructive/10 text-destructive"
                                    : worstStatus === "warning"
                                      ? "bg-warning/10 text-warning"
                                      : "bg-success/10 text-success"
                              }`}
                            >
                              {!business.isActive 
                                ? "Inactivo"
                                : worstStatus === "danger"
                                  ? "Límite"
                                  : worstStatus === "warning"
                                    ? "Cerca"
                                    : "OK"}
                            </Badge>
                          </TableCell>
                          
                          {/* Acciones - Dropdown Menu */}
                          <TableCell className={`pr-6 text-right ${compactMode ? 'py-2.5' : 'py-4'}`}>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button 
                                  variant="ghost" 
                                  size="icon"
                                  className="h-8 w-8 opacity-60 group-hover:opacity-100 transition-opacity"
                                >
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-48">
                                <DropdownMenuItem onClick={() => loadProfessionals(business)}>
                                  <UserCog className="h-4 w-4 mr-2" />
                                  Ver detalle
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => enterBusiness(business.id)}>
                                  <LogIn className="h-4 w-4 mr-2" />
                                  Entrar al consultorio
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => openEditModal(business)}>
                                  <Pencil className="h-4 w-4 mr-2" />
                                  Editar
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => openPrivateClinicModal(business)}>
                                  <Globe className="h-4 w-4 mr-2" />
                                  Configurar dominio
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem 
                                  onClick={() => openDeleteModal(business)}
                                  className="text-destructive focus:text-destructive focus:bg-destructive/10"
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Eliminar
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </div>
        </TooltipProvider>

        {/* Metrics - Collapsible */}
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
                  {PLAN_ORDER.map(code => {
                    const plan = PLAN_DEFINITIONS[code];
                    const limitsText = plan.maxProfessionals === null 
                      ? "(a medida)" 
                      : `(${plan.maxProfessionals} prof, ${plan.maxPatients} pac)`;
                    return (
                      <SelectItem key={code} value={code}>
                        {plan.name} {limitsText}
                      </SelectItem>
                    );
                  })}
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

      {/* Delete Confirmation Modal */}
      <AlertDialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Eliminar consultorio
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>
                ¿Estás seguro? Si eliminás el consultorio <strong>"{businessToDelete?.name}"</strong>, 
                se borrarán todos sus datos y no se pueden recuperar.
              </p>
              <p className="text-xs text-muted-foreground">
                Se eliminarán: profesionales, pacientes, citas, pagos, recordatorios, 
                disponibilidad, servicios e invitaciones asociadas.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <div className="flex items-start gap-3 p-3 bg-destructive/5 border border-destructive/20 rounded-lg">
              <Checkbox 
                id="deleteConfirm"
                checked={deleteConfirmChecked}
                onCheckedChange={(checked) => setDeleteConfirmChecked(checked === true)}
                className="mt-0.5"
              />
              <Label 
                htmlFor="deleteConfirm" 
                className="text-sm font-normal cursor-pointer leading-relaxed"
              >
                Entiendo que esta acción es irreversible y que se eliminarán todos los datos del consultorio
              </Label>
            </div>
          </div>
          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => {
                setShowDeleteModal(false);
                setBusinessToDelete(null);
                setDeleteConfirmChecked(false);
              }}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              className="flex-1"
              onClick={handleDeleteBusiness}
              disabled={!deleteConfirmChecked || deleting}
            >
              {deleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Eliminar definitivamente
            </Button>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Business Modal */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5" />
              Editar consultorio
            </DialogTitle>
            <DialogDescription>
              Modifica los datos del consultorio "{businessToEdit?.name}"
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="editName">Nombre del consultorio</Label>
              <Input
                id="editName"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Nombre del consultorio"
              />
            </div>
            <div className="space-y-2">
              <Label>Email del dueño</Label>
              <Input
                value={editEmail}
                disabled
                className="bg-muted"
              />
              <p className="text-xs text-muted-foreground">
                El email del dueño no se puede cambiar
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="editPlan">Plan</Label>
              <Select value={editPlan} onValueChange={setEditPlan}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar plan" />
                </SelectTrigger>
                <SelectContent>
                  {PLAN_ORDER.map(code => {
                    const plan = PLAN_DEFINITIONS[code];
                    return (
                      <SelectItem key={code} value={code}>
                        {plan.name}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <div className="space-y-0.5">
                <Label className="text-sm font-semibold">Estado activo</Label>
                <p className="text-xs text-muted-foreground">
                  Desactivar pausará el acceso al consultorio
                </p>
              </div>
              <Switch
                checked={editIsActive}
                onCheckedChange={setEditIsActive}
              />
            </div>
          </div>
          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => {
                setShowEditModal(false);
                setBusinessToEdit(null);
              }}
            >
              Cancelar
            </Button>
            <Button
              className="flex-1"
              onClick={handleEditBusiness}
              disabled={saving}
            >
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Guardar cambios
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SaasAdmin;

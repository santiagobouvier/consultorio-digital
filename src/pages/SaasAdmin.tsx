import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "@/hooks/use-toast";
import {
  Building2, Users, UserCog, DollarSign, Plus, ArrowLeft, Eye, UserPlus,
  Loader2, AlertTriangle, ChevronDown, Copy, Check, X, Globe, Shield,
  Sparkles, Play, Trash2, Pencil, Search, MoreHorizontal, LogIn,
  Rows3, LayoutGrid, Activity, TrendingUp, Zap, Terminal,
} from "lucide-react";
import LoadingPage from "@/components/LoadingPage";
import { getPlanName, getPlanConfig, checkProfessionalLimit } from "@/hooks/use-plan-limits";
import {
  PLAN_DEFINITIONS, PLAN_ORDER, getPlanPrice, normalizePlanCode,
} from "@/lib/plan-definitions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PlanSelector } from "@/components/PlanSelector";
import { useIsMobile } from "@/hooks/use-mobile";

// ── Types ──────────────────────────────────────────────
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

// ── Helpers ────────────────────────────────────────────
const getPlanMonthlyRevenue = (planCode: string, billingCycle: string): number => {
  const normalizedCode = normalizePlanCode(planCode);
  return getPlanPrice(normalizedCode, billingCycle === "monthly" ? "monthly" : "annual");
};

type PlanFilter = "all" | "esencial" | "inicial" | "profesional" | "equipo" | "clinica" | "personalizado";
type UsageFilter = "all" | "near_limit" | "at_limit";

const getUsageStatus = (current: number, max: number | null) => {
  if (max === null) return { percentage: 0, status: "ok" as const };
  const percentage = (current / max) * 100;
  if (percentage >= 100) return { percentage, status: "danger" as const };
  if (percentage >= 70) return { percentage, status: "warning" as const };
  return { percentage, status: "ok" as const };
};

// ── Animated Counter ───────────────────────────────────
const AnimatedNumber = ({ value }: { value: number }) => {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    const duration = 600;
    const start = performance.now();
    const from = display;
    const step = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(from + (value - from) * eased));
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [value]);
  return <>{display.toLocaleString()}</>;
};

// ── Main Component ─────────────────────────────────────
const SaasAdmin = () => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [loading, setLoading] = useState(true);
  const [businesses, setBusinesses] = useState<BusinessWithDetails[]>([]);
  const [metrics, setMetrics] = useState<SaasMetrics>({
    totalBusinesses: 0, totalProfessionals: 0, totalPatients: 0, estimatedRevenue: 0,
  });
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showProfessionalsModal, setShowProfessionalsModal] = useState(false);
  const [selectedBusiness, setSelectedBusiness] = useState<BusinessWithDetails | null>(null);
  const [professionals, setProfessionals] = useState<any[]>([]);
  const [creating, setCreating] = useState(false);
  const [planFilter, setPlanFilter] = useState<PlanFilter>("all");
  const [usageFilter, setUsageFilter] = useState<UsageFilter>("all");
  const [compactMode, setCompactMode] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [newBusinessName, setNewBusinessName] = useState("");
  const [newBusinessEmail, setNewBusinessEmail] = useState("");
  const [newBusinessPlan, setNewBusinessPlan] = useState("inicial");
  const [createMode, setCreateMode] = useState<"test" | "invite">("test");
  const [newBusinessPassword, setNewBusinessPassword] = useState("");
  const [ownerInviteLink, setOwnerInviteLink] = useState<string | null>(null);
  const [showAddProfessionalModal, setShowAddProfessionalModal] = useState(false);
  const [newProfName, setNewProfName] = useState("");
  const [newProfEmail, setNewProfEmail] = useState("");
  const [professionalLimitError, setProfessionalLimitError] = useState<string | null>(null);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showPrivateClinicModal, setShowPrivateClinicModal] = useState(false);
  const [editingPrivateClinic, setEditingPrivateClinic] = useState({ isPrivateClinic: false, customSubdomain: "", customDomain: "" });
  const [savingPrivateClinic, setSavingPrivateClinic] = useState(false);
  const [creatingDemo, setCreatingDemo] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [businessToDelete, setBusinessToDelete] = useState<BusinessWithDetails | null>(null);
  const [deleteConfirmChecked, setDeleteConfirmChecked] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [businessToEdit, setBusinessToEdit] = useState<BusinessWithDetails | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPlan, setEditPlan] = useState("");
  const [editIsActive, setEditIsActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showActivateModal, setShowActivateModal] = useState(false);
  const [businessToActivate, setBusinessToActivate] = useState<BusinessWithDetails | null>(null);
  const [activatePlan, setActivatePlan] = useState<string>("esencial");
  const [activating, setActivating] = useState(false);

  useEffect(() => { checkAccessAndLoad(); }, []);

  const checkAccessAndLoad = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/auth"); return; }
      const { data: superAdminRole } = await supabase.from("user_roles").select("id").eq("user_id", user.id).eq("role", "super_admin").maybeSingle();
      if (!superAdminRole) { toast({ title: "Acceso denegado", description: "No tienes permisos para acceder a esta sección", variant: "destructive" }); navigate("/dashboard"); return; }
      await loadData();
    } catch { navigate("/dashboard"); }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const { data: businessesData, error: bizError } = await supabase.from("businesses").select("*").order("created_at", { ascending: false });
      if (bizError) throw bizError;
      const ownerIds = [...new Set(businessesData?.map(b => b.owner_user_id) || [])];
      const { data: profiles } = await supabase.from("profiles").select("id, email").in("id", ownerIds);
      const profileMap = new Map(profiles?.map(p => [p.id, p.email]) || []);
      const { data: rolesData } = await supabase.from("user_roles").select("business_id, role").in("role", ["owner", "professional"]);
      const profCountMap = new Map<string, number>();
      rolesData?.forEach(r => { if (r.business_id) profCountMap.set(r.business_id, (profCountMap.get(r.business_id) || 0) + 1); });
      const { data: patientsData } = await supabase.from("patients").select("business_id").eq("is_active", true);
      const patientCountMap = new Map<string, number>();
      patientsData?.forEach(p => { patientCountMap.set(p.business_id, (patientCountMap.get(p.business_id) || 0) + 1); });
      const businessesWithDetails: BusinessWithDetails[] = (businessesData || []).map(b => ({
        ...b, ownerEmail: profileMap.get(b.owner_user_id) || "N/A",
        professionalsCount: profCountMap.get(b.id) || 0, patientsCount: patientCountMap.get(b.id) || 0,
        planCode: b.plan_code || "individual", isActive: b.is_active !== false,
        customMaxProfessionals: b.custom_max_professionals, customMaxPatients: b.custom_max_patients,
        billingPeriod: b.billing_period || "annual", isPrivateClinic: b.is_private_clinic || false,
        customSubdomain: b.custom_subdomain || null, customDomain: b.custom_domain || null, isDemo: b.is_demo || false,
      }));
      setBusinesses(businessesWithDetails);
      const estimatedRevenue = businessesWithDetails.reduce((sum, b) => sum + getPlanMonthlyRevenue(b.planCode, b.billingPeriod), 0);
      setMetrics({ totalBusinesses: businessesWithDetails.length, totalProfessionals: rolesData?.length || 0, totalPatients: patientsData?.length || 0, estimatedRevenue });
    } catch (error) { console.error("Error loading data:", error); toast({ title: "Error", description: "No se pudo cargar la información", variant: "destructive" }); } finally { setLoading(false); }
  };

  // ── Business CRUD ──
  const handleCreateBusiness = async () => {
    if (!newBusinessName.trim() || !newBusinessEmail.trim()) { toast({ title: "Error", description: "Nombre y email son requeridos", variant: "destructive" }); return; }
    if (createMode === "test" && (!newBusinessPassword || newBusinessPassword.length < 6)) { toast({ title: "Error", description: "La contraseña debe tener al menos 6 caracteres", variant: "destructive" }); return; }
    try {
      setCreating(true);
      const { data, error } = await supabase.functions.invoke("create-business-owner", {
        body: {
          businessName: newBusinessName.trim(),
          ownerEmail: newBusinessEmail.trim(),
          planCode: newBusinessPlan,
          mode: createMode,
          password: createMode === "test" ? newBusinessPassword : undefined,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      if (data?.inviteToken) {
        const link = `${window.location.origin}/invitar-profesional?token=${data.inviteToken}`;
        setOwnerInviteLink(link);
        toast({ title: "Consultorio creado", description: "Copiá el enlace de invitación y envialo al dueño." });
      } else if (data?.mode === "existing") {
        toast({ title: "Consultorio creado", description: `Asignado a usuario existente. Ya puede acceder.` });
        setShowCreateModal(false); resetCreateForm();
      } else {
        toast({ title: "Consultorio creado", description: `"${newBusinessName}" creado. Credenciales: ${newBusinessEmail} / la contraseña ingresada.` });
        setShowCreateModal(false); resetCreateForm();
      }
      await loadData();
    } catch (error: any) { toast({ title: "Error", description: error.message || "No se pudo crear el consultorio", variant: "destructive" }); } finally { setCreating(false); }
  };

  const resetCreateForm = () => {
    setNewBusinessName(""); setNewBusinessEmail(""); setNewBusinessPlan("inicial");
    setCreateMode("test"); setNewBusinessPassword(""); setOwnerInviteLink(null);
  };

  const loadProfessionals = async (business: BusinessWithDetails) => {
    setSelectedBusiness(business); setShowProfessionalsModal(true);
    try {
      const { data: roles } = await supabase.from("user_roles").select("user_id, role").eq("business_id", business.id).in("role", ["owner", "professional"]);
      if (roles && roles.length > 0) {
        const userIds = roles.map(r => r.user_id);
        const { data: profiles } = await supabase.from("profiles").select("id, name, email").in("id", userIds);
        setProfessionals(roles.map(r => { const p = profiles?.find(p => p.id === r.user_id); return { userId: r.user_id, role: r.role, name: p?.name || "Sin nombre", email: p?.email || "Sin email" }; }));
      } else { setProfessionals([]); }
    } catch { toast({ title: "Error", description: "No se pudieron cargar los profesionales", variant: "destructive" }); }
  };

  const handleAddProfessional = async () => {
    if (!selectedBusiness || !newProfName.trim()) { toast({ title: "Error", description: "El nombre es requerido", variant: "destructive" }); return; }
    try {
      setCreating(true); setProfessionalLimitError(null);
      const limitCheck = await checkProfessionalLimit(selectedBusiness.id);
      if (!limitCheck.canAdd) { setProfessionalLimitError(limitCheck.message || "Límite alcanzado"); setCreating(false); return; }
      const { data, error } = await supabase.functions.invoke("create-professional-invite", { body: { email: newProfEmail.trim().toLowerCase() || undefined, name: newProfName.trim(), businessId: selectedBusiness.id } });
      if (error) throw error;
      if (newProfEmail && data?.token) {
        const link = `${window.location.origin}/invitar-profesional?token=${data.token}`;
        setInviteLink(link);
        toast({ title: "Invitación creada", description: "Copia el enlace y envíalo al profesional." });
      } else {
        toast({ title: "Profesional agregado", description: "El profesional ha sido agregado al consultorio" });
        setShowAddProfessionalModal(false); setNewProfName(""); setNewProfEmail(""); setProfessionalLimitError(null);
      }
      await loadProfessionals(selectedBusiness); await loadData();
    } catch (error: any) { toast({ title: "Error", description: error.message || "No se pudo agregar el profesional", variant: "destructive" }); } finally { setCreating(false); }
  };

  const handleChangePlan = async (businessId: string, newPlanCode: string, customLimits?: { maxProfessionals?: number | null; maxPatients?: number | null }) => {
    try {
      const updateData: any = { plan_code: newPlanCode };
      if (newPlanCode === "custom" && customLimits) { updateData.custom_max_professionals = customLimits.maxProfessionals; updateData.custom_max_patients = customLimits.maxPatients; }
      const { error } = await supabase.from("businesses").update(updateData).eq("id", businessId);
      if (error) throw error;
      toast({ title: "Plan actualizado", description: `Plan cambiado a ${getPlanName(newPlanCode)}` });
      await loadData();
    } catch (error: any) { toast({ title: "Error", description: error.message || "No se pudo cambiar el plan", variant: "destructive" }); }
  };

  const openPrivateClinicModal = (business: BusinessWithDetails) => {
    setSelectedBusiness(business);
    setEditingPrivateClinic({ isPrivateClinic: business.isPrivateClinic, customSubdomain: business.customSubdomain || "", customDomain: business.customDomain || "" });
    setShowPrivateClinicModal(true);
  };

  const handleSavePrivateClinic = async () => {
    if (!selectedBusiness) return;
    try {
      setSavingPrivateClinic(true);
      const { error } = await supabase.from("businesses").update({ is_private_clinic: editingPrivateClinic.isPrivateClinic, custom_subdomain: editingPrivateClinic.customSubdomain.trim() || null, custom_domain: editingPrivateClinic.customDomain.trim() || null }).eq("id", selectedBusiness.id);
      if (error) throw error;
      toast({ title: "Configuración guardada" }); setShowPrivateClinicModal(false); await loadData();
    } catch (error: any) { toast({ title: "Error", description: error.message || "No se pudo guardar", variant: "destructive" }); } finally { setSavingPrivateClinic(false); }
  };

  const enterBusiness = (id: string) => { sessionStorage.setItem("saas_selected_business", id); navigate("/dashboard"); };

  const openDeleteModal = (b: BusinessWithDetails) => { setBusinessToDelete(b); setDeleteConfirmChecked(false); setShowDeleteModal(true); };

  const handleDeleteBusiness = async () => {
    if (!businessToDelete || !deleteConfirmChecked) return;
    try {
      setDeleting(true);
      const { data, error } = await supabase.functions.invoke("delete-business", {
        body: { businessId: businessToDelete.id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: "Consultorio eliminado", description: `"${businessToDelete.name}" y todos sus datos fueron eliminados.` });
      setShowDeleteModal(false); setBusinessToDelete(null); await loadData();
    } catch (error: any) { toast({ title: "Error al eliminar", description: error.message || "No se pudo eliminar. Probá de nuevo.", variant: "destructive" }); } finally { setDeleting(false); }
  };

  const openEditModal = (b: BusinessWithDetails) => {
    setBusinessToEdit(b); setEditName(b.name); setEditEmail(b.ownerEmail || ""); setEditPlan(b.planCode); setEditIsActive(b.isActive); setShowEditModal(true);
  };

  const handleEditBusiness = async () => {
    if (!businessToEdit || !editName.trim()) { toast({ title: "Error", description: "El nombre es requerido", variant: "destructive" }); return; }
    try {
      setSaving(true);
      const { error } = await supabase.from("businesses").update({ name: editName.trim(), plan_code: editPlan, is_active: editIsActive }).eq("id", businessToEdit.id);
      if (error) throw error;
      toast({ title: "Consultorio actualizado" }); setShowEditModal(false); setBusinessToEdit(null); await loadData();
    } catch (error: any) { toast({ title: "Error", description: error.message || "No se pudo actualizar", variant: "destructive" }); } finally { setSaving(false); }
  };

  const openActivateModal = (b: BusinessWithDetails) => {
    setBusinessToActivate(b);
    const normalized = normalizePlanCode(b.planCode);
    const valid = ["emprendedor", "esencial", "profesional", "consultorio"].includes(normalized) ? normalized : "esencial";
    setActivatePlan(valid);
    setShowActivateModal(true);
  };

  const handleActivateSubscription = async () => {
    if (!businessToActivate) return;
    try {
      setActivating(true);
      const trialEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      const periodEnd = trialEnd;

      // Buscar suscripción más reciente
      const { data: existingSub } = await supabase
        .from("subscriptions")
        .select("id")
        .eq("business_id", businessToActivate.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingSub?.id) {
        const { error: subErr } = await supabase
          .from("subscriptions")
          .update({
            status: "active",
            plan_code: activatePlan,
            trial_ends_at: trialEnd,
            current_period_start: new Date().toISOString(),
            current_period_end: periodEnd,
            cancelled_at: null,
          })
          .eq("id", existingSub.id);
        if (subErr) throw subErr;
      } else {
        // Crear suscripción si no existe (super_admin tiene permiso)
        const { error: insErr } = await supabase.from("subscriptions").insert({
          business_id: businessToActivate.id,
          plan_code: activatePlan,
          status: "active",
          trial_ends_at: trialEnd,
          current_period_start: new Date().toISOString(),
          current_period_end: periodEnd,
          billing_period: "monthly",
          amount: 0,
          currency: "UYU",
        });
        if (insErr) throw insErr;
      }

      // Activar el business y actualizar plan_code
      const { error: bizErr } = await supabase
        .from("businesses")
        .update({ is_active: true, plan_code: activatePlan })
        .eq("id", businessToActivate.id);
      if (bizErr) throw bizErr;

      toast({ title: "Suscripción activada correctamente" });
      setShowActivateModal(false);
      setBusinessToActivate(null);
      await loadData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "No se pudo activar la suscripción",
        variant: "destructive",
      });
    } finally {
      setActivating(false);
    }
  };

  const demoBusinessExists = businesses.some(b => b.isDemo);
  const demoBusiness = businesses.find(b => b.isDemo);

  const handleCreateDemo = async () => {
    try {
      setCreatingDemo(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No user");
      const { data: business, error: bizError } = await supabase.from("businesses").insert({ name: "Demo Psicología", owner_user_id: user.id, public_slug: "demo-psicologia-" + Date.now().toString(36), contact_email: "demo@demo.local", plan_code: "professional", specialty: "Psicología", timezone: "America/Montevideo", is_active: true, onboarding_completed: true, is_demo: true }).select().single();
      if (bizError) throw bizError;
      const businessId = business.id;
      await supabase.from("clinic_settings").insert({ user_id: user.id, clinic_name: "Demo Psicología", specialty: "Psicología clínica y terapia", welcome_message: "Bienvenido/a al consultorio demo." });
      const patients = [
        { full_name: "Sofía Martínez", email: "sofia.demo@demo.local", whatsapp_phone: "+598991111111" },
        { full_name: "Juan Rodríguez", email: "juan.demo@demo.local", whatsapp_phone: "+598992222222" },
        { full_name: "Camila Fernández", email: "camila.demo@demo.local", whatsapp_phone: "+598993333333" },
      ];
      const { data: createdPatients, error: patErr } = await supabase.from("patients").insert(patients.map(p => ({ ...p, business_id: businessId, is_active: true }))).select();
      if (patErr) throw patErr;
      const now = new Date();
      const setTime = (d: Date, h: number, m: number) => { const nd = new Date(d); nd.setHours(h, m, 0, 0); return nd; };
      const tomorrow = new Date(now); tomorrow.setDate(tomorrow.getDate() + 1);
      const dayAfter = new Date(now); dayAfter.setDate(dayAfter.getDate() + 3);
      const lw1 = new Date(now); lw1.setDate(lw1.getDate() - 5);
      const lw2 = new Date(now); lw2.setDate(lw2.getDate() - 7);
      const lw3 = new Date(now); lw3.setDate(lw3.getDate() - 3);
      await supabase.from("appointments").insert([
        { patient_id: createdPatients[0].id, start_at: setTime(tomorrow, 10, 0).toISOString(), end_at: setTime(tomorrow, 11, 0).toISOString(), status: "confirmed", modality: "presencial", business_id: businessId },
        { patient_id: createdPatients[1].id, start_at: setTime(dayAfter, 15, 0).toISOString(), end_at: setTime(dayAfter, 16, 0).toISOString(), status: "pending", modality: "online", business_id: businessId },
        { patient_id: createdPatients[0].id, start_at: setTime(lw1, 11, 0).toISOString(), end_at: setTime(lw1, 12, 0).toISOString(), status: "attended", modality: "presencial", business_id: businessId },
        { patient_id: createdPatients[2].id, start_at: setTime(lw2, 9, 0).toISOString(), end_at: setTime(lw2, 10, 0).toISOString(), status: "attended", modality: "online", business_id: businessId },
        { patient_id: createdPatients[1].id, start_at: setTime(lw3, 14, 0).toISOString(), end_at: setTime(lw3, 15, 0).toISOString(), status: "cancelled", modality: "presencial", business_id: businessId },
      ]);
      const dueG = new Date(now); dueG.setDate(dueG.getDate() + 15);
      const dueO = new Date(now); dueO.setDate(dueO.getDate() + 3);
      const dueR = new Date(now); dueR.setDate(dueR.getDate() - 5);
      await supabase.from("payments").insert([
        { patient_id: createdPatients[0].id, amount: 1500, due_date: dueG.toISOString(), status: "paid", paid_at: new Date().toISOString(), currency: "UYU", business_id: businessId, recurrence_type: "one_time" },
        { patient_id: createdPatients[1].id, amount: 1500, due_date: dueO.toISOString(), status: "pending", paid_at: null, currency: "UYU", business_id: businessId, recurrence_type: "one_time" },
        { patient_id: createdPatients[2].id, amount: 1500, due_date: dueR.toISOString(), status: "pending", paid_at: null, currency: "UYU", business_id: businessId, recurrence_type: "one_time" },
      ]);
      const slots: any[] = [];
      for (let i = 1; i <= 7; i++) { const sd = new Date(now); sd.setDate(sd.getDate() + i); const dow = sd.getDay(); if (dow === 0 || dow === 6) continue; const ds = sd.toISOString().split("T")[0]; slots.push({ business_id: businessId, date: ds, start_time: "09:00", end_time: "12:00", modality: "presencial", status: "available" }); slots.push({ business_id: businessId, date: ds, start_time: "14:00", end_time: "18:00", modality: "online", status: "available" }); }
      if (slots.length) await supabase.from("availability_slots").insert(slots);
      toast({ title: "Demo creado", description: "Consultorio demo con datos de ejemplo." }); await loadData();
    } catch (error: any) { toast({ title: "Error", description: error.message || "No se pudo crear el demo", variant: "destructive" }); } finally { setCreatingDemo(false); }
  };

  const formatDate = (d: string) => new Date(d).toLocaleDateString("es-UY", { year: "numeric", month: "short", day: "numeric" });

  const filteredBusinesses = useMemo(() => {
    return businesses.filter(b => {
      if (searchQuery.trim()) { const q = searchQuery.toLowerCase(); if (!b.name.toLowerCase().includes(q) && !b.ownerEmail?.toLowerCase().includes(q)) return false; }
      if (planFilter !== "all" && b.planCode !== planFilter) return false;
      if (usageFilter !== "all") {
        const cl = b.planCode === "custom" ? { maxProfessionals: b.customMaxProfessionals ?? null, maxPatients: b.customMaxPatients ?? null } : undefined;
        const cfg = getPlanConfig(b.planCode, cl);
        const ps = getUsageStatus(b.professionalsCount, cfg.maxProfessionals);
        const pts = getUsageStatus(b.patientsCount, cfg.maxPatients);
        if (usageFilter === "near_limit") return ps.status === "warning" || ps.status === "danger" || pts.status === "warning" || pts.status === "danger";
        if (usageFilter === "at_limit") return ps.status === "danger" || pts.status === "danger";
      }
      return true;
    });
  }, [businesses, planFilter, usageFilter, searchQuery]);

  const hasActiveFilters = planFilter !== "all" || usageFilter !== "all" || searchQuery.trim() !== "";
  const clearFilters = () => { setPlanFilter("all"); setUsageFilter("all"); setSearchQuery(""); };

  // Count businesses at limit
  const atLimitCount = useMemo(() => businesses.filter(b => {
    const cl = b.planCode === "custom" ? { maxProfessionals: b.customMaxProfessionals ?? null, maxPatients: b.customMaxPatients ?? null } : undefined;
    const cfg = getPlanConfig(b.planCode, cl);
    return getUsageStatus(b.professionalsCount, cfg.maxProfessionals).status === "danger" || getUsageStatus(b.patientsCount, cfg.maxPatients).status === "danger";
  }).length, [businesses]);

  if (loading) return <LoadingPage />;

  return (
    <div className="min-h-screen bg-background">
      {/* ─── Tech Header ─── */}
      <div className="relative overflow-hidden border-b border-border bg-gradient-to-br from-[hsl(180,15%,6%)] via-[hsl(176,40%,12%)] to-[hsl(180,15%,8%)]">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,hsl(176_80%_40%/0.15),transparent_60%)]" />
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'40\' height=\'40\' viewBox=\'0 0 40 40\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'%23fff\' fill-opacity=\'1\'%3E%3Cpath d=\'M0 0h1v1H0zM20 0h1v1h-1zM0 20h1v1H0zM20 20h1v1h-1z\'/%3E%3C/g%3E%3C/svg%3E")' }} />
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")} className="text-white/70 hover:text-white hover:bg-white/10">
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Panel de Gestión</h1>
                  <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/20">
                    <Zap className="h-3 w-3 mr-1" />
                    En vivo
                  </Badge>
                </div>
                <p className="text-sm text-white/50 mt-1 flex items-center gap-2">
                  <Building2 className="h-3.5 w-3.5" />
                  Administración de consultorios
                </p>
              </div>
            </div>
            <Badge className="bg-white/10 text-white/90 border-white/20 hover:bg-white/15 hidden sm:flex">
              <Shield className="h-3.5 w-3.5 mr-1.5" />
              Super Admin
            </Badge>
          </div>

          {/* ─── Stat Cards ─── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {[
              { label: "Consultorios", value: metrics.totalBusinesses, icon: Building2, color: "from-cyan-500/20 to-cyan-500/5", iconColor: "text-cyan-400", borderColor: "border-cyan-500/20" },
              { label: "Profesionales", value: metrics.totalProfessionals, icon: UserCog, color: "from-violet-500/20 to-violet-500/5", iconColor: "text-violet-400", borderColor: "border-violet-500/20" },
              { label: "Pacientes", value: metrics.totalPatients, icon: Users, color: "from-blue-500/20 to-blue-500/5", iconColor: "text-blue-400", borderColor: "border-blue-500/20" },
              { label: "MRR Estimado", value: metrics.estimatedRevenue, icon: TrendingUp, color: "from-emerald-500/20 to-emerald-500/5", iconColor: "text-emerald-400", borderColor: "border-emerald-500/20", prefix: "$" },
            ].map(({ label, value, icon: Icon, color, iconColor, borderColor, prefix }) => (
              <div key={label} className={`relative rounded-xl border ${borderColor} bg-gradient-to-br ${color} backdrop-blur-sm p-4 sm:p-5 overflow-hidden group`}>
                <div className="absolute top-0 right-0 w-20 h-20 bg-white/[0.02] rounded-bl-full" />
                <div className="flex items-center justify-between mb-3">
                  <div className={`h-9 w-9 rounded-lg bg-white/10 flex items-center justify-center`}>
                    <Icon className={`h-4.5 w-4.5 ${iconColor}`} />
                  </div>
                  <Activity className="h-4 w-4 text-white/20 group-hover:text-white/40 transition-colors" />
                </div>
                <p className="text-2xl sm:text-3xl font-bold text-white tabular-nums">
                  {prefix}<AnimatedNumber value={value} />
                </p>
                <p className="text-xs text-white/50 mt-1 font-medium uppercase tracking-wider">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ─── Content ─── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-5">
        {/* Alert bar for businesses at limit */}
        {atLimitCount > 0 && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-destructive/10 border border-destructive/20 text-sm">
            <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
            <span className="text-destructive font-medium">
              {atLimitCount} consultorio{atLimitCount > 1 ? "s" : ""} en el límite de su plan
            </span>
            <Button variant="ghost" size="sm" className="ml-auto text-destructive hover:text-destructive h-7 px-2" onClick={() => setUsageFilter("at_limit")}>
              Ver
            </Button>
          </div>
        )}

        {/* Actions row */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Button className="h-10 px-5 gap-2 font-semibold" onClick={() => setShowCreateModal(true)}>
            <Plus className="h-4 w-4" />
            Nuevo consultorio
          </Button>
          {demoBusinessExists ? (
            <Button variant="outline" className="h-10 px-5 gap-2 font-semibold border-amber-500/30 text-amber-600 hover:bg-amber-500/10" onClick={() => demoBusiness && enterBusiness(demoBusiness.id)}>
              <Play className="h-4 w-4" />
              Entrar a Demo
            </Button>
          ) : (
            <Button variant="outline" className="h-10 px-5 gap-2 font-semibold border-amber-500/30 text-amber-600 hover:bg-amber-500/10" onClick={handleCreateDemo} disabled={creatingDemo}>
              {creatingDemo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {creatingDemo ? "Creando..." : "Crear Demo"}
            </Button>
          )}
        </div>

        {/* ─── Data Grid ─── */}
        <TooltipProvider>
          <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
            {/* Filter bar */}
            <div className="px-4 lg:px-6 py-4 border-b border-border bg-muted/30 flex flex-col lg:flex-row lg:items-center gap-4">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <h2 className="text-base font-semibold text-foreground whitespace-nowrap">Consultorios</h2>
                <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                  {filteredBusinesses.length}{hasActiveFilters ? ` / ${businesses.length}` : ""}
                </span>
              </div>

              <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Buscar..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9 h-9 w-full sm:w-[180px] bg-background" />
                </div>
                <Select value={planFilter} onValueChange={(v) => setPlanFilter(v as PlanFilter)}>
                  <SelectTrigger className="w-[130px] h-9 bg-background"><SelectValue placeholder="Plan" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {PLAN_ORDER.map(code => (<SelectItem key={code} value={code}>{PLAN_DEFINITIONS[code].name}</SelectItem>))}
                  </SelectContent>
                </Select>
                <Select value={usageFilter} onValueChange={(v) => setUsageFilter(v as UsageFilter)}>
                  <SelectTrigger className="w-[130px] h-9 bg-background"><SelectValue placeholder="Estado" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="near_limit">Cerca del límite</SelectItem>
                    <SelectItem value="at_limit">En el límite</SelectItem>
                  </SelectContent>
                </Select>
                {hasActiveFilters && (
                  <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9 px-2 text-muted-foreground hover:text-foreground">
                    <X className="h-4 w-4" />
                  </Button>
                )}
                {!isMobile && (
                  <div className="hidden lg:flex items-center border-l border-border pl-3 ml-1 gap-0.5">
                    <Tooltip><TooltipTrigger asChild><Button variant={compactMode ? "secondary" : "ghost"} size="icon" className="h-8 w-8" onClick={() => setCompactMode(true)}><Rows3 className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent>Compacto</TooltipContent></Tooltip>
                    <Tooltip><TooltipTrigger asChild><Button variant={!compactMode ? "secondary" : "ghost"} size="icon" className="h-8 w-8" onClick={() => setCompactMode(false)}><LayoutGrid className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent>Cómodo</TooltipContent></Tooltip>
                  </div>
                )}
              </div>
            </div>

            {/* Mobile cards / Desktop table */}
            {isMobile ? (
              <div className="space-y-3 p-4">
                {filteredBusinesses.map(business => {
                  const cl = business.planCode === "custom" ? { maxProfessionals: business.customMaxProfessionals ?? null, maxPatients: business.customMaxPatients ?? null } : undefined;
                  const config = getPlanConfig(business.planCode, cl);
                  const profStatus = getUsageStatus(business.professionalsCount, config.maxProfessionals);
                  const patientStatus = getUsageStatus(business.patientsCount, config.maxPatients);
                  return (
                    <Card key={business.id} className="overflow-hidden border-border/60">
                      <CardContent className="p-4 space-y-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-base leading-tight">{business.name}</h3>
                          {business.isDemo && <Badge variant="outline" className="text-[10px] border-amber-500 text-amber-600">Demo</Badge>}
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-xs">{getPlanName(business.planCode)}</Badge>
                          <span className="text-xs text-muted-foreground truncate">{business.ownerEmail}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          {[
                            { label: "Profs", count: business.professionalsCount, max: config.maxProfessionals, status: profStatus },
                            { label: "Pac", count: business.patientsCount, max: config.maxPatients, status: patientStatus },
                          ].map(({ label, count, max, status }) => (
                            <div key={label} className={`p-2.5 rounded-lg text-center ${status.status === "danger" ? "bg-destructive/10" : status.status === "warning" ? "bg-amber-500/10" : "bg-muted/60"}`}>
                              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">{label}</p>
                              <p className={`font-bold text-lg tabular-nums ${status.status === "danger" ? "text-destructive" : status.status === "warning" ? "text-amber-600" : "text-foreground"}`}>
                                {count}<span className="text-sm font-normal text-muted-foreground">/{max ?? "∞"}</span>
                              </p>
                            </div>
                          ))}
                        </div>
                        <div className="flex items-center justify-between pt-2 border-t border-border/50">
                          <div className="flex gap-1">
                            {[
                              { icon: Eye, action: () => enterBusiness(business.id), tip: "Ver" },
                              { icon: Pencil, action: () => openEditModal(business), tip: "Editar" },
                              { icon: UserCog, action: () => loadProfessionals(business), tip: "Equipo" },
                              { icon: Globe, action: () => openPrivateClinicModal(business), tip: "Dominio" },
                            ].map(({ icon: I, action, tip }) => (
                              <Button key={tip} variant="ghost" size="icon" className="h-9 w-9" onClick={action} title={tip}><I className="h-4 w-4" /></Button>
                            ))}
                          </div>
                          <Button variant="ghost" size="icon" className="h-9 w-9 text-destructive hover:bg-destructive/10" onClick={() => openDeleteModal(business)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
                {filteredBusinesses.length === 0 && (
                  <div className="text-center py-12">
                    <Building2 className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
                    <p className="font-medium text-muted-foreground">{hasActiveFilters ? "Sin resultados" : "Sin consultorios"}</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent border-0 bg-muted/40">
                      {["Consultorio", "Dueño", "Plan", "Uso", "Estado", ""].map((h, i) => (
                        <TableHead key={i} className={`font-semibold text-[11px] uppercase tracking-wider text-muted-foreground ${compactMode ? 'py-2.5' : 'py-3.5'} ${i === 0 ? 'pl-6' : ''} ${i === 5 ? 'pr-6 text-right w-12' : ''} ${i === 4 ? 'text-center' : ''}`}>
                          {h}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredBusinesses.length === 0 ? (
                      <TableRow><TableCell colSpan={6} className="h-48 text-center">
                        <Building2 className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
                        <p className="text-muted-foreground">{hasActiveFilters ? "Sin resultados" : "Crea tu primer consultorio"}</p>
                      </TableCell></TableRow>
                    ) : filteredBusinesses.map(business => {
                      const cl = business.planCode === "custom" ? { maxProfessionals: business.customMaxProfessionals ?? null, maxPatients: business.customMaxPatients ?? null } : undefined;
                      const config = getPlanConfig(business.planCode, cl);
                      const profStatus = getUsageStatus(business.professionalsCount, config.maxProfessionals);
                      const patientStatus = getUsageStatus(business.patientsCount, config.maxPatients);
                      const worstStatus = profStatus.status === "danger" || patientStatus.status === "danger" ? "danger" : profStatus.status === "warning" || patientStatus.status === "warning" ? "warning" : "ok";

                      return (
                        <TableRow key={business.id} className="group border-b border-border/40 hover:bg-muted/30 transition-colors">
                          <TableCell className={`pl-6 ${compactMode ? 'py-2.5' : 'py-4'}`}>
                            <div className="flex items-center gap-3">
                              <div className={`rounded-lg bg-primary/10 flex items-center justify-center shrink-0 ${compactMode ? 'h-8 w-8' : 'h-10 w-10'}`}>
                                <Building2 className={`text-primary ${compactMode ? 'h-4 w-4' : 'h-5 w-5'}`} />
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className={`font-medium text-foreground truncate max-w-[200px] ${compactMode ? 'text-sm' : 'text-base'}`}>{business.name}</span>
                                  {business.isDemo && <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-amber-500 text-amber-600">Demo</Badge>}
                                  {business.isPrivateClinic && <Shield className="h-3.5 w-3.5 text-muted-foreground" />}
                                </div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className={compactMode ? 'py-2.5' : 'py-4'}>
                            <span className={`text-muted-foreground truncate block max-w-[180px] ${compactMode ? 'text-xs' : 'text-sm'}`}>{business.ownerEmail}</span>
                          </TableCell>
                          <TableCell className={compactMode ? 'py-2.5' : 'py-4'}>
                            <PlanSelector businessId={business.id} currentPlan={business.planCode} customMaxProfessionals={business.customMaxProfessionals} customMaxPatients={business.customMaxPatients} onChangePlan={handleChangePlan} />
                          </TableCell>
                          <TableCell className={compactMode ? 'py-2.5' : 'py-4'}>
                            <div className="flex flex-col gap-1.5 min-w-[120px]">
                              {[
                                { label: "Profs", count: business.professionalsCount, max: config.maxProfessionals, status: profStatus },
                                { label: "Pac", count: business.patientsCount, max: config.maxPatients, status: patientStatus },
                              ].map(({ label, count, max, status }) => (
                                <div key={label} className="flex items-center gap-2">
                                  <span className="text-[10px] text-muted-foreground w-7 shrink-0">{label}</span>
                                  <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                                    <div className={`h-full rounded-full transition-all ${status.status === "danger" ? "bg-destructive" : status.status === "warning" ? "bg-warning" : "bg-success"}`} style={{ width: `${Math.min(status.percentage || 2, 100)}%` }} />
                                  </div>
                                  <span className={`text-[10px] tabular-nums w-10 text-right ${status.status === "danger" ? "text-destructive font-semibold" : status.status === "warning" ? "text-warning font-medium" : "text-muted-foreground"}`}>
                                    {count}/{max ?? "∞"}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell className={`text-center ${compactMode ? 'py-2.5' : 'py-4'}`}>
                            <Badge variant="secondary" className={`text-[10px] px-2 py-0.5 ${!business.isActive ? "bg-muted text-muted-foreground" : worstStatus === "danger" ? "bg-destructive/10 text-destructive" : worstStatus === "warning" ? "bg-warning/10 text-warning" : "bg-success/10 text-success"}`}>
                              {!business.isActive ? "Inactivo" : worstStatus === "danger" ? "Límite" : worstStatus === "warning" ? "Cerca" : "OK"}
                            </Badge>
                          </TableCell>
                          <TableCell className={`pr-6 text-right ${compactMode ? 'py-2.5' : 'py-4'}`}>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 opacity-50 group-hover:opacity-100 transition-opacity">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-48">
                                <DropdownMenuItem onClick={() => loadProfessionals(business)}><UserCog className="h-4 w-4 mr-2" />Ver detalle</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => enterBusiness(business.id)}><LogIn className="h-4 w-4 mr-2" />Entrar</DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => openEditModal(business)}><Pencil className="h-4 w-4 mr-2" />Editar</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => openPrivateClinicModal(business)}><Globe className="h-4 w-4 mr-2" />Dominio</DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => openDeleteModal(business)} className="text-destructive focus:text-destructive focus:bg-destructive/10"><Trash2 className="h-4 w-4 mr-2" />Eliminar</DropdownMenuItem>
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
        </TooltipProvider>
      </div>

      {/* ─── Modals ─── */}
      {/* Create Business */}
      <Dialog open={showCreateModal} onOpenChange={(open) => { if (!open) resetCreateForm(); setShowCreateModal(open); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Crear nuevo consultorio</DialogTitle><DialogDescription>Ingresa los datos del nuevo consultorio y su dueño</DialogDescription></DialogHeader>
          
          {ownerInviteLink ? (
            <div className="space-y-4 py-4">
              <Alert>
                <AlertDescription>
                  Consultorio creado. Enviá este enlace al dueño para que active su cuenta y establezca su contraseña.
                </AlertDescription>
              </Alert>
              <div className="space-y-2">
                <Label>Enlace de invitación</Label>
                <div className="p-3 bg-muted rounded-md text-sm break-all font-mono">{ownerInviteLink}</div>
              </div>
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => { resetCreateForm(); setShowCreateModal(false); }}>Cerrar</Button>
                <Button className="flex-1 gap-2" onClick={async () => {
                  try { await navigator.clipboard.writeText(ownerInviteLink); setCopied(true); toast({ title: "Enlace copiado" }); setTimeout(() => setCopied(false), 2000); } catch { toast({ title: "Error", description: "No se pudo copiar", variant: "destructive" }); }
                }}>
                  {copied ? <><Check className="h-4 w-4" />Copiado</> : <><Copy className="h-4 w-4" />Copiar enlace</>}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4 py-4">
              {/* Mode selector */}
              <div className="space-y-2">
                <Label>Modo de creación</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Button type="button" variant={createMode === "test" ? "default" : "outline"} className="gap-2 h-auto py-3 flex-col" onClick={() => setCreateMode("test")}>
                    <Terminal className="h-4 w-4" />
                    <span className="text-xs">Test rápido</span>
                  </Button>
                  <Button type="button" variant={createMode === "invite" ? "default" : "outline"} className="gap-2 h-auto py-3 flex-col" onClick={() => setCreateMode("invite")}>
                    <UserPlus className="h-4 w-4" />
                    <span className="text-xs">Invitación real</span>
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {createMode === "test" 
                    ? "Crea el usuario con email y contraseña directa. Ideal para pruebas internas."
                    : "Genera un enlace de invitación. El dueño activa su cuenta y establece su contraseña."
                  }
                </p>
              </div>

              <div className="space-y-2"><Label>Nombre del consultorio</Label><Input value={newBusinessName} onChange={e => setNewBusinessName(e.target.value)} placeholder="Ej: Consultorio Dr. García" /></div>
              <div className="space-y-2"><Label>Email del dueño</Label><Input type="email" value={newBusinessEmail} onChange={e => setNewBusinessEmail(e.target.value)} placeholder="email@ejemplo.com" /><p className="text-xs text-muted-foreground">Si el email ya existe, se asignará ese usuario.</p></div>
              
              {createMode === "test" && (
                <div className="space-y-2"><Label>Contraseña</Label><Input type="password" value={newBusinessPassword} onChange={e => setNewBusinessPassword(e.target.value)} placeholder="Mínimo 6 caracteres" /><p className="text-xs text-muted-foreground">Contraseña para acceso directo de prueba.</p></div>
              )}

              <div className="space-y-2"><Label>Plan</Label>
                <Select value={newBusinessPlan} onValueChange={setNewBusinessPlan}><SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{PLAN_ORDER.map(c => { const p = PLAN_DEFINITIONS[c]; return <SelectItem key={c} value={c}>{p.name} ({p.maxProfessionals === null ? "a medida" : `${p.maxProfessionals} prof, ${p.maxPatients} pac`})</SelectItem>; })}</SelectContent>
                </Select>
              </div>
              <div className="flex gap-3"><Button variant="outline" className="flex-1" onClick={() => { resetCreateForm(); setShowCreateModal(false); }}>Cancelar</Button><Button className="flex-1" onClick={handleCreateBusiness} disabled={creating}>{creating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}{createMode === "test" ? "Crear" : "Crear e invitar"}</Button></div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Professionals */}
      <Dialog open={showProfessionalsModal} onOpenChange={setShowProfessionalsModal}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Profesionales de {selectedBusiness?.name}</DialogTitle><DialogDescription>Gestiona el equipo de este consultorio</DialogDescription></DialogHeader>
          <div className="py-4">
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {professionals.map(prof => (
                <div key={prof.userId} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div><p className="font-medium">{prof.name}</p><p className="text-sm text-muted-foreground">{prof.email}</p></div>
                  <Badge variant={prof.role === "owner" ? "default" : "secondary"}>{prof.role === "owner" ? "Dueño" : "Profesional"}</Badge>
                </div>
              ))}
              {professionals.length === 0 && <p className="text-center text-muted-foreground py-4">No hay profesionales</p>}
            </div>
            <Button className="w-full mt-4 gap-2" onClick={() => setShowAddProfessionalModal(true)}><UserPlus className="h-4 w-4" />Agregar profesional</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Professional */}
      <Dialog open={showAddProfessionalModal} onOpenChange={open => { if (!open) { setInviteLink(null); setCopied(false); setNewProfName(""); setNewProfEmail(""); setProfessionalLimitError(null); } setShowAddProfessionalModal(open); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{inviteLink ? "Enlace de invitación" : "Agregar profesional"}</DialogTitle><DialogDescription>{inviteLink ? "Copia el enlace y envíalo al profesional." : `Agregar a ${selectedBusiness?.name}`}</DialogDescription></DialogHeader>
          {!inviteLink ? (
            <>
              <div className="space-y-4 py-4">
                {professionalLimitError && <Alert variant="destructive"><AlertTriangle className="h-4 w-4" /><AlertDescription>{professionalLimitError}</AlertDescription></Alert>}
                <div className="space-y-2"><Label>Nombre</Label><Input value={newProfName} onChange={e => setNewProfName(e.target.value)} placeholder="Nombre completo" /></div>
                <div className="space-y-2"><Label>Email (opcional)</Label><Input type="email" value={newProfEmail} onChange={e => setNewProfEmail(e.target.value)} placeholder="email@ejemplo.com" /><p className="text-xs text-muted-foreground">Si se proporciona, se genera link de invitación</p></div>
              </div>
              <div className="flex gap-3"><Button variant="outline" className="flex-1" onClick={() => setShowAddProfessionalModal(false)}>Cancelar</Button><Button className="flex-1" onClick={handleAddProfessional} disabled={creating}>{creating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Agregar</Button></div>
            </>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2"><Label>Enlace</Label><div className="p-3 bg-muted rounded-md text-sm break-all font-mono">{inviteLink}</div></div>
              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => { setShowAddProfessionalModal(false); setInviteLink(null); setCopied(false); setNewProfName(""); setNewProfEmail(""); }}>Cerrar</Button>
                <Button onClick={async () => { try { await navigator.clipboard.writeText(inviteLink); setCopied(true); toast({ title: "Copiado" }); setTimeout(() => setCopied(false), 2000); } catch { toast({ title: "Error", variant: "destructive" }); } }} className="gap-2">{copied ? <><Check className="h-4 w-4" />Copiado</> : <><Copy className="h-4 w-4" />Copiar</>}</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Private Clinic */}
      <Dialog open={showPrivateClinicModal} onOpenChange={setShowPrivateClinicModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Globe className="h-5 w-5" />Consultorio Privado</DialogTitle><DialogDescription>Dominio personalizado de {selectedBusiness?.name}</DialogDescription></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <div><Label className="text-sm font-semibold">Consultorio privado</Label><p className="text-xs text-muted-foreground">Habilitar dominio personalizado</p></div>
              <Switch checked={editingPrivateClinic.isPrivateClinic} onCheckedChange={checked => setEditingPrivateClinic({ ...editingPrivateClinic, isPrivateClinic: checked })} />
            </div>
            <div className="space-y-2"><Label>Subdominio</Label><div className="flex items-center gap-1"><Input value={editingPrivateClinic.customSubdomain} onChange={e => setEditingPrivateClinic({ ...editingPrivateClinic, customSubdomain: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") })} placeholder="psilaura" className="flex-1" /><span className="text-sm text-muted-foreground">.tudominio.com</span></div></div>
            <div className="space-y-2"><Label>Dominio propio (opcional)</Label><Input value={editingPrivateClinic.customDomain} onChange={e => setEditingPrivateClinic({ ...editingPrivateClinic, customDomain: e.target.value.toLowerCase() })} placeholder="psicologalaura.com" /></div>
            {selectedBusiness && (editingPrivateClinic.customDomain || editingPrivateClinic.customSubdomain) && (
              <div className="space-y-2"><Label>URL calculada</Label><div className="p-3 bg-muted rounded-md text-sm font-mono break-all">{editingPrivateClinic.customDomain ? `https://${editingPrivateClinic.customDomain}` : `https://${editingPrivateClinic.customSubdomain}.tudominio.com`}</div></div>
            )}
          </div>
          <div className="flex gap-3"><Button variant="outline" className="flex-1" onClick={() => setShowPrivateClinicModal(false)}>Cancelar</Button><Button className="flex-1" onClick={handleSavePrivateClinic} disabled={savingPrivateClinic}>{savingPrivateClinic && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Guardar</Button></div>
        </DialogContent>
      </Dialog>

      {/* Delete */}
      <AlertDialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive"><AlertTriangle className="h-5 w-5" />Eliminar consultorio</AlertDialogTitle>
            <AlertDialogDescription className="space-y-3"><p>Estás por eliminar el consultorio <strong>"{businessToDelete?.name}"</strong> y todos sus datos. Esta acción es irreversible.</p><p className="text-xs text-muted-foreground">Se eliminarán: profesionales, pacientes, citas, pagos, recordatorios, servicios, slots, invitaciones y suscripciones.</p></AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <div className="flex items-start gap-3 p-3 bg-destructive/5 border border-destructive/20 rounded-lg">
              <Checkbox id="deleteConfirm" checked={deleteConfirmChecked} onCheckedChange={c => setDeleteConfirmChecked(c === true)} className="mt-0.5" />
              <Label htmlFor="deleteConfirm" className="text-sm font-normal cursor-pointer leading-relaxed">Entiendo que esta acción es irreversible y se perderán todos los datos</Label>
            </div>
          </div>
          <div className="flex gap-3"><Button variant="outline" className="flex-1" onClick={() => { setShowDeleteModal(false); setBusinessToDelete(null); setDeleteConfirmChecked(false); }}>Cancelar</Button><Button variant="destructive" className="flex-1" onClick={handleDeleteBusiness} disabled={!deleteConfirmChecked || deleting}>{deleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Eliminar definitivamente</Button></div>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Pencil className="h-5 w-5" />Editar consultorio</DialogTitle><DialogDescription>Modificar "{businessToEdit?.name}"</DialogDescription></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2"><Label>Nombre</Label><Input value={editName} onChange={e => setEditName(e.target.value)} /></div>
            <div className="space-y-2"><Label>Email del dueño</Label><Input value={editEmail} disabled className="bg-muted" /><p className="text-xs text-muted-foreground">No se puede cambiar</p></div>
            <div className="space-y-2"><Label>Plan</Label>
              <Select value={editPlan} onValueChange={setEditPlan}><SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{PLAN_ORDER.map(c => <SelectItem key={c} value={c}>{PLAN_DEFINITIONS[c].name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <div><Label className="text-sm font-semibold">Estado activo</Label><p className="text-xs text-muted-foreground">Desactivar pausa el acceso</p></div>
              <Switch checked={editIsActive} onCheckedChange={setEditIsActive} />
            </div>
          </div>
          <div className="flex gap-3"><Button variant="outline" className="flex-1" onClick={() => { setShowEditModal(false); setBusinessToEdit(null); }}>Cancelar</Button><Button className="flex-1" onClick={handleEditBusiness} disabled={saving}>{saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Guardar</Button></div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SaasAdmin;

import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useBusinessIdContext } from "@/contexts/BusinessIdContext";
import { setActiveBusinessId } from "@/hooks/use-business-id";
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
  Loader2, AlertTriangle, ChevronDown, Copy, Check, X, Shield,
  Sparkles, Play, Trash2, Pencil, Search, MoreHorizontal, LogIn,
  Rows3, LayoutGrid, Activity, TrendingUp, Zap, Terminal,
  Mail, RefreshCw, Ban,
} from "lucide-react";
import LoadingPage from "@/components/LoadingPage";
import { getPlanName, getPlanConfig, checkProfessionalLimit } from "@/hooks/use-plan-limits";
import {
  PLAN_DEFINITIONS, PLAN_ORDER, getPlanPrice, normalizePlanCode,
} from "@/lib/plan-definitions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PlanSelector } from "@/components/PlanSelector";
import { useIsMobile } from "@/hooks/use-mobile";
import { isCurrentUserSuperAdmin } from "@/lib/admin-access";
import { SaasAdminLayout, type SaasSection } from "@/components/saas-admin/SaasAdminLayout";
import { EstadisticasSection } from "@/components/saas-admin/EstadisticasSection";
import { FinanzasSection } from "@/components/saas-admin/FinanzasSection";
import { EmbedKitSection } from "@/components/saas-admin/EmbedKitSection";
import { buildShareUrl } from "@/config/app";

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
  /** Cortesía con fecha: al llegar, el listado avisa para retomar el cobro */
  noBillingUntil: string | null;
  subscriptionStatus: "trial" | "active" | "expired" | "cancelled" | "none";
  trialDaysLeft: number | null;
  mpConnected: boolean; // true si la suscripción tiene cobro automático por Mercado Pago
}

const noBillingDue = (b: { isDemo: boolean; noBillingUntil: string | null }) =>
  b.isDemo && !!b.noBillingUntil && new Date(b.noBillingUntil + "T23:59:59") < new Date();

const formatShortDate = (iso: string) =>
  new Date(iso + "T12:00:00").toLocaleDateString("es-UY", { day: "numeric", month: "short" });

interface SaasMetrics {
  totalBusinesses: number;
  totalProfessionals: number;
  totalPatients: number;
  estimatedRevenue: number;
}

// Invitación por email pendiente de activar (pending_business_activations)
interface PendingInvite {
  id: string;
  business_name: string;
  owner_email: string;
  plan_code: string;
  token: string;
  expires_at: string;
  used_at: string | null;
  created_at: string;
}

const inviteStatus = (inv: PendingInvite): { label: string; cls: string } => {
  if (inv.used_at) return { label: "Activada", cls: "bg-success/10 text-success" };
  if (new Date(inv.expires_at) < new Date()) return { label: "Vencida", cls: "bg-destructive/10 text-destructive" };
  return { label: "Pendiente", cls: "bg-amber-500/10 text-amber-500" };
};

const inviteActivationUrl = (inv: PendingInvite) =>
  `https://consultoriodigital.app/activar-consultorio?token=${inv.token}`;

const daysUntil = (iso: string) =>
  Math.ceil((new Date(iso).getTime() - Date.now()) / (1000 * 60 * 60 * 24));

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
  const { refetch: refetchBusinessId } = useBusinessIdContext();
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
  const [newBusinessPlan, setNewBusinessPlan] = useState("esencial");
  const [createMode, setCreateMode] = useState<"test" | "invite">("test");
  const [newBusinessPassword, setNewBusinessPassword] = useState("");
  const [ownerInviteLink, setOwnerInviteLink] = useState<string | null>(null);
  const [showAddProfessionalModal, setShowAddProfessionalModal] = useState(false);
  const [newProfName, setNewProfName] = useState("");
  const [newProfEmail, setNewProfEmail] = useState("");
  const [professionalLimitError, setProfessionalLimitError] = useState<string | null>(null);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [creatingDemo, setCreatingDemo] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [businessToDelete, setBusinessToDelete] = useState<BusinessWithDetails | null>(null);
  const [deleteConfirmChecked, setDeleteConfirmChecked] = useState(false);
  const [ownerOtherBizCount, setOwnerOtherBizCount] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [businessToEdit, setBusinessToEdit] = useState<BusinessWithDetails | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPlan, setEditPlan] = useState("");
  const [editIsActive, setEditIsActive] = useState(true);
  const [editNoBilling, setEditNoBilling] = useState(false);
  const [editNoBillingUntil, setEditNoBillingUntil] = useState("");
  const [saving, setSaving] = useState(false);
  const [showActivateModal, setShowActivateModal] = useState(false);
  const [businessToActivate, setBusinessToActivate] = useState<BusinessWithDetails | null>(null);
  const [activatePlan, setActivatePlan] = useState<string>("esencial");
  const [activateType, setActivateType] = useState<"trial" | "active">("trial");
  const [activateDays, setActivateDays] = useState("15");
  const [activating, setActivating] = useState(false);
  const [activeSection, setActiveSection] = useState<SaasSection>("home");
  const [invites, setInvites] = useState<PendingInvite[]>([]);
  const [inviteToCancel, setInviteToCancel] = useState<PendingInvite | null>(null);
  const [cancellingInvite, setCancellingInvite] = useState(false);
  const [resendingInviteId, setResendingInviteId] = useState<string | null>(null);

  useEffect(() => { checkAccessAndLoad(); }, []);

  const checkAccessAndLoad = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/auth"); return; }
      const isSuperAdmin = await isCurrentUserSuperAdmin(user.id);
      if (!isSuperAdmin) { toast({ title: "Acceso denegado", description: "No tienes permisos para acceder a esta sección", variant: "destructive" }); navigate("/dashboard"); return; }
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
      const { data: subsData } = await supabase.from("subscriptions").select("business_id, status, trial_ends_at, mercadopago_preapproval_id");
      const subsMap = new Map<string, { status: string; trial_ends_at: string | null; mercadopago_preapproval_id: string | null }>();
      subsData?.forEach((s: any) => { if (s.business_id) subsMap.set(s.business_id, s); });
      const businessesWithDetails: BusinessWithDetails[] = (businessesData || []).map(b => ({
        ...b, ownerEmail: profileMap.get(b.owner_user_id) || "N/A",
        ...(() => {
          const sub = subsMap.get(b.id);
          if (!sub) return { subscriptionStatus: "none" as const, trialDaysLeft: null };
          if (sub.status === "active") return { subscriptionStatus: "active" as const, trialDaysLeft: null };
          if (sub.status === "trial" && sub.trial_ends_at) {
            const daysLeft = Math.ceil((new Date(sub.trial_ends_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
            if (daysLeft > 0) return { subscriptionStatus: "trial" as const, trialDaysLeft: daysLeft };
            return { subscriptionStatus: "expired" as const, trialDaysLeft: 0 };
          }
          if (sub.status === "cancelled") return { subscriptionStatus: "cancelled" as const, trialDaysLeft: null };
          return { subscriptionStatus: (sub.status as any) || ("none" as const), trialDaysLeft: null };
        })(),
        mpConnected: !!subsMap.get(b.id)?.mercadopago_preapproval_id,
        professionalsCount: profCountMap.get(b.id) || 0, patientsCount: patientCountMap.get(b.id) || 0,
        planCode: b.plan_code || "individual", isActive: b.is_active !== false,
        customMaxProfessionals: b.custom_max_professionals, customMaxPatients: b.custom_max_patients,
        billingPeriod: b.billing_period || "annual", isPrivateClinic: b.is_private_clinic || false,
        customSubdomain: b.custom_subdomain || null, customDomain: b.custom_domain || null, isDemo: b.is_demo || false,
        noBillingUntil: (b as any).no_billing_until || null,
      }));
      setBusinesses(businessesWithDetails);
      const estimatedRevenue = businessesWithDetails.reduce((sum, b) => sum + getPlanMonthlyRevenue(b.planCode, b.billingPeriod), 0);
      setMetrics({ totalBusinesses: businessesWithDetails.length, totalProfessionals: rolesData?.length || 0, totalPatients: patientsData?.length || 0, estimatedRevenue });

      // Registro de invitaciones enviadas (RLS: solo super_admin las ve)
      const { data: invitesData } = await supabase
        .from("pending_business_activations")
        .select("id, business_name, owner_email, plan_code, token, expires_at, used_at, created_at")
        .order("created_at", { ascending: false })
        .limit(50);
      setInvites((invitesData ?? []) as PendingInvite[]);
    } catch (error) { console.error("Error loading data:", error); toast({ title: "Error", description: "No se pudo cargar la información", variant: "destructive" }); } finally { setLoading(false); }
  };

  // ── Business CRUD ──
  const handleCreateBusiness = async () => {
    // En modo "invite" sólo necesitamos email; el nombre del consultorio
    // lo define el dueño en el wizard de onboarding.
    if (createMode === "invite") {
      if (!newBusinessEmail.trim()) { toast({ title: "Error", description: "El email del dueño es requerido", variant: "destructive" }); return; }
    } else {
      if (!newBusinessName.trim() || !newBusinessEmail.trim()) { toast({ title: "Error", description: "Nombre y email son requeridos", variant: "destructive" }); return; }
      if (!newBusinessPassword || newBusinessPassword.length < 6) { toast({ title: "Error", description: "La contraseña debe tener al menos 6 caracteres", variant: "destructive" }); return; }
    }
    try {
      setCreating(true);
      // Para modo invite usamos un placeholder en businessName porque el
      // backend lo requiere por compatibilidad; el dueño lo va a sobreescribir.
      const businessNameForRequest =
        createMode === "invite"
          ? `Consultorio (pendiente de configurar)`
          : newBusinessName.trim();
      const { data, error } = await supabase.functions.invoke("create-business-owner", {
        body: {
          businessName: businessNameForRequest,
          ownerEmail: newBusinessEmail.trim(),
          planCode: newBusinessPlan,
          mode: createMode,
          password: createMode === "test" ? newBusinessPassword : undefined,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      if (data?.mode === "invite") {
        toast({
          title: "Invitación enviada por email",
          description: `Le enviamos un correo a ${data.sentTo || newBusinessEmail.trim()}. Cuando active la cuenta va a configurar su consultorio desde cero.`,
        });
        setShowCreateModal(false); resetCreateForm();
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
    setNewBusinessName(""); setNewBusinessEmail(""); setNewBusinessPlan("esencial");
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
        const link = buildShareUrl(`/invitar-profesional?token=${data.token}`);
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
      // La página "Mi plan" del cliente lee la SUSCRIPCIÓN: se sincroniza
      // siempre para que el panel admin y lo que ve el cliente nunca difieran.
      await supabase.from("subscriptions").update({ plan_code: newPlanCode }).eq("business_id", businessId);
      toast({ title: "Plan actualizado", description: `Plan cambiado a ${getPlanName(newPlanCode)}` });
      await loadData();
    } catch (error: any) { toast({ title: "Error", description: error.message || "No se pudo cambiar el plan", variant: "destructive" }); }
  };

  const enterBusiness = async (id: string) => {
    setActiveBusinessId(id);
    // El contexto cachea el business resuelto por usuario: sin un refetch
    // forzado el super admin entra con businessId null y lo rebotan al panel.
    await refetchBusinessId();
    navigate("/dashboard");
  };

  const openDeleteModal = async (b: BusinessWithDetails) => {
    setBusinessToDelete(b);
    setDeleteConfirmChecked(false);
    setOwnerOtherBizCount(null);
    setShowDeleteModal(true);
    try {
      const { count } = await supabase
        .from("businesses")
        .select("id", { count: "exact", head: true })
        .eq("owner_user_id", b.owner_user_id)
        .neq("id", b.id);
      setOwnerOtherBizCount(count ?? 0);
    } catch {
      setOwnerOtherBizCount(null);
    }
  };

  const handleDeleteBusiness = async () => {
    if (!businessToDelete || !deleteConfirmChecked) return;
    try {
      setDeleting(true);
      const { data, error } = await supabase.functions.invoke("delete-business", {
        body: { businessId: businessToDelete.id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const ownerDeleted = data?.owner_auth_user_deleted === true;
      const skipReason = data?.owner_skipped_reason as string | null;
      const desc = ownerDeleted
        ? `"${businessToDelete.name}" y la cuenta del owner (${data?.owner_email ?? "—"}) fueron eliminados.`
        : `"${businessToDelete.name}" eliminado. Cuenta del owner preservada${skipReason ? ` (${skipReason})` : ""}.`;
      toast({ title: "Consultorio eliminado", description: desc });
      setShowDeleteModal(false); setBusinessToDelete(null); await loadData();
    } catch (error: any) { toast({ title: "Error al eliminar", description: error.message || "No se pudo eliminar. Probá de nuevo.", variant: "destructive" }); } finally { setDeleting(false); }
  };

  const openEditModal = (b: BusinessWithDetails) => {
    setBusinessToEdit(b); setEditName(b.name); setEditEmail(b.ownerEmail || ""); setEditPlan(b.planCode); setEditIsActive(b.isActive); setEditNoBilling(b.isDemo); setEditNoBillingUntil(b.noBillingUntil ? b.noBillingUntil.slice(0, 10) : ""); setShowEditModal(true);
  };

  const handleEditBusiness = async () => {
    if (!businessToEdit || !editName.trim()) { toast({ title: "Error", description: "El nombre es requerido", variant: "destructive" }); return; }
    try {
      setSaving(true);
      const payload: any = {
        name: editName.trim(), plan_code: editPlan, is_active: editIsActive, is_demo: editNoBilling,
        no_billing_until: editNoBilling && editNoBillingUntil ? editNoBillingUntil : null,
      };
      let { error } = await supabase.from("businesses").update(payload).eq("id", businessToEdit.id);
      if (error && String(error.message || "").includes("no_billing_until")) {
        // La columna todavía no existe en la base: guardamos el resto igual.
        delete payload.no_billing_until;
        ({ error } = await supabase.from("businesses").update(payload).eq("id", businessToEdit.id));
        if (!error && editNoBillingUntil) {
          toast({ title: "Falta un paso en la base", description: "La fecha de aviso no se guardó: corré el SQL de la columna no_billing_until.", variant: "destructive" });
        }
      }
      if (error) throw error;
      // Sincronizar el plan también en la suscripción (lo que ve el cliente)
      await supabase.from("subscriptions").update({ plan_code: editPlan }).eq("business_id", businessToEdit.id);
      toast({ title: "Consultorio actualizado" }); setShowEditModal(false); setBusinessToEdit(null); await loadData();
    } catch (error: any) { toast({ title: "Error", description: error.message || "No se pudo actualizar", variant: "destructive" }); } finally { setSaving(false); }
  };

  const openActivateModal = (b: BusinessWithDetails) => {
    setBusinessToActivate(b);
    const normalized = normalizePlanCode(b.planCode);
    const valid = ["emprendedor", "esencial", "profesional", "consultorio"].includes(normalized) ? normalized : "esencial";
    setActivatePlan(valid);
    setActivateType("trial");
    setActivateDays("15");
    setShowActivateModal(true);
  };

  const handleActivateSubscription = async () => {
    if (!businessToActivate) return;
    try {
      setActivating(true);
      // "trial" → prueba con días elegibles que vence sola. "active" → cuenta
      // activa SIN vencimiento (acceso pleno, sin cobro automático): se corta
      // a mano desde Editar cuando haga falta.
      const isTrial = activateType === "trial";
      const newStatus = isTrial ? "trial" : "active";
      const days = Math.max(1, parseInt(activateDays) || 15);
      const trialEnd = isTrial
        ? new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()
        : null;
      // Sin vencimiento real: fecha lejana para que nada lo bloquee por período
      const periodEnd = trialEnd ?? new Date("2099-01-01T00:00:00Z").toISOString();

      // Buscar suscripción actual
      const { data: existingSub } = await supabase
        .from("subscriptions")
        .select("id")
        .eq("business_id", businessToActivate.id)
        .maybeSingle();

      if (existingSub?.id) {
        const { error: subErr } = await supabase
          .from("subscriptions")
          .update({
            status: newStatus,
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
          status: newStatus,
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

      toast({
        title: activateType === "trial"
          ? `Prueba de ${days} días activada`
          : "Cuenta activada sin vencimiento (sin cobro automático)",
      });
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

  // ── Invitaciones: cancelar (el enlace muere al instante) y reenviar ──
  const handleCancelInvite = async () => {
    if (!inviteToCancel) return;
    try {
      setCancellingInvite(true);
      const { error } = await supabase
        .from("pending_business_activations")
        .delete()
        .eq("id", inviteToCancel.id);
      if (error) throw error;
      setInvites(prev => prev.filter(i => i.id !== inviteToCancel.id));
      toast({
        title: "Invitación cancelada",
        description: `El enlace enviado a ${inviteToCancel.owner_email} quedó inválido: si lo abren, van a ver que ya no sirve.`,
      });
      setInviteToCancel(null);
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "No se pudo cancelar la invitación", variant: "destructive" });
    } finally {
      setCancellingInvite(false);
    }
  };

  const handleResendInvite = async (inv: PendingInvite) => {
    try {
      setResendingInviteId(inv.id);
      // create-business-owner borra la invitación anterior sin usar y crea una
      // nueva con otro token: el correo viejo queda inválido solo.
      const { data, error } = await supabase.functions.invoke("create-business-owner", {
        body: {
          businessName: inv.business_name || "Consultorio (pendiente de configurar)",
          ownerEmail: inv.owner_email,
          planCode: inv.plan_code,
          mode: "invite",
        },
      });
      if (error || data?.error) throw new Error(data?.error || "No se pudo reenviar");
      toast({ title: "Invitación reenviada", description: `Correo nuevo enviado a ${inv.owner_email}. El enlace anterior quedó inválido.` });
      await loadData();
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "No se pudo reenviar la invitación", variant: "destructive" });
    } finally {
      setResendingInviteId(null);
    }
  };

  const copyInviteLink = async (inv: PendingInvite) => {
    try {
      await navigator.clipboard.writeText(inviteActivationUrl(inv));
      toast({ title: "Enlace copiado", description: "Podés mandárselo por WhatsApp si el correo no le llegó." });
    } catch {
      toast({ title: "Error", description: "No se pudo copiar", variant: "destructive" });
    }
  };

  // La demo "de verdad" es la que crea "Crear Demo" (slug demo-psicologia-*);
  // un consultorio real con cobro desactivado (cortesía) no cuenta como demo.
  const demoBusiness = businesses.find(b => b.isDemo && b.public_slug?.startsWith("demo-psicologia"));
  const demoBusinessExists = !!demoBusiness;

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
       if (planFilter !== "all" && normalizePlanCode(b.planCode) !== planFilter) return false;
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

  // KPIs de la sección Consultorios (solo negocios reales, sin demos)
  const kpi = useMemo(() => {
    const real = businesses.filter(b => !b.isDemo);
    const paying = real.filter(b => b.subscriptionStatus === "active" && b.mpConnected).length;
    const manual = real.filter(b => b.subscriptionStatus === "active" && !b.mpConnected).length;
    const trial = real.filter(b => b.subscriptionStatus === "trial").length;
    const expired = real.filter(b => b.subscriptionStatus === "expired").length;
    const mrr = real.reduce((sum, b) =>
      b.subscriptionStatus === "active" ? sum + getPlanMonthlyRevenue(b.planCode, b.billingPeriod) : sum, 0);
    return { total: real.length, paying, manual, active: paying + manual, trial, expired, mrr };
  }, [businesses]);

  const pendingInvitesCount = useMemo(
    () => invites.filter(i => !i.used_at && new Date(i.expires_at) >= new Date()).length,
    [invites],
  );

  // Cortesías que llegaron a su fecha de aviso: hora de retomar el cobro
  const noBillingDueList = useMemo(() => businesses.filter(noBillingDue), [businesses]);

  // Count businesses at limit
  const atLimitCount = useMemo(() => businesses.filter(b => {
    const cl = b.planCode === "custom" ? { maxProfessionals: b.customMaxProfessionals ?? null, maxPatients: b.customMaxPatients ?? null } : undefined;
    const cfg = getPlanConfig(b.planCode, cl);
    return getUsageStatus(b.professionalsCount, cfg.maxProfessionals).status === "danger" || getUsageStatus(b.patientsCount, cfg.maxPatients).status === "danger";
  }).length, [businesses]);

  if (loading) return <LoadingPage />;

  return (
    <SaasAdminLayout
      activeSection={activeSection}
      onSectionChange={setActiveSection}
    >
      {activeSection === "estadisticas" && <EstadisticasSection />}
      {activeSection === "finanzas" && <FinanzasSection />}
      {activeSection === "kitweb" && <EmbedKitSection />}

      {activeSection !== "consultorios" && activeSection !== "estadisticas" && activeSection !== "finanzas" && activeSection !== "kitweb" && (
        <ComingSoonSection section={activeSection} />
      )}

      {activeSection === "consultorios" && (
      <div className="space-y-5">
        {/* Section heading */}
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Consultorios</h1>
            <p className="text-sm text-slate-400 mt-0.5">Gestión de todos los consultorios en la plataforma</p>
          </div>
        </div>

        {/* ─── KPIs del negocio (glass tiles) ─── */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
          {[
            {
              label: "Consultorios",
              icon: Building2,
              accent: "hsl(190 90% 55%)",
              value: kpi.total,
              prefix: "",
              sub: `${kpi.active} activo${kpi.active !== 1 ? "s" : ""} hoy`,
            },
            {
              label: "Cobrando",
              icon: DollarSign,
              accent: "hsl(152 70% 45%)",
              value: kpi.active,
              prefix: "",
              sub: `${kpi.paying} por Mercado Pago · ${kpi.manual} manual`,
            },
            {
              label: "En prueba",
              icon: Activity,
              accent: "hsl(38 95% 55%)",
              value: kpi.trial,
              prefix: "",
              sub: kpi.expired > 0 ? `${kpi.expired} expirado${kpi.expired !== 1 ? "s" : ""} para rescatar` : "sin expirados",
            },
            {
              label: "Ingreso mensual",
              icon: TrendingUp,
              accent: "hsl(262 80% 66%)",
              value: kpi.mrr,
              prefix: "$",
              sub: "estimado, planes activos",
            },
          ].map(({ label, icon: Icon, accent, value, prefix, sub }) => (
            <div
              key={label}
              className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.06] to-white/[0.02] px-5 py-4 transition-colors hover:border-white/20"
            >
              <span
                aria-hidden
                className="absolute -top-12 -right-12 h-28 w-28 rounded-full blur-3xl opacity-25 pointer-events-none"
                style={{ background: accent }}
              />
              <div className="flex items-center justify-between">
                <p className="text-[10px] uppercase tracking-[0.16em] text-slate-400 font-semibold">{label}</p>
                <Icon className="h-4 w-4" style={{ color: accent }} />
              </div>
              <p className="mt-2 text-2xl font-bold text-white tabular-nums leading-none">
                {prefix}<AnimatedNumber value={value} />
              </p>
              <p className="text-[11px] text-slate-500 mt-1.5 truncate">{sub}</p>
            </div>
          ))}
        </div>

        {/* Cortesías vencidas: retomar el cobro */}
        {noBillingDueList.length > 0 && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/25 text-sm">
            <DollarSign className="h-4 w-4 text-amber-500 shrink-0" />
            <span className="text-amber-500 font-medium">
              {noBillingDueList.length === 1
                ? `"${noBillingDueList[0].name}" llegó a su fecha límite sin cobro — hora de retomar el cobro`
                : `${noBillingDueList.length} consultorios llegaron a su fecha límite sin cobro — hora de retomar el cobro`}
            </span>
          </div>
        )}

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
              <div className="divide-y divide-border/50">
                {filteredBusinesses.map(business => {
                  const cl = business.planCode === "custom" ? { maxProfessionals: business.customMaxProfessionals ?? null, maxPatients: business.customMaxPatients ?? null } : undefined;
                  const config = getPlanConfig(business.planCode, cl);
                  const profStatus = getUsageStatus(business.professionalsCount, config.maxProfessionals);
                  const patientStatus = getUsageStatus(business.patientsCount, config.maxPatients);
                  const worstStatus =
                    profStatus.status === "danger" || patientStatus.status === "danger"
                      ? "danger"
                      : profStatus.status === "warning" || patientStatus.status === "warning"
                        ? "warning"
                        : "ok";
                  const statusDot =
                    !business.isActive
                      ? "bg-muted-foreground/40"
                      : worstStatus === "danger"
                        ? "bg-destructive"
                        : worstStatus === "warning"
                          ? "bg-amber-500"
                          : "bg-emerald-500";
                  return (
                    <div key={business.id} className="px-4 py-3.5 flex items-center gap-3 active:bg-muted/40 transition-colors">
                      {/* Status dot + name */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${statusDot}`} />
                          <h3 className="font-medium text-sm text-foreground truncate">{business.name}</h3>
                          {business.isDemo && (
                            <span className={`text-[9px] uppercase tracking-wider font-semibold shrink-0 ${noBillingDue(business) ? "text-destructive" : "text-amber-600"}`}>Sin cobro</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground tabular-nums">
                          <span className="truncate">{getPlanName(business.planCode)}</span>
                          <span className="text-muted-foreground/40">·</span>
                          <span className="shrink-0">
                            {business.professionalsCount}/{config.maxProfessionals ?? "∞"} prof
                          </span>
                          <span className="text-muted-foreground/40">·</span>
                          <span className="shrink-0">
                            {business.patientsCount}/{config.maxPatients ?? "∞"} pac
                          </span>
                          <span className="text-muted-foreground/40">·</span>
                          <span className={`shrink-0 ${business.subscriptionStatus === "active" ? (business.mpConnected ? "text-success" : "text-amber-500") : business.subscriptionStatus === "expired" ? "text-destructive" : business.subscriptionStatus === "trial" ? "text-amber-500" : ""}`}>
                            {business.isDemo ? (noBillingDue(business) ? "Sin cobro · retomar" : "Sin cobro") : business.subscriptionStatus === "active" ? (business.mpConnected ? "Pagando" : "Activa (manual)") : business.subscriptionStatus === "trial" ? `Prueba ${business.trialDaysLeft}d` : business.subscriptionStatus === "expired" ? "Expirado" : business.subscriptionStatus === "cancelled" ? "Cancelado" : !business.isActive ? "Inactivo" : "Sin plan"}
                          </span>
                        </div>
                      </div>

                      {/* Single action menu */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0 text-muted-foreground">
                            <MoreHorizontal className="h-5 w-5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-52">
                          <DropdownMenuItem onClick={() => enterBusiness(business.id)}><LogIn className="h-4 w-4 mr-2" />Entrar</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => loadProfessionals(business)}><UserCog className="h-4 w-4 mr-2" />Ver equipo</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => openEditModal(business)}><Pencil className="h-4 w-4 mr-2" />Editar</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openActivateModal(business)}><Zap className="h-4 w-4 mr-2" />Activar suscripción</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => openDeleteModal(business)} className="text-destructive focus:text-destructive focus:bg-destructive/10"><Trash2 className="h-4 w-4 mr-2" />Eliminar</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  );
                })}
                {filteredBusinesses.length === 0 && (
                  <div className="text-center py-16 px-4">
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
                      {["Consultorio", "Dueño", "Plan", "Uso", "Suscripción", ""].map((h, i) => (
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
                                  {business.isDemo && <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${noBillingDue(business) ? "border-destructive text-destructive" : "border-amber-500 text-amber-600"}`}>Sin cobro</Badge>}
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
                            {(() => {
                              if (business.isDemo) {
                                if (noBillingDue(business)) return <Badge variant="secondary" className="text-[10px] px-2 py-0.5 bg-destructive/10 text-destructive">Sin cobro · retomar</Badge>;
                                if (business.noBillingUntil) return <Badge variant="outline" className="text-[10px] px-2 py-0.5 border-amber-500/40 text-amber-500">Sin cobro · hasta {formatShortDate(business.noBillingUntil)}</Badge>;
                                return <Badge variant="outline" className="text-[10px] px-2 py-0.5 border-amber-500/40 text-amber-500">Sin cobro</Badge>;
                              }
                              if (!business.isActive) return <Badge variant="secondary" className="text-[10px] px-2 py-0.5 bg-muted text-muted-foreground">Inactivo</Badge>;
                              if (business.subscriptionStatus === "active") return business.mpConnected
                                ? <Badge variant="secondary" className="text-[10px] px-2 py-0.5 bg-success/10 text-success">Pagando</Badge>
                                : <Badge variant="secondary" className="text-[10px] px-2 py-0.5 bg-amber-500/10 text-amber-500">Activa (manual)</Badge>;
                              if (business.subscriptionStatus === "trial" && business.trialDaysLeft !== null) return <Badge variant="secondary" className={`text-[10px] px-2 py-0.5 ${business.trialDaysLeft <= 2 ? "bg-destructive/10 text-destructive" : "bg-amber-500/10 text-amber-500"}`}>Prueba · {business.trialDaysLeft}d</Badge>;
                              if (business.subscriptionStatus === "expired") return <Badge variant="secondary" className="text-[10px] px-2 py-0.5 bg-destructive/10 text-destructive">Expirado</Badge>;
                              if (business.subscriptionStatus === "cancelled") return <Badge variant="secondary" className="text-[10px] px-2 py-0.5 bg-muted text-muted-foreground">Cancelado</Badge>;
                              return <Badge variant="secondary" className="text-[10px] px-2 py-0.5 bg-muted text-muted-foreground">Sin plan</Badge>;
                            })()}
                          </TableCell>
                          <TableCell className={`pr-6 text-right ${compactMode ? 'py-2.5' : 'py-4'}`}>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-foreground hover:bg-muted">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-48">
                                <DropdownMenuItem onClick={() => loadProfessionals(business)}><UserCog className="h-4 w-4 mr-2" />Ver detalle</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => enterBusiness(business.id)}><LogIn className="h-4 w-4 mr-2" />Entrar</DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => openEditModal(business)}><Pencil className="h-4 w-4 mr-2" />Editar</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => openActivateModal(business)}><Zap className="h-4 w-4 mr-2" />Activar suscripción</DropdownMenuItem>
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

        {/* ─── Registro de invitaciones enviadas ─── */}
        <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
          <div className="px-4 lg:px-6 py-4 border-b border-border bg-muted/30 flex items-center gap-3">
            <span className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Mail className="h-4 w-4 text-primary" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="text-base font-semibold text-foreground">Invitaciones enviadas</h2>
              <p className="text-xs text-muted-foreground">
                Cancelá una invitación y el enlace del correo muere al instante. También podés reenviarla o copiar el enlace.
              </p>
            </div>
            {pendingInvitesCount > 0 && (
              <Badge variant="secondary" className="bg-amber-500/10 text-amber-500 shrink-0">
                {pendingInvitesCount} pendiente{pendingInvitesCount !== 1 ? "s" : ""}
              </Badge>
            )}
          </div>

          {invites.length === 0 ? (
            <div className="py-10 text-center">
              <Mail className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
              <p className="text-sm text-muted-foreground">Todavía no enviaste invitaciones por email.</p>
            </div>
          ) : (
            <div className="divide-y divide-border/40">
              {invites.map(inv => {
                const st = inviteStatus(inv);
                const isPending = st.label === "Pendiente";
                const dLeft = daysUntil(inv.expires_at);
                return (
                  <div key={inv.id} className="px-4 lg:px-6 py-3 flex items-center gap-4 hover:bg-muted/30 transition-colors">
                    <Badge variant="secondary" className={`text-[10px] px-2 py-0.5 shrink-0 w-20 justify-center ${st.cls}`}>
                      {st.label}
                    </Badge>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground truncate">{inv.owner_email}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {getPlanName(inv.plan_code)} · enviada {formatDate(inv.created_at)}
                        {isPending && dLeft > 0 && <> · vence en {dLeft} día{dLeft !== 1 ? "s" : ""}</>}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {isPending && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={() => copyInviteLink(inv)}>
                              <Copy className="h-3.5 w-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Copiar enlace de activación</TooltipContent>
                        </Tooltip>
                      )}
                      {!inv.used_at && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={() => handleResendInvite(inv)} disabled={resendingInviteId === inv.id}>
                              {resendingInviteId === inv.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Reenviar (correo nuevo, enlace nuevo)</TooltipContent>
                        </Tooltip>
                      )}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => setInviteToCancel(inv)}>
                            <Ban className="h-3.5 w-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>{isPending ? "Cancelar invitación" : "Borrar del registro"}</TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        </TooltipProvider>
      </div>
      )}

      {/* Cancelar invitación */}
      <AlertDialog open={!!inviteToCancel} onOpenChange={(open) => { if (!open) setInviteToCancel(null); }}>
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Ban className="h-5 w-5 text-destructive" />
              Cancelar invitación
            </AlertDialogTitle>
            <AlertDialogDescription>
              Vas a cancelar la invitación enviada a <strong>{inviteToCancel?.owner_email}</strong>.
              El enlace del correo queda inválido al instante: si la persona lo abre, va a ver que ya no sirve.
              No se borra ningún consultorio ni dato.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setInviteToCancel(null)}>Volver</Button>
            <Button variant="destructive" className="flex-1" onClick={handleCancelInvite} disabled={cancellingInvite}>
              {cancellingInvite && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Cancelar invitación
            </Button>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      {/* Create Business */}
      <Dialog open={showCreateModal} onOpenChange={(open) => { if (!open) resetCreateForm(); setShowCreateModal(open); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Crear nuevo consultorio</DialogTitle><DialogDescription>Ingresa los datos del nuevo consultorio y su dueño</DialogDescription></DialogHeader>
          
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
                    : "Le enviamos un correo al dueño. Activa su cuenta, define su contraseña y configura su consultorio desde cero."
                  }
                </p>
              </div>

              {createMode === "test" && (
                <div className="space-y-2"><Label>Nombre del consultorio</Label><Input value={newBusinessName} onChange={e => setNewBusinessName(e.target.value)} placeholder="Ej: Consultorio Dr. García" /></div>
              )}
              <div className="space-y-2"><Label>Email del dueño</Label><Input type="email" value={newBusinessEmail} onChange={e => setNewBusinessEmail(e.target.value)} placeholder="email@ejemplo.com" /><p className="text-xs text-muted-foreground">{createMode === "invite" ? "Le va a llegar un correo de activación a esta dirección." : "Si el email ya existe, se asignará ese usuario."}</p></div>
              
              {createMode === "test" && (
                <div className="space-y-2"><Label>Contraseña</Label><Input type="password" value={newBusinessPassword} onChange={e => setNewBusinessPassword(e.target.value)} placeholder="Mínimo 6 caracteres" /><p className="text-xs text-muted-foreground">Contraseña para acceso directo de prueba.</p></div>
              )}

              <div className="space-y-2"><Label>Plan</Label>
                <Select value={newBusinessPlan} onValueChange={setNewBusinessPlan}><SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{PLAN_ORDER.map(c => { const p = PLAN_DEFINITIONS[c]; return <SelectItem key={c} value={c}>{p.name} ({p.maxProfessionals === null ? "a medida" : p.maxPatients === null ? `${p.maxProfessionals} prof, pacientes ilimitados` : `${p.maxProfessionals} prof, ${p.maxPatients} pac`})</SelectItem>; })}</SelectContent>
                </Select>
              </div>
              <div className="flex gap-3"><Button variant="outline" className="flex-1" onClick={() => { resetCreateForm(); setShowCreateModal(false); }}>Cancelar</Button><Button className="flex-1" onClick={handleCreateBusiness} disabled={creating}>{creating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}{createMode === "test" ? "Crear" : "Enviar invitación por email"}</Button></div>
          </div>
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

      {/* Delete */}
      <AlertDialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive"><AlertTriangle className="h-5 w-5" />Eliminar consultorio</AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>Estás por eliminar el consultorio <strong>"{businessToDelete?.name}"</strong> y todos sus datos. Esta acción es irreversible.</p>
              <p className="text-xs text-muted-foreground">Se eliminarán: profesionales, pacientes, citas, pagos, recordatorios, servicios, slots, invitaciones y suscripciones.</p>
              {ownerOtherBizCount === null ? (
                <p className="text-xs text-muted-foreground">Verificando cuenta del owner…</p>
              ) : ownerOtherBizCount > 0 ? (
                <p className="text-xs"><strong>Cuenta del owner</strong> ({businessToDelete?.ownerEmail}) se <strong>preservará</strong>: tiene {ownerOtherBizCount} consultorio(s) adicional(es).</p>
              ) : (
                <p className="text-xs text-destructive"><strong>También se eliminará</strong> la cuenta del owner ({businessToDelete?.ownerEmail}) de auth (no tiene otros consultorios).</p>
              )}
            </AlertDialogDescription>
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
            <div className="p-3 bg-muted/50 rounded-lg space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-semibold">Desactivar cobro en el sistema</Label>
                  <p className="text-xs text-muted-foreground">Sigue funcionando normal, pero no cuenta en Finanzas ni en los KPIs (cortesía/prueba)</p>
                </div>
                <Switch checked={editNoBilling} onCheckedChange={setEditNoBilling} />
              </div>
              {editNoBilling && (
                <div className="space-y-1.5 pt-1 border-t border-border/50">
                  <Label className="text-xs font-semibold">Avisarme a partir de (opcional)</Label>
                  <Input type="date" value={editNoBillingUntil} onChange={e => setEditNoBillingUntil(e.target.value)} className="h-9" />
                  <p className="text-xs text-muted-foreground">
                    Cuando llegue esa fecha, el listado te muestra un aviso para retomar el cobro. Vacío = sin límite.
                  </p>
                </div>
              )}
            </div>
          </div>
          <div className="flex gap-3"><Button variant="outline" className="flex-1" onClick={() => { setShowEditModal(false); setBusinessToEdit(null); }}>Cancelar</Button><Button className="flex-1" onClick={handleEditBusiness} disabled={saving}>{saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Guardar</Button></div>
        </DialogContent>
      </Dialog>

      {/* Activate Subscription */}
      <Dialog open={showActivateModal} onOpenChange={(open) => { if (!open) setBusinessToActivate(null); setShowActivateModal(open); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Zap className="h-5 w-5 text-primary" />Activar manualmente</DialogTitle>
            <DialogDescription>
              Activación manual para <strong>{businessToActivate?.name}</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Tipo de activación</Label>
              <Select value={activateType} onValueChange={(v) => setActivateType(v as "trial" | "active")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="trial">Prueba (vence sola)</SelectItem>
                  <SelectItem value="active">Cuenta activa (acceso pleno, sin cobro)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {activateType === "trial" && (
              <div className="space-y-2">
                <Label>Duración de la prueba</Label>
                <Select value={activateDays} onValueChange={setActivateDays}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7">7 días</SelectItem>
                    <SelectItem value="15">15 días</SelectItem>
                    <SelectItem value="30">30 días</SelectItem>
                    <SelectItem value="60">60 días</SelectItem>
                    <SelectItem value="90">90 días</SelectItem>
                    <SelectItem value="180">180 días</SelectItem>
                    <SelectItem value="365">1 año</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Volver a activar con más días extiende la prueba; Billing lo refleja al instante.
                </p>
              </div>
            )}
            <div className="space-y-2">
              <Label>Plan a asignar</Label>
              <Select value={activatePlan} onValueChange={setActivatePlan}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="emprendedor">Emprendedor</SelectItem>
                  <SelectItem value="esencial">Esencial</SelectItem>
                  <SelectItem value="profesional">Profesional</SelectItem>
                  <SelectItem value="consultorio">Consultorio</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Alert>
              <AlertDescription className="text-xs">
                {activateType === "trial"
                  ? `Crea una prueba gratuita de ${activateDays} días. Al vencer, la cuenta se bloquea y la persona paga por Mercado Pago.`
                  : "Deja la cuenta activa con acceso pleno, SIN cobro automático y SIN vencimiento. La cobrás por fuera (transferencia, etc.) y si el cliente deja de pagar, la cortás vos desde Editar o pasándola a una prueba."}
              </AlertDescription>
            </Alert>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => { setShowActivateModal(false); setBusinessToActivate(null); }}>Cancelar</Button>
            <Button className="flex-1 gap-2" onClick={handleActivateSubscription} disabled={activating}>
              {activating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
              Activar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </SaasAdminLayout>
  );
};

// ── Coming Soon placeholder for sections under construction ──
const ComingSoonSection = ({ section }: { section: SaasSection }) => {
  const labels: Record<SaasSection, { title: string; desc: string }> = {
    home: { title: "Panel", desc: "" },
    consultorios: { title: "Consultorios", desc: "" },
    finanzas: { title: "Finanzas", desc: "Gráficos de ingresos por mes, MRR por plan, total cobrado vs proyectado." },
    kitweb: { title: "Kit Web", desc: "Snippets de reserva embebida y botón de portal para webs con dominio propio." },
    estadisticas: { title: "Estadísticas", desc: "" },
    usuarios: { title: "Usuarios", desc: "Lista de profesionales registrados en la plataforma con búsqueda y filtros." },
    planes: { title: "Planes", desc: "Editor de nombre, precios y límites de cada plan." },
    sistema: { title: "Sistema", desc: "Salud técnica (webhooks de MercadoPago, edge functions, push) y configuración global del SaaS." },
  };
  const info = labels[section];
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="h-16 w-16 rounded-2xl bg-blue-500/10 ring-1 ring-blue-500/20 flex items-center justify-center mb-4 shadow-[0_0_30px_-10px_rgba(59,130,246,0.6)]">
        <span className="text-2xl">🚧</span>
      </div>
      <h2 className="text-2xl font-bold text-white mb-2">{info.title}</h2>
      <p className="text-sm text-slate-400 max-w-md mb-6">{info.desc}</p>
      <div className="px-4 py-1.5 rounded-full bg-slate-800/60 border border-slate-700 text-xs font-mono uppercase tracking-wider text-slate-300">
        Próximamente
      </div>
    </div>
  );
};

export default SaasAdmin;

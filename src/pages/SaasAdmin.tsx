import { useEffect, useState } from "react";
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
} from "lucide-react";

interface BusinessWithDetails {
  id: string;
  name: string;
  owner_user_id: string;
  public_slug: string;
  created_at: string;
  ownerEmail?: string;
  professionalsCount: number;
  patientsCount: number;
  plan?: string;
  isActive?: boolean;
}

interface SaasMetrics {
  totalBusinesses: number;
  totalProfessionals: number;
  totalPatients: number;
  estimatedRevenue: number;
}

const SUPER_ADMIN_EMAIL = "santib1997@gmail.com";

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

  // Create business form state
  const [newBusinessName, setNewBusinessName] = useState("");
  const [newBusinessEmail, setNewBusinessEmail] = useState("");
  const [newBusinessPlan, setNewBusinessPlan] = useState("free");

  // Create professional form state
  const [showAddProfessionalModal, setShowAddProfessionalModal] = useState(false);
  const [newProfName, setNewProfName] = useState("");
  const [newProfEmail, setNewProfEmail] = useState("");

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
        plan: "free", // TODO: implement plans
        isActive: true,
      }));

      setBusinesses(businessesWithDetails);

      // Calculate metrics
      const totalProfessionals = rolesData?.length || 0;
      const totalPatients = patientsData?.length || 0;

      setMetrics({
        totalBusinesses: businessesWithDetails.length,
        totalProfessionals,
        totalPatients,
        estimatedRevenue: 0, // TODO: calculate based on plans
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
      setNewBusinessPlan("free");
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

      const { data, error } = await supabase.functions.invoke("create-professional-invite", {
        body: {
          email: newProfEmail.trim().toLowerCase() || undefined,
          name: newProfName.trim(),
          businessId: selectedBusiness.id,
        },
      });

      if (error) throw error;

      toast({
        title: "Profesional agregado",
        description: newProfEmail
          ? "Se ha creado el profesional y generado un link de invitación"
          : "El profesional ha sido agregado al consultorio",
      });

      setShowAddProfessionalModal(false);
      setNewProfName("");
      setNewProfEmail("");
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

        {/* Metrics */}
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

        {/* Create Business Button */}
        <Button
          className="w-full h-12 rounded-xl font-semibold gap-2"
          onClick={() => setShowCreateModal(true)}
        >
          <Plus className="h-5 w-5" />
          Crear nuevo consultorio
        </Button>

        {/* Businesses Table */}
        <Card className="mobile-card">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-bold">Consultorios</CardTitle>
          </CardHeader>
          <CardContent className="p-0 sm:p-6 sm:pt-0">
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
                  {businesses.map((business) => (
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
                        <Badge variant="secondary" className="capitalize">
                          {business.plan}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        {business.professionalsCount}
                      </TableCell>
                      <TableCell className="text-center">
                        {business.patientsCount}
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
                  ))}
                  {businesses.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        No hay consultorios registrados
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
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
                  <SelectItem value="free">Gratuito</SelectItem>
                  <SelectItem value="basic">Básico</SelectItem>
                  <SelectItem value="pro">Profesional</SelectItem>
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
      <Dialog open={showAddProfessionalModal} onOpenChange={setShowAddProfessionalModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Agregar profesional</DialogTitle>
            <DialogDescription>
              Agrega un nuevo profesional a {selectedBusiness?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
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
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SaasAdmin;

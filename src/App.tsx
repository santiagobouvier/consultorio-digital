import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Component, lazy, Suspense, useEffect, type ErrorInfo, type ReactNode } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import {
  clearServiceWorkerCaches,
  isChunkLoadFailure,
  recoverFromChunkLoadFailure,
} from "@/lib/session-recovery";
import { SessionExpiredDialog, triggerSessionExpired } from "@/components/SessionExpiredDialog";
import { AuthProvider } from "@/contexts/AuthContext";
import { BusinessIdProvider } from "@/contexts/BusinessIdContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { PWAInstalledCelebrationModal } from "@/components/PWAInstalledCelebrationModal";
import LoadingPage from "@/components/LoadingPage";
import { useAuthSync } from "@/hooks/use-auth-sync";


// Lazy load all pages for optimal performance (code-split per route)
const Landing = lazy(() => import("./pages/Landing"));
const Auth = lazy(() => import("./pages/Auth"));
const AuthCallback = lazy(() => import("./pages/AuthCallback"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const BusinessSetup = lazy(() => import("./pages/OnboardingWizard"));
const Patients = lazy(() => import("./pages/Patients"));
const PatientDetail = lazy(() => import("./pages/PatientDetail"));
const Appointments = lazy(() => import("./pages/Appointments"));
const Agenda = lazy(() => import("./pages/CalendarV2"));
const PendingReminders = lazy(() => import("./pages/PendingReminders"));
const ClinicSettings = lazy(() => import("./pages/ClinicSettings"));
const AvailableSlots = lazy(() => import("./pages/AvailableSlots"));
const PublicClinic = lazy(() => import("./pages/PublicClinic"));
const PublicBooking = lazy(() => import("./pages/PublicBooking"));
const AppointmentRequests = lazy(() => import("./pages/AppointmentRequests"));
const PlanPayment = lazy(() => import("./pages/PlanPayment"));
const Payments = lazy(() => import("./pages/Payments"));
const PatientPortal = lazy(() => import("./pages/PatientPortal"));
const PatientInvitation = lazy(() => import("./pages/PatientInvitation"));
const ProfessionalInvitation = lazy(() => import("./pages/ProfessionalInvitation"));
const ProfessionalRegister = lazy(() => import("./pages/ProfessionalRegister"));

const Statistics = lazy(() => import("./pages/Statistics"));
const SaasAdmin = lazy(() => import("./pages/SaasAdmin"));
const CommandCenter = lazy(() => import("./pages/CommandCenter"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const Billing = lazy(() => import("./pages/Billing"));
const NotFound = lazy(() => import("./pages/NotFound"));
const PatientPortalDemo = lazy(() => import("./pages/PatientPortalDemo"));
const PortalCustomization = lazy(() => import("./pages/PortalCustomization"));
const ClinicPortal = lazy(() => import("./pages/ClinicPortal"));
const ActivateTrial = lazy(() => import("./pages/ActivateTrial"));
const Activating = lazy(() => import("./pages/Activating"));
const ActivateBusinessAccount = lazy(() => import("./pages/ActivateBusinessAccount"));
const Pricing = lazy(() => import("./pages/Pricing"));
const Demo = lazy(() => import("./pages/Demo"));
const DemoReservar = lazy(() => import("./pages/DemoReservar"));
const DemoAgenda = lazy(() => import("./pages/DemoAgenda"));
const AccessSelector = lazy(() => import("./pages/AccessSelector"));
const PatientAccess = lazy(() => import("./pages/PatientAccess"));
const Terms = lazy(() => import("./pages/Terms"));
const Privacy = lazy(() => import("./pages/Privacy"));
const HelpCenter = lazy(() => import("./pages/HelpCenter"));
const SubscriptionGuard = lazy(() => import("./components/SubscriptionGuard"));
const SuperAdminGuard = lazy(() => import("./components/SuperAdminGuard"));

class ChunkLoadRecoveryBoundary extends Component<
  { children: ReactNode },
  { chunkLoadFailed: boolean; error: unknown }
> {
  state = { chunkLoadFailed: false, error: null };

  static getDerivedStateFromError(error: unknown) {
    return { chunkLoadFailed: isChunkLoadFailure(error), error };
  }

  componentDidCatch(error: unknown, errorInfo: ErrorInfo) {
    if (isChunkLoadFailure(error)) {
      void recoverFromChunkLoadFailure({ unregisterServiceWorkers: true });
      return;
    }

    console.error("Error no recuperable en la app", error, errorInfo);
  }

  render() {
    if (this.state.chunkLoadFailed) {
      return <LoadingPage />;
    }

    if (this.state.error) {
      throw this.state.error;
    }

    return this.props.children;
  }
}

// Defaults globales: datos válidos por 30s, mantenidos en caché 5min.
// refetchOnWindowFocus: true permite revalidar datos al volver a la pestaña
// (importante para detectar cambios tras inactividad o sesión refrescada).
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 120_000,
      gcTime: 600_000,
      refetchOnWindowFocus: true,
      retry: 1,
    },
  },
});

// Helper to wrap a page with subscription guard + sidebar layout
const Protected = ({ children }: { children: React.ReactNode }) => (
  <SubscriptionGuard>
    <DashboardLayout>{children}</DashboardLayout>
  </SubscriptionGuard>
);

// Super admin pages live in their own visual world (no clinic sidebar / no subscription guard).
// The page itself renders SaasAdminLayout with its dedicated dark-blue sidebar.
const AdminProtected = ({ children }: { children: React.ReactNode }) => (
  <SuperAdminGuard>{children}</SuperAdminGuard>
);

const PROTECTED_ROUTE_PREFIXES = [
  "/dashboard",
  "/patients",
  "/appointments",
  "/agenda",
  "/centro-control",
  "/recordatorios-pendientes",
  "/mi-consultorio",
  "/horarios-disponibles",
  "/solicitudes",
  "/pagos",
  "/personalizar-portal",
  "/billing",
  "/estadisticas",
  "/ayuda",
  "/saas-admin",
];

const isOnProtectedRoute = () =>
  PROTECTED_ROUTE_PREFIXES.some((prefix) => window.location.pathname.startsWith(prefix));

/**
 * Wrapper interno que vive DENTRO del BrowserRouter para poder usar
 * useNavigate / useLocation desde el hook de sincronización entre pestañas.
 */
const AuthSyncBridge = () => {
  useAuthSync();
  return null;
};

const App = () => {
  useEffect(() => {
    // Único responsable de reaccionar a cambios de sesión a nivel app:
    // - SIGNED_OUT: limpiar caches del SW.
    // - El refresh automático del token lo maneja supabase-js internamente.
    //   No usamos heartbeat ni revalidación en visibilitychange porque eso
    //   provocaba "recargas fantasma" tras inactividad o al cambiar de pestaña.
    // - No actuamos en TOKEN_REFRESHED ni USER_UPDATED — son eventos normales
    //   y dispararlos con redirects rompía la navegación entre rutas protegidas.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        void clearServiceWorkerCaches();
        return;
      }
      // Caso borde: el token vence y Supabase no pudo refrescarlo.
      // Solo actuamos si el usuario realmente está en una ruta protegida
      // y no hay sesión disponible. Mostramos dialog amigable, sin hard reset.
      if (event === "TOKEN_REFRESHED" && !session && isOnProtectedRoute()) {
        triggerSessionExpired();
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <SessionExpiredDialog />
        <PWAInstalledCelebrationModal />
        <BrowserRouter>
          <AuthSyncBridge />
          <AuthProvider>
            <BusinessIdProvider>
            <ChunkLoadRecoveryBoundary>
            <Suspense fallback={<LoadingPage />}>
              <Routes>
                {/* Public routes */}
                <Route path="/" element={<Landing />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/auth/callback" element={<AuthCallback />} />
                <Route path="/configurar-negocio" element={<BusinessSetup />} />
                <Route path="/consultorio/:slug" element={<PublicClinic />} />
                <Route path="/consultorio/:slug/reservar" element={<PublicBooking />} />
                <Route path="/pago-plan/:planId" element={<PlanPayment />} />
                <Route path="/portal-paciente" element={<PatientPortal />} />
                <Route path="/portal-paciente/invitacion" element={<PatientInvitation />} />
                <Route path="/invitar-profesional" element={<ProfessionalInvitation />} />
                <Route path="/registrarse-profesional" element={<ProfessionalRegister />} />
                <Route path="/onboarding-consultorio" element={<BusinessSetup />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/activar-prueba" element={<ActivateTrial />} />
                <Route path="/activating" element={<Activating />} />
                <Route path="/activar-consultorio" element={<ActivateBusinessAccount />} />
                <Route path="/portal-paciente/demo" element={<PatientPortalDemo />} />
                <Route path="/portal/:slug" element={<ClinicPortal />} />
                <Route path="/pricing" element={<Pricing />} />
                <Route path="/demo" element={<Demo />} />
                <Route path="/demo/reservar" element={<DemoReservar />} />
                <Route path="/demo/agenda" element={<DemoAgenda />} />
                <Route path="/acceso" element={<AccessSelector />} />
                <Route path="/acceso/paciente" element={<PatientAccess />} />
                <Route path="/terminos" element={<Terms />} />
                <Route path="/privacidad" element={<Privacy />} />

                {/* Protected routes - require active subscription + sidebar */}
                <Route path="/dashboard" element={<Protected><Dashboard /></Protected>} />
                <Route path="/patients" element={<Protected><Patients /></Protected>} />
                <Route path="/patients/:id" element={<Protected><PatientDetail /></Protected>} />
                <Route path="/appointments" element={<Protected><Appointments /></Protected>} />
                <Route path="/agenda" element={<Protected><Agenda /></Protected>} />
                <Route path="/centro-control" element={<Protected><CommandCenter /></Protected>} />
                <Route path="/recordatorios-pendientes" element={<Protected><PendingReminders /></Protected>} />
                <Route path="/mi-consultorio" element={<Protected><ClinicSettings /></Protected>} />
                <Route path="/horarios-disponibles" element={<Protected><AvailableSlots /></Protected>} />
                <Route path="/solicitudes" element={<Protected><AppointmentRequests /></Protected>} />
                <Route path="/pagos" element={<Protected><Payments /></Protected>} />
                <Route path="/personalizar-portal" element={<Protected><PortalCustomization /></Protected>} />
                <Route path="/billing" element={<Protected><Billing /></Protected>} />
                <Route path="/estadisticas" element={<Protected><Statistics /></Protected>} />
                <Route path="/ayuda" element={<Protected><HelpCenter /></Protected>} />
                <Route path="/saas-admin" element={<AdminProtected><SaasAdmin /></AdminProtected>} />

                {/* Catch-all */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
            </ChunkLoadRecoveryBoundary>
            </BusinessIdProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
};

export default App;

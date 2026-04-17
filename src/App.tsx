import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { lazy, Suspense, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { clearServiceWorkerCaches } from "@/lib/session-recovery";


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
const SubscriptionGuard = lazy(() => import("./components/SubscriptionGuard"));
const SuperAdminGuard = lazy(() => import("./components/SuperAdminGuard"));

// Defaults globales: datos válidos por 30s, mantenidos en caché 5min.
// Esto permite que al volver a una sección los datos se muestren al instante
// desde la caché y se revaliden en background.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 300_000,
      refetchOnWindowFocus: false,
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

const App = () => {
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        void clearServiceWorkerCaches();
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Suspense fallback={null}>
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
              <Route path="/portal-paciente/demo" element={<PatientPortalDemo />} />
              <Route path="/portal/:slug" element={<ClinicPortal />} />

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
              <Route path="/saas-admin" element={<AdminProtected><SaasAdmin /></AdminProtected>} />

              {/* Catch-all */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;

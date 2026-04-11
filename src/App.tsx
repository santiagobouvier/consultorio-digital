import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { lazy, Suspense } from "react";
// Lazy load all pages for optimal performance
const Landing = lazy(() => import("./pages/Landing"));
const Auth = lazy(() => import("./pages/Auth"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const BusinessSetup = lazy(() => import("./pages/BusinessSetup"));
const Patients = lazy(() => import("./pages/Patients"));
const PatientDetail = lazy(() => import("./pages/PatientDetail"));
const Appointments = lazy(() => import("./pages/Appointments"));
const Agenda = lazy(() => import("./pages/Agenda"));
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
const ConsultorioOnboarding = lazy(() => import("./pages/ConsultorioOnboarding"));
const SaasAdmin = lazy(() => import("./pages/SaasAdmin"));
const CommandCenter = lazy(() => import("./pages/CommandCenter"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const Billing = lazy(() => import("./pages/Billing"));
const NotFound = lazy(() => import("./pages/NotFound"));
const SubscriptionGuard = lazy(() => import("./components/SubscriptionGuard"));

const queryClient = new QueryClient();

// Helper to wrap a page with subscription guard
const Protected = ({ children }: { children: React.ReactNode }) => (
  <SubscriptionGuard>{children}</SubscriptionGuard>
);

const App = () => (
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
            <Route path="/configurar-negocio" element={<BusinessSetup />} />
            <Route path="/consultorio/:slug" element={<PublicClinic />} />
            <Route path="/consultorio/:slug/reservar" element={<PublicBooking />} />
            <Route path="/pago-plan/:planId" element={<PlanPayment />} />
            <Route path="/portal-paciente" element={<PatientPortal />} />
            <Route path="/portal-paciente/invitacion" element={<PatientInvitation />} />
            <Route path="/invitar-profesional" element={<ProfessionalInvitation />} />
            <Route path="/registrarse-profesional" element={<ProfessionalRegister />} />
            <Route path="/onboarding-consultorio" element={<ConsultorioOnboarding />} />
            <Route path="/billing" element={<Billing />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            
            {/* Protected routes - require active subscription */}
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
            <Route path="/saas-admin" element={<SaasAdmin />} />
            
            {/* Catch-all */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

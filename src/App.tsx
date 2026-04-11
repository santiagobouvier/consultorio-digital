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
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Suspense fallback={null}>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/configurar-negocio" element={<BusinessSetup />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/patients" element={<Patients />} />
            <Route path="/patients/:id" element={<PatientDetail />} />
            <Route path="/appointments" element={<Appointments />} />
            <Route path="/agenda" element={<Agenda />} />
            <Route path="/centro-control" element={<CommandCenter />} />
            <Route path="/recordatorios-pendientes" element={<PendingReminders />} />
            <Route path="/mi-consultorio" element={<ClinicSettings />} />
            <Route path="/horarios-disponibles" element={<AvailableSlots />} />
            <Route path="/solicitudes" element={<AppointmentRequests />} />
            <Route path="/consultorio/:slug" element={<PublicClinic />} />
            <Route path="/consultorio/:slug/reservar" element={<PublicBooking />} />
            <Route path="/pago-plan/:planId" element={<PlanPayment />} />
            <Route path="/pagos" element={<Payments />} />
            <Route path="/portal-paciente" element={<PatientPortal />} />
            <Route path="/portal-paciente/invitacion" element={<PatientInvitation />} />
            <Route path="/invitar-profesional" element={<ProfessionalInvitation />} />
            <Route path="/registrarse-profesional" element={<ProfessionalRegister />} />
            <Route path="/onboarding-consultorio" element={<ConsultorioOnboarding />} />
            <Route path="/saas-admin" element={<SaasAdmin />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

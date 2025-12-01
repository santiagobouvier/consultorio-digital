import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import BusinessSetup from "./pages/BusinessSetup";
import Patients from "./pages/Patients";
import PatientDetail from "./pages/PatientDetail";
import Appointments from "./pages/Appointments";
import Agenda from "./pages/Agenda";
import PendingReminders from "./pages/PendingReminders";
import ClinicSettings from "./pages/ClinicSettings";
import PublicClinic from "./pages/PublicClinic";
import PublicBooking from "./pages/PublicBooking";
import AppointmentRequests from "./pages/AppointmentRequests";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/configurar-negocio" element={<BusinessSetup />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/patients" element={<Patients />} />
          <Route path="/patients/:id" element={<PatientDetail />} />
          <Route path="/appointments" element={<Appointments />} />
          <Route path="/agenda" element={<Agenda />} />
          <Route path="/recordatorios-pendientes" element={<PendingReminders />} />
          <Route path="/mi-consultorio" element={<ClinicSettings />} />
          <Route path="/solicitudes" element={<AppointmentRequests />} />
          <Route path="/consultorio/:slug" element={<PublicClinic />} />
          <Route path="/consultorio/:slug/reservar" element={<PublicBooking />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

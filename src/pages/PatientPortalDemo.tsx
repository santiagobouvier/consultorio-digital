import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { usePWAInstall } from "@/hooks/use-pwa-install";
import {
  PatientPortalView,
  type PortalBranding,
  type PortalPatient,
  type PortalAppointment,
  type PortalPayment,
} from "@/components/portal/PatientPortalView";

const BRANDING: PortalBranding = {
  name: "Consultorio Demo",
  specialty: "Psicología Clínica",
  contactEmail: "demo@consultoriodigital.app",
  logoUrl: "",
  lightColor: "176 100% 32%",
  darkColor: "176 70% 55%",
};

const PATIENT: PortalPatient = {
  id: "demo-patient",
  full_name: "María González",
  email: "maria@example.com",
  whatsapp_phone: "+59899123456",
  avatar_url: null,
  reason_for_consultation: "Acompañamiento terapéutico semanal.",
  private_notes: "Recordá practicar los ejercicios de respiración antes de dormir.",
  created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 90).toISOString(),
};

const inDays = (d: number, h = 10) => {
  const date = new Date();
  date.setDate(date.getDate() + d);
  date.setHours(h, 0, 0, 0);
  return date.toISOString();
};

const UPCOMING: PortalAppointment[] = [
  {
    id: "demo-up-1",
    start_at: inDays(2, 10),
    end_at: inDays(2, 11),
    status: "scheduled",
    modality: "presencial",
    location: "Av. Brasil 2345, Montevideo",
    notes: null,
    service_name: "Sesión individual",
    payment_status: "pending",
  },
  {
    id: "demo-up-2",
    start_at: inDays(9, 10),
    end_at: inDays(9, 11),
    status: "scheduled",
    modality: "online",
    location: null,
    notes: null,
    service_name: "Sesión individual",
    payment_status: "paid",
  },
];

const PAST: PortalAppointment[] = [
  {
    id: "demo-past-1",
    start_at: inDays(-5, 10),
    end_at: inDays(-5, 11),
    status: "completed",
    modality: "presencial",
    location: "Av. Brasil 2345, Montevideo",
    notes: null,
    service_name: "Sesión individual",
    payment_status: "paid",
  },
  {
    id: "demo-past-2",
    start_at: inDays(-12, 10),
    end_at: inDays(-12, 11),
    status: "completed",
    modality: "online",
    location: null,
    notes: null,
    service_name: "Sesión individual",
    payment_status: "paid",
  },
];

const PAYMENTS: PortalPayment[] = [
  {
    id: "demo-pay-1",
    amount: 1500,
    currency: "UYU",
    due_date: inDays(2),
    status: "pending",
    paid_at: null,
    recurrence_label: "Sesión",
    notes: null,
    appointment_id: "demo-up-1",
  },
  {
    id: "demo-pay-2",
    amount: 1500,
    currency: "UYU",
    due_date: inDays(-5),
    status: "paid",
    paid_at: inDays(-5),
    recurrence_label: "Sesión",
    notes: null,
    appointment_id: "demo-past-1",
  },
];

export default function PatientPortalDemo() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { canInstall, isInstalled, install } = usePWAInstall();
  // La elección de tema queda guardada, como en el portal real
  const [isDark, setIsDark] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    const stored = localStorage.getItem("portal-theme");
    return stored ? stored === "dark" : true;
  });
  useEffect(() => {
    localStorage.setItem("portal-theme", isDark ? "dark" : "light");
  }, [isDark]);

  useEffect(() => {
    document.title = "Portal del Paciente — Demo";
  }, []);

  const noop = (msg = "Modo demo: acción no disponible.") => {
    toast({ title: "Demo", description: msg });
  };

  return (
    <PatientPortalView
      branding={BRANDING}
      patient={PATIENT}
      upcomingAppointments={UPCOMING}
      pastAppointments={PAST}
      payments={PAYMENTS}
      isDark={isDark}
      onToggleDark={() => setIsDark((v) => !v)}
      isDemo
      canInstall={canInstall}
      isInstalled={isInstalled}
      onInstallApp={() => { install(); }}
      headerAction="back"
      backLabel="Volver a las demos"
      onBack={() => navigate("/demo")}
      onBookAppointment={() => noop("Reserva de citas deshabilitada en la demo.")}
      onSaveProfile={() => noop("Edición de perfil deshabilitada en la demo.")}
      onPaySession={() => noop("Pagos deshabilitados en la demo.")}
      // La demo muestra TODO lo que puede hacer un paciente: los botones de
      // pagar, reprogramar y cancelar aparecen y avisan que es demo
      mpConnected
      onPayPayments={() => noop("Pagos deshabilitados en la demo.")}
      onCancelAppointment={() => noop("Cancelación deshabilitada en la demo.")}
      onRescheduleAppointment={() => noop("Reprogramación deshabilitada en la demo.")}
    />
  );
}
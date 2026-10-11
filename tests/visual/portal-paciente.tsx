// Página de prueba visual (solo tests/visual): monta el PatientPortalView REAL
// con datos ficticios según ?escenario=…&tema=claro|oscuro. Sin sesión ni
// backend: las novedades y documentos los inyecta la prueba con page.route.
import { useState } from "react";
import { createRoot } from "react-dom/client";
import "@/index.css";
import { Toaster } from "@/components/ui/toaster";
import {
  PatientPortalView,
  type PortalAppointment,
  type PortalBranding,
  type PortalPatient,
  type PortalPayment,
} from "@/components/portal/PatientPortalView";

const params = new URLSearchParams(location.search);
const escenario = params.get("escenario") || "completo";

const at = (days: number, hour = 10) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
};
const apt = (id: string, days: number, hour: number, extra: Partial<PortalAppointment> = {}): PortalAppointment => ({
  id, start_at: at(days, hour), end_at: at(days, hour + 1), status: days >= 0 ? "confirmed" : "completed",
  modality: "presencial", location: "Consultorio Pocitos", notes: null, service_name: "Sesión individual", ...extra,
});
const pay = (id: string, amount: number, dueDays: number, status: string, extra: Partial<PortalPayment> = {}): PortalPayment => ({
  id, amount, currency: "UYU", due_date: at(dueDays).slice(0, 10), status, paid_at: status === "paid" ? at(dueDays) : null,
  recurrence_label: "Sesión", notes: null, ...extra,
});

const branding: PortalBranding = {
  name: "Consultorio Ficticio QA", specialty: "Psicología clínica", contactEmail: "contacto@ejemplo.test",
  logoUrl: "", lightColor: "176 100% 32%", darkColor: "176 85% 42%",
};
const patient: PortalPatient = {
  id: "pac-ficticio", full_name: "Lucía Ficticia Pérez", email: "lucia@ejemplo.test", whatsapp_phone: "099 000 000",
  avatar_url: null, reason_for_consultation: null, private_notes: null, created_at: at(-120),
};

const past = Array.from({ length: 8 }, (_, i) =>
  apt(`p${i}`, -7 * (i + 1), 10, i === 0 ? { notes: "Practicar la respiración 4-7-8 antes de dormir." } : {}));

const DATA: Record<string, { upcoming: PortalAppointment[]; past: PortalAppointment[]; payments: PortalPayment[] }> = {
  completo: {
    upcoming: [apt("u1", 1, 10), apt("u2", 8, 10), apt("u3", 15, 10)],
    past,
    payments: [
      pay("x1", 1800, -12, "overdue", { appointment_id: "p1" }),
      pay("x2", 1800, 1, "pending", { appointment_id: "u1" }),
      pay("x3", 1800, -7, "paid", { appointment_id: "p0" }),
      pay("x4", 1800, -14, "paid"),
    ],
  },
  vacio: { upcoming: [], past: [], payments: [] },
  "sin-citas-con-pagos": {
    upcoming: [],
    past: past.slice(0, 3),
    payments: [pay("y1", 2000, -20, "overdue"), pay("y2", 2000, -5, "overdue"), pay("y3", 2000, 3, "due_soon")],
  },
  "al-dia": {
    upcoming: [apt("u1", 0, 18, { modality: "online", location: null })],
    past: past.slice(0, 4),
    payments: [pay("z1", 1800, -7, "paid", { appointment_id: "p0" })],
  },
};

function Harness() {
  const [isDark, setIsDark] = useState(params.get("tema") !== "claro");
  document.documentElement.classList.toggle("dark", isDark);
  const d = DATA[escenario] ?? DATA.completo;
  return (
    <>
      <PatientPortalView
        branding={branding}
        patient={patient}
        upcomingAppointments={d.upcoming}
        pastAppointments={d.past}
        payments={d.payments}
        isDark={isDark}
        onToggleDark={() => setIsDark((v) => !v)}
        headerAction="logout"
        onLogout={() => {}}
        onBookAppointment={() => {}}
        onCancelAppointment={async () => {}}
        onRescheduleAppointment={() => {}}
        onSaveProfile={async () => {}}
        onPaySession={async () => {}}
        onPayPayments={async () => {}}
        mpConnected
      />
      <Toaster />
    </>
  );
}

createRoot(document.getElementById("root")!).render(<Harness />);

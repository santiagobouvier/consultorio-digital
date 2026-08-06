// Demo del WhatsApp automático COMPLETO: todos los avisos que salen solos,
// tanto al paciente como al profesional. Se elige el aviso y el celular
// muestra el mensaje tal como llega. Una sola pantalla, responsive.
import { useState } from "react";
import { DemoBanner } from "@/components/demo/DemoBanner";
import { WhatsAppPhone, buildDemoWaConfirmation, buildDemoWaReminder, type WaMessage } from "@/components/demo/WhatsAppPhone";
import { User, Stethoscope } from "lucide-react";

const BRAND = "#00c78a";

const fechaEs = (() => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toLocaleDateString("es-UY", { weekday: "long", day: "numeric", month: "long" });
})();

interface Scenario {
  id: string;
  group: "paciente" | "profesional";
  label: string;
  explain: string;
  header: { name: string; initials: string };
  messages: WaMessage[];
}

const PRO_HEADER = { name: "Consultorio Digital", initials: "CD" };
const CLINIC_HEADER = { name: "Mente Clara", initials: "MC" };

const SCENARIOS: Scenario[] = [
  {
    id: "confirmacion",
    group: "paciente",
    label: "Confirmación de reserva",
    explain: "Sale al instante cuando el paciente reserva online o le agendás una cita.",
    header: CLINIC_HEADER,
    messages: [buildDemoWaConfirmation("16:00")],
  },
  {
    id: "recordatorio",
    group: "paciente",
    label: "Recordatorio de sesión",
    explain: "Vos elegís cuántas horas antes sale (24 hs, por ejemplo). Es lo que más baja las ausencias.",
    header: CLINIC_HEADER,
    messages: [buildDemoWaReminder("16:00")],
  },
  {
    id: "reprogramacion",
    group: "paciente",
    label: "Cambio de horario",
    explain: "Si reprogramás una sesión, el paciente se entera solo, sin que le escribas.",
    header: CLINIC_HEADER,
    messages: [{
      text: `Hola Sofía 👋\n\nTu sesión con Mente Clara cambió de horario:\n\n📅 ${fechaEs}\n🕐 17:30 hs (antes 16:00)\n\nSi el nuevo horario no te sirve, escribile a tu profesional: +598 98 123 456\n\n¡Nos vemos!`,
      time: "11:02",
    }],
  },
  {
    id: "cancelacion",
    group: "paciente",
    label: "Cancelación",
    explain: "Si una sesión se cancela, el aviso sale al momento. Nadie viaja de gusto.",
    header: CLINIC_HEADER,
    messages: [{
      text: `Hola Sofía,\n\nTu sesión con Mente Clara del ${fechaEs} a las 16:00 hs fue cancelada.\n\nPara coordinar una nueva fecha, escribile a tu profesional: +598 98 123 456`,
      time: "09:15",
    }],
  },
  {
    id: "nueva-reserva",
    group: "profesional",
    label: "Nueva reserva",
    explain: "Alguien reservó desde tu web: te llega al instante, con la cita ya confirmada en tu agenda.",
    header: PRO_HEADER,
    messages: [{
      text: `Hola Camila 👋\n\n¡Nueva reserva en tu consultorio!\n\n🧑 Sofía Pereyra\n📅 ${fechaEs}\n🕐 16:00 hs\n\nLa cita ya está confirmada en tu agenda.`,
      time: "10:24",
    }],
  },
  {
    id: "cobro",
    group: "profesional",
    label: "Pago recibido",
    explain: "Un paciente pagó online con Mercado Pago: te enterás sin abrir el panel.",
    header: PRO_HEADER,
    messages: [{
      text: `¡Cobraste! 💸\n\nSofía Pereyra pagó $ 1.500 por su sesión del ${fechaEs} a las 16:00 hs.\n\nEl pago ya figura registrado en tu panel.`,
      time: "10:26",
    }],
  },
  {
    id: "cancelacion-pro",
    group: "profesional",
    label: "Cancelación de un paciente",
    explain: "Si un paciente cancela desde su portal, lo sabés al momento y el horario queda libre.",
    header: PRO_HEADER,
    messages: [{
      text: `Hola Camila,\n\nSofía Pereyra canceló su sesión del ${fechaEs} a las 16:00 hs.\n\nEl horario quedó libre en tu agenda.`,
      time: "09:15",
    }],
  },
];

const DemoWhatsApp = () => {
  const [selectedId, setSelectedId] = useState("confirmacion");
  const scenario = SCENARIOS.find((s) => s.id === selectedId)!;

  return (
    <div className="min-h-dvh bg-black text-white flex flex-col">
      <DemoBanner />

      <div className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 py-4 sm:py-6 flex flex-col md:grid md:grid-cols-[1fr_auto] md:gap-10 md:items-center">
        {/* Selector + explicación */}
        <div className="min-w-0">
          <h1 className="text-2xl md:text-3xl font-bold mb-1">WhatsApp automático</h1>
          <p className="text-sm text-white/50 mb-4 md:mb-5">
            Todo esto sale solo, sin que nadie escriba. Tocá un aviso y miralo tal como llega:
          </p>

          {(["paciente", "profesional"] as const).map((group) => (
            <div key={group} className="mb-3 md:mb-4">
              <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.14em] font-semibold text-white/40 mb-1.5">
                {group === "paciente" ? <User className="w-3.5 h-3.5" /> : <Stethoscope className="w-3.5 h-3.5" />}
                {group === "paciente" ? "Le llegan a tu paciente" : "Te llegan a vos"}
              </p>
              <div className="flex md:flex-col flex-wrap gap-1.5">
                {SCENARIOS.filter((s) => s.group === group).map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setSelectedId(s.id)}
                    className="text-left rounded-xl border px-3 py-2 transition-colors md:w-full"
                    style={
                      s.id === selectedId
                        ? { borderColor: BRAND, backgroundColor: "rgba(0,199,138,0.1)" }
                        : { borderColor: "rgba(255,255,255,0.12)" }
                    }
                  >
                    <span className={`block text-[13px] font-semibold ${s.id === selectedId ? "text-white" : "text-white/70"}`}>
                      {s.label}
                    </span>
                    {/* La explicación solo del seleccionado, para no saturar */}
                    {s.id === selectedId && (
                      <span className="block text-[12px] text-white/50 mt-0.5 leading-snug">{s.explain}</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* El celular: cambia (y anima) con cada aviso elegido */}
        <div className="mt-4 md:mt-0 flex items-center justify-center">
          <WhatsAppPhone
            key={scenario.id}
            clinicName={scenario.header.name}
            clinicInitials={scenario.header.initials}
            messages={scenario.messages}
            animate
          />
        </div>
      </div>
    </div>
  );
};

export default DemoWhatsApp;

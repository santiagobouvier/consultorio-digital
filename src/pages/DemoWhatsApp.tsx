// Demo del WhatsApp automático: el celular del paciente con los avisos
// reales del producto (confirmación + recordatorio). El diferenciador
// principal, mostrado tal cual llega.
import { DemoBanner } from "@/components/demo/DemoBanner";
import { WhatsAppPhone, buildDemoWaMessages } from "@/components/demo/WhatsAppPhone";
import { Check } from "lucide-react";

const BRAND = "#00c78a";

const BULLETS = [
  "Confirmación al instante cuando reservan online",
  "Recordatorio automático antes de cada sesión",
  "Avisos de reprogramación y cancelación",
  "A vos también te avisa: nueva reserva, cobro recibido",
];

const DemoWhatsApp = () => (
  <div className="min-h-screen bg-black text-white">
    <DemoBanner />
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 sm:py-14 grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
      <div>
        <h1 className="text-3xl sm:text-4xl font-bold mb-3">WhatsApp automático</h1>
        <p className="text-white/50 mb-6 leading-relaxed">
          Cada aviso le llega al paciente con el nombre de tu consultorio, sin que toques nada.
          Es lo que más baja las ausencias — y lo que tus pacientes más agradecen.
        </p>
        <ul className="space-y-3">
          {BULLETS.map((b) => (
            <li key={b} className="flex items-start gap-2.5 text-sm text-white/80">
              <span className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5" style={{ backgroundColor: "rgba(0,199,138,0.15)" }}>
                <Check className="w-3 h-3" style={{ color: BRAND }} />
              </span>
              {b}
            </li>
          ))}
        </ul>
      </div>
      <WhatsAppPhone
        clinicName="Mente Clara"
        clinicInitials="MC"
        messages={buildDemoWaMessages()}
        animate
      />
    </div>
  </div>
);

export default DemoWhatsApp;

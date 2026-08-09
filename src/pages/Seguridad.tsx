// Página de seguridad: el argumento de venta para la pregunta que TODOS los
// profesionales de la salud hacen. Honesta al 100%: todo lo que se afirma acá
// es verdad verificable del sistema. Mostrable en reuniones y compartible por
// WhatsApp (/seguridad).
import { Link } from "react-router-dom";
import {
  ArrowLeft, Lock, Database, ShieldCheck, KeyRound, CreditCard, MessageCircle,
  HardDriveDownload, EyeOff, Sparkles,
} from "lucide-react";

const BRAND = "#00c78a";

const PILLARS = [
  {
    icon: Lock,
    title: "Cifrado de punta a punta del viaje",
    body: "Los datos viajan cifrados (HTTPS/TLS) y se guardan cifrados (AES-256). Si alguien interceptara la conexión o robara un disco, vería solo ruido ilegible.",
  },
  {
    icon: ShieldCheck,
    title: "Cada consultorio, una caja aparte",
    body: "El aislamiento entre consultorios está en la base de datos misma (Row Level Security), no en la aplicación. Un consultorio no puede ver datos de otro, ni por error ni por ataque.",
  },
  {
    icon: EyeOff,
    title: "Historia clínica blindada",
    body: "Diagnósticos, medicación y notas de sesión viven en una zona sin ningún acceso desde el portal del paciente ni la web pública. Solo el profesional las ve. Por diseño, no por promesa.",
  },
  {
    icon: KeyRound,
    title: "Contraseñas irrecuperables",
    body: "No guardamos contraseñas: guardamos un hash irreversible. Nadie puede verlas, ni siquiera nosotros. Y el sistema rechaza contraseñas que aparecieron en filtraciones conocidas.",
  },
  {
    icon: CreditCard,
    title: "Las tarjetas nunca nos tocan",
    body: "Los pagos los procesa Mercado Pago (certificación PCI DSS) directo en la cuenta del profesional. Ningún dato de tarjeta pasa ni se guarda en la Plataforma.",
  },
  {
    icon: Database,
    title: "Infraestructura de primera línea",
    body: "Los datos viven en Supabase sobre Amazon Web Services (región São Paulo) — infraestructura con certificaciones SOC 2 e ISO 27001, la misma que usan bancos y gobiernos.",
  },
  {
    icon: MessageCircle,
    title: "WhatsApp oficial, sin contenido clínico",
    body: "Los avisos salen por la API oficial de Meta y solo llevan nombre, fecha y hora — jamás información clínica. \"Tenés sesión el martes a las 16\" y nada más.",
  },
  {
    icon: HardDriveDownload,
    title: "Respaldos diarios y datos tuyos",
    body: "Copias de seguridad automáticas todos los días. Y los datos son del profesional y sus pacientes: se pueden exportar (CSV) y llevar en cualquier momento.",
  },
];

const ACCESS_ROWS = [
  { who: "El profesional", what: "Todo lo de sus pacientes", ok: true },
  { who: "El paciente (desde su portal)", what: "Solo sus citas, pagos y documentos compartidos. Historia clínica: nunca.", ok: true },
  { who: "Otros consultorios", what: "Nada. Aislamiento a nivel base de datos.", ok: false },
  { who: "Consultorio Digital (nosotros)", what: "Acceso técnico de administración, usado únicamente para soporte solicitado, bajo confidencialidad. No usamos ni vendemos datos.", ok: true },
  { who: "Proveedores de infraestructura", what: "Custodian datos cifrados, sin acceso al contenido (SOC 2).", ok: false },
];

const Seguridad = () => (
  <div className="min-h-screen bg-black text-white px-4 sm:px-6 py-10 sm:py-14">
    <div className="max-w-4xl mx-auto">
      <Link to="/" className="inline-flex items-center gap-2 text-sm text-white/50 hover:text-white transition-colors mb-10">
        <ArrowLeft className="w-4 h-4" /> Volver al inicio
      </Link>

      {/* Hero */}
      <div className="text-center mb-10 sm:mb-14">
        <div className="w-14 h-14 mx-auto rounded-2xl flex items-center justify-center mb-5" style={{ backgroundColor: "rgba(0,199,138,0.14)" }}>
          <ShieldCheck className="w-7 h-7" style={{ color: BRAND }} />
        </div>
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight mb-3">
          Tus datos, protegidos en serio
        </h1>
        <p className="text-base sm:text-lg text-gray-400 max-w-2xl mx-auto font-light">
          Trabajás con información sensible. Así la cuidamos — sin promesas vacías:
          cada punto de esta página es verificable.
        </p>
      </div>

      {/* Pilares */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-12">
        {PILLARS.map((p) => (
          <div key={p.title} className="rounded-2xl border border-white/10 p-5" style={{ backgroundColor: "#111111" }}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ backgroundColor: "rgba(0,199,138,0.12)" }}>
              <p.icon className="w-5 h-5" style={{ color: BRAND }} />
            </div>
            <h3 className="text-base font-bold mb-1.5">{p.title}</h3>
            <p className="text-sm text-white/50 leading-relaxed">{p.body}</p>
          </div>
        ))}
      </div>

      {/* Quién ve qué */}
      <div className="rounded-2xl border border-white/10 overflow-hidden mb-12" style={{ backgroundColor: "#111111" }}>
        <div className="px-5 py-4 border-b border-white/10">
          <h2 className="text-lg font-bold">¿Quién puede ver los datos?</h2>
          <p className="text-sm text-white/50">La pregunta correcta — y la respuesta completa, sin letra chica.</p>
        </div>
        <div className="divide-y divide-white/5">
          {ACCESS_ROWS.map((r) => (
            <div key={r.who} className="px-5 py-3.5 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-6">
              <p className="text-sm font-semibold sm:w-56 shrink-0">{r.who}</p>
              <p className="text-sm text-white/55">{r.what}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Roadmap honesto */}
      <div
        className="rounded-2xl border p-5 sm:p-6 mb-12 flex items-start gap-4"
        style={{ borderColor: "rgba(0,199,138,0.35)", background: "linear-gradient(135deg, rgba(0,199,138,0.10) 0%, rgba(0,165,160,0.04) 100%)" }}
      >
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: BRAND }}>
          <Sparkles className="w-5 h-5 text-black" />
        </div>
        <div>
          <h3 className="text-base font-bold mb-1">En desarrollo: cifrado clínico con clave del profesional</h3>
          <p className="text-sm text-white/55 leading-relaxed">
            Una capa opcional donde las notas clínicas se cifran con una clave que solo el profesional
            posee — ni siquiera nuestro equipo técnico podría leerlas. Lo estamos construyendo con el
            cuidado que una función así exige.
          </p>
        </div>
      </div>

      {/* CTA */}
      <div className="text-center pb-6">
        <p className="text-sm text-white/50 mb-4">¿Tenés una pregunta específica sobre seguridad?</p>
        <a
          href="mailto:contacto@consultoriodigital.app"
          className="inline-flex items-center justify-center h-11 px-6 rounded-xl text-sm font-semibold text-black"
          style={{ backgroundColor: BRAND }}
        >
          Escribinos: contacto@consultoriodigital.app
        </a>
      </div>
    </div>
  </div>
);

export default Seguridad;

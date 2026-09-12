// Landing de Consultorio Digital — diseño "Luz editorial" aprobado en el
// mockup de Claude Design: fondo claro cálido, tipografía grande, mucho aire
// y el teal de la marca como único acento. La agenda como protagonista,
// sincronización en vivo con Google Calendar / iPhone, cobros y reservas.
// Sin mención a creación de páginas web (eso se ofrece en privado).
// Los planes se contratan mano a mano: cada botón abre WhatsApp con el
// mensaje armado según plan y forma de pago.
import { usePageMeta } from "@/hooks/use-page-meta";
import { useJsonLd } from "@/hooks/use-json-ld";
import { useMemo, useState } from "react";
import {
  ArrowRight,
  Check,
  CreditCard,
  Link2,
  MessageCircle,
} from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { PLAN_DEFINITIONS, PUBLIC_PLAN_ORDER, formatPrice } from "@/lib/plan-definitions";
import { InstallAppButton } from "@/components/InstallAppButton";
import { ScrollReveal } from "@/components/landing/ScrollReveal";
import { LandingNavbar } from "@/components/landing/LandingNavbar";
import { ScrollToTop } from "@/components/landing/ScrollToTop";

// Marca sobre claro
const BRAND = "#1f938d";
const TEAL_DEEP = "#14655f";
const BG = "#fbfaf7";
const BG2 = "#f3f1ea";
const INK = "#16211c";
const MUTED = "#5b6a63";
const DIM = "#93a09a";
const HAIR = "rgba(22,33,28,.08)";
const HAIR2 = "rgba(22,33,28,.1)";
const CARD_BORDER = "1px solid rgba(22,33,28,.09)";
const GROTESK = { fontFamily: "'Space Grotesk', sans-serif" } as const;

const WA_DEMO =
  "https://wa.me/59898543623?text=Hola%2C%20quiero%20ver%20una%20demo%20de%20Consultorio%20Digital";
const WA_PERSONALIZADO =
  "https://wa.me/59898543623?text=Hola,%20quiero%20un%20plan%20personalizado%20para%20mi%20consultorio.";

// La contratación es mano a mano: cada plan abre WhatsApp con un mensaje ya
// escrito. Un solo precio por plan, facturado en un pago anual.
const waPlanUrl = (planName: string, priceLabel: string) =>
  `https://wa.me/59898543623?text=${encodeURIComponent(
    `¡Hola! Me interesa el plan ${planName} de Consultorio Digital (${priceLabel}/mes, pago anual). ¿Me contás cómo empezar?`
  )}`;

// FAQ real, sin nada de páginas web
const faqItems = [
  {
    question: "¿Qué incluye cada plan?",
    answer:
      "Todos los planes incluyen el sistema completo: agenda sincronizada con Google Calendar y iPhone, link público de reservas, portal del paciente, cobro online con Mercado Pago, recordatorios automáticos por WhatsApp y email, expediente clínico, estadísticas, app instalable y tu marca. La diferencia está en la cantidad de pacientes activos y de WhatsApps automáticos por mes.",
  },
  {
    question: "¿Necesito saber de tecnología?",
    answer:
      "No. Te dejamos todo configurado y andando en una videollamada corta. Después el sistema trabaja solo: recuerda, reclama y sincroniza sin que toques nada.",
  },
  {
    question: "¿Mis pacientes tienen que instalar algo?",
    answer:
      "Nada. Reciben un link y agendan desde el navegador del celular, como abrir cualquier página.",
  },
  {
    question: "¿Los recordatorios automáticos tienen costo extra?",
    answer:
      "No. Cada plan incluye una cantidad generosa de recordatorios de WhatsApp por mes (250 en Emprendedor, 700 en Esencial, 1.500 en Profesional) y los de email son ilimitados en todos los planes. Si llegás al límite de WhatsApps, tus pacientes siguen recibiendo el aviso por email igual.",
  },
  {
    question: "¿De qué número le llega el WhatsApp a mis pacientes?",
    answer:
      "Desde el número oficial de Consultorio Digital, con un mensaje aprobado por WhatsApp que incluye el nombre de tu consultorio y TU número de contacto — si el paciente quiere reprogramar, te escribe directo a vos.",
  },
  {
    question: "¿Puedo cambiar de plan en cualquier momento?",
    answer:
      "Sí, podés escalar tu plan cuando lo necesites. Si pasás a un plan superior, solo pagás la diferencia proporcional.",
  },
  {
    question: "¿Mis pacientes pueden ver información de otros pacientes?",
    answer:
      "No. Cada paciente accede solo a su propia información: sus citas, su historial y su estado de pagos. La privacidad está garantizada.",
  },
];

const Landing = () => {
  usePageMeta({
    title: "Consultorio Digital | Tu agenda, trabajando por vos",
    description:
      "Citas, recordatorios por WhatsApp, cobros y reservas online en un solo lugar — sincronizado en vivo con Google Calendar y tu iPhone.",
    canonicalPath: "/",
  });

  useJsonLd(
    "landing-faq",
    useMemo(
      () => ({
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: faqItems.map((item) => ({
          "@type": "Question",
          name: item.question,
          acceptedAnswer: { "@type": "Answer", text: item.answer },
        })),
      }),
      []
    )
  );

  // Planes reales: un solo precio por plan (el mensual equivalente del pago anual)
  const plans = useMemo(() => {
    return PUBLIC_PLAN_ORDER.filter((code) => code !== "personalizado").map((code) => {
      const p = PLAN_DEFINITIONS[code];
      return {
        code,
        name: p.name,
        price: p.priceAnnual,
        patients:
          p.maxPatients === null ? "Pacientes activos sin límite" : `Hasta ${p.maxPatients} pacientes activos`,
        whatsapps: p.whatsappMonthly
          ? `${p.whatsappMonthly.toLocaleString("es-UY")} WhatsApps automáticos por mes`
          : "WhatsApps automáticos sin límite",
        professionals:
          p.maxProfessionals === 1 ? "1 profesional" : `Hasta ${p.maxProfessionals} profesionales`,
        highlight: code === "esencial",
      };
    });
  }, []);

  return (
    <div className="min-h-screen" style={{ background: BG, color: INK, fontFamily: "'Instrument Sans', 'Plus Jakarta Sans', sans-serif" }}>
      <style>{`
        @media (prefers-reduced-motion: no-preference) {
        @keyframes dotGo { 0% { left: 6%; opacity: 0; } 12% { opacity: 1; } 88% { opacity: 1; } 100% { left: 90%; opacity: 0; } }
        @keyframes dotBack { 0% { left: 90%; opacity: 0; } 12% { opacity: 1; } 88% { opacity: 1; } 100% { left: 6%; opacity: 0; } }
        @keyframes pulseRing { 0% { box-shadow: 0 0 0 0 rgba(31,147,141,.35); } 70% { box-shadow: 0 0 0 12px rgba(31,147,141,0); } 100% { box-shadow: 0 0 0 0 rgba(31,147,141,0); } }
        @keyframes heroUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        .cd-up { opacity: 0; animation: heroUp .8s cubic-bezier(0.16,1,0.3,1) forwards; }
        }
        @media (prefers-reduced-motion: reduce) {
          .cd-up { opacity: 1; }
        }
      `}</style>

      <LandingNavbar />

      {/* ═══════════ HERO ═══════════ */}
      <section className="relative px-5 sm:px-8 pt-28 pb-16 lg:pt-40 lg:pb-24">
        <div className="relative max-w-6xl mx-auto flex flex-col lg:flex-row items-center gap-12 lg:gap-20">
          <div className="flex-1 min-w-0 text-left">
            <span
              className="cd-up inline-flex items-center gap-2 text-[11px] sm:text-xs font-semibold uppercase"
              style={{ ...GROTESK, letterSpacing: "0.1em", color: TEAL_DEEP }}
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: BRAND, animation: "pulseRing 2.4s infinite" }} />
              Para psicólogos y odontólogos
            </span>
            <h1
              className="cd-up mt-5 text-[42px] leading-[1.05] sm:text-6xl lg:text-[68px] font-bold tracking-tight"
              style={{ ...GROTESK, letterSpacing: "-0.03em", animationDelay: "0.1s" }}
            >
              Tu agenda,<br />trabajando por vos.
            </h1>
            <p className="cd-up mt-5 text-[15.5px] sm:text-lg leading-relaxed max-w-md" style={{ color: MUTED, animationDelay: "0.2s" }}>
              Citas, recordatorios por WhatsApp, cobros y reservas online — todo en un solo lugar, sincronizado con el calendario que ya usás.
            </p>
            <div className="cd-up mt-7 flex flex-col sm:flex-row gap-3" style={{ animationDelay: "0.3s" }}>
              <a
                href="/auth"
                className="flex items-center justify-center gap-2 h-[52px] px-8 rounded-full font-semibold text-[15px] text-white transition-transform hover:scale-[1.03]"
                style={{ background: BRAND, boxShadow: "0 14px 30px -12px rgba(31,147,141,.5)" }}
              >
                Probar gratis 7 días
                <ArrowRight className="w-4 h-4" />
              </a>
              <a
                href="/demo"
                className="flex items-center justify-center gap-2 h-[52px] px-7 rounded-full font-semibold text-[14.5px] transition-colors hover:bg-black/[0.03]"
                style={{ border: "1px solid rgba(22,33,28,.16)", color: INK }}
              >
                Ver la demo
              </a>
            </div>
            <p className="cd-up mt-5 text-[13px]" style={{ color: DIM, animationDelay: "0.4s" }}>
              Sin tarjeta · Te lo dejamos configurado en una videollamada
            </p>
          </div>

          {/* Mini agenda del día, versión clara */}
          <div className="cd-up flex-1 min-w-0 w-full max-w-md lg:max-w-none" style={{ animationDelay: "0.45s" }}>
            <div className="rounded-[22px] p-5 sm:p-6 bg-white" style={{ border: CARD_BORDER, boxShadow: "0 30px 60px -30px rgba(22,33,28,.18)" }}>
              <div className="flex items-center justify-between mb-4">
                <span className="text-[15px] font-semibold" style={GROTESK}>Hoy, martes</span>
                <span
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold"
                  style={{ background: "rgba(31,147,141,.1)", color: TEAL_DEEP }}
                >
                  <span className="w-[5px] h-[5px] rounded-full" style={{ background: BRAND, animation: "pulseRing 2s infinite" }} />
                  4 sesiones
                </span>
              </div>
              <div className="flex flex-col gap-2.5">
                <div className="flex items-center gap-3.5 rounded-xl px-4 py-3" style={{ background: "#fdfdfb", border: "1px solid rgba(22,33,28,.07)", borderLeft: `3px solid ${BRAND}` }}>
                  <span className="text-[13px] font-semibold tabular-nums w-11 shrink-0" style={{ color: MUTED }}>09:00</span>
                  <div className="min-w-0">
                    <p className="m-0 text-sm font-semibold">Agustina N.</p>
                    <p className="m-0 text-xs" style={{ color: DIM }}>Sesión individual · 50 min</p>
                  </div>
                  <span className="ml-auto px-2.5 py-1 rounded-full text-[10.5px] font-semibold shrink-0" style={{ background: "rgba(31,147,141,.1)", color: TEAL_DEEP }}>Pagada</span>
                </div>
                <div className="flex items-center gap-3.5 rounded-xl px-4 py-3" style={{ background: "#fdfdfb", border: "1px solid rgba(22,33,28,.07)", borderLeft: `3px solid ${BRAND}` }}>
                  <span className="text-[13px] font-semibold tabular-nums w-11 shrink-0" style={{ color: MUTED }}>10:30</span>
                  <div className="min-w-0">
                    <p className="m-0 text-sm font-semibold">Diego C.</p>
                    <p className="m-0 text-xs" style={{ color: DIM }}>Primera consulta</p>
                  </div>
                  <span className="ml-auto hidden sm:inline-flex items-center gap-1.5 text-[11px] font-semibold shrink-0" style={{ color: MUTED }}>
                    <Check className="w-3 h-3" style={{ color: BRAND }} strokeWidth={3} />
                    Recordatorio enviado
                  </span>
                </div>
                <div className="flex items-center gap-3.5 rounded-xl px-4 py-3" style={{ border: "1px dashed rgba(22,33,28,.18)" }}>
                  <span className="text-[13px] font-semibold tabular-nums w-11 shrink-0" style={{ color: DIM }}>12:00</span>
                  <p className="m-0 text-[13px]" style={{ color: DIM }}>Reservado recién desde tu link</p>
                  <span className="ml-auto px-2.5 py-1 rounded-full text-[10.5px] font-semibold shrink-0" style={{ background: "rgba(200,138,49,.1)", color: "#b0721e" }}>Nueva</span>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-4 pt-4" style={{ borderTop: `1px solid ${HAIR}` }}>
                <span className="w-[5px] h-[5px] rounded-full" style={{ background: BRAND, animation: "pulseRing 2.4s infinite" }} />
                <span className="text-[12.5px]" style={{ color: MUTED }}>Sincronizado con tu Google Calendar</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════ STRIP DE CONFIANZA ═══════════ */}
      <section className="px-5 sm:px-8" style={{ borderTop: `1px solid ${HAIR}`, borderBottom: `1px solid ${HAIR}` }}>
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-center sm:justify-between gap-x-8 gap-y-2 py-5 text-[13px] font-medium" style={{ color: DIM }}>
          <span>Hecho en Uruguay</span>
          <span>Recordatorios automáticos por WhatsApp</span>
          <span className="hidden sm:inline">Sincroniza con Google Calendar y iPhone</span>
          <span>Cobros con Mercado Pago</span>
        </div>
      </section>

      {/* ═══════════ TRES PILARES ═══════════ */}
      <section id="funciones" className="px-5 sm:px-8 py-16 lg:py-24 scroll-mt-20">
        <div className="max-w-6xl mx-auto">
          <ScrollReveal>
            <span className="text-[11px] sm:text-xs font-semibold uppercase" style={{ ...GROTESK, letterSpacing: "0.1em", color: TEAL_DEEP }}>Cómo funciona</span>
            <h2 className="mt-3 text-[30px] leading-[1.1] sm:text-5xl font-bold tracking-tight max-w-xl" style={{ ...GROTESK, letterSpacing: "-0.025em" }}>
              Vos atendés.<br />El sistema hace el resto.
            </h2>
          </ScrollReveal>
          <div className="mt-10 lg:mt-14 grid grid-cols-1 md:grid-cols-3 gap-5">
            {[
              {
                icon: MessageCircle,
                title: "Recordatorios que salen solos",
                text: "Cada paciente recibe su confirmación y su recordatorio por WhatsApp, con tu nombre. Menos ausencias, cero mensajes manuales.",
              },
              {
                icon: CreditCard,
                title: "Cobros al día",
                text: "Sabés quién pagó y quién debe, sin planillas. El paciente puede pagar online y el sistema reclama lo pendiente por vos.",
              },
              {
                icon: Link2,
                title: "Reservas por link",
                text: "Compartís tu link, el paciente elige un hueco libre y la cita aparece en tu agenda. También de madrugada, también un domingo.",
              },
            ].map((f, i) => (
              <ScrollReveal key={f.title} delay={i * 110}>
                <div className="h-full rounded-[18px] bg-white p-7 transition-transform duration-300 hover:-translate-y-1" style={{ border: CARD_BORDER }}>
                  <f.icon className="w-[26px] h-[26px]" style={{ color: BRAND }} strokeWidth={1.8} />
                  <p className="mt-4 mb-0 font-semibold text-[17px]" style={GROTESK}>{f.title}</p>
                  <p className="mt-2 mb-0 text-[14.5px] leading-relaxed" style={{ color: MUTED }}>{f.text}</p>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════ SINCRONIZACIÓN ═══════════ */}
      <section className="px-5 sm:px-8 py-16 lg:py-24" style={{ background: BG2 }}>
        <div className="max-w-6xl mx-auto flex flex-col lg:flex-row items-center gap-10 lg:gap-16">
          <div className="flex-1 min-w-0">
            <ScrollReveal direction="left">
              <span className="text-[11px] sm:text-xs font-semibold uppercase" style={{ ...GROTESK, letterSpacing: "0.1em", color: TEAL_DEEP }}>Sincronización</span>
              <h2 className="mt-3 text-[30px] leading-[1.1] sm:text-5xl font-bold tracking-tight" style={{ ...GROTESK, letterSpacing: "-0.025em" }}>
                Seguí usando el calendario de siempre.
              </h2>
              <p className="mt-4 text-[14.5px] sm:text-base leading-relaxed max-w-md" style={{ color: MUTED }}>
                Conectás tu Google Calendar o el calendario del iPhone una sola vez. Cada cita nueva aparece allá al instante, y tus eventos personales se respetan al agendar.
              </p>
              <div className="mt-6 flex flex-col gap-2.5">
                {[
                  "Sincronización instantánea en los dos sentidos",
                  "Te avisa si una cita choca con algo tuyo",
                  "Nada clínico viaja: solo nombre, tipo y hora",
                ].map((t) => (
                  <span key={t} className="inline-flex items-center gap-2.5 text-[13.5px] sm:text-[15px] font-medium">
                    <Check className="w-4 h-4 shrink-0" style={{ color: BRAND }} strokeWidth={2.4} />
                    {t}
                  </span>
                ))}
              </div>
            </ScrollReveal>
          </div>
          <div className="flex-1 min-w-0 w-full">
            <ScrollReveal direction="right" delay={120}>
              {/* Diagrama: Google ↔ Consultorio ↔ iPhone con puntos viajando */}
              <div className="relative rounded-[22px] bg-white px-4 sm:px-8 py-8 sm:py-12" style={{ border: CARD_BORDER, boxShadow: "0 30px 60px -34px rgba(22,33,28,.16)" }}>
                <div className="flex items-center justify-between">
                  <div className="flex flex-col items-center gap-2 w-[88px] sm:w-[130px]">
                    <span className="flex items-center justify-center w-[52px] h-[52px] sm:w-[68px] sm:h-[68px] rounded-2xl bg-white" style={{ border: `1px solid ${HAIR2}` }}>
                      <svg className="w-6 h-6 sm:w-8 sm:h-8" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.5 0 6.7 1.2 9.2 3.6l6.9-6.9C35.9 2.4 30.5 0 24 0 14.6 0 6.5 5.4 2.6 13.2l8 6.2C12.4 13.7 17.7 9.5 24 9.5z" /><path fill="#4285F4" d="M47 24.6c0-1.6-.2-3.1-.4-4.6H24v9h12.9c-.6 3-2.3 5.5-4.8 7.2l7.7 6c4.5-4.2 7.2-10.3 7.2-17.6z" /><path fill="#FBBC05" d="M10.5 28.6a14.5 14.5 0 0 1 0-9.2l-8-6.2a24 24 0 0 0 0 21.6l8-6.2z" /><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.7-6c-2.1 1.5-4.9 2.3-8.2 2.3-6.3 0-11.6-4.2-13.5-9.9l-8 6.2C6.5 42.6 14.6 48 24 48z" /></svg>
                    </span>
                    <span className="text-[10.5px] sm:text-xs text-center" style={{ color: MUTED }}>Google Calendar</span>
                  </div>
                  <div className="flex flex-col items-center gap-2">
                    <span
                      className="flex items-center justify-center w-[62px] h-[62px] sm:w-[84px] sm:h-[84px] rounded-[22px] font-bold text-[22px] sm:text-3xl text-white"
                      style={{ ...GROTESK, background: `linear-gradient(135deg, ${BRAND}, ${TEAL_DEEP})`, animation: "pulseRing 2.6s infinite" }}
                    >
                      C
                    </span>
                    <span className="text-[10.5px] sm:text-xs font-semibold text-center">Tu consultorio</span>
                  </div>
                  <div className="flex flex-col items-center gap-2 w-[88px] sm:w-[130px]">
                    <span className="flex items-center justify-center w-[52px] h-[52px] sm:w-[68px] sm:h-[68px] rounded-2xl" style={{ background: "#1c1c1e" }}>
                      <svg className="w-6 h-6 sm:w-7 sm:h-7" viewBox="0 0 24 24" fill="#f2f7f4"><path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.53 4.08zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" /></svg>
                    </span>
                    <span className="text-[10.5px] sm:text-xs text-center" style={{ color: MUTED }}>iPhone / iCal</span>
                  </div>
                </div>
                {/* Líneas punteadas con puntos animados */}
                <div className="absolute left-[86px] right-[52%] sm:left-[130px] top-[58px] sm:top-[82px] h-[2px]" style={{ background: "repeating-linear-gradient(90deg, rgba(31,147,141,.35) 0 6px, transparent 6px 12px)" }}>
                  <span className="absolute -top-[3px] w-2 h-2 rounded-full" style={{ background: BRAND, boxShadow: "0 0 10px rgba(31,147,141,.8)", animation: "dotGo 2.8s linear infinite" }} />
                </div>
                <div className="absolute left-[52%] right-[86px] sm:right-[130px] top-[58px] sm:top-[82px] h-[2px]" style={{ background: "repeating-linear-gradient(90deg, rgba(31,147,141,.35) 0 6px, transparent 6px 12px)" }}>
                  <span className="absolute -top-[3px] w-2 h-2 rounded-full" style={{ background: BRAND, boxShadow: "0 0 10px rgba(31,147,141,.8)", animation: "dotBack 2.8s linear infinite .9s" }} />
                </div>
                {/* Ejemplo concreto de lo que viaja */}
                <div className="mt-7 flex flex-col gap-2">
                  <div className="flex items-center gap-2.5 rounded-[10px] px-3.5 py-2.5" style={{ background: "#fdfdfb", border: "1px solid rgba(22,33,28,.07)" }}>
                    <span className="w-[7px] h-[7px] rounded-full shrink-0" style={{ background: BRAND }} />
                    <span className="text-[13px] font-medium truncate">Viernes 17:00 — Agustina</span>
                    <span className="ml-auto text-[11px] shrink-0" style={{ color: DIM }}>recién agendada acá</span>
                  </div>
                  <div className="flex items-center gap-2.5 rounded-[10px] px-3.5 py-2.5" style={{ background: "#fdfdfb", border: "1px solid rgba(22,33,28,.07)" }}>
                    <span className="w-[7px] h-[7px] rounded-full shrink-0" style={{ background: DIM }} />
                    <span className="text-[13px] font-medium truncate" style={{ color: MUTED }}>Dentista 15:00 — tuyo, de Google</span>
                    <span className="ml-auto text-[11px] shrink-0" style={{ color: DIM }}>esa hora se bloquea</span>
                  </div>
                </div>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* ═══════════ PLANES ═══════════ */}
      <section id="pricing" className="px-5 sm:px-8 py-16 lg:py-24 scroll-mt-20">
        <div className="max-w-6xl mx-auto">
          <ScrollReveal>
            <div className="text-center">
              <span className="text-[11px] sm:text-xs font-semibold uppercase" style={{ ...GROTESK, letterSpacing: "0.1em", color: TEAL_DEEP }}>Planes</span>
              <h2 className="mt-3 text-[30px] leading-[1.1] sm:text-5xl font-bold tracking-tight" style={{ ...GROTESK, letterSpacing: "-0.025em" }}>
                Un precio simple. Todo incluido.
              </h2>
              <p className="mt-4 text-sm sm:text-[15px]" style={{ color: MUTED }}>
                Todos incluyen el sistema completo. Un solo pago al año. 7 días gratis, sin tarjeta.
              </p>
            </div>
          </ScrollReveal>

          <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-5 items-stretch max-w-5xl mx-auto">
            {plans.map((plan, i) => {
              return (
                <ScrollReveal key={plan.code} className="w-full" delay={i * 110}>
                  <div
                    className="relative h-full flex flex-col rounded-[20px] bg-white p-7"
                    style={
                      plan.highlight
                        ? { border: `1.5px solid ${BRAND}`, boxShadow: "0 24px 50px -28px rgba(31,147,141,.45)" }
                        : { border: CARD_BORDER }
                    }
                  >
                    {plan.highlight && (
                      <span
                        className="absolute -top-3 left-1/2 -translate-x-1/2 px-3.5 py-1 rounded-full text-[11px] font-bold whitespace-nowrap text-white"
                        style={{ ...GROTESK, letterSpacing: "0.06em", background: BRAND }}
                      >
                        MÁS ELEGIDO
                      </span>
                    )}
                    <p className="m-0 font-semibold text-base" style={{ ...GROTESK, color: plan.highlight ? TEAL_DEEP : INK }}>{plan.name}</p>
                    <p className="mt-3 mb-0 font-bold text-[34px] leading-none" style={GROTESK}>
                      {formatPrice(plan.price)}
                      <span className="text-[13px] font-medium" style={{ color: DIM, fontFamily: "'Instrument Sans', sans-serif" }}> /mes</span>
                    </p>
                    <p className="mt-1.5 mb-0 text-[11.5px]" style={{ color: DIM }}>
                      un solo pago al año de {formatPrice(plan.price * 12)}
                    </p>
                    <div className="mt-5 pt-5 flex flex-col gap-2.5 text-[13.5px] leading-snug" style={{ color: MUTED, borderTop: `1px solid ${HAIR}` }}>
                      <span className="inline-flex items-start gap-2"><Check className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: BRAND }} />{plan.patients}</span>
                      <span className="inline-flex items-start gap-2"><Check className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: BRAND }} />{plan.whatsapps}</span>
                      <span className="inline-flex items-start gap-2"><Check className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: BRAND }} />{plan.professionals}</span>
                      <span className="inline-flex items-start gap-2"><Check className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: BRAND }} />Sistema completo: agenda, cobros, portal y estadísticas</span>
                    </div>
                    <div className="mt-auto pt-6">
                      <a
                        href={waPlanUrl(plan.name, formatPrice(plan.price))}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2 h-[46px] rounded-xl font-semibold text-[14px] transition-transform hover:scale-[1.02]"
                        style={
                          plan.highlight
                            ? { background: BRAND, color: "#ffffff", boxShadow: "0 10px 24px -10px rgba(31,147,141,.6)" }
                            : { border: "1px solid rgba(22,33,28,.16)", color: INK }
                        }
                      >
                        <MessageCircle className="w-4 h-4" />
                        Quiero este plan
                      </a>
                      <p className="m-0 text-center mt-2.5 text-[11.5px]" style={{ color: DIM }}>
                        Te respondemos en el día y lo dejamos andando.
                      </p>
                    </div>
                  </div>
                </ScrollReveal>
              );
            })}
          </div>

          <ScrollReveal>
            <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-3 rounded-[20px] bg-white px-6 py-5" style={{ border: CARD_BORDER }}>
              <div>
                <p className="m-0 font-semibold text-[15px]" style={GROTESK}>¿Un equipo más grande?</p>
                <p className="m-0 mt-1 text-[13px]" style={{ color: MUTED }}>Armamos un plan personalizado para tu clínica o centro.</p>
              </div>
              <a
                href={WA_PERSONALIZADO}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-5 h-11 rounded-full font-semibold text-[13.5px] shrink-0"
                style={{ background: "rgba(31,147,141,.08)", border: "1px solid rgba(31,147,141,.3)", color: TEAL_DEEP }}
              >
                <MessageCircle className="w-4 h-4" />
                Charlemos por WhatsApp
              </a>
            </div>
            <p className="mt-4 text-center text-xs" style={{ color: DIM }}>
              Importante: no pedimos tarjeta para los 7 días gratis.
            </p>
          </ScrollReveal>
        </div>
      </section>

      {/* ═══════════ FAQ ═══════════ */}
      <section id="faq" className="px-5 sm:px-8 py-16 lg:py-24 scroll-mt-20" style={{ borderTop: `1px solid ${HAIR}` }}>
        <div className="max-w-3xl mx-auto">
          <ScrollReveal>
            <h2 className="text-[26px] sm:text-4xl font-bold tracking-tight mb-7" style={{ ...GROTESK, letterSpacing: "-0.02em" }}>
              Preguntas frecuentes
            </h2>
          </ScrollReveal>
          <Accordion type="single" collapsible>
            {faqItems.map((item, i) => (
              <ScrollReveal key={i}>
                <AccordionItem
                  value={`faq-${i}`}
                  className="border-0"
                  style={{ borderTop: `1px solid ${HAIR2}` }}
                >
                  <AccordionTrigger className="text-left text-sm sm:text-[15.5px] font-semibold hover:no-underline py-5" style={GROTESK}>
                    {item.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-[13px] sm:text-sm leading-relaxed pb-5" style={{ color: MUTED }}>
                    {item.answer}
                  </AccordionContent>
                </AccordionItem>
              </ScrollReveal>
            ))}
          </Accordion>
        </div>
      </section>

      {/* ═══════════ CTA FINAL ═══════════ */}
      <section className="px-5 sm:px-8 pb-20 lg:pb-24">
        <div className="max-w-6xl mx-auto">
          <ScrollReveal>
            <div className="rounded-[26px] px-6 py-14 sm:py-16 text-center" style={{ background: INK }}>
              <h2 className="text-[30px] leading-[1.12] sm:text-5xl font-bold tracking-tight m-0" style={{ ...GROTESK, letterSpacing: "-0.025em", color: BG }}>
                Empezá hoy.<br />Mañana tu agenda ya trabaja sola.
              </h2>
              <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
                <a
                  href="/auth"
                  className="w-full sm:w-auto flex items-center justify-center gap-2 h-[52px] px-8 rounded-full font-bold text-[15px] transition-transform hover:scale-[1.03]"
                  style={{ background: "#2fb583", color: "#071009" }}
                >
                  Probar gratis 7 días
                  <ArrowRight className="w-4 h-4" />
                </a>
                <a
                  href={WA_DEMO}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full sm:w-auto flex items-center justify-center gap-2 h-[52px] px-7 rounded-full font-semibold text-[14.5px]"
                  style={{ border: "1px solid rgba(251,250,247,.25)", color: BG }}
                >
                  <MessageCircle className="w-4 h-4" />
                  Hablar por WhatsApp
                </a>
              </div>
              <p className="mt-5 mb-0 text-[13px]" style={{ color: "rgba(251,250,247,.5)" }}>
                Sin tarjeta · Cancelás cuando quieras
              </p>
              <div className="flex justify-center mt-6">
                <InstallAppButton className="h-10 px-5 rounded-full text-[13px]" label="Instalar la app en tu dispositivo" />
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* ═══════════ FOOTER ═══════════ */}
      <footer className="px-4 sm:px-6 py-8 sm:py-12" style={{ borderTop: `1px solid ${HAIR}` }}>
        <div className="max-w-7xl mx-auto flex flex-col items-center gap-4">
          <div className="flex items-center gap-2 text-xs" style={{ color: DIM }}>
            <span className="text-lg">🇺🇾</span>
            <span>Disponible únicamente en Uruguay</span>
          </div>
          <p className="text-center text-xs sm:text-sm font-light m-0" style={{ color: DIM }}>
            © {new Date().getFullYear()} Consultorio Digital
          </p>
          <div className="flex items-center gap-4 text-xs" style={{ color: MUTED }}>
            <a href="/terminos" className="transition-colors hover:opacity-70" style={{ color: MUTED }}>
              Términos y Condiciones
            </a>
            <span style={{ color: DIM }}>·</span>
            <a href="/privacidad" className="transition-colors hover:opacity-70" style={{ color: MUTED }}>
              Política de Privacidad
            </a>
            <span style={{ color: DIM }}>·</span>
            <a href="/seguridad" className="transition-colors hover:opacity-70" style={{ color: MUTED }}>
              Seguridad
            </a>
          </div>
          <div className="flex items-center gap-2 text-xs" style={{ color: DIM }}>
            <span>Sistema desarrollado por</span>
            <a
              href="https://www.digitalbuilders.net"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:opacity-80 transition-opacity rounded-xl px-3 py-1.5"
              style={{ background: INK }}
            >
              <img
                src="/assets/logo-digitalbuilders.webp"
                alt="Digital Builders"
                className="h-8 sm:h-10"
              />
            </a>
          </div>
        </div>
      </footer>

      <ScrollToTop />

      {/* Botón flotante de WhatsApp */}
      <a
        href="https://wa.me/59898543623?text=Hola%2C%20vine%20desde%20la%20web%20de%20Consultorio%20Digital%20y%20tengo%20una%20consulta"
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-6 right-6 z-50 group flex items-center gap-2"
        aria-label="Contactar por WhatsApp"
      >
        <span
          className="text-sm font-medium px-3 py-1.5 rounded-full opacity-0 -translate-x-2 transition-all duration-300 group-hover:opacity-100 group-hover:translate-x-0"
          style={{ backgroundColor: "#128C7E", color: "white" }}
        >
          ¿Consultas?
        </span>
        <div
          className="w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-transform duration-300 hover:scale-110"
          style={{
            backgroundColor: "#25d366",
            boxShadow: "0 8px 25px rgba(37, 211, 102, 0.4)",
          }}
        >
          <svg viewBox="0 0 24 24" className="w-7 h-7 fill-white" xmlns="http://www.w3.org/2000/svg">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.52.149-.174.198-.298.297-.497.1-.198.05-.371-.025-.52-.074-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" />
          </svg>
        </div>
      </a>
    </div>
  );
};

export default Landing;

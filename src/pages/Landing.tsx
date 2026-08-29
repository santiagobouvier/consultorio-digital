// Landing de Consultorio Digital — diseño "agencia premium dark" aprobado en
// el mockup de Claude Design: la agenda como centro de control, sincronización
// en vivo con Google Calendar / iPhone, cobros con Mercado Pago, WhatsApp
// automático y el link público de reservas como protagonista.
// Sin mención a creación de páginas web (eso se ofrece en privado).
import { usePageMeta } from "@/hooks/use-page-meta";
import { useJsonLd } from "@/hooks/use-json-ld";
import { useMemo, useState } from "react";
import {
  ArrowRight,
  BarChart3,
  Check,
  CreditCard,
  Link2,
  Lock,
  MessageCircle,
  Shield,
  Users,
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
import { DayJourney } from "@/components/landing/DayJourney";

// Marca
const BRAND = "#1f938d";
const GREEN = "#2fb583";
const GREEN_SOFT = "#7ce0b8";
const INK = "#04120c";
const MUTED = "#8fa39a";
const SOFT = "#c6d4cd";
const DIM = "#5c6f66";
const CARD = "linear-gradient(180deg,#0c1310,#080d0b)";
const CARD_HL = "linear-gradient(180deg,#0d1a14,#091009)";
const GROTESK = { fontFamily: "'Space Grotesk', sans-serif" } as const;

const WA_DEMO =
  "https://wa.me/59898543623?text=Hola%2C%20quiero%20ver%20una%20demo%20de%20Consultorio%20Digital";
const WA_PERSONALIZADO =
  "https://wa.me/59898543623?text=Hola,%20quiero%20un%20plan%20personalizado%20para%20mi%20consultorio.";

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
    title: "Consultorio Digital | Tu agenda es tu centro de control",
    description:
      "Citas, cobros y pacientes en un solo lugar — sincronizado en vivo con Google Calendar y tu iPhone. Link público de reservas, cobros con Mercado Pago y recordatorios automáticos por WhatsApp.",
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

  const [isAnnual, setIsAnnual] = useState(true);

  // Planes reales, con precio anual Y mensual siempre a la vista
  const plans = useMemo(() => {
    return PUBLIC_PLAN_ORDER.filter((code) => code !== "personalizado").map((code) => {
      const p = PLAN_DEFINITIONS[code];
      return {
        code,
        name: p.name,
        priceAnnual: p.priceAnnual,
        priceMonthly: p.priceMonthly,
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
    <div className="min-h-screen text-white" style={{ background: "#050807", fontFamily: "'Instrument Sans', 'Plus Jakarta Sans', sans-serif" }}>
      <style>{`
        @media (prefers-reduced-motion: no-preference) {
        @keyframes glowFloat { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(28px,-20px) scale(1.1); } }
        @keyframes dotGo { 0% { left: 6%; opacity: 0; } 12% { opacity: 1; } 88% { opacity: 1; } 100% { left: 90%; opacity: 0; } }
        @keyframes dotBack { 0% { left: 90%; opacity: 0; } 12% { opacity: 1; } 88% { opacity: 1; } 100% { left: 6%; opacity: 0; } }
        @keyframes pulseRing { 0% { box-shadow: 0 0 0 0 rgba(47,181,131,.45); } 70% { box-shadow: 0 0 0 12px rgba(47,181,131,0); } 100% { box-shadow: 0 0 0 0 rgba(47,181,131,0); } }
        @keyframes heroUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        .cd-up { opacity: 0; animation: heroUp .8s cubic-bezier(0.16,1,0.3,1) forwards; }
        }
        @media (prefers-reduced-motion: reduce) {
          .cd-up { opacity: 1; }
        }
      `}</style>

      <LandingNavbar />

      {/* ═══════════ HERO ═══════════ */}
      <section className="relative overflow-hidden px-5 sm:px-8 pt-28 pb-16 lg:pt-36 lg:pb-24 z-10">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-40 -right-32 w-[420px] h-[420px] lg:w-[620px] lg:h-[620px] rounded-full"
          style={{
            background: `radial-gradient(circle, rgba(47,181,131,.10) 0%, rgba(47,181,131,0) 65%)`,
            filter: "blur(18px)",
            animation: "glowFloat 10s ease-in-out infinite",
          }}
        />
        <div className="relative max-w-6xl mx-auto flex flex-col lg:flex-row items-center gap-12 lg:gap-16">
          <div className="flex-1 min-w-0 text-left">
            <span
              className="cd-up inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-[11px] sm:text-xs font-semibold uppercase"
              style={{ ...GROTESK, letterSpacing: "0.1em", background: "rgba(47,181,131,.08)", border: "1px solid rgba(47,181,131,.22)", color: GREEN_SOFT }}
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: GREEN, animation: "pulseRing 2.4s infinite" }} />
              Para psicólogos y odontólogos
            </span>
            <h1
              className="cd-up mt-5 text-[44px] leading-[1.04] sm:text-6xl lg:text-7xl font-bold tracking-tight"
              style={{ ...GROTESK, letterSpacing: "-0.03em", animationDelay: "0.1s" }}
            >
              Tu agenda es tu
              <span
                className="block bg-clip-text text-transparent pb-1"
                style={{ backgroundImage: `linear-gradient(100deg, ${GREEN}, ${BRAND} 70%)` }}
              >
                centro de control.
              </span>
            </h1>
            <p className="cd-up mt-5 text-[15.5px] sm:text-lg leading-relaxed max-w-lg" style={{ color: MUTED, animationDelay: "0.2s" }}>
              Citas, cobros y pacientes en un solo lugar — sincronizado en vivo con Google Calendar y tu iPhone.
            </p>
            <div className="cd-up mt-7 flex flex-col sm:flex-row gap-3" style={{ animationDelay: "0.3s" }}>
              <a
                href="#pricing"
                className="flex items-center justify-center gap-2 h-[52px] sm:h-14 px-8 rounded-2xl font-semibold text-[15px] transition-transform hover:scale-[1.03]"
                style={{ background: `linear-gradient(135deg, ${GREEN}, ${BRAND})`, color: INK, boxShadow: "0 14px 40px rgba(47,181,131,.22)" }}
              >
                Probalo 7 días gratis
                <ArrowRight className="w-4 h-4" />
              </a>
              <a
                href={WA_DEMO}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 h-[52px] sm:h-14 px-7 rounded-2xl font-medium text-[14.5px] transition-colors hover:bg-white/[0.07]"
                style={{ background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.1)", color: SOFT }}
              >
                <MessageCircle className="w-4 h-4" />
                Demo de 10 min por WhatsApp
              </a>
            </div>
            <div className="cd-up mt-6 flex flex-wrap gap-x-6 gap-y-2 text-xs sm:text-sm" style={{ color: DIM, animationDelay: "0.4s" }}>
              {["Sin tarjeta", "7 días gratis", "Cancelás cuando quieras"].map((t) => (
                <span key={t} className="inline-flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5" style={{ color: GREEN }} />
                  {t}
                </span>
              ))}
            </div>
          </div>

          {/* Mini agenda del día con badge de sync latiendo */}
          <div className="cd-up flex-1 min-w-0 w-full max-w-md lg:max-w-none" style={{ animationDelay: "0.45s" }}>
            <div className="rounded-3xl p-5 sm:p-6" style={{ background: CARD, border: "1px solid rgba(47,181,131,.14)", boxShadow: "0 40px 90px -40px rgba(0,0,0,.8)" }}>
              <div className="flex items-center gap-2 mb-4">
                <span className="text-xs font-semibold uppercase" style={{ ...GROTESK, letterSpacing: "0.12em", color: DIM }}>Hoy · Martes</span>
                <span
                  className="ml-auto inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10.5px] sm:text-[11px] font-semibold"
                  style={{ background: "rgba(47,181,131,.1)", border: "1px solid rgba(47,181,131,.3)", color: GREEN_SOFT }}
                >
                  <span className="w-[5px] h-[5px] rounded-full" style={{ background: GREEN, animation: "pulseRing 2s infinite" }} />
                  Sincronizado con Google
                </span>
              </div>
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-3 px-3.5 py-3 rounded-xl" style={{ background: "rgba(47,181,131,.09)", borderLeft: `3px solid ${GREEN}` }}>
                  <span className="text-[13px] font-bold tabular-nums" style={{ ...GROTESK, color: GREEN_SOFT }}>09:00</span>
                  <span className="text-[13.5px] font-semibold">Camila S. · Sesión individual</span>
                  <span className="ml-auto hidden sm:inline px-2.5 py-0.5 rounded-full text-[10.5px] font-semibold" style={{ background: "rgba(47,181,131,.12)", color: GREEN_SOFT }}>Pagada</span>
                </div>
                <div className="flex items-center gap-3 px-3.5 py-3 rounded-xl" style={{ background: "rgba(255,255,255,.03)", borderLeft: "3px solid rgba(255,255,255,.18)" }}>
                  <span className="text-[13px] font-bold tabular-nums" style={{ ...GROTESK, color: MUTED }}>11:00</span>
                  <span className="text-[13.5px]" style={{ color: SOFT }}>Turno libre — reservable online</span>
                </div>
                <div className="flex items-center gap-3 px-3.5 py-3 rounded-xl" style={{ background: "rgba(255,255,255,.03)", borderLeft: "3px solid #4285F4" }}>
                  <span className="text-[13px] font-bold tabular-nums" style={{ ...GROTESK, color: MUTED }}>13:00</span>
                  <span className="text-[13.5px]" style={{ color: SOFT }}>Almuerzo · desde Google Calendar</span>
                </div>
                <div className="flex items-center gap-3 px-3.5 py-3 rounded-xl" style={{ background: "rgba(255,255,255,.03)", borderLeft: `3px solid ${BRAND}` }}>
                  <span className="text-[13px] font-bold tabular-nums" style={{ ...GROTESK, color: MUTED }}>15:00</span>
                  <span className="text-[13.5px]" style={{ color: SOFT }}>Andrés S. · reservó solo desde tu link</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <DayJourney />

      {/* ═══════════ SINCRONIZACIÓN ═══════════ */}
      <section className="relative px-5 sm:px-8 py-16 lg:py-24 z-10" style={{ background: "#070b09", borderTop: "1px solid rgba(255,255,255,.05)" }}>
        <div className="max-w-6xl mx-auto flex flex-col lg:flex-row items-center gap-10 lg:gap-16">
          <div className="flex-1 min-w-0">
            <ScrollReveal direction="left">
              <span className="text-[11px] sm:text-xs font-semibold uppercase" style={{ ...GROTESK, letterSpacing: "0.16em", color: GREEN }}>Sincronización en vivo</span>
              <h2 className="mt-3 text-[30px] leading-[1.1] sm:text-5xl font-bold tracking-tight" style={{ ...GROTESK, letterSpacing: "-0.025em" }}>
                Agendás acá.<br />Aparece en todos lados.
              </h2>
              <p className="mt-4 text-[14.5px] sm:text-base leading-relaxed max-w-md" style={{ color: MUTED }}>
                Conexión directa y bidireccional con Google Calendar y el calendario del iPhone. Borrás allá, se borra acá. Al instante.
              </p>
              <div className="mt-6 flex flex-col gap-2.5">
                {[
                  "Instantáneo y en los dos sentidos",
                  "Te avisa si vas a pisar un evento tuyo",
                  "Se conecta en un click, sin links raros",
                ].map((t) => (
                  <span key={t} className="inline-flex items-center gap-2.5 text-[13.5px] sm:text-[15px] font-medium" style={{ color: SOFT }}>
                    <Check className="w-4 h-4 shrink-0" style={{ color: GREEN }} strokeWidth={2.4} />
                    {t}
                  </span>
                ))}
              </div>
            </ScrollReveal>
          </div>
          <div className="flex-1 min-w-0 w-full">
            <ScrollReveal direction="right" delay={120}>
              {/* Diagrama: Google ↔ Consultorio ↔ iPhone con puntos viajando */}
              <div className="relative rounded-3xl px-4 sm:px-8 py-8 sm:py-12" style={{ background: CARD, border: "1px solid rgba(255,255,255,.07)" }}>
                <div className="flex items-center justify-between">
                  <div className="flex flex-col items-center gap-2 w-[88px] sm:w-[130px]">
                    <span className="flex items-center justify-center w-[52px] h-[52px] sm:w-[68px] sm:h-[68px] rounded-2xl bg-white">
                      <svg className="w-6 h-6 sm:w-8 sm:h-8" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.5 0 6.7 1.2 9.2 3.6l6.9-6.9C35.9 2.4 30.5 0 24 0 14.6 0 6.5 5.4 2.6 13.2l8 6.2C12.4 13.7 17.7 9.5 24 9.5z" /><path fill="#4285F4" d="M47 24.6c0-1.6-.2-3.1-.4-4.6H24v9h12.9c-.6 3-2.3 5.5-4.8 7.2l7.7 6c4.5-4.2 7.2-10.3 7.2-17.6z" /><path fill="#FBBC05" d="M10.5 28.6a14.5 14.5 0 0 1 0-9.2l-8-6.2a24 24 0 0 0 0 21.6l8-6.2z" /><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.7-6c-2.1 1.5-4.9 2.3-8.2 2.3-6.3 0-11.6-4.2-13.5-9.9l-8 6.2C6.5 42.6 14.6 48 24 48z" /></svg>
                    </span>
                    <span className="text-[10.5px] sm:text-xs text-center" style={{ color: MUTED }}>Google Calendar</span>
                  </div>
                  <div className="flex flex-col items-center gap-2">
                    <span
                      className="flex items-center justify-center w-[62px] h-[62px] sm:w-[84px] sm:h-[84px] rounded-[22px] font-bold text-[22px] sm:text-3xl"
                      style={{ ...GROTESK, background: `linear-gradient(135deg, ${GREEN}, ${BRAND})`, color: INK, animation: "pulseRing 2.6s infinite" }}
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
                <div className="absolute left-[86px] right-[52%] sm:left-[130px] top-[58px] sm:top-[82px] h-[2px]" style={{ background: "repeating-linear-gradient(90deg, rgba(47,181,131,.35) 0 6px, transparent 6px 12px)" }}>
                  <span className="absolute -top-[3px] w-2 h-2 rounded-full" style={{ background: GREEN, boxShadow: "0 0 10px rgba(47,181,131,.9)", animation: "dotGo 2.8s linear infinite" }} />
                </div>
                <div className="absolute left-[52%] right-[86px] sm:right-[130px] top-[58px] sm:top-[82px] h-[2px]" style={{ background: "repeating-linear-gradient(90deg, rgba(47,181,131,.35) 0 6px, transparent 6px 12px)" }}>
                  <span className="absolute -top-[3px] w-2 h-2 rounded-full" style={{ background: GREEN, boxShadow: "0 0 10px rgba(47,181,131,.9)", animation: "dotBack 2.8s linear infinite .9s" }} />
                </div>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* ═══════════ LINK PÚBLICO DE RESERVAS ═══════════ */}
      <section className="relative overflow-hidden px-5 sm:px-8 py-16 lg:py-24 z-10">
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-44 -left-32 w-[420px] h-[420px] rounded-full"
          style={{ background: "radial-gradient(circle, rgba(31,147,141,.09) 0%, rgba(31,147,141,0) 65%)", filter: "blur(16px)" }}
        />
        <div className="relative max-w-6xl mx-auto flex flex-col lg:flex-row items-center gap-10 lg:gap-16">
          <div className="flex-1 min-w-0">
            <ScrollReveal direction="left">
              <span className="text-[11px] sm:text-xs font-semibold uppercase" style={{ ...GROTESK, letterSpacing: "0.16em", color: GREEN }}>Tu link de reservas</span>
              <h2 className="mt-3 text-[30px] leading-[1.1] sm:text-5xl font-bold tracking-tight" style={{ ...GROTESK, letterSpacing: "-0.025em" }}>
                Tus pacientes<br />agendan solos.
              </h2>
              <p className="mt-4 text-[14.5px] sm:text-base leading-relaxed max-w-md" style={{ color: MUTED }}>
                Compartís un link y listo: eligen un horario libre real de tu agenda y la cita queda confirmada. Sin idas y vueltas por WhatsApp.
              </p>
              <div className="mt-6 inline-flex items-center gap-3 px-4 py-3.5 rounded-2xl max-w-full" style={{ background: CARD, border: "1px solid rgba(47,181,131,.25)" }}>
                <Link2 className="w-4 h-4 shrink-0" style={{ color: GREEN }} />
                <span className="text-[13px] sm:text-[15px] font-semibold truncate" style={{ ...GROTESK, color: GREEN_SOFT }}>
                  consultoriodigital.app/tu-consultorio
                </span>
              </div>
            </ScrollReveal>
          </div>
          <div className="flex-1 min-w-0 w-full">
            <div className="flex flex-col gap-3">
              {[
                "El paciente abre tu link y ve solo los horarios que de verdad tenés libres.",
                "Elige, confirma, y la cita entra directo a tu agenda (y a tu Google Calendar).",
                "Antes de la sesión le llega el recordatorio automático por WhatsApp.",
              ].map((t, i) => (
                <ScrollReveal key={i} direction="right" delay={i * 130}>
                  <div
                    className="relative overflow-hidden flex items-center gap-4 rounded-2xl px-4 sm:px-5 py-5"
                    style={{ background: CARD, border: "1px solid rgba(255,255,255,.07)" }}
                  >
                    {/* Número gigante fantasma de fondo */}
                    <span
                      aria-hidden
                      className="absolute -right-2 -top-7 font-bold select-none pointer-events-none"
                      style={{ ...GROTESK, fontSize: 96, lineHeight: 1, color: "rgba(47,181,131,.07)" }}
                    >
                      {i + 1}
                    </span>
                    <span
                      className="relative flex items-center justify-center w-9 h-9 rounded-full font-bold text-sm shrink-0"
                      style={{ ...GROTESK, background: "rgba(47,181,131,.12)", border: "1px solid rgba(47,181,131,.3)", color: GREEN_SOFT }}
                    >
                      {i + 1}
                    </span>
                    <p className="relative text-[13.5px] sm:text-[15px] leading-relaxed font-medium m-0 pr-8" style={{ color: SOFT }}>{t}</p>
                  </div>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════ BENTO ═══════════ */}
      <section id="funciones" className="relative px-5 sm:px-8 py-16 lg:py-24 z-10 scroll-mt-20" style={{ background: "#070b09", borderTop: "1px solid rgba(255,255,255,.05)" }}>
        <div className="max-w-6xl mx-auto">
          <ScrollReveal>
            <h2 className="text-[30px] leading-[1.1] sm:text-5xl font-bold tracking-tight" style={{ ...GROTESK, letterSpacing: "-0.025em" }}>
              Y todo lo demás, resuelto de fábrica.
            </h2>
          </ScrollReveal>
          <div className="mt-8 lg:mt-10 grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
            {[
              {
                icon: CreditCard,
                title: "Cobrás sin perseguir a nadie",
                text: "Link de pago con Mercado Pago, y el sistema reclama solo los vencidos. Sabés al peso quién te debe y cuánto.",
                span: "col-span-2",
                hl: true,
              },
              {
                icon: MessageCircle,
                title: "WhatsApp automático",
                text: "Recordatorios que bajan las ausencias, sin que muevas un dedo.",
                span: "",
                hl: false,
              },
              {
                icon: Users,
                title: "Ficha del paciente",
                text: "Historia, sesiones y pagos de cada paciente en un solo lugar.",
                span: "",
                hl: false,
              },
              {
                icon: Shield,
                title: "Tu marca, no la nuestra",
                text: "Tu logo y tus colores en el panel y en el portal que ven tus pacientes. App instalable en el celular.",
                span: "col-span-2 lg:col-span-3",
                hl: true,
              },
              {
                icon: Lock,
                title: "Datos protegidos",
                text: "La información clínica de tus pacientes, cifrada y solo tuya.",
                span: "col-span-2 lg:col-span-1",
                hl: false,
              },
              {
                icon: BarChart3,
                title: "Estadísticas de tu negocio",
                text: "Cuánto facturaste, tu tasa de cobranza y qué pacientes se están enfriando.",
                span: "col-span-2 lg:col-span-4",
                hl: false,
              },
            ].map((f, i) => (
              <ScrollReveal key={f.title} className={f.span} direction="scale" delay={(i % 4) * 90}>
                <div
                  className="h-full rounded-[20px] p-5 sm:p-6 transition-transform duration-300 hover:-translate-y-1"
                  style={{ background: f.hl ? CARD_HL : CARD, border: f.hl ? "1px solid rgba(47,181,131,.11)" : "1px solid rgba(255,255,255,.07)" }}
                >
                  <span className="flex items-center justify-center w-10 h-10 sm:w-11 sm:h-11 rounded-[13px] mb-4" style={{ background: "rgba(47,181,131,.12)", color: GREEN }}>
                    <f.icon className="w-5 h-5" />
                  </span>
                  <p className="m-0 font-semibold text-[15px] sm:text-[17px]" style={GROTESK}>{f.title}</p>
                  <p className="mt-1.5 mb-0 text-[12.5px] sm:text-sm leading-relaxed" style={{ color: MUTED }}>{f.text}</p>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════ PLANES ═══════════ */}
      <section id="pricing" className="relative px-5 sm:px-8 py-16 lg:py-24 z-10 scroll-mt-20">
        <div className="max-w-6xl mx-auto">
          <ScrollReveal>
            <div className="text-center">
              <span className="text-[11px] sm:text-xs font-semibold uppercase" style={{ ...GROTESK, letterSpacing: "0.16em", color: GREEN }}>Planes</span>
              <h2 className="mt-3 text-[30px] leading-[1.1] sm:text-5xl font-bold tracking-tight" style={{ ...GROTESK, letterSpacing: "-0.025em" }}>
                Un precio simple. Todo incluido.
              </h2>
              <p className="mt-4 text-sm sm:text-[15px]" style={{ color: MUTED }}>
                Todos incluyen el sistema completo. 7 días gratis, sin tarjeta.
              </p>
              {/* Toggle anual / mensual */}
              <div className="mt-6 inline-flex gap-1 p-1 rounded-[14px]" style={{ background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.1)" }}>
                <button
                  type="button"
                  onClick={() => setIsAnnual(true)}
                  className="px-5 py-2.5 rounded-[11px] text-[13px] transition-colors"
                  style={isAnnual ? { background: "#f2f7f4", color: "#0a120e", fontWeight: 600 } : { color: MUTED, fontWeight: 500 }}
                >
                  Pago anual <span style={{ color: isAnnual ? BRAND : DIM }}>· ahorrás hasta 20%</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsAnnual(false)}
                  className="px-5 py-2.5 rounded-[11px] text-[13px] transition-colors"
                  style={!isAnnual ? { background: "#f2f7f4", color: "#0a120e", fontWeight: 600 } : { color: MUTED, fontWeight: 500 }}
                >
                  Pago mensual
                </button>
              </div>
            </div>
          </ScrollReveal>

          <div className="mt-10 flex flex-wrap justify-center gap-4 items-stretch">
            {plans.map((plan) => {
              const price = isAnnual ? plan.priceAnnual : plan.priceMonthly;
              const other = isAnnual
                ? `${formatPrice(plan.priceMonthly)} si pagás mes a mes`
                : `${formatPrice(plan.priceAnnual)}/mes si pagás anual`;
              return (
                <ScrollReveal key={plan.code} className="w-full max-w-[420px] sm:w-[320px] sm:max-w-none lg:w-[330px]">
                  <div
                    className="relative h-full flex flex-col rounded-[20px] p-6"
                    style={
                      plan.highlight
                        ? { background: CARD_HL, border: "1px solid rgba(47,181,131,.4)", boxShadow: "0 24px 60px -24px rgba(47,181,131,.3)" }
                        : { background: CARD, border: "1px solid rgba(255,255,255,.07)" }
                    }
                  >
                    {plan.highlight && (
                      <span
                        className="absolute -top-3 left-1/2 -translate-x-1/2 px-3.5 py-1 rounded-full text-[11px] font-bold whitespace-nowrap"
                        style={{ ...GROTESK, letterSpacing: "0.06em", background: `linear-gradient(135deg, ${GREEN}, ${BRAND})`, color: INK }}
                      >
                        MÁS ELEGIDO
                      </span>
                    )}
                    <p className="m-0 font-semibold text-base" style={{ ...GROTESK, color: plan.highlight ? GREEN_SOFT : "#f2f7f4" }}>{plan.name}</p>
                    <p className="mt-3 mb-0 font-bold text-[32px] leading-none" style={GROTESK}>
                      {formatPrice(price)}
                      <span className="text-[13px] font-medium" style={{ color: DIM, fontFamily: "'Instrument Sans', sans-serif" }}> /mes</span>
                    </p>
                    <p className="mt-1.5 mb-0 text-[11.5px]" style={{ color: DIM }}>
                      {isAnnual ? "pagando anual" : "pagando mes a mes"} · {other}
                    </p>
                    <div className="mt-4 flex flex-col gap-2 text-[13px] leading-snug" style={{ color: MUTED }}>
                      <span className="inline-flex items-start gap-2"><Check className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: GREEN }} />{plan.patients}</span>
                      <span className="inline-flex items-start gap-2"><Check className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: GREEN }} />{plan.whatsapps}</span>
                      <span className="inline-flex items-start gap-2"><Check className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: GREEN }} />{plan.professionals}</span>
                      <span className="inline-flex items-start gap-2"><Check className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: GREEN }} />Sistema completo: agenda, cobros, portal y estadísticas</span>
                    </div>
                    <div className="mt-auto pt-5">
                      <a
                        href={`/auth?plan=${plan.code}&billing=${isAnnual ? "annual" : "monthly"}`}
                        className="flex items-center justify-center h-11 rounded-[13px] font-semibold text-[13.5px] transition-transform hover:scale-[1.02]"
                        style={
                          plan.highlight
                            ? { background: `linear-gradient(135deg, ${GREEN}, ${BRAND})`, color: INK, boxShadow: "0 10px 28px rgba(47,181,131,.22)" }
                            : { background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.12)", color: "#f2f7f4" }
                        }
                      >
                        Probar gratis 7 días
                      </a>
                      <a
                        href={`/auth?plan=${plan.code}&billing=${isAnnual ? "annual" : "monthly"}&skip_trial=true`}
                        className="block text-center mt-2.5 text-[11.5px] transition-colors hover:text-white"
                        style={{ color: DIM }}
                      >
                        Empezar ya, sin prueba
                      </a>
                    </div>
                  </div>
                </ScrollReveal>
              );
            })}
          </div>

          <ScrollReveal>
            <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-3 rounded-[20px] px-6 py-5" style={{ background: CARD, border: "1px solid rgba(255,255,255,.07)" }}>
              <div>
                <p className="m-0 font-semibold text-[15px]" style={GROTESK}>¿Un equipo más grande?</p>
                <p className="m-0 mt-1 text-[13px]" style={{ color: MUTED }}>Armamos un plan personalizado para tu clínica o centro.</p>
              </div>
              <a
                href={WA_PERSONALIZADO}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-5 h-11 rounded-[13px] font-semibold text-[13.5px] shrink-0"
                style={{ background: "rgba(47,181,131,.1)", border: "1px solid rgba(47,181,131,.3)", color: GREEN_SOFT }}
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
      <section id="faq" className="relative px-5 sm:px-8 py-16 lg:py-24 z-10 scroll-mt-20" style={{ background: "#070b09", borderTop: "1px solid rgba(255,255,255,.05)" }}>
        <div className="max-w-3xl mx-auto">
          <ScrollReveal>
            <h2 className="text-[26px] sm:text-4xl font-bold tracking-tight mb-7" style={{ ...GROTESK, letterSpacing: "-0.02em" }}>
              Preguntas de siempre
            </h2>
          </ScrollReveal>
          <Accordion type="single" collapsible className="space-y-3">
            {faqItems.map((item, i) => (
              <ScrollReveal key={i}>
                <AccordionItem
                  value={`faq-${i}`}
                  className="rounded-2xl px-5 border-0"
                  style={{ background: CARD, border: "1px solid rgba(255,255,255,.07)" }}
                >
                  <AccordionTrigger className="text-left text-sm sm:text-[15px] font-semibold hover:no-underline py-4" style={GROTESK}>
                    {item.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-[13px] sm:text-sm leading-relaxed pb-4" style={{ color: MUTED }}>
                    {item.answer}
                  </AccordionContent>
                </AccordionItem>
              </ScrollReveal>
            ))}
          </Accordion>
        </div>
      </section>

      {/* ═══════════ CTA FINAL ═══════════ */}
      <section className="relative overflow-hidden px-5 sm:px-8 py-20 lg:py-28 z-10 text-center">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 w-[420px] h-[340px] rounded-full"
          style={{ background: "radial-gradient(circle, rgba(47,181,131,.11) 0%, rgba(47,181,131,0) 65%)", filter: "blur(16px)" }}
        />
        <div className="relative max-w-2xl mx-auto">
          <ScrollReveal>
            <h2 className="text-[32px] leading-[1.08] sm:text-5xl font-bold tracking-tight" style={{ ...GROTESK, letterSpacing: "-0.025em" }}>
              ¿Lo vemos juntos?
            </h2>
            <p className="mt-4 text-[14.5px] sm:text-base leading-relaxed max-w-md mx-auto" style={{ color: MUTED }}>
              Una demo de 10 minutos por WhatsApp y te vas con tu agenda armada.
            </p>
            <div className="mt-7 flex flex-col sm:flex-row items-center justify-center gap-3">
              <a
                href={WA_DEMO}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full sm:w-auto flex items-center justify-center gap-2 h-14 px-9 rounded-2xl font-semibold text-[15px] transition-transform hover:scale-[1.03]"
                style={{ background: `linear-gradient(135deg, ${GREEN}, ${BRAND})`, color: INK, boxShadow: "0 16px 44px rgba(47,181,131,.24)" }}
              >
                <MessageCircle className="w-[17px] h-[17px]" />
                Agendar mi demo
              </a>
              <a
                href="/acceso"
                className="w-full sm:w-auto flex items-center justify-center h-14 px-9 rounded-2xl font-medium text-[14.5px] transition-colors hover:bg-white/[0.07]"
                style={{ background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.1)", color: SOFT }}
              >
                Ingresar
              </a>
            </div>
            <div className="flex justify-center mt-6">
              <InstallAppButton className="h-10 px-5 rounded-full text-[13px]" label="Instalar la app en tu dispositivo" />
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* ═══════════ FOOTER ═══════════ */}
      <footer className="relative px-4 sm:px-6 py-8 sm:py-12 border-t border-white/5 z-10">
        <div className="max-w-7xl mx-auto flex flex-col items-center gap-4">
          <div className="flex items-center gap-2 text-gray-500 text-xs">
            <span className="text-lg">🇺🇾</span>
            <span>Disponible únicamente en Uruguay</span>
          </div>
          <p className="text-center text-gray-600 text-xs sm:text-sm font-light">
            © {new Date().getFullYear()} Consultorio Digital
          </p>
          <div className="flex items-center gap-4 text-xs text-gray-500">
            <a href="/terminos" className="hover:text-gray-300 transition-colors">
              Términos y Condiciones
            </a>
            <span className="text-gray-700">·</span>
            <a href="/privacidad" className="hover:text-gray-300 transition-colors">
              Política de Privacidad
            </a>
            <span className="text-gray-700">·</span>
            <a href="/seguridad" className="hover:text-gray-300 transition-colors">
              Seguridad
            </a>
          </div>
          <div className="flex items-center gap-2 text-gray-500 text-xs">
            <span>Sistema desarrollado por</span>
            <a
              href="https://www.digitalbuilders.net"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:opacity-80 transition-opacity"
            >
              <img
                src="/assets/logo-digitalbuilders.webp"
                alt="Digital Builders"
                className="h-10 sm:h-12"
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
            boxShadow: "0 4px 20px rgba(37, 211, 102, 0.4)",
            animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
          }}
        >
          <MessageCircle className="w-7 h-7 text-white" strokeWidth={2.2} />
        </div>
      </a>
    </div>
  );
};

export default Landing;

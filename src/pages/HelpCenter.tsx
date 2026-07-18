// Centro de ayuda: mini-guías por módulo, en criollo y con visuales
// ilustrativos propios (nunca capturas que envejecen mal). Cada pregunta que
// responde esta página es un mensaje de soporte que no llega.
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  ArrowLeft, Search, LifeBuoy, CalendarDays, AlarmClock, Users, Receipt,
  Clock, FileText, BarChart3, Palette, CreditCard, Rocket, CheckCircle2,
  MessageCircle,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────
// Mini-visuales ilustrativos (hechos en CSS, con animación sutil)
// ─────────────────────────────────────────────────────────────

const VisualAgendaColors = () => (
  <div className="rounded-xl border border-border/60 bg-muted/30 p-3 grid grid-cols-2 gap-2 text-xs">
    {[
      { c: "bg-primary", t: "Confirmada" },
      { c: "bg-amber-500", t: "Pendiente" },
      { c: "bg-yellow-400", t: "Pidió reprogramar" },
      { c: "bg-rose-500", t: "Cancelada" },
    ].map((i) => (
      <div key={i.t} className="flex items-center gap-2">
        <span className={`w-3 h-3 rounded-full ${i.c}`} />
        <span className="text-muted-foreground">{i.t}</span>
      </div>
    ))}
  </div>
);

const VisualBookingFlow = () => (
  <div className="rounded-xl border border-border/60 bg-muted/30 p-3 flex items-center justify-between text-[11px] text-muted-foreground">
    {["Tipo de sesión", "Día y hora", "Datos", "✓ Confirmada"].map((step, i) => (
      <div key={step} className="flex items-center gap-1.5">
        <span
          className={`px-2 py-1 rounded-full border ${
            i === 3 ? "border-primary/40 bg-primary/10 text-primary font-semibold" : "border-border bg-card"
          }`}
        >
          {step}
        </span>
        {i < 3 && <span className="text-border">→</span>}
      </div>
    ))}
  </div>
);

const VisualPaymentStates = () => (
  <div className="rounded-xl border border-border/60 bg-muted/30 p-3 space-y-2 text-xs">
    {[
      { c: "bg-emerald-500", t: "Pagado", d: "cobro registrado" },
      { c: "bg-amber-500", t: "Por vencer", d: "vence pronto, avisale" },
      { c: "bg-rose-500", t: "Vencido", d: "aparece en 'Te deben'" },
    ].map((i) => (
      <div key={i.t} className="flex items-center gap-2">
        <span className={`w-3 h-3 rounded-full ${i.c} animate-pulse`} />
        <span className="font-medium text-foreground">{i.t}</span>
        <span className="text-muted-foreground">· {i.d}</span>
      </div>
    ))}
  </div>
);

const VisualPolicy = () => (
  <div className="rounded-xl border border-border/60 bg-muted/30 p-3 space-y-1.5 text-[11px]">
    {[
      { t: "Sin pago previo", d: "cobrás en la sesión", on: false },
      { t: "Pago opcional", d: "puede pagar online", on: false },
      { t: "Pago requerido", d: "paga o el horario se libera en 45 min", on: true },
    ].map((i) => (
      <div
        key={i.t}
        className={`flex items-center justify-between rounded-lg border px-2.5 py-1.5 ${
          i.on ? "border-primary/40 bg-primary/10" : "border-border bg-card"
        }`}
      >
        <span className={i.on ? "font-semibold text-primary" : "text-foreground"}>{i.t}</span>
        <span className="text-muted-foreground">{i.d}</span>
      </div>
    ))}
  </div>
);

const VisualBrand = () => (
  <div className="rounded-xl border border-border/60 bg-muted/30 p-3 flex items-center gap-3">
    <span className="w-10 h-10 rounded-xl bg-gradient-to-tr from-primary to-primary/60 shrink-0 animate-pulse" />
    <div className="text-[11px] text-muted-foreground leading-relaxed">
      Tu logo y color se aplican solos a: <span className="text-foreground font-medium">web pública</span>,{" "}
      <span className="text-foreground font-medium">portal del paciente</span> y{" "}
      <span className="text-foreground font-medium">tu panel</span>.
    </div>
  </div>
);

// ─────────────────────────────────────────────────────────────
// Contenido de las guías
// ─────────────────────────────────────────────────────────────

interface GuideItem {
  q: string;
  steps: string[];
  visual?: JSX.Element;
  note?: string;
}

interface GuideSection {
  id: string;
  module: string;
  icon: typeof CalendarDays;
  tint: string;
  items: GuideItem[];
}

const SECTIONS: GuideSection[] = [
  {
    id: "primeros-pasos",
    module: "Primeros pasos",
    icon: Rocket,
    tint: "150 65% 45%",
    items: [
      {
        q: "¿Qué configuro primero para empezar a atender?",
        steps: [
          "Seguí la guía \"Activá tu consultorio\" del inicio: son 5 pasos y al completarlos ya podés recibir reservas.",
          "1) En Mi consultorio → General completá tu nombre, el del consultorio y el email de avisos (ahí te llegan las reservas).",
          "2) En Horarios creá tus tipos de sesión (nombre, duración y precio).",
          "3) En Horarios definí tu semana tipo: los días y franjas en que atendés.",
          "4) En Mi consultorio → Pagos conectá Mercado Pago si querés cobrar online.",
          "5) Compartí tu link público — desde la tarjeta \"Tu web pública\" del inicio.",
        ],
        note: "Con eso pronto, tus pacientes ya pueden reservar solos y a vos te llega el aviso por email y notificación.",
      },
      {
        q: "¿Cómo pongo mi logo y mis colores?",
        steps: [
          "Andá a Portal (en el menú) → ahí subís tu logo, elegís tu color y el nombre que se muestra.",
          "Guardá: tu marca se aplica automáticamente a tu web pública, al portal de tus pacientes y a tu propio panel.",
        ],
        visual: <VisualBrand />,
      },
    ],
  },
  {
    id: "agenda",
    module: "Agenda",
    icon: CalendarDays,
    tint: "176 100% 32%",
    items: [
      {
        q: "¿Qué significan los colores de las citas?",
        steps: [
          "El color de la tarjeta indica el estado de la cita, y el puntito indica cómo vienen los pagos de ese paciente.",
          "Si te olvidás, tocá el botón \"Referencias\" arriba de la agenda: ahí está la leyenda completa.",
        ],
        visual: <VisualAgendaColors />,
      },
      {
        q: "¿Cómo creo una cita?",
        steps: [
          "Tocá el botón + (o un espacio libre del calendario) → \"Cita con paciente\".",
          "Elegí el paciente (o crealo ahí mismo), el tipo de sesión, y el sistema te muestra los horarios que realmente tenés libres.",
          "Confirmá: la cita queda en la agenda, se genera el cobro pendiente vinculado y al paciente le llega el aviso.",
        ],
      },
      {
        q: "¿Cómo agendo sesiones recurrentes (todas las semanas)?",
        steps: [
          "Al crear la cita, activá \"Repetir\": elegí semanal, quincenal o mensual, y cuántas sesiones.",
          "Elegí cómo cobrarla: por sesión (un cobro por cita), mensual (un solo cobro por mes) o sin cobro.",
          "Se crean todas las citas de una y el paciente recibe UN solo email con todas las fechas.",
        ],
      },
    ],
  },
  {
    id: "horarios",
    module: "Horarios y tipos de sesión",
    icon: AlarmClock,
    tint: "262 80% 66%",
    items: [
      {
        q: "¿Cómo funcionan los tipos de sesión?",
        steps: [
          "Cada tipo de sesión tiene nombre, duración, modalidad (online/presencial) y precio.",
          "El paciente elige el TIPO al reservar, y el sistema calcula solo qué horarios caben según la duración.",
          "El precio del tipo de sesión manda: es lo que se cobra por esa cita.",
        ],
      },
      {
        q: "¿Cómo defino cuándo atiendo?",
        steps: [
          "En Horarios → Semana tipo marcá los días y franjas (ej: lunes 9 a 13 y 15 a 19).",
          "La disponibilidad se calcula sola: no tenés que crear casilleros a mano.",
          "¿Un día puntual distinto? Agregalo en \"Horarios sueltos\" sin tocar tu semana tipo.",
          "¿Te vas de vacaciones? Desactivá los días o bloqueá el rango — los pacientes no van a poder reservar ahí.",
        ],
      },
    ],
  },
  {
    id: "reservas",
    module: "Web pública y reservas",
    icon: MessageCircle,
    tint: "210 90% 60%",
    items: [
      {
        q: "¿Cómo reservan mis pacientes?",
        steps: [
          "Compartís tu link público (está siempre en el inicio, con botones para copiar o mandar por WhatsApp).",
          "El paciente entra, elige tipo de sesión, día y horario, deja sus datos y listo.",
          "A vos te llega email + notificación; al paciente su confirmación por email. La cita aparece en tu agenda.",
        ],
        visual: <VisualBookingFlow />,
      },
      {
        q: "No quiero que cualquiera reserve, ¿puedo?",
        steps: [
          "Sí: en Mi consultorio → General activá \"Agenda privada\".",
          "Tu web pública deja de aceptar reservas (muestra que atendés con invitación) y solo tus pacientes con acceso al portal pueden agendar.",
        ],
      },
    ],
  },
  {
    id: "solicitudes",
    module: "Solicitudes",
    icon: FileText,
    tint: "38 92% 55%",
    items: [
      {
        q: "¿Qué son las solicitudes y qué hago con ellas?",
        steps: [
          "Cuando un paciente del portal pide una cita o una reprogramación, entra como solicitud (no toca tu agenda hasta que decidas).",
          "Te avisan el globito rojo del menú y el cartel del inicio.",
          "Entrá a Solicitudes → Confirmar o Rechazar. El paciente recibe el aviso automáticamente en ambos casos.",
        ],
      },
    ],
  },
  {
    id: "pacientes",
    module: "Pacientes y portal",
    icon: Users,
    tint: "210 90% 60%",
    items: [
      {
        q: "¿Cómo invito a un paciente a su portal?",
        steps: [
          "Entrá a su ficha (Pacientes → tocá el nombre) → botón \"Invitar al portal\".",
          "Le llega un email con el acceso. Desde el portal ve sus citas, puede reservar, reprogramar y pagar.",
          "En su ficha ves si ya tiene portal activo (chip \"Portal activo\").",
        ],
      },
      {
        q: "¿Qué veo en la ficha de un paciente?",
        steps: [
          "Todo lo suyo en un lugar: datos de contacto, si debe plata (y cuánto), historial completo de citas, pagos, notas privadas y documentos.",
          "Las notas privadas son tuyas: el paciente no las ve, salvo las que compartas a su portal.",
        ],
      },
    ],
  },
  {
    id: "pagos",
    module: "Pagos y Mercado Pago",
    icon: Receipt,
    tint: "152 70% 45%",
    items: [
      {
        q: "¿Cómo conecto Mercado Pago?",
        steps: [
          "Mi consultorio → Pagos → \"Conectar con Mercado Pago\" → iniciá sesión con TU cuenta de MP y autorizá.",
          "Los pagos de tus pacientes van directo a tu cuenta de Mercado Pago (nosotros no tocamos tu plata).",
          "Consejo: si la página de Mercado Pago no abre, probá desactivar el bloqueador de anuncios o usá una ventana de incógnito.",
        ],
      },
      {
        q: "¿Cuál política de cobro me conviene?",
        steps: [
          "Sin pago previo: reservan gratis y cobrás en la sesión (o marcás el pago a mano).",
          "Pago opcional: el paciente puede pagar online desde su portal si quiere.",
          "Pago requerido: la reserva de la web pública queda retenida hasta que paga; si no paga en 45 minutos, el horario se libera solo.",
          "Las opciones que cobran online solo se habilitan con Mercado Pago conectado.",
        ],
        visual: <VisualPolicy />,
      },
      {
        q: "¿Cómo sigo los cobros y las deudas?",
        steps: [
          "En Pagos ves todo ordenado por urgencia: primero los vencidos.",
          "La tarjeta roja \"Te deben $X\" muestra quiénes deben más — con botón de WhatsApp para reclamar con un mensaje pronto.",
          "¿Te pagaron en efectivo? Botón \"Cobrar\" en la fila → queda registrado.",
        ],
        visual: <VisualPaymentStates />,
      },
    ],
  },
  {
    id: "recordatorios",
    module: "Recordatorios",
    icon: Clock,
    tint: "22 90% 58%",
    items: [
      {
        q: "¿Cómo funcionan los recordatorios automáticos?",
        steps: [
          "En Recordatorios configurás una sola vez: cuántas horas antes avisar y el texto del mensaje (con variables como el nombre y la hora).",
          "A cada cita confirmada se le programa su recordatorio por email automáticamente. No tenés que hacer nada por cita.",
          "En la pestaña Próximos ves los que están por salir; en Historial, los enviados (y podés reintentar si alguno falló).",
        ],
        note: "Los recordatorios por WhatsApp llegan pronto — van a salir solos igual que los de email.",
      },
    ],
  },
  {
    id: "estadisticas",
    module: "Estadísticas",
    icon: BarChart3,
    tint: "190 85% 50%",
    items: [
      {
        q: "¿Qué me cuentan las estadísticas?",
        steps: [
          "Cuánto cobraste y cuánto te deben, con tendencia contra el período anterior.",
          "Proyección del mes: lo cobrado + lo que vence este mes.",
          "De dónde vienen tus reservas (panel, web pública o portal), tus días más cargados y tasa de ausencias.",
          "\"Pacientes sin próxima cita\": los que hace más tiempo no vienen, con botón de WhatsApp para reactivarlos.",
        ],
      },
      {
        q: "¿Puedo exportar un reporte?",
        steps: [
          "Sí: botón \"Exportar PDF\" arriba — genera un reporte profesional con tu marca, listo para guardar o mandar a tu contador.",
          "También podés bajar los datos crudos en CSV (Excel).",
        ],
      },
    ],
  },
  {
    id: "suscripcion",
    module: "Tu suscripción",
    icon: CreditCard,
    tint: "235 75% 66%",
    items: [
      {
        q: "¿Cómo manejo mi suscripción a Consultorio Digital?",
        steps: [
          "En \"Mi plan\" ves tu suscripción, el estado y la próxima fecha de cobro.",
          "El cobro es automático por Mercado Pago. Podés cancelar cuando quieras y mantenés el acceso hasta el fin del período pago.",
          "¿Dudas o problemas con el cobro? Escribinos y lo resolvemos.",
        ],
      },
    ],
  },
];

// ─────────────────────────────────────────────────────────────

const HelpCenter = () => {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return SECTIONS;
    return SECTIONS.map((s) => ({
      ...s,
      items: s.items.filter(
        (it) =>
          it.q.toLowerCase().includes(q) ||
          it.steps.some((st) => st.toLowerCase().includes(q)),
      ),
    })).filter((s) => s.items.length > 0);
  }, [query]);

  return (
    <div className="min-h-screen bg-background pb-16">
      <div className="mx-auto w-full max-w-[1500px] px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
        {/* Encabezado de página */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <span className="h-11 w-11 rounded-2xl flex items-center justify-center shrink-0" style={{ background: "hsla(150, 65%, 45%, 0.14)" }}>
              <LifeBuoy className="h-5 w-5" style={{ color: "hsl(150 65% 45%)" }} />
            </span>
            <div className="min-w-0">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Centro de ayuda</h1>
              <p className="text-sm text-muted-foreground truncate">
                Guías cortas de cada módulo, al grano.
              </p>
            </div>
          </div>
          <button
            onClick={() => navigate("/dashboard")}
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver al inicio
          </button>
        </div>

        <div className="relative lg:max-w-2xl">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscá tu duda... (ej: recordatorio, portal, cobrar)"
            className="pl-10 h-12 rounded-2xl"
          />
        </div>

        {filtered.length === 0 && (
          <Card className="border-dashed">
            <CardContent className="py-10 text-center space-y-2">
              <p className="font-medium">No encontramos nada con "{query}"</p>
              <p className="text-sm text-muted-foreground">
                Probá con otra palabra, o escribinos y te ayudamos.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Mosaico de guías: dos columnas en desktop, una en mobile */}
        <div className="lg:columns-2 2xl:columns-3 lg:gap-6">
        {filtered.map((section) => (
          <Card key={section.id} className="break-inside-avoid mb-6">
            <CardContent className="p-4 sm:p-5">
              <div className="flex items-center gap-2.5 mb-2">
                <span
                  className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: `hsla(${section.tint}, 0.14)` }}
                >
                  <section.icon className="h-4 w-4" style={{ color: `hsl(${section.tint})` }} />
                </span>
                <h2 className="text-base font-semibold">{section.module}</h2>
              </div>
              <Accordion type="single" collapsible className="w-full">
                {section.items.map((item, idx) => (
                  <AccordionItem key={idx} value={`${section.id}-${idx}`} className="border-border/60">
                    <AccordionTrigger className="text-sm text-left hover:no-underline py-3">
                      {item.q}
                    </AccordionTrigger>
                    <AccordionContent className="space-y-3">
                      <ol className="space-y-2">
                        {item.steps.map((step, si) => (
                          <li key={si} className="flex items-start gap-2.5 text-sm text-muted-foreground leading-relaxed">
                            <CheckCircle2 className="h-4 w-4 text-primary/60 shrink-0 mt-0.5" />
                            <span>{step}</span>
                          </li>
                        ))}
                      </ol>
                      {item.visual && <div className="pt-1">{item.visual}</div>}
                      {item.note && (
                        <p className="text-xs text-muted-foreground italic border-l-2 border-primary/30 pl-3">
                          {item.note}
                        </p>
                      )}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </CardContent>
          </Card>
        ))}
        </div>

        <p className="text-center text-xs text-muted-foreground pt-2">
          ¿No encontraste lo que buscabas? Escribinos a{" "}
          <a href="mailto:contacto@consultoriodigital.app" className="underline hover:text-foreground">
            contacto@consultoriodigital.app
          </a>{" "}
          y te damos una mano.
        </p>
      </div>
    </div>
  );
};

export default HelpCenter;

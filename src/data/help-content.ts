/**
 * Contenido centralizado para los tooltips de ayuda.
 *
 * Cada entrada explica brevemente para qué sirve una sección o módulo.
 * El componente <HelpTooltip id="..." /> consume este diccionario.
 *
 * Mantener los textos cortos (1-3 frases), en español rioplatense ('vos').
 */

export interface HelpEntry {
  title: string;
  body: string;
}

export const HELP_CONTENT: Record<string, HelpEntry> = {
  dashboard: {
    title: "Panel principal",
    body:
      "Vista resumen de tu consultorio: pacientes activos, citas del día, cobros pendientes e ingresos del mes. Desde acá podés crear pacientes, citas o cobros sin entrar a cada módulo.",
  },
  patients: {
    title: "Pacientes",
    body:
      "Tu lista de pacientes activos e inactivos. Desde la ficha de cada paciente accedés a sus citas, pagos, notas privadas y al portal del paciente si lo activaste.",
  },
  agenda: {
    title: "Agenda",
    body:
      "Vista de calendario por día, semana o mes. Podés crear citas, ver cobros del día y filtrar por profesional cuando trabajás en equipo.",
  },
  payments: {
    title: "Pagos",
    body:
      "Gestioná cobros únicos y recurrentes. Marcá pagos como cobrados, registrá el método y enviá recordatorios por WhatsApp con un click.",
  },
  reminders: {
    title: "Recordatorios",
    body:
      "Centro de notificaciones automáticas: recordatorios y confirmaciones de cita por WhatsApp y email. Personalizá los mensajes desde Mi Consultorio → Mensajes.",
  },
  statistics: {
    title: "Estadísticas",
    body:
      "Métricas de tu consultorio: ingresos, ocupación de agenda, tasa de ausencias y pacientes inactivos. Filtrá por período y exportá a CSV.",
  },
  billing: {
    title: "Facturación",
    body:
      "Tu plan, ciclo de facturación y próximos cobros con Mercado Pago. Desde acá cambiás de plan o cancelás la suscripción cuando lo necesites.",
  },
  schedules: {
    title: "Horarios",
    body:
      "Configurá tu semana tipo y generá automáticamente los horarios disponibles del mes. Tus pacientes solo ven los slots que dejes activos.",
  },
  patientPortal: {
    title: "Portal del paciente",
    body:
      "Espacio privado donde tus pacientes ven citas, pagos y notifican el portal con tu marca. Personalizá colores, logo y nombre desde Personalizar Portal.",
  },
  sessionNotes: {
    title: "Notas de sesión",
    body:
      "Notas privadas vinculadas al paciente y, opcionalmente, a una sesión específica. Solo vos y los profesionales del consultorio pueden verlas — nunca el paciente.",
  },
  publicClinic: {
    title: "Web pública del consultorio",
    body:
      "Página abierta a internet con tu marca, horarios y formulario de reserva sin login. Disponible solo en planes que incluyen web pública.",
  },
};

export type HelpId = keyof typeof HELP_CONTENT;
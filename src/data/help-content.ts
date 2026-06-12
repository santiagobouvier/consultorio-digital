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
  /** Optional URL for "Ver más" link (internal route or external doc). */
  learnMoreUrl?: string;
  /** Custom label for the "Ver más" link (default: "Ver más"). */
  learnMoreLabel?: string;
}

export const HELP_CONTENT: Record<string, HelpEntry> = {
  // ─────────────── Secciones generales ───────────────
  dashboard: {
    title: "Panel principal",
    body: "Vista resumen de tu consultorio: pacientes, citas del día, cobros pendientes e ingresos del mes.",
  },
  patients: {
    title: "Pacientes",
    body: "Tu lista de pacientes. Entrá a cada ficha para ver historial, pagos, notas y portal.",
  },
  agenda: {
    title: "Agenda",
    body: "Tu calendario por día, semana o mes. Tocá un horario libre para crear una cita.",
  },
  payments: {
    title: "Pagos",
    body: "Cobros únicos y recurrentes. Marcá como cobrado y enviá recordatorios por WhatsApp.",
  },
  reminders: {
    title: "Recordatorios",
    body: "Notificaciones automáticas y manuales por WhatsApp y email para reducir ausencias.",
  },
  statistics: {
    title: "Estadísticas",
    body: "Métricas reales de tu consultorio: ingresos, ocupación, ausencias y retención.",
  },
  billing: {
    title: "Facturación",
    body: "Tu plan, próximos cobros y método de pago vinculado con Mercado Pago.",
  },
  schedules: {
    title: "Horarios",
    body: "Definí tu semana tipo y generá los horarios disponibles del mes con un click.",
  },
  patientPortal: {
    title: "Portal del paciente",
    body: "Espacio privado con tu marca donde tus pacientes ven citas, pagos y reservan turnos.",
  },
  sessionNotes: {
    title: "Notas de sesión",
    body: "Notas privadas del consultorio. El paciente nunca las ve, solo vos y tu equipo.",
  },
  publicClinic: {
    title: "Web pública",
    body: "Página abierta con tu marca y reserva sin login. Solo en planes con web pública.",
  },

  // ─────────────── Dashboard - métricas ───────────────
  dashboardActivePatients: {
    title: "Pacientes activos",
    body: "Cantidad de pacientes marcados como activos. Los inactivos no cuentan para el límite de tu plan.",
  },
  dashboardTodayAppointments: {
    title: "Citas de hoy",
    body: "Turnos confirmados o pendientes para el día de hoy. No incluye cancelados ni ausencias.",
  },
  dashboardOverduePayments: {
    title: "Pagos vencidos",
    body: "Cobros con fecha de vencimiento pasada y aún sin pagar. Hacé click para gestionarlos.",
  },
  dashboardMonthlyIncome: {
    title: "Ingresos del mes",
    body: "Suma de pagos cobrados en el mes en curso. Si sos profesional, solo ves los tuyos.",
  },
  dashboardPortalPatients: {
    title: "Pacientes con portal",
    body: "Pacientes que ya activaron su acceso al portal y pueden ver sus citas y pagos.",
  },
  dashboardPrivacyMode: {
    title: "Modo privacidad",
    body: "Oculta nombres y montos sensibles en pantalla. Útil cuando compartís tu pantalla.",
  },

  // ─────────────── Pacientes ───────────────
  patientsNew: {
    title: "Nuevo paciente",
    body: "Creá la ficha con nombre y contacto. Después podés invitarlo al portal o agendar una cita.",
  },
  patientsExportCSV: {
    title: "Exportar a CSV",
    body: "Descargá tu lista filtrada en formato CSV (UTF-8). Lo abrís con Excel o Google Sheets.",
  },
  patientsStatusFilter: {
    title: "Filtro por estado",
    body: "Mostrá solo activos, inactivos o los que tienen acceso al portal del paciente.",
  },
  patientsPortalColumn: {
    title: "Acceso al portal",
    body: "Indica si el paciente ya activó su cuenta para ver citas y pagos desde su celular.",
  },
  patientInvite: {
    title: "Invitar al portal",
    body: "Generá un link único para que el paciente cree su cuenta y vea su info desde el celular.",
  },
  patientPrivateNotes: {
    title: "Notas privadas",
    body: "Información sensible que solo vos y tu equipo ven. El paciente nunca tiene acceso.",
  },
  patientReason: {
    title: "Motivo de consulta",
    body: "Texto libre con la razón principal por la que el paciente acude. Se usa de referencia interna.",
  },

  // ─────────────── Agenda ───────────────
  agendaNewAppointment: {
    title: "Nueva cita",
    body: "Creá un turno eligiendo paciente, profesional, fecha y hora. Se generan recordatorios automáticos.",
  },
  agendaFilters: {
    title: "Filtros de agenda",
    body: "Filtrá por profesional, modalidad o estado para enfocar el calendario.",
  },
  agendaViews: {
    title: "Vistas día / semana / mes",
    body: "Día para detalle horario, semana para visión general, mes para planificación amplia.",
  },
  agendaPaymentsOfDay: {
    title: "Pagos del día",
    body: "Vencimientos del día visibles directo en la agenda para cobrar al terminar la sesión.",
  },

  // ─────────────── Pagos - estados y acciones ───────────────
  paymentsTotalBilled: {
    title: "Total facturado",
    body: "Suma de todos los cobros registrados, pagados o no, en el período visible.",
  },
  paymentsTotalCollected: {
    title: "Total cobrado",
    body: "Suma de los pagos efectivamente cobrados (con fecha de pago registrada).",
  },
  paymentsOverdueCount: {
    title: "Pagos vencidos",
    body: "Cobros con fecha de vencimiento pasada y aún sin pagar.",
  },
  paymentsPendingCount: {
    title: "Pagos pendientes",
    body: "Pagos sin cobrar pero todavía dentro de la fecha de vencimiento.",
  },
  paymentsRecurrence: {
    title: "Recurrencia",
    body: "Único: un solo cobro. Mensual / quincenal: se regeneran automáticamente cada período.",
  },
  paymentsWhatsAppReminder: {
    title: "Recordar por WhatsApp",
    body: "Abre WhatsApp con un mensaje listo para que el paciente sepa que tiene un cobro pendiente.",
  },
  paymentsConfirm: {
    title: "Confirmar pago",
    body: "Marcá el cobro como pagado, elegí método y fecha. Suma a los ingresos del mes.",
  },

  // ─────────────── Recordatorios ───────────────
  remindersHowItWorks: {
    title: "¿Cómo funcionan?",
    body: "Los recordatorios por email se envían solos. Los de WhatsApp los enviás vos con un click.",
  },
  remindersPendingTab: {
    title: "Pendientes",
    body: "Recordatorios listos para enviar. Tocá WhatsApp para abrir el chat con el mensaje cargado.",
  },
  remindersSendAll: {
    title: "Enviar todos",
    body: "Abre una pestaña de WhatsApp por cada paciente con el mensaje listo, en cadena.",
  },
  remindersAutoSend: {
    title: "Envío automático",
    body: "Si el paciente tiene email cargado, el recordatorio se envía solo a la hora programada.",
  },

  // ─────────────── Estadísticas ───────────────
  statsRevenue: {
    title: "Ingresos por mes",
    body: "Comparativo mensual de cobrado vs pendiente. Útil para detectar caídas o crecimiento.",
  },
  statsHourDistribution: {
    title: "Horarios más demandados",
    body: "Franja horaria con más turnos. Sirve para decidir cuándo abrir más disponibilidad.",
  },
  statsNoShow: {
    title: "Tasa de ausencias",
    body: "% de turnos donde el paciente no se presentó. Bajarla mejora tus ingresos directamente.",
  },
  statsOccupancy: {
    title: "Ocupación de agenda",
    body: "% de horarios disponibles que se reservaron. Mostrá huecos para llenarlos.",
  },
  statsRetention: {
    title: "Nuevos vs recurrentes",
    body: "Pacientes que vienen por primera vez vs los que ya conocías. Mide la retención.",
  },
  statsInactivePatients: {
    title: "Pacientes inactivos",
    body: "Pacientes activos sin movimiento hace 90+ días. Reactivalos con un mensaje de WhatsApp.",
  },
  statsByProfessional: {
    title: "Por profesional",
    body: "Citas y ausencias de cada profesional del consultorio. Solo visible para el dueño.",
  },

  // ─────────────── Facturación ───────────────
  billingPlanLimits: {
    title: "Límites del plan",
    body: "Cantidad máxima de pacientes activos y profesionales que permite tu plan actual.",
  },
  billingTrial: {
    title: "Prueba gratuita",
    body: "Tenés 15 días sin cobro. Cuando termine, se activa el plan elegido automáticamente.",
  },
  billingPaymentMethod: {
    title: "Método de pago",
    body: "Tu tarjeta queda guardada de forma segura en Mercado Pago. Nosotros no la vemos.",
  },
  billingCancel: {
    title: "Cancelar suscripción",
    body: "Podés cancelar cuando quieras. Mantenés acceso hasta el final del período pagado.",
  },

  // ─────────────── Horarios ───────────────
  schedulesTemplate: {
    title: "Plantilla semanal",
    body: "Definí qué días y horarios atendés cada semana. Es la base para generar turnos.",
  },
  schedulesGenerate: {
    title: "Generar horarios",
    body: "Crea automáticamente todos los slots disponibles del mes según tu plantilla semanal.",
  },
  schedulesPunctual: {
    title: "Bloque puntual",
    body: "Agregá horarios para un día específico sin tocar la plantilla (ej: un sábado especial).",
  },
  schedulesList: {
    title: "Lista de horarios",
    body: "Todos los slots ya generados. Editalos o eliminalos uno por uno desde acá.",
  },

  // ─────────────── Portal / Personalización ───────────────
  portalLogo: {
    title: "Logo del consultorio",
    body: "Aparece en el portal del paciente y en los emails. Recomendado: PNG cuadrado de 256px.",
  },
  portalThemeColor: {
    title: "Color del portal",
    body: "Color principal de botones y acentos. Elegí una paleta predefinida o personalizada.",
  },
  portalDisplayName: {
    title: "Nombre visible",
    body: "Cómo ven tu consultorio los pacientes en el portal. Puede diferir del nombre legal.",
  },
  portalShareLink: {
    title: "Compartir el portal",
    body: "Copiá el link y mandalo a tus pacientes para que entren a ver sus citas y pagos.",
  },

  // ─────────────── Notas de sesión ───────────────
  sessionNoteStatus: {
    title: "Borrador vs Finalizada",
    body: "Borrador: la podés seguir editando. Finalizada: queda fija como registro de la sesión.",
  },
  sessionNoteLinkAppointment: {
    title: "Vincular a turno",
    body: "Asociar la nota a una cita específica permite encontrarla rápido en el historial.",
  },
};

export type HelpId = keyof typeof HELP_CONTENT;
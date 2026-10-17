// Datos FICTICIOS del modo capturas. Ningún dato de esta lista viene de la
// base: se generan en la pestaña, son siempre los mismos (semilla fija) y se
// ubican alrededor de "hoy" para que Inicio, Agenda, Pacientes, Pagos y el
// resto de las pantallas se vean vivos.
//
// Solo se reutilizan dos identificadores reales, sin ningún dato asociado:
//  - el id del consultorio autorizado (para que el contexto de la app y la
//    caché por consultorio no cambien de forma), y
//  - el id del usuario con sesión (la app filtra "mis citas" por ese id).
// Nombres, teléfonos (+598 9x 555 0xx), correos (@ejemplo.invalid, dominio
// reservado que no entrega correo), notas y montos son inventados.

import type { Row, Store } from "./postgrest.ts";

export interface FixtureOptions {
  businessId: string;
  userId: string;
  /** "Ahora" para ubicar las citas (por defecto, el reloj). */
  now?: Date;
}

export const SHOWCASE_CLINIC_NAME = "Centro Aurora";
export const SHOWCASE_PROFESSIONAL_NAME = "Valentina Ríos";

// Generador determinístico (mismos datos en cada captura)
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

const MVD_OFFSET_H = 3; // Uruguay: UTC-3 fijo

/** Día de hoy en Montevideo (YYYY-MM-DD) desplazado `offset` días. */
function mvdDay(now: Date, offset: number): string {
  const d = new Date(now.getTime() - MVD_OFFSET_H * 3600_000);
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
}

/** "YYYY-MM-DD" + "HH:MM" de Montevideo → ISO UTC */
function mvdIso(day: string, hhmm: string): string {
  return new Date(`${day}T${hhmm}:00-03:00`).toISOString();
}

function weekday(day: string): number {
  return new Date(`${day}T12:00:00Z`).getUTCDay();
}

/** id estable con forma de UUID (prefijo 5c0a5e = "showcase") */
function fid(kind: number, n: number): string {
  return `5c0a5e${kind.toString(16).padStart(2, "0")}-0000-4000-8000-${n.toString(16).padStart(12, "0")}`;
}

const PATIENTS: { name: string; reason: string; insurance: string; freq: "semanal" | "quincenal" | "mensual"; born: string }[] = [
  { name: "Lucía Fernández", reason: "Ansiedad y manejo del estrés", insurance: "Particular", freq: "semanal", born: "1991-03-14" },
  { name: "Martín Sosa", reason: "Estrés laboral", insurance: "Mutualista", freq: "semanal", born: "1986-07-02" },
  { name: "Camila Pereira", reason: "Duelo", insurance: "Particular", freq: "quincenal", born: "1979-11-23" },
  { name: "Diego Rodríguez", reason: "Orientación vocacional", insurance: "Particular", freq: "quincenal", born: "2004-01-30" },
  { name: "Sofía Martínez", reason: "Autoestima", insurance: "Seguro privado", freq: "semanal", born: "1995-05-09" },
  { name: "Joaquín Silva", reason: "Insomnio", insurance: "Mutualista", freq: "mensual", born: "1972-09-17" },
  { name: "Valeria Gómez", reason: "Vínculos de pareja", insurance: "Particular", freq: "semanal", born: "1988-12-01" },
  { name: "Federico Núñez", reason: "Ataques de pánico", insurance: "Particular", freq: "semanal", born: "1993-04-21" },
  { name: "Agustina López", reason: "Adaptación a cambios", insurance: "Seguro privado", freq: "quincenal", born: "1999-08-11" },
  { name: "Nicolás Castro", reason: "Control de impulsos", insurance: "Mutualista", freq: "quincenal", born: "1984-02-26" },
  { name: "Florencia Díaz", reason: "Maternidad y crianza", insurance: "Particular", freq: "mensual", born: "1990-06-05" },
  { name: "Santiago Méndez", reason: "Estrés académico", insurance: "Particular", freq: "semanal", born: "2002-10-19" },
  { name: "Paula Acosta", reason: "Ansiedad social", insurance: "Particular", freq: "quincenal", born: "1997-01-08" },
  { name: "Gonzalo Ramírez", reason: "Duelo migratorio", insurance: "Seguro privado", freq: "mensual", born: "1981-03-29" },
  { name: "Carolina Suárez", reason: "Burnout", insurance: "Mutualista", freq: "semanal", born: "1987-07-15" },
  { name: "Tomás Benítez", reason: "Consulta inicial", insurance: "Particular", freq: "quincenal", born: "1996-12-12" },
];

const SLOT_TIMES = ["09:00", "10:00", "11:00", "14:00", "15:00", "16:00", "17:00", "18:00"];

const NOTE_LINES = [
  "Sesión de seguimiento. Se retoman los objetivos acordados y se revisan los registros de la semana.",
  "Se trabajó con técnicas de respiración y se acordó practicarlas a diario.",
  "Buena adherencia a las tareas. Se plantea espaciar la frecuencia en las próximas semanas.",
  "Se exploran situaciones disparadoras y se ensayan respuestas alternativas.",
  "Se revisa el plan de trabajo y se fijan metas para el próximo mes.",
];

export function buildShowcaseStore({ businessId, userId, now = new Date() }: FixtureOptions): Store {
  const rand = rng(20261013);
  const pick = <T,>(arr: T[]) => arr[Math.floor(rand() * arr.length)];
  const created = (daysAgo: number) => new Date(now.getTime() - daysAgo * 86400_000).toISOString();
  const email = (name: string) =>
    `${name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, ".")}@ejemplo.invalid`;
  const phone = (i: number) => `+598 9${(i % 9) + 1} 555 0${String(10 + i).padStart(2, "0")}`;

  // ── Consultorio, cuenta y plan ──
  const businesses: Row[] = [
    {
      id: businessId,
      name: SHOWCASE_CLINIC_NAME,
      owner_user_id: userId,
      public_slug: "centro-aurora-ejemplo",
      specialty: "Psicología clínica",
      contact_email: "contacto@ejemplo.invalid",
      plan_code: "profesional",
      billing_period: "annual",
      is_active: true,
      is_demo: false,
      is_private_clinic: false,
      onboarding_completed: true,
      onboarding_link_shared_at: created(120),
      cancellation_hours_notice: 24,
      late_cancellation_message: "Las cancelaciones con menos de 24 horas se cobran.",
      default_session_price: 1800,
      min_booking_notice_hours: 12,
      max_booking_horizon_days: 45,
      portal_clinic_display_name: SHOWCASE_CLINIC_NAME,
      portal_primary_color: "#5B7FA6",
      dashboard_display_name: SHOWCASE_CLINIC_NAME,
      shared_calendar: false,
      timezone: "America/Montevideo",
      plan_started_at: created(200),
      created_at: created(400),
      updated_at: created(3),
    },
  ];
  const profiles: Row[] = [
    { id: userId, name: SHOWCASE_PROFESSIONAL_NAME, email: "valentina.rios@ejemplo.invalid", avatar_url: null, ui_prefs: {}, created_at: created(400), updated_at: created(3) },
  ];
  const user_roles: Row[] = [
    { id: fid(1, 1), user_id: userId, business_id: businessId, role: "owner", calendar_color: "#5B7FA6", coordination_mode: "independent", created_at: created(400) },
  ];
  const subscriptions: Row[] = [
    {
      id: fid(2, 1),
      business_id: businessId,
      plan_code: "profesional",
      status: "active",
      billing_period: "annual",
      amount: 36000,
      currency: "UYU",
      current_period_start: created(165),
      current_period_end: new Date(now.getTime() + 200 * 86400_000).toISOString(),
      trial_ends_at: null,
      mercadopago_preapproval_id: null,
      created_at: created(400),
      updated_at: created(165),
    },
  ];
  const clinic_settings: Row[] = [
    {
      id: fid(3, 1),
      user_id: userId,
      clinic_name: SHOWCASE_CLINIC_NAME,
      specialty: "Psicología clínica",
      welcome_message: "Bienvenida/o. Reservá tu sesión online o escribinos por cualquier consulta.",
      whatsapp_contact_phone: "+598 99 555 000",
      auto_whatsapp_reminders: true,
      auto_email_reminders: true,
      auto_accept_bookings: false,
      reminder_hours_before: 24,
      default_reminder_message: "Hola {nombre}, te recuerdo tu sesión del {fecha} a las {hora}.",
      created_at: created(400),
      updated_at: created(10),
    },
  ];
  const services: Row[] = [
    { id: fid(4, 1), business_id: businessId, name: "Sesión individual", duration_minutes: 50, mode: "ambas", suggested_price: 1800, is_active: true },
    { id: fid(4, 2), business_id: businessId, name: "Primera consulta", duration_minutes: 60, mode: "presencial", suggested_price: 2000, is_active: true },
    { id: fid(4, 3), business_id: businessId, name: "Terapia de pareja", duration_minutes: 75, mode: "ambas", suggested_price: 2600, is_active: true },
    { id: fid(4, 4), business_id: businessId, name: "Sesión online", duration_minutes: 50, mode: "online", suggested_price: 1800, is_active: true },
  ].map((s) => ({ ...s, created_at: created(300), updated_at: created(30) }));
  const spaces: Row[] = [
    { id: fid(5, 1), business_id: businessId, name: "Consultorio 1", type: "consultorio", capacity: 1, color: "#8FB3D9", is_active: true, owned_by_user_id: null, notes: null, created_at: created(300), updated_at: created(30) },
    { id: fid(5, 2), business_id: businessId, name: "Consultorio 2", type: "consultorio", capacity: 1, color: "#B7D3A8", is_active: true, owned_by_user_id: null, notes: null, created_at: created(300), updated_at: created(30) },
  ];
  const dayBlock = (enabled: boolean) => ({ enabled, s1: enabled ? "09:00" : null, e1: enabled ? "13:00" : null, s2: enabled ? "14:00" : null, e2: enabled ? "19:00" : null });
  const template: Row = {
    id: fid(6, 1),
    business_id: businessId,
    professional_user_id: userId,
    name: "Horario habitual",
    is_active: true,
    modality: "ambas",
    slot_duration_minutes: 50,
    default_price: 1800,
    day_blocks: null,
    created_at: created(300),
    updated_at: created(30),
  };
  for (const d of ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]) {
    const b = dayBlock(!["saturday", "sunday"].includes(d));
    template[`${d}_enabled`] = b.enabled;
    template[`${d}_start_1`] = b.s1;
    template[`${d}_end_1`] = b.e1;
    template[`${d}_start_2`] = b.s2;
    template[`${d}_end_2`] = b.e2;
  }

  // ── Pacientes ──
  const patients: Row[] = PATIENTS.map((p, i) => ({
    id: fid(10, i + 1),
    business_id: businessId,
    full_name: p.name,
    email: email(p.name),
    whatsapp_phone: phone(i),
    birth_date: p.born,
    reason_for_consultation: p.reason,
    health_insurance: p.insurance,
    agreed_frequency: p.freq,
    first_consultation_date: mvdDay(now, -(30 + i * 9)),
    is_active: i !== PATIENTS.length - 1,
    payment_policy_override: "inherit",
    payment_type: "por_sesion",
    assigned_professional_id: userId,
    // Algunos pacientes ya usan el portal (id ficticio, no es una cuenta)
    auth_user_id: i < 5 ? fid(11, i + 1) : null,
    avatar_url: null,
    document_id: null,
    referred_by: i % 4 === 0 ? "Recomendación" : null,
    private_notes: null,
    created_by: userId,
    created_at: created(30 + i * 9),
    updated_at: created(i),
  }));
  const patient_clinical_status: Row[] = patients.slice(0, 10).map((p, i) => ({
    patient_id: p.id,
    business_id: businessId,
    treatment_status: i === 6 ? "seguimiento" : "activo",
    risk_flag: "ninguno",
    risk_notes: null,
    current_diagnosis: null,
    current_medication: null,
    medical_history: null,
    created_at: created(60),
    updated_at: created(5),
  }));

  // ── Citas, cobros, notas y recordatorios ──
  const appointments: Row[] = [];
  const payments: Row[] = [];
  const session_notes: Row[] = [];
  const scheduled_reminders: Row[] = [];
  let apptN = 0;
  let payN = 0;
  let noteN = 0;
  let remN = 0;

  for (let offset = -35; offset <= 14; offset++) {
    const day = mvdDay(now, offset);
    const wd = weekday(day);
    if (wd === 0 || wd === 6) continue;
    const count = 3 + Math.floor(rand() * 4); // 3 a 6 por día
    const times = [...SLOT_TIMES].sort(() => rand() - 0.5).slice(0, count).sort();
    for (const t of times) {
      const pIdx = Math.floor(rand() * patients.length);
      const patient = patients[pIdx];
      // Terapia de pareja (75 min) solo si la hora siguiente está libre: sin superposiciones
      const nextHour = `${String(Number(t.slice(0, 2)) + 1).padStart(2, "0")}:00`;
      const service = pIdx % 7 === 3 && !times.includes(nextHour) ? services[2] : pIdx % 5 === 0 ? services[3] : services[0];
      const start = mvdIso(day, t);
      const end = new Date(Date.parse(start) + (service.duration_minutes as number) * 60_000).toISOString();
      const isPast = Date.parse(start) < now.getTime();
      let status: string;
      const roll = rand();
      if (isPast) status = roll < 0.04 ? "no_show" : roll < 0.1 ? "cancelled" : "attended";
      else status = roll < 0.75 ? "confirmed" : "scheduled";
      const price = service.suggested_price as number;
      const paid = isPast && status === "attended" && rand() < 0.93;
      const id = fid(20, ++apptN);
      appointments.push({
        id,
        business_id: businessId,
        patient_id: patient.id,
        professional_id: userId,
        service_id: service.id,
        space_id: service.mode === "online" ? null : spaces[apptN % 2].id,
        start_at: start,
        end_at: end,
        status,
        modality: service.mode === "online" ? "online" : "presencial",
        location: service.mode === "online" ? "Videollamada" : "Consultorio",
        source: apptN % 6 === 0 ? "public_booking" : "panel",
        payment_status: status === "cancelled" ? null : paid ? "pagado" : "pendiente",
        session_price: price,
        contact_name: patient.full_name,
        contact_email: patient.email,
        contact_phone: patient.whatsapp_phone,
        is_new_contact: false,
        notes: null,
        patient_note: null,
        recurrence_group_id: null,
        cancelled_at: status === "cancelled" ? start : null,
        cancellation_reason: status === "cancelled" ? "Reprogramación solicitada" : null,
        created_at: created(Math.max(1, 20 - offset)),
        updated_at: created(Math.max(0, -offset)),
      });
      // Cancelada o ausencia sin cargo: sin cobro
      if (status !== "cancelled" && status !== "no_show") {
        const overdue = isPast && !paid && offset < -7;
        payments.push({
          id: fid(30, ++payN),
          business_id: businessId,
          patient_id: patient.id,
          appointment_id: id,
          amount: price,
          currency: "UYU",
          status: paid ? "paid" : overdue ? "overdue" : "pending",
          due_date: start,
          paid_at: paid ? end : null,
          method: paid ? pick(["transferencia", "efectivo", "mercadopago"]) : null,
          recurrence_type: "one_time",
          anchor_day: null,
          notes: null,
          mp_link_status: null,
          mp_link_url: null,
          mp_preference_id: null,
          mp_link_created_at: null,
          created_at: start,
          updated_at: paid ? end : start,
        });
      }
      if (status === "attended" && rand() < 0.7) {
        session_notes.push({
          id: fid(40, ++noteN),
          business_id: businessId,
          patient_id: patient.id,
          appointment_id: id,
          author_user_id: userId,
          note_date: day,
          content: `${pick(NOTE_LINES)} (Nota de ejemplo, datos ficticios.)`,
          status: "finalized",
          created_at: end,
          updated_at: end,
        });
      }
      const remindAt = Date.parse(start) - 24 * 3600_000;
      if (!isPast && remindAt > now.getTime() && offset <= 3 && status !== "cancelled") {
        for (const channel of ["whatsapp", "email"]) {
          scheduled_reminders.push({
            id: fid(50, ++remN),
            business_id: businessId,
            patient_id: patient.id,
            appointment_id: id,
            channel,
            type: "reminder",
            status: "scheduled",
            auto_send: true,
            message: `Hola ${String(patient.full_name).split(" ")[0]}, te recuerdo tu sesión de mañana a las ${t}.`,
            scheduled_for: new Date(remindAt).toISOString(),
            recipient_phone: null,
            wa_params: null,
            created_at: created(2),
          });
        }
      }
    }
  }

  // Solicitudes del portal pendientes de confirmar y un pedido de reprogramación
  for (const [i, off, t] of [[2, 2, "12:00"], [9, 4, "19:00"]] as const) {
    const p = patients[i];
    const day = mvdDay(now, off);
    appointments.push({
      id: fid(20, ++apptN),
      business_id: businessId,
      patient_id: p.id,
      professional_id: userId,
      service_id: services[0].id,
      start_at: mvdIso(day, t),
      end_at: new Date(Date.parse(mvdIso(day, t)) + 50 * 60_000).toISOString(),
      status: "pending",
      modality: "presencial",
      source: "patient_portal",
      payment_status: "pendiente",
      session_price: 1800,
      contact_name: p.full_name,
      contact_email: p.email,
      contact_phone: p.whatsapp_phone,
      patient_note: "¿Puede ser en este horario? Gracias.",
      is_new_contact: false,
      created_at: created(1),
      updated_at: created(1),
    });
  }
  const futureConfirmed = appointments.find((a) => a.status === "confirmed" && Date.parse(String(a.start_at)) > now.getTime() + 86400_000);
  const appointment_reschedule_requests: Row[] = futureConfirmed
    ? [
        {
          id: fid(21, 1),
          business_id: businessId,
          original_appointment_id: futureConfirmed.id,
          requested_start_at: new Date(Date.parse(String(futureConfirmed.start_at)) + 2 * 86400_000).toISOString(),
          requested_end_at: new Date(Date.parse(String(futureConfirmed.end_at)) + 2 * 86400_000).toISOString(),
          requested_slot_id: null,
          requested_by: null,
          reason: "Tengo un compromiso laboral ese día.",
          status: "pending",
          rejection_reason: null,
          resolved_at: null,
          created_at: created(1),
          updated_at: created(1),
        },
      ]
    : [];

  // Un cobro mensual recurrente de ejemplo
  payments.push({
    id: fid(30, ++payN),
    business_id: businessId,
    patient_id: patients[4].id,
    appointment_id: null,
    amount: 6400,
    currency: "UYU",
    status: "pending",
    due_date: mvdDay(now, 5),
    paid_at: null,
    method: null,
    recurrence_type: "monthly",
    anchor_day: 1,
    notes: "Paquete mensual (4 sesiones)",
    created_at: created(25),
    updated_at: created(25),
  });

  const patient_documents: Row[] = patients.slice(0, 6).map((p, i) => ({
    id: fid(60, i + 1),
    business_id: businessId,
    patient_id: p.id,
    appointment_id: null,
    document_type: ["consentimiento", "informe", "evaluacion"][i % 3],
    file_name: ["Consentimiento informado.pdf", "Informe de evolución.pdf", "Evaluación inicial.pdf"][i % 3],
    file_path: `capturas/ejemplo-${i + 1}.pdf`,
    file_size: 120_000 + i * 7_000,
    mime_type: "application/pdf",
    notes: null,
    shared_with_patient: i % 2 === 0,
    shared_at: i % 2 === 0 ? created(10 + i) : null,
    uploaded_by: userId,
    created_at: created(10 + i),
    updated_at: created(10 + i),
  }));

  const personal_event_labels: Row[] = [
    { id: fid(70, 1), business_id: businessId, professional_user_id: userId, name: "Formación", color: "#C7A6E0", created_at: created(90), updated_at: created(90) },
    { id: fid(70, 2), business_id: businessId, professional_user_id: userId, name: "Personal", color: "#F2C28B", created_at: created(90), updated_at: created(90) },
  ];
  const personal_events: Row[] = [1, 3, 8].map((off, i) => {
    const day = mvdDay(now, off);
    return {
      id: fid(71, i + 1),
      business_id: businessId,
      professional_user_id: userId,
      title: ["Supervisión clínica", "Trámite personal", "Taller de actualización"][i],
      category: i === 1 ? "personal" : "work",
      label_id: personal_event_labels[i === 1 ? 1 : 0].id,
      start_at: mvdIso(day, "13:00"),
      end_at: mvdIso(day, "14:00"),
      recurrence: "none",
      recurrence_until: null,
      icon: null,
      notes: null,
      google_event_id: null,
      google_synced_at: null,
      created_at: created(7),
      updated_at: created(7),
    };
  });

  return {
    businesses,
    profiles,
    user_roles,
    subscriptions,
    clinic_settings,
    services,
    spaces,
    availability_templates: [template],
    patients,
    patient_clinical_status,
    appointments,
    payments,
    session_notes,
    scheduled_reminders,
    appointment_reschedule_requests,
    patient_documents,
    personal_event_labels,
    personal_events,
    payment_policies: [
      // "modo-capturas" no es un token: solo hace que la versión actual de la app muestre Mercado Pago conectado.
      { id: fid(80, 1), business_id: businessId, policy_type: "optional", deposit_percentage: null, session_price: 1800, mp_access_token: "modo-capturas", mp_public_key: null, mp_connected: true, created_at: created(200), updated_at: created(20) },
    ],
    business_bank_accounts: [
      { id: fid(81, 1), business_id: businessId, bank_name: "Banco de ejemplo", account_holder: SHOWCASE_PROFESSIONAL_NAME, account_number: "000000-0000", account_number_other_banks: null, currency: "UYU", notes: "Cuenta ficticia", created_at: created(200), updated_at: created(200) },
    ],
    business_document_types: [],
    note_templates: [
      { id: fid(82, 1), business_id: businessId, professional_user_id: userId, name: "Seguimiento", content: "Motivo de la sesión:\nTemas trabajados:\nAcuerdos:\n", created_at: created(100), updated_at: created(100) },
      { id: fid(82, 2), business_id: businessId, professional_user_id: userId, name: "Primera entrevista", content: "Motivo de consulta:\nAntecedentes:\nPlan:\n", created_at: created(100), updated_at: created(100) },
    ],
    appointment_requests: [],
    availability_slots: [],
    availability_rules: [],
    availability_exceptions: [],
    patient_notifications: [],
    patient_portal_invites: [],
    professional_portal_invites: [],
    professional_spaces: [],
    push_subscriptions: [],
    calendar_feed_tokens: [],
    external_calendars: [],
    google_calendar_accounts: [],
    google_oauth_states: [],
    pending_business_activations: [],
    platform_settings: [],
    businesses_public_branding: businesses.map((b) => ({
      id: b.id,
      name: b.name,
      public_slug: b.public_slug,
      specialty: b.specialty,
      is_private_clinic: b.is_private_clinic,
      portal_clinic_display_name: b.portal_clinic_display_name,
      portal_primary_color: b.portal_primary_color,
      dashboard_display_name: b.dashboard_display_name,
      shared_calendar: b.shared_calendar,
      cancellation_hours_notice: b.cancellation_hours_notice,
      late_cancellation_message: b.late_cancellation_message,
    })),
  };
}

/** Respuestas de RPC de solo lectura que usan las pantallas. */
export function showcaseRpc(store: Store, name: string, args: Row, opts: FixtureOptions): unknown {
  switch (name) {
    case "is_super_admin":
      return false;
    case "get_user_business_id":
      return opts.businessId;
    case "get_available_starts": {
      const from = String(args.p_from ?? "");
      const to = String(args.p_to ?? from);
      const dur = Number(args.p_duration_minutes ?? 50);
      const out: Row[] = [];
      const busy = (store.appointments ?? []).filter((a) => !["cancelled", "cancelled_by_patient"].includes(String(a.status)));
      for (let d = new Date(`${from}T12:00:00Z`); d.toISOString().slice(0, 10) <= to; d.setUTCDate(d.getUTCDate() + 1)) {
        const day = d.toISOString().slice(0, 10);
        const wd = d.getUTCDay();
        if (wd === 0 || wd === 6) continue;
        for (const t of SLOT_TIMES) {
          const s = Date.parse(mvdIso(day, t));
          const e = s + dur * 60_000;
          if (s < Date.now()) continue;
          if (busy.some((a) => Date.parse(String(a.start_at)) < e && Date.parse(String(a.end_at)) > s)) continue;
          const endT = new Date(e - MVD_OFFSET_H * 3600_000).toISOString().slice(11, 19);
          out.push({ day, start_time: `${t}:00`, end_time: endT });
        }
      }
      return out;
    }
    default:
      return null;
  }
}

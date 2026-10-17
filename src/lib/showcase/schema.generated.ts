// GENERADO por scripts/generate-showcase-schema.mjs desde types.ts. No editar a mano.
export interface ShowcaseFk { name: string; columns: string[]; oneToOne: boolean; ref: string }
export const SHOWCASE_SCHEMA: Record<string, { columns: string[]; fks: ShowcaseFk[] }> = {
  appointment_requests: {
    columns: ["business_id","clinic_user_id","created_at","email","id","message","name","phone","requested_datetime","status","updated_at"],
    fks: [{"name":"appointment_requests_business_id_fkey","columns":["business_id"],"oneToOne":false,"ref":"businesses"}],
  },
  appointment_reschedule_requests: {
    columns: ["business_id","created_at","id","original_appointment_id","reason","rejection_reason","requested_by","requested_end_at","requested_slot_id","requested_start_at","resolved_at","status","updated_at"],
    fks: [{"name":"arr_business_fk","columns":["business_id"],"oneToOne":false,"ref":"businesses"},{"name":"arr_original_appointment_fk","columns":["original_appointment_id"],"oneToOne":false,"ref":"appointments"},{"name":"arr_requested_slot_fk","columns":["requested_slot_id"],"oneToOne":false,"ref":"availability_slots"}],
  },
  appointments: {
    columns: ["availability_slot_id","business_id","cancellation_acknowledged_at","cancellation_reason","cancelled_at","cancelled_by","contact_email","contact_name","contact_phone","created_at","end_at","google_event_id","google_synced_at","id","is_new_contact","location","modality","notes","patient_id","patient_note","payment_status","professional_id","recurrence_group_id","service_id","session_price","source","space_id","start_at","status","updated_at"],
    fks: [{"name":"appointments_availability_slot_id_fkey","columns":["availability_slot_id"],"oneToOne":false,"ref":"availability_slots"},{"name":"appointments_business_id_fkey","columns":["business_id"],"oneToOne":false,"ref":"businesses"},{"name":"appointments_patient_id_fkey","columns":["patient_id"],"oneToOne":false,"ref":"patients"},{"name":"appointments_service_id_fkey","columns":["service_id"],"oneToOne":false,"ref":"services"}],
  },
  availability_exceptions: {
    columns: ["business_id","created_at","end_at","id","notes","professional_id","reason","scope","space_id","start_at","updated_at"],
    fks: [],
  },
  availability_rules: {
    columns: ["business_id","created_at","day_of_week","end_time","id","is_active","professional_id","slot_duration_minutes","start_time","updated_at"],
    fks: [],
  },
  availability_slots: {
    columns: ["business_id","created_at","date","end_time","generated_from_template","id","modality","notes","price","professional_user_id","start_time","status","updated_at"],
    fks: [{"name":"availability_slots_business_id_fkey","columns":["business_id"],"oneToOne":false,"ref":"businesses"},{"name":"availability_slots_generated_from_template_fkey","columns":["generated_from_template"],"oneToOne":false,"ref":"availability_templates"}],
  },
  availability_templates: {
    columns: ["business_id","created_at","day_blocks","default_price","friday_enabled","friday_end_1","friday_end_2","friday_start_1","friday_start_2","id","is_active","modality","monday_enabled","monday_end_1","monday_end_2","monday_start_1","monday_start_2","name","professional_user_id","saturday_enabled","saturday_end_1","saturday_end_2","saturday_start_1","saturday_start_2","slot_duration_minutes","sunday_enabled","sunday_end_1","sunday_end_2","sunday_start_1","sunday_start_2","thursday_enabled","thursday_end_1","thursday_end_2","thursday_start_1","thursday_start_2","tuesday_enabled","tuesday_end_1","tuesday_end_2","tuesday_start_1","tuesday_start_2","updated_at","wednesday_enabled","wednesday_end_1","wednesday_end_2","wednesday_start_1","wednesday_start_2"],
    fks: [{"name":"availability_templates_business_id_fkey","columns":["business_id"],"oneToOne":false,"ref":"businesses"}],
  },
  business_bank_accounts: {
    columns: ["account_holder","account_number","account_number_other_banks","bank_name","business_id","created_at","currency","id","notes","updated_at"],
    fks: [{"name":"business_bank_accounts_business_id_fkey","columns":["business_id"],"oneToOne":false,"ref":"businesses"}],
  },
  business_document_types: {
    columns: ["business_id","created_at","icon","id","label"],
    fks: [{"name":"business_document_types_business_id_fkey","columns":["business_id"],"oneToOne":false,"ref":"businesses"}],
  },
  businesses: {
    columns: ["billing_period","cancellation_hours_notice","contact_email","created_at","custom_domain","custom_max_patients","custom_max_professionals","custom_subdomain","dashboard_display_name","dashboard_logo_url","dashboard_primary_color","default_session_price","id","is_active","is_demo","is_private_clinic","late_cancellation_message","max_booking_horizon_days","min_booking_notice_hours","name","no_billing_until","onboarding_completed","onboarding_link_shared_at","owner_user_id","plan_code","plan_expires_at","plan_started_at","portal_clinic_display_name","portal_dark_primary_color","portal_logo_url","portal_primary_color","portal_theme_preset","public_slug","shared_calendar","specialty","timezone","updated_at"],
    fks: [],
  },
  businesses_public_branding: {
    columns: ["cancellation_hours_notice","custom_domain","custom_subdomain","dashboard_display_name","dashboard_logo_url","dashboard_primary_color","id","is_private_clinic","late_cancellation_message","name","owner_user_id","plan_code","portal_clinic_display_name","portal_dark_primary_color","portal_logo_url","portal_primary_color","portal_theme_preset","public_slug","shared_calendar","specialty"],
    fks: [],
  },
  calendar_feed_tokens: {
    columns: ["business_id","created_at","destination","id","professional_user_id","token","updated_at"],
    fks: [],
  },
  clinic_settings: {
    columns: ["auto_accept_bookings","auto_email_reminders","auto_whatsapp_reminders","clinic_name","cover_image_url","created_at","default_confirmation_message","default_postsession_message","default_reminder_message","id","logo_url","reminder_hours_before","specialty","updated_at","user_id","welcome_message","whatsapp_contact_phone"],
    fks: [],
  },
  external_calendars: {
    columns: ["business_id","created_at","ics_url","id","label","professional_user_id"],
    fks: [{"name":"external_calendars_business_id_fkey","columns":["business_id"],"oneToOne":false,"ref":"businesses"}],
  },
  google_calendar_accounts: {
    columns: ["business_id","calendar_id","created_at","google_email","id","professional_user_id","refresh_token","sync_enabled"],
    fks: [{"name":"google_calendar_accounts_business_id_fkey","columns":["business_id"],"oneToOne":false,"ref":"businesses"}],
  },
  google_oauth_states: {
    columns: ["business_id","created_at","professional_user_id","state"],
    fks: [],
  },
  note_templates: {
    columns: ["business_id","content","created_at","id","name","professional_user_id","updated_at"],
    fks: [],
  },
  patient_clinical_status: {
    columns: ["business_id","created_at","current_diagnosis","current_medication","medical_history","patient_id","risk_flag","risk_notes","treatment_status","updated_at"],
    fks: [{"name":"patient_clinical_status_business_id_fkey","columns":["business_id"],"oneToOne":false,"ref":"businesses"},{"name":"patient_clinical_status_patient_id_fkey","columns":["patient_id"],"oneToOne":true,"ref":"patients"}],
  },
  patient_documents: {
    columns: ["appointment_id","business_id","created_at","document_type","file_name","file_path","file_size","id","mime_type","notes","patient_id","shared_at","shared_with_patient","updated_at","uploaded_by"],
    fks: [{"name":"patient_documents_appointment_id_fkey","columns":["appointment_id"],"oneToOne":false,"ref":"appointments"},{"name":"patient_documents_business_id_fkey","columns":["business_id"],"oneToOne":false,"ref":"businesses"},{"name":"patient_documents_patient_id_fkey","columns":["patient_id"],"oneToOne":false,"ref":"patients"}],
  },
  patient_notifications: {
    columns: ["body","business_id","created_at","id","metadata","patient_id","read_at","related_appointment_id","related_payment_id","title","type"],
    fks: [{"name":"patient_notifications_business_id_fkey","columns":["business_id"],"oneToOne":false,"ref":"businesses"},{"name":"patient_notifications_patient_id_fkey","columns":["patient_id"],"oneToOne":false,"ref":"patients"}],
  },
  patient_portal_invites: {
    columns: ["auth_user_id","created_at","expires_at","id","patient_id","token","used_at"],
    fks: [{"name":"patient_portal_invites_patient_id_fkey","columns":["patient_id"],"oneToOne":false,"ref":"patients"}],
  },
  patients: {
    columns: ["agreed_frequency","assigned_professional_id","auth_user_id","avatar_url","birth_date","business_id","created_at","created_by","document_id","email","emergency_contact_name","emergency_contact_phone","emergency_contact_relationship","first_consultation_date","full_name","guardian_email","guardian_name","guardian_phone","guardian_relationship","health_insurance","id","is_active","payment_policy_override","payment_type","private_notes","reason_for_consultation","referred_by","updated_at","whatsapp_phone"],
    fks: [{"name":"patients_business_id_fkey","columns":["business_id"],"oneToOne":false,"ref":"businesses"}],
  },
  payment_policies: {
    columns: ["business_id","created_at","deposit_percentage","id","mp_access_token","mp_public_key","policy_type","session_price","updated_at"],
    fks: [{"name":"payment_policies_business_id_fkey","columns":["business_id"],"oneToOne":true,"ref":"businesses"}],
  },
  payments: {
    columns: ["amount","anchor_day","appointment_id","business_id","created_at","currency","due_date","id","method","mp_link_created_at","mp_link_status","mp_link_url","mp_preference_id","notes","paid_at","patient_id","recurrence_type","status","updated_at"],
    fks: [{"name":"payments_appointment_id_fkey","columns":["appointment_id"],"oneToOne":false,"ref":"appointments"},{"name":"payments_business_id_fkey","columns":["business_id"],"oneToOne":false,"ref":"businesses"},{"name":"payments_patient_id_fkey","columns":["patient_id"],"oneToOne":false,"ref":"patients"}],
  },
  pending_business_activations: {
    columns: ["business_name","created_at","created_by","custom_max_patients","custom_max_professionals","expires_at","id","owner_email","plan_code","token","updated_at","used_at"],
    fks: [],
  },
  personal_event_labels: {
    columns: ["business_id","color","created_at","id","name","professional_user_id","updated_at"],
    fks: [],
  },
  personal_events: {
    columns: ["business_id","category","created_at","end_at","google_event_id","google_synced_at","icon","id","label_id","notes","professional_user_id","recurrence","recurrence_until","start_at","title","updated_at"],
    fks: [{"name":"personal_events_label_id_fkey","columns":["label_id"],"oneToOne":false,"ref":"personal_event_labels"}],
  },
  platform_settings: {
    columns: ["key","updated_at","value"],
    fks: [],
  },
  professional_portal_invites: {
    columns: ["auth_user_id","business_id","created_at","email","expires_at","id","name","token","used_at"],
    fks: [{"name":"professional_portal_invites_business_id_fkey","columns":["business_id"],"oneToOne":false,"ref":"businesses"}],
  },
  professional_spaces: {
    columns: ["created_at","professional_id","space_id"],
    fks: [],
  },
  profiles: {
    columns: ["avatar_url","created_at","email","id","name","ui_prefs","updated_at"],
    fks: [],
  },
  push_subscriptions: {
    columns: ["auth","business_id","created_at","device_type","endpoint","id","p256dh","user_id"],
    fks: [{"name":"push_subscriptions_business_id_fkey","columns":["business_id"],"oneToOne":false,"ref":"businesses"}],
  },
  scheduled_reminders: {
    columns: ["appointment_id","auto_send","business_id","channel","created_at","id","message","patient_id","recipient_phone","scheduled_for","status","type","wa_params"],
    fks: [{"name":"fk_appointment","columns":["appointment_id"],"oneToOne":false,"ref":"appointments"},{"name":"fk_patient","columns":["patient_id"],"oneToOne":false,"ref":"patients"}],
  },
  services: {
    columns: ["business_id","created_at","duration_minutes","id","is_active","mode","name","suggested_price","updated_at"],
    fks: [{"name":"services_business_id_fkey","columns":["business_id"],"oneToOne":false,"ref":"businesses"}],
  },
  session_notes: {
    columns: ["appointment_id","author_user_id","business_id","content","created_at","id","note_date","patient_id","status","updated_at"],
    fks: [{"name":"session_notes_appointment_id_fkey","columns":["appointment_id"],"oneToOne":false,"ref":"appointments"},{"name":"session_notes_business_id_fkey","columns":["business_id"],"oneToOne":false,"ref":"businesses"},{"name":"session_notes_patient_id_fkey","columns":["patient_id"],"oneToOne":false,"ref":"patients"}],
  },
  spaces: {
    columns: ["business_id","capacity","color","created_at","id","is_active","name","notes","owned_by_user_id","type","updated_at"],
    fks: [],
  },
  subscriptions: {
    columns: ["amount","billing_period","business_id","cancelled_at","created_at","currency","current_period_end","current_period_start","detached_mercadopago_preapproval_id","id","mercadopago_payer_id","mercadopago_preapproval_id","plan_code","status","trial_ends_at","updated_at"],
    fks: [{"name":"subscriptions_business_id_fkey","columns":["business_id"],"oneToOne":false,"ref":"businesses"}],
  },
  user_roles: {
    columns: ["business_id","calendar_color","coordination_mode","created_at","id","role","user_id"],
    fks: [{"name":"user_roles_business_id_fkey","columns":["business_id"],"oneToOne":false,"ref":"businesses"}],
  },
};

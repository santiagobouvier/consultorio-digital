## Hallazgo crítico previo

`patients` **no tiene** ni `assigned_professional_id` ni `created_by`. Sin esos campos no se puede implementar el modelo "cada profesional ve solo lo suyo" en `patients` (ni en cascada en `payments`, `session_notes`, `patient_documents`, `scheduled_reminders`, `patient_notifications`, que dependen de la asignación del paciente).

Por lo tanto la Sub-fase 1.B requiere primero una **migración de schema**, no solo de policies.

---

## 1. Inventario de tablas con `business_id` / `patient_id` / `professional_id`

| Tabla | business_id | patient_id | professional_id | Clasificación propuesta |
|---|---|---|---|---|
| appointments | ✓ | ✓ | ✓ | **Ya migrada (1.A) — privada por profesional** |
| patients | ✓ | — | — (falta) | **Privada por profesional asignado** |
| payments | ✓ | ✓ | — | **Privada por profesional asignado del paciente / de la cita** |
| appointment_reschedule_requests | ✓ | — (vía appt) | — | **Privada (deriva del professional_id de la appointment original)** |
| patient_notifications | ✓ | ✓ | — | **Privada (deriva del paciente)** — verificar |
| session_notes | ✓ | ✓ | — (author_user_id) | **Privada por author_user_id + profesional asignado del paciente** |
| patient_documents | ✓ | ✓ | — (uploaded_by) | **Privada por profesional asignado del paciente** |
| scheduled_reminders | ✓ | ✓ | — | **Privada por profesional asignado del paciente** |
| appointment_requests | ✓ | — | — | **Compartida en el business** (reservas públicas, sin asignación previa). Mantener actual. |
| availability_rules / exceptions / templates / slots | ✓ | — | ✓/— | Mantener actuales (compartido o por profesional dueño). |
| spaces / professional_spaces / services | ✓ | — | — | Compartidas en el business. Sin cambios. |
| payment_policies | ✓ | — | — | Configuración del negocio. Sin cambios. |
| push_subscriptions | ✓ | — | — | Ya filtra por user_id. Sin cambios. |
| subscriptions / user_roles / professional_portal_invites / patient_portal_invites / pending_business_activations | varios | — | — | Administrativas. Sin cambios. |

---

## 2. Cambios de schema requeridos

```sql
-- Asignación del paciente a un profesional
ALTER TABLE public.patients
  ADD COLUMN assigned_professional_id uuid,
  ADD COLUMN created_by uuid;

-- Backfill: asignar al owner del business para no romper acceso
UPDATE public.patients p
SET assigned_professional_id = b.owner_user_id,
    created_by = b.owner_user_id
FROM public.businesses b
WHERE p.business_id = b.id
  AND p.assigned_professional_id IS NULL;

CREATE INDEX idx_patients_assigned_prof ON public.patients(assigned_professional_id);
```

No se agregan FKs a `auth.users` (regla del proyecto).

---

## 3. Helper común (security definer)

Para evitar duplicar joins en cada policy:

```sql
CREATE OR REPLACE FUNCTION public.is_patient_professional(_user_id uuid, _patient_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.patients p
    WHERE p.id = _patient_id
      AND (p.assigned_professional_id = _user_id OR p.created_by = _user_id)
  );
$$;

CREATE OR REPLACE FUNCTION public.is_patient_owner_auth(_user_id uuid, _patient_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.patients p
    WHERE p.id = _patient_id AND p.auth_user_id = _user_id
  );
$$;
```

---

## 4. Plan drop/create por tabla

### 4.1 `patients`

**Drop:** `patients_select_own_business`, `patients_insert_own_business`, `patients_update_own_business`, `patients_delete_own_business` (las 4 basadas en `user_belongs_to_business`).
**Mantener:** "Patients can update their own record", "Patients can view their own record", "Super admin can delete patients".

**Create:**
- `patients_select_assigned_or_creator` (SELECT, authenticated): `is_super_admin(auth.uid()) OR assigned_professional_id = auth.uid() OR created_by = auth.uid()`
- `patients_insert_business_member` (INSERT): `user_belongs_to_business(auth.uid(), business_id) AND (assigned_professional_id IS NULL OR assigned_professional_id = auth.uid()) AND (created_by IS NULL OR created_by = auth.uid())`
- `patients_update_assigned` (UPDATE): `is_super_admin(auth.uid()) OR assigned_professional_id = auth.uid() OR created_by = auth.uid()`
- `patients_delete_assigned` (DELETE): `assigned_professional_id = auth.uid() OR created_by = auth.uid()`

**Trigger** `patients_set_defaults_biu`:
- BEFORE INSERT: si `created_by IS NULL` → `auth.uid()`; si `assigned_professional_id IS NULL` → `auth.uid()`.
- BEFORE UPDATE: si la fila vieja tiene `assigned_professional_id` y `auth.uid()` NO es super_admin ni el assigned actual, **bloquear** cambio de `assigned_professional_id` y `business_id`. También bloquear que el paciente (auth_user_id=auth.uid()) cambie esos campos vía su policy de self-update.

### 4.2 `payments`

**Drop:** `payments_select_own_business`, `payments_insert_own_business`, `payments_update_own_business`, `payments_delete_own_business`.
**Mantener:** "Patients can view their own payments", "Super admin can delete payments".

**Create:**
- `payments_select_prof` (SELECT): `is_super_admin(auth.uid()) OR is_patient_professional(auth.uid(), patient_id) OR EXISTS (SELECT 1 FROM appointments a WHERE a.id = payments.appointment_id AND a.professional_id = auth.uid())`
- `payments_insert_prof` (INSERT): `is_super_admin(auth.uid()) OR is_patient_professional(auth.uid(), patient_id)`
- `payments_update_prof` (UPDATE): mismo using/check que select. (Webhook MP usa service role → bypass).
- `payments_delete_prof` (DELETE): `is_super_admin(auth.uid()) OR is_patient_professional(auth.uid(), patient_id)`

### 4.3 `appointment_reschedule_requests`

**Drop:** `reschedule_business_members_all`.
**Mantener:** `reschedule_patient_select_own`, `reschedule_patient_insert_own`, `reschedule_super_admin_all`.

**Create:**
- `reschedule_prof_select` (SELECT, authenticated): `EXISTS (SELECT 1 FROM appointments a WHERE a.id = original_appointment_id AND a.professional_id = auth.uid())`
- `reschedule_prof_update` (UPDATE): mismo expression. (Los RPCs `approve_reschedule_request` / `reject_reschedule_request` son SECURITY DEFINER; agregar al chequeo interno la condición `a.professional_id = auth.uid() OR is_super_admin(auth.uid())` en lugar del actual `user_belongs_to_business`.)

### 4.4 `session_notes`

**Drop:** `session_notes_select_own_business`, `session_notes_insert_own_business`, `session_notes_update_own_business`, `session_notes_delete_own_business`.
**Mantener:** `session_notes_super_admin_all`.

**Create:**
- SELECT: `is_super_admin(auth.uid()) OR author_user_id = auth.uid() OR is_patient_professional(auth.uid(), patient_id)`
- INSERT: `user_belongs_to_business(auth.uid(), business_id) AND author_user_id = auth.uid() AND (is_patient_professional(auth.uid(), patient_id) OR is_super_admin(auth.uid()))`
- UPDATE: `author_user_id = auth.uid() OR is_super_admin(auth.uid())`
- DELETE: igual que UPDATE.

### 4.5 `patient_documents`

**Drop:** las 4 `*_own_business`.
**Mantener:** super_admin.

**Create:**
- SELECT: `is_super_admin(auth.uid()) OR uploaded_by = auth.uid() OR is_patient_professional(auth.uid(), patient_id)`
- INSERT: `uploaded_by = auth.uid() AND is_patient_professional(auth.uid(), patient_id)`
- UPDATE / DELETE: `is_super_admin(auth.uid()) OR uploaded_by = auth.uid() OR is_patient_professional(auth.uid(), patient_id)`

### 4.6 `scheduled_reminders`

**Drop:** las 4 `*_own_business`.
**Mantener:** super_admin.

**Create:** todas usan `is_super_admin(auth.uid()) OR is_patient_professional(auth.uid(), patient_id)`.

Nota: el trigger `auto_create_reminders` corre en contexto del usuario que crea la cita; ahora `professional_id = auth.uid()` (post 1.A) garantiza acceso. OK.

### 4.7 `patient_notifications`

Estado actual:
- `notif_patient_select_own` ✓ paciente
- `notif_patient_update_own` ✓ paciente
- `notif_business_insert` — usa `user_belongs_to_business`. **Cambiar** a `is_super_admin(auth.uid()) OR is_patient_professional(auth.uid(), patient_id)` para que solo el profesional asignado pueda insertar avisos del paciente. (Los triggers `notify_*` son SECURITY DEFINER y siguen funcionando, bypass RLS).
- Falta SELECT para el profesional asignado → **agregar** `notif_prof_select` con `is_patient_professional(auth.uid(), patient_id)`.
- `notif_super_admin_all` ✓.

### 4.8 `appointment_requests`

**Sin cambios.** Reservas públicas no asignadas. Owner/profesionales del business las triagean. Aceptado como "compartida en business".

---

## 5. Impacto en código y edge functions

Tras aplicar, revisar/ajustar:
- `BusinessIdContext` y queries que hagan `from('patients').select('*')` ya filtrarán automáticamente por RLS (cada profesional ve solo los suyos).
- UI de Patients/Payments necesitará indicar visualmente la asignación. **Fuera de scope de este bug** salvo que rompamos alguna pantalla — lo evaluamos después de aplicar.
- Edge functions con `SUPABASE_SERVICE_ROLE_KEY` (create-patient-invite, create-patient-payment, webhook MP, etc.) bypasean RLS → siguen funcionando.
- RPC `approve_reschedule_request` / `reject_reschedule_request`: ajustar el chequeo interno como se detalla en 4.3.

---

## 6. Orden de ejecución (cuando me des OK)

1. **Migración 1**: schema (`patients.assigned_professional_id`, `created_by`), backfill, índice, helpers (`is_patient_professional`, `is_patient_owner_auth`), trigger `patients_set_defaults_biu`.
2. **Migración 2**: drop+create policies de `patients`.
3. **Migración 3**: drop+create policies de `payments`.
4. **Migración 4**: policies de `appointment_reschedule_requests` + update RPCs.
5. **Migración 5**: policies de `session_notes`, `patient_documents`, `scheduled_reminders`.
6. **Migración 6**: policies de `patient_notifications`.
7. Smoke-test funcional en preview con 2 profesionales del mismo business + 1 paciente + super_admin.

---

## 7. Riesgos / preguntas para vos antes de codear

1. **Backfill de `assigned_professional_id`**: propongo asignar al `owner_user_id` del business. ¿OK o preferís dejarlo NULL y forzar reasignación manual? (NULL implica que pacientes legacy quedan invisibles para todos los profesionales que no sean el creador — más estricto pero rompe acceso existente).
2. **Reasignación de paciente entre profesionales**: ¿solo super_admin y el owner del business pueden reasignar? Hoy lo restringimos solo a super_admin via trigger. ¿Sumamos owner?
3. **Pacientes "compartidos"** (clínicas multi-prof donde el secretario carga a todos): el modelo actual no lo soporta sin una tabla de relación N:M. ¿Lo dejamos para fase posterior?
4. Confirmar que `appointment_requests` queda como compartido del business (público + triagea cualquier miembro).

Pasame OK + respuestas a esas 4 preguntas y arranco con la Migración 1.

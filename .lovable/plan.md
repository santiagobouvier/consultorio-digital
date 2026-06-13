# Plan — Alinear UX al PDF de Oferta de Valor

Norte: el PDF de oferta de valor. Flujo de 4 pasos (Configurá → Reservá → Cobrá → Fidelizá) y "fácil de usar" para un psicólogo que atiende solo. Este plan **no agrega features nuevos**: orquesta lo que ya existe y corrige inconsistencias entre la promesa del PDF y el producto actual.

## Diagnóstico verificado

1. **OnboardingWizard (`src/pages/OnboardingWizard.tsx`)** cubre solo los 4 pasos de **perfil del negocio** (datos, branding, slug, etc.). NO orquesta el flujo operativo del PDF: definir semana tipo → generar slots → conectar Mercado Pago → compartir link. Esas piezas existen sueltas (WeeklyTemplateEditor, GenerateSlotsDialog, connect-mercadopago, PublicClinic) pero el usuario debe descubrirlas por su cuenta. **Este es el hueco principal.**
2. **Modo privacidad** hoy: el toggle del Dashboard solo oculta el monto de ingresos (localStorage, scope dashboard). NO oculta nombres de pacientes en agenda/listas. El PDF promete "modo privacidad para compartir pantalla", que requiere ocultar nombres en agenda + listas, no solo el monto.
3. Sidebar actual (`AppSidebar.tsx` / `PremiumSidebar.tsx`) tiene 8+ items flat. El PDF sintetiza en 6 áreas (Agenda, Reserva, Pagos, Recordatorios, Ficha, Pacientes).
4. Ficha de paciente: hoy datos clínicos (notas, motivo) quedan por debajo de pagos/turnos.
5. Página pública (PublicClinic) y portal PWA son entradas separadas sin un módulo único que las explique al profesional.

---

## Fase 1 — Barata, antes de mostrar a usuarios reales

### 1.1 Checklist de activación persistente en el Dashboard

**Objetivo:** orquestar las piezas existentes en el orden del PDF, sin reescribir flujos.

**Ubicación:** card destacada en `src/pages/Dashboard.tsx`, arriba de todo, visible solo mientras quede al menos un ítem pendiente. Se autodestruye (no hay que cerrarla) cuando los 4 están completos.

**Ítems y detección de completitud (todo en cliente, consultando datos reales que ya existen):**

| # | Ítem | "Done" cuando… | CTA | Hook/query existente |
|---|---|---|---|---|
| 1 | Definí tu semana tipo | `availability_templates` del business tiene ≥1 fila activa | → `/horarios-disponibles` (tab plantilla) | `useAvailabilityTemplate` |
| 2 | Generá tus horarios del mes | `available_slots` con `start_at > now()` existe (≥1) | → `/horarios-disponibles` + abrir `GenerateSlotsDialog` | query directa a `available_slots` |
| 3 | Conectá Mercado Pago | `businesses.mp_access_token IS NOT NULL` (o equivalente actual del flow de OAuth) | → `/mi-consultorio` sección MP | leer `businesses` del contexto |
| 4 | Compartí tu link público | flag `onboarding_link_shared_at` en `businesses` (nuevo campo) set en el click "Copiar/Compartir" | → modal con link `/consultorio/:slug` + botón copiar/WhatsApp | nuevo |

**Único cambio de schema en Fase 1:** agregar `onboarding_link_shared_at timestamptz null` a `businesses`. No toca límites, RLS ni cobros.

**UX:** cada ítem es una fila con check verde si done, círculo vacío si pending, CTA al lado. Diseño consistente con el dark theme actual.

### 1.2 Pantalla post-activación

Cuando los 4 ítems quedan completos, mostrar **una sola vez** (flag local + `onboarding_link_shared_at` ya garantiza que pasó por el paso 4) un modal/celebration:

> "Tu consultorio está listo. Compartí tu link para empezar a recibir reservas."

Con: link, botón copiar, botón WhatsApp, botón "Ir al dashboard". No bloquea nada. Se dispara desde el Dashboard al detectar transición "pending → all done".

### 1.3 Reagrupar sidebar en las 6 áreas del PDF

**Solo navegación, sin tocar rutas ni páginas.** Reordenar y agrupar visualmente en `AppSidebar.tsx` y `PremiumSidebar.tsx`:

- **Agenda** → Agenda, Horarios, Pendientes (solicitudes)
- **Reserva** → (link a página pública + portal — placeholder hasta Fase 2.5)
- **Pagos** → Pagos, Facturación
- **Recordatorios** → Recordatorios pendientes
- **Ficha** → (sin item directo; se accede desde paciente — se documenta solo)
- **Pacientes** → Pacientes, Estadísticas

Mantener "Configuración" (Mi consultorio, Portal pacientes, Panel Admin si super_admin) como bloque inferior separado, igual que hoy.

### 1.4 Reordenar ficha de paciente

En `src/pages/PatientDetail.tsx`: subir **Motivo de consulta** y **Notas de sesión** por encima de Pagos y Turnos. Es reorden de tabs/secciones, no cambia componentes.

---

## Fase 2 — Después de validar con psicólogos reales

No se ejecuta hasta tener feedback de Fase 1. Documentado para tenerlo en cola.

### 2.5 Módulo unificado "Tu presencia online"

Nueva ruta `/presencia-online` (o subreemplazo de "Portal pacientes" en sidebar) con dos cards:
- **Página pública** (`/consultorio/:slug`): preview + link + QR + copiar.
- **Portal PWA del paciente**: invitar pacientes, descargar QR, instrucciones.

No duplica funcionalidad, centraliza acceso. Reemplaza el item "Portal pacientes" del sidebar.

### 2.6 Bandeja de recordatorios pendientes del día

Vista que agrupa por día los recordatorios WhatsApp pendientes de enviar (hoy `PendingReminders` ya existe pero sin agrupación por día ni "todos los de hoy de un saque"). Mejora de UI sobre lo existente.

### 2.7 Modo privacidad — decisión

Dos caminos, **elegir uno con el usuario tras Fase 1**:

- **A. Extender el feature:** mover el flag de localStorage a un contexto global (`PrivacyModeContext`), exponer toggle en `MobileHeader`/topbar, y aplicar en: agenda (V2: AppointmentCard, DayViewV2, WeekViewV2, MonthViewV2), lista de pacientes, ficha de paciente, recordatorios. Nombres → "Paciente" o iniciales. Montos → ya cubierto.
- **B. Ajustar la promesa del PDF:** dejar el modo privacidad solo para ingresos y reescribir el copy del PDF para que no prometa ocultar nombres.

Recomendación tentativa: A, pero requiere ~1 día de trabajo cuidadoso para cubrir todas las vistas sin romper estados. No se decide acá.

---

## Lo que este plan NO hace

- No toca precios, límites, gating ni lógica de cobro.
- No toca espacios compartidos / coordination_mode (la sub-fase A previa de este archivo queda pospuesta; si querés retomarla, la rescato a otro archivo).
- No reescribe el OnboardingWizard existente: el checklist del Dashboard cumple el rol de "guía operativa post-onboarding".
- No agrega features nuevos del PDF que no existan ya en el código.

---

## Archivos que tocaría Fase 1

- `src/pages/Dashboard.tsx` — montar checklist + detección de "all done" para disparar celebración.
- `src/components/ActivationChecklist.tsx` — nuevo, contiene las 4 filas y queries.
- `src/components/ActivationCompleteModal.tsx` — nuevo, modal post-activación con link.
- `src/components/AppSidebar.tsx` y `src/components/PremiumSidebar.tsx` — reordenar + agrupar.
- `src/pages/PatientDetail.tsx` — reordenar secciones.
- 1 migración SQL: `ALTER TABLE businesses ADD COLUMN onboarding_link_shared_at timestamptz` (sin cambios de RLS porque ya cubre `businesses`).

---

**Espero tu OK antes de ejecutar. Si querés cambiar orden, sacar algo, o decidir ya el camino de modo privacidad (A vs B), avisame y reescribo.**

## 1. Estado actual del schema

### `spaces`
| columna | tipo | nullable | default |
|---|---|---|---|
| id | uuid | no | gen_random_uuid() |
| business_id | uuid | no | — |
| name | text | no | — |
| type | text | no | 'physical' |
| capacity | int | no | 1 |
| color | text | sí | — |
| notes | text | sí | — |
| is_active | bool | no | true |
| created_at / updated_at | timestamptz | no | now() |

No tiene `description` (vos lo mencionás como opcional, no existe; uso `notes` o no lo toco).
Falta `owned_by_user_id`.

### `user_roles`
| columna | tipo | nullable | default |
|---|---|---|---|
| id | uuid | no | gen_random_uuid() |
| user_id | uuid | no | — |
| role | text | no | — |
| business_id | uuid | **sí** | — |
| calendar_color | text | sí | '#00b5b5' |
| created_at | timestamptz | no | now() |

Falta `coordination_mode`. Ojo: `business_id` es nullable (super_admin no tiene business). El trigger nuevo debe ignorar filas sin business_id.

### `professional_spaces`
Existe (professional_id, space_id, created_at). Hoy se usa en **un solo lugar real**: el JOIN dentro de la RPC `get_available_slots` (línea 232 de la migración 20260518204410) para filtrar qué espacios puede usar cada profesional en el booking público.

### Policies actuales de `spaces`
- `spaces_super_admin` — ALL, `is_super_admin(auth.uid())`
- `spaces_business_all` — ALL, `user_belongs_to_business(auth.uid(), business_id)` (todos los miembros pueden todo)
- `spaces_patient_select` — SELECT para pacientes activos del business

### RPC `get_agenda_view`
**No existe.** La agenda hoy lee directo de `appointments` con RLS filtrando por `professional_id = auth.uid()` (Sub-fase 1.A). Tu spec asume que ya existe y la "actualizamos"; en realidad hay que **crearla de cero**.

## 2. Dependencias frontend a mirar

- `PatientBookingModal.tsx` → llama `rpc("get_available_slots")` → esa RPC joinea `professional_spaces`. Si dejamos `professional_spaces` deprecated pero vacía/inconsistente para nuevos `independent`, el booking público **devolverá 0 slots** para profesionales sin filas en `professional_spaces`. **Hay que tocar `get_available_slots` o garantizar consistencia.** Lo marco como riesgo abierto al final.
- Resto del frontend: solo `PatientBookingModal` usa `spaces` directamente. No hay UI de gestión de espacios todavía.
- No hay nada usando `get_agenda_view` (no existe).

## 3. Decisiones que necesito confirmadas

1. **`professional_spaces` y `get_available_slots`**: ¿qué hacemos en esta sub-fase?
   - **Opción A (recomendada):** ajustar `get_available_slots` para que use la nueva lógica (`shared` ve espacios del business con `owned_by_user_id IS NULL`; `independent` ve solo los suyos `owned_by_user_id = professional_id`) y dejar de mirar `professional_spaces`. Así el booking público sigue andando sin requerir backfill de `professional_spaces` para los espacios nuevos auto-generados.
   - **Opción B:** seguir alimentando `professional_spaces` (insertar fila al auto-generar "Mi consultorio"/"Online" en el trigger) y no tocar la RPC. Más conservador pero deja deuda.
   
2. **`coordination_mode` para super_admin / filas sin business_id**: ¿forzar `shared` como default igual o permitir NULL? Propongo: default `'shared'` siempre, y el trigger de auto-generación solo dispara cuando `business_id IS NOT NULL AND role IN ('owner','professional')`.

3. **RPC `get_agenda_view`**: ¿qué firma querés? Propongo:
   ```
   get_agenda_view(p_business_id uuid, p_from timestamptz, p_to timestamptz)
   RETURNS TABLE (
     id uuid, start_at timestamptz, end_at timestamptz,
     space_id uuid, space_name text,
     professional_id uuid,
     is_own boolean,
     -- campos completos solo si is_own = true (sino NULL):
     patient_id uuid, patient_name text, status text, modality text,
     notes text, contact_name text, contact_phone text, session_price numeric,
     payment_status text
   )
   ```
   Lógica:
   - Si caller es `independent` → solo sus citas (todos los campos).
   - Si caller es `shared` → sus citas (todos los campos) + citas de **otros profesionales `shared` del mismo business** con solo `start_at/end_at/space_id/space_name/professional_id/is_own=false` y resto NULL.
   - `super_admin` y owner viendo el business: trato como `shared`.

## 4. Plan SQL (3 migraciones, en orden)

**Migración 1 — schema + helpers + trigger**
- `ALTER TABLE user_roles ADD coordination_mode text NOT NULL DEFAULT 'shared' CHECK (IN ('shared','independent'))`.
- `ALTER TABLE spaces ADD owned_by_user_id uuid` + índice.
- `COMMENT ON TABLE professional_spaces IS 'DEPRECATED — sustituido por spaces.owned_by_user_id + coordination_mode. Mantener filas existentes; no leer desde frontend nuevo.'`.
- `get_user_coordination_mode(user, business)`.
- `is_business_owner(user, business)`.
- `handle_coordination_mode_change()` trigger: AFTER INSERT/UPDATE OF coordination_mode en `user_roles`, si pasa a `independent` y `business_id IS NOT NULL`, crear "Mi consultorio" + "Online" con `owned_by_user_id = NEW.user_id` (o reactivar si ya existían). Skip si `business_id IS NULL`.

**Migración 2 — RLS de `spaces`**
- DROP `spaces_business_all`.
- KEEP `spaces_super_admin`, `spaces_patient_select` (ajustando el select de paciente para que solo vea espacios shared del business: `owned_by_user_id IS NULL`).
- CREATE:
  - `spaces_select_member`: `user_belongs_to_business(auth.uid(), business_id) AND (owned_by_user_id IS NULL OR owned_by_user_id = auth.uid())`
  - `spaces_insert_shared_owner`: owner del business AND `owned_by_user_id IS NULL`
  - `spaces_insert_independent_self`: miembro del business AND `owned_by_user_id = auth.uid()`
  - `spaces_update_shared_owner` / `spaces_delete_shared_owner`: owner AND `owned_by_user_id IS NULL`
  - `spaces_update_own_independent` / `spaces_delete_own_independent`: `owned_by_user_id = auth.uid()`

**Migración 3 — RPC `get_agenda_view`** con la lógica de §3.3. SECURITY DEFINER, validando que `auth.uid()` pertenece al business (`user_belongs_to_business` o super_admin).

**Opción A elegida** → en la misma Migración 3 también:
- Reemplazar `get_available_slots` para que el filtro de espacios deje de usar `professional_spaces` y use:
  ```
  spaces.business_id = p_business_id
  AND spaces.is_active
  AND (spaces.owned_by_user_id IS NULL OR spaces.owned_by_user_id = p_professional_id)
  ```
  Y filtrar por coordination_mode del profesional target (si es `independent`, solo sus propios; si es `shared`, solo `owned_by_user_id IS NULL`).

## 5. Tests SQL que correré al final
1. Insert `user_role` con `coordination_mode='independent'` → spaces "Mi consultorio" + "Online" creados con `owned_by_user_id` correcto.
2. Update `coordination_mode` shared → independent → spaces reactivados, sin duplicar.
3. Como profesional shared: `SELECT * FROM spaces WHERE business_id=X` → ve shared (NULL) + propios; NO ve los de otro independent.
4. Como profesional staff (no owner): intentar insert con `owned_by_user_id IS NULL` → falla. Insert con `owned_by_user_id = auth.uid()` → ok.
5. Como owner: insert shared OK.
6. `get_agenda_view` con 2 shared del mismo business: ve los suyos con datos + bloques anonimizados del otro.
7. `get_agenda_view` siendo independent: solo lo suyo.

## 6. Lo que **no** cambia ahora
- UI (sub-fase B).
- `professional_spaces` (deprecated, datos quedan).
- Lógica de creación de citas (sub-fase C).
- RLS de `appointments` (ya está bien para esta sub-fase: cada profesional ve las suyas; los bloques anonimizados los entrega la RPC con SECURITY DEFINER).

---

**Necesito tu OK + respuesta a las 3 decisiones de §3 antes de ejecutar las 3 migraciones.**

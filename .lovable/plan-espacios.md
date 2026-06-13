# Plan — Espacios / Coordination mode (pospuesto)

Sub-fase de espacios compartidos vs independientes. NO se ejecuta hasta que retomemos explícitamente.

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

No tiene `description` (uso `notes` o no lo toco). Falta `owned_by_user_id`.

### `user_roles`
| columna | tipo | nullable | default |
|---|---|---|---|
| id | uuid | no | gen_random_uuid() |
| user_id | uuid | no | — |
| role | text | no | — |
| business_id | uuid | **sí** | — |
| calendar_color | text | sí | '#00b5b5' |
| created_at | timestamptz | no | now() |

Falta `coordination_mode`. `business_id` es nullable (super_admin no tiene business). El trigger nuevo debe ignorar filas sin business_id.

### `professional_spaces`
Existe (professional_id, space_id, created_at). Hoy se usa en **un solo lugar real**: el JOIN dentro de la RPC `get_available_slots` para filtrar qué espacios puede usar cada profesional en el booking público.

### Policies actuales de `spaces`
- `spaces_super_admin` — ALL, `is_super_admin(auth.uid())`
- `spaces_business_all` — ALL, `user_belongs_to_business(auth.uid(), business_id)`
- `spaces_patient_select` — SELECT para pacientes activos del business

### RPC `get_agenda_view`
**No existe.** La agenda hoy lee directo de `appointments` con RLS. Hay que crearla de cero.

## 2. Dependencias frontend a mirar

- `PatientBookingModal.tsx` → `rpc("get_available_slots")` → joinea `professional_spaces`. Si dejamos `professional_spaces` deprecated para nuevos `independent`, el booking público **devolverá 0 slots**. Hay que tocar `get_available_slots` o garantizar consistencia.
- Resto del frontend: solo `PatientBookingModal` usa `spaces` directamente.
- No hay nada usando `get_agenda_view`.

## 3. Decisiones a confirmar

1. **`professional_spaces` y `get_available_slots`**:
   - **A (recomendada):** ajustar `get_available_slots` con la nueva lógica (`shared` ve `owned_by_user_id IS NULL`; `independent` solo los suyos).
   - **B:** seguir alimentando `professional_spaces` desde el trigger. Más conservador, deja deuda.
2. **`coordination_mode` para super_admin / sin business_id**: default `'shared'`; trigger dispara solo con `business_id IS NOT NULL AND role IN ('owner','professional')`.
3. **RPC `get_agenda_view`**: firma propuesta:
   ```
   get_agenda_view(p_business_id uuid, p_from timestamptz, p_to timestamptz)
   RETURNS TABLE (id, start_at, end_at, space_id, space_name,
     professional_id, is_own,
     patient_id, patient_name, status, modality, notes,
     contact_name, contact_phone, session_price, payment_status)
   ```
   - `independent` → solo sus citas (todos los campos).
   - `shared` → suyas (todo) + otras `shared` del mismo business (anonimizadas).
   - `super_admin` y owner: como `shared`.

## 4. Plan SQL (3 migraciones)

**Migración 1 — schema + helpers + trigger**
- `ALTER user_roles ADD coordination_mode text NOT NULL DEFAULT 'shared' CHECK (IN ('shared','independent'))`.
- `ALTER spaces ADD owned_by_user_id uuid` + índice.
- `COMMENT ON TABLE professional_spaces IS 'DEPRECATED ...'`.
- `get_user_coordination_mode(user, business)`.
- `is_business_owner(user, business)`.
- `handle_coordination_mode_change()` trigger: crea "Mi consultorio" + "Online" con `owned_by_user_id = NEW.user_id` al pasar a independent.

**Migración 2 — RLS de `spaces`**
- DROP `spaces_business_all`.
- KEEP `spaces_super_admin`, `spaces_patient_select` (ajustando a `owned_by_user_id IS NULL`).
- CREATE policies por owner/independent.

**Migración 3 — RPC `get_agenda_view`** + reemplazar `get_available_slots` con la nueva lógica (Opción A).

## 5. Tests SQL
1. Insert role independent → spaces creados.
2. Update shared→independent → reactivados sin duplicar.
3. Profesional shared: ve shared + propios; no ve de otro independent.
4. Staff no-owner: insert con NULL falla; con su uid OK.
5. Owner: insert shared OK.
6. `get_agenda_view` con 2 shared: ve los suyos + bloques anonimizados.
7. `get_agenda_view` independent: solo lo suyo.

## 6. Lo que no cambia
- UI, `professional_spaces` (datos quedan), creación de citas, RLS de `appointments`.

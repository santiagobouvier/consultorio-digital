
# Sub-fase A — Espacios compartidos: investigación previa + plan

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

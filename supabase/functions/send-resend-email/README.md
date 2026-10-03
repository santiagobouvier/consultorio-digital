# send-resend-email

Único punto de salida de email de la plataforma (Resend). Publicada con
`verify_jwt = false` en `supabase/config.toml`, así que **la autorización la
hace la propia función** (`handler.ts`), antes de leer el cuerpo y de tocar
Resend.

## Quién puede enviar qué

| Llamador | Cómo se identifica | Plantillas | Consultorio | Destinatario |
|---|---|---|---|---|
| Backend (edge functions) | `Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>` exacta | todas | cualquiera | cualquiera |
| Trigger `notify_professional_portal_requests` (pg_net) | `Bearer <portal_notify_token>` (64 hex, generado en Vault). La función **no lee el token**: pregunta a la base con `verify_portal_notify_token(p_token)` → boolean | solo `portal_notice` (`kind` ∈ `new_booking`, `reschedule_request`; `when` = `DD/MM/YYYY HH:MM`) | `businessId` obligatorio | lo pone el servidor: `businesses.contact_email` de ese consultorio; el `to` del cuerpo se ignora |
| Profesional logueado | JWT de usuario (lo manda solo `supabase.functions.invoke`) | `raw`, `appointment_confirmation`, `appointment_reminder` | `businessId` obligatorio y `user_belongs_to_business(uid, businessId)` | tiene que existir en ese consultorio: `patients.email`, `appointment_requests.email` o `appointments.contact_email` (sin distinguir mayúsculas) |
| Anon key, sin header, token inválido o rotado | — | 401 | | |

Respuestas de rechazo: `401 unauthorized`, `403 forbidden_template`,
`403 business_required`, `403 forbidden` (no es miembro),
`403 recipient_not_allowed`, `400 invalid_notice`. Ninguna llega a Resend.
Si un consultorio no tiene `contact_email`, el trigger obtiene
`200 { skipped: "no_contact_email" }` sin envío.

Llamadores legítimos al día de hoy:

- Backend: `public-book-appointment` (confirmación al paciente + "nueva
  reserva" al profesional), `process-scheduled-reminders`,
  `create-patient-invite`, `create-business-owner`, `mercadopago-webhook`.
- Base de datos: trigger `notify_professional_portal_requests` (reserva o
  pedido de reprogramación desde el portal del paciente).
- Frontend (profesional): `CreateAppointmentModal`,
  `RescheduleAppointmentModal`, `AppointmentDetailModal`,
  `PatientDocuments`, `AppointmentRequests`. Siempre `raw` o
  `appointment_confirmation`, con `businessId` propio y un email tomado de
  `patients`, `appointment_requests` o `appointments`.

## Pruebas

```
npm run test:functions        # Node ≥ 22 (node:test, sin dependencias)
deno test supabase/functions/send-resend-email/   # equivalente en Deno
```

`handler_test.ts` cubre rechazos (sin envío) y caminos autorizados con el
proveedor simulado, incluidos token del portal, rotación y fail closed.

## Credencial del trigger: diseño

Migración `20260922120000_notify_professional_portal_requests_service_role.sql`
(idempotente, protegida con advisory lock; no asume índice único en
`vault.secrets.name`):

1. Si no existe, crea en Vault el secreto `portal_notify_token`
   (`encode(extensions.gen_random_bytes(32), 'hex')`). El valor nunca queda en
   el repo, en logs ni en el frontend.
2. `public.verify_portal_notify_token(text) → boolean`: `SECURITY DEFINER`,
   compara digests SHA-256 (pgcrypto) para que el timing no revele el token;
   `REVOKE` de `PUBLIC`, `anon`, `authenticated` y `GRANT EXECUTE` solo a
   `service_role` (la edge function). No devuelve el secreto.
3. `public.rotate_portal_notify_token()` y `public.revoke_portal_notify_token()`:
   sin `EXECUTE` para ningún rol de API; solo desde SQL como `postgres`.
4. El trigger lee el token de Vault y llama a la función con
   `template = portal_notice`, `businessId`, `kind` y `when`. Sin token o sin
   Vault: guarda la cita igual y omite el aviso con `WARNING`.

Requisitos ya verificados en el proyecto (`sfvuuzpmsgepooeamkin`): Vault 0.3.1,
pgcrypto en el esquema `extensions`, migraciones con rol `postgres` y `USAGE`
sobre `vault`, RPC restringible con `REVOKE`/`GRANT`. `pg_net` ya lo usa el
trigger actual.

## Despliegue

### Estado en producción (22/9/2026)

En el backend `sfvuuzpmsgepooeamkin`:

- PR #361 integrada en `main`.
- Migración `20260922120000_notify_professional_portal_requests_service_role.sql`
  aplicada a mano en el editor SQL de Lovable Cloud.
- Función `send-resend-email` desplegada **por separado** (el Publish del
  frontend no la desplegó).
- Verificado ese día: una invitación de QA recibida en Gmail (camino service
  role), una reserva `patient_portal` pendiente cuyo aviso al profesional llegó
  al buzón de Hostinger (camino token del trigger) y un `POST` vacío sin
  credenciales que devolvió `401 unauthorized`. Estas pruebas no se repitieron
  después.

### Cómo se despliega un cambio futuro

- **Publish en Lovable solo publica el frontend.** No despliega edge functions
  ni aplica migraciones; sincronizar `main` tampoco. Una versión anterior de
  este README afirmaba que el Publish desplegaba la función: era incorrecto.
- **Migración**: editor SQL de Lovable Cloud, pegando el archivo completo.
- **Función**: despliegue explícito de `send-resend-email`, como operación
  separada del Publish. Con la regla vigente (sin usar el chat de Lovable), la
  vía por UI para desplegar una edge function está **por confirmar**.
- **Orden compatible** entre función y trigger: aplicar primero la pieza que
  sigue funcionando con la versión publicada de la otra. En el cambio del 22/9,
  la migración primero era segura (la función vieja aceptaba el token nuevo),
  pero dejaba CD-001 abierto hasta desplegar la función; la función primero no
  rompía reservas (pg_net es asíncrono), pero dejaba los avisos del trigger en
  `401` hasta aplicar la migración.

## Verificación sin exponer secretos

Después de aplicar la migración (SQL):

```sql
-- una fila; solo nombre y fechas
select name, created_at, updated_at from vault.secrets where name = 'portal_notify_token';

-- la RPC existe y niega un token cualquiera
select public.verify_portal_notify_token(repeat('0', 64));   -- false

-- los roles de API no pueden ejecutarla ni rotar
select has_function_privilege('anon', 'public.verify_portal_notify_token(text)', 'EXECUTE');          -- false
select has_function_privilege('authenticated', 'public.verify_portal_notify_token(text)', 'EXECUTE'); -- false
select has_function_privilege('service_role', 'public.verify_portal_notify_token(text)', 'EXECUTE');  -- true
select has_function_privilege('service_role', 'public.rotate_portal_notify_token()', 'EXECUTE');      -- false
```

Después de desplegar la función (desde cualquier máquina, sin credenciales):

```
curl -s -o /dev/null -w '%{http_code}\n' -X POST \
  https://sfvuuzpmsgepooeamkin.supabase.co/functions/v1/send-resend-email \
  -H 'Content-Type: application/json' -d '{}'                       # 401

curl -s -o /dev/null -w '%{http_code}\n' -X POST \
  https://sfvuuzpmsgepooeamkin.supabase.co/functions/v1/send-resend-email \
  -H 'Authorization: Bearer <ANON KEY PÚBLICA>' \
  -H 'Content-Type: application/json' -d '{"to":"x@example.test","template":"raw","data":{}}'   # 401
```

Funcional, con datos ficticios (consultorio y paciente de prueba, email de
prueba propio):

- Reserva pública de prueba → sigue llegando la confirmación al email de
  prueba (camino service role).
- Reserva desde el portal del paciente de prueba → llega "Nueva reserva desde
  el portal · DD/MM/YYYY HH:MM" al `contact_email` del consultorio de prueba
  (camino token del trigger). Si no llega, mirar los logs de Postgres: un
  `WARNING ... falta portal_notify_token` indica que la migración no está
  aplicada.
- Desde el panel del profesional de prueba: cancelar una cita del paciente de
  prueba → llega el aviso (camino JWT + destinatario validado).

## Operación

- **Rotar** el token (por ejemplo, ante sospecha de filtración):
  `select public.rotate_portal_notify_token();` — efecto inmediato en el
  trigger y en la función (no hay caché).
- **Apagar** solo el aviso del trigger sin tocar nada más:
  `select public.revoke_portal_notify_token();` — las citas se siguen
  guardando; el aviso se omite con `WARNING`. Reactivar: rotar (crea uno
  nuevo) o volver a aplicar la migración (idempotente).
- **Volver atrás la función** (desplegar una versión anterior de
  `send-resend-email`; el Publish no lo hace) no requiere cambios en la base:
  la versión anterior aceptaba cualquier credencial, así que el trigger sigue
  funcionando y la migración no necesita revertirse. **Reabre CD-001**: solo
  como medida de emergencia.
- Nunca ejecutar `select * from vault.decrypted_secrets` en pantalla ni pegar
  el token en chats, tickets o commits.

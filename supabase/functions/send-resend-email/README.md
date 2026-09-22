# send-resend-email

Único punto de salida de email de la plataforma (Resend). Publicada con
`verify_jwt = false` en `supabase/config.toml`, así que **la autorización la
hace la propia función** (`handler.ts`), antes de leer el cuerpo y de tocar
Resend.

## Quién puede enviar qué

| Llamador | Cómo se identifica | Plantillas | Consultorio | Destinatario |
|---|---|---|---|---|
| Backend (edge functions, pg_net) | `Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>` exacta | todas | cualquiera | cualquiera |
| Profesional logueado | JWT de usuario (lo manda solo `supabase.functions.invoke`) | `raw`, `appointment_confirmation`, `appointment_reminder` | `businessId` obligatorio y `user_belongs_to_business(uid, businessId)` | tiene que existir en ese consultorio: `patients.email`, `appointment_requests.email` o `appointments.contact_email` (sin distinguir mayúsculas) |
| Anon key, sin header, token inválido | — | 401 | | |

Respuestas de rechazo: `401 unauthorized`, `403 forbidden_template`,
`403 business_required`, `403 forbidden` (no es miembro),
`403 recipient_not_allowed`. Ninguna llega a Resend.

Llamadores legítimos al día de hoy:

- Backend: `public-book-appointment` (confirmación al paciente + "nueva
  reserva" al profesional), `process-scheduled-reminders`,
  `create-patient-invite`, `create-business-owner`, `mercadopago-webhook`,
  y el trigger `notify_professional_portal_requests` (pg_net).
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
proveedor simulado.

## Dependencia de configuración del trigger (pg_net)

`notify_professional_portal_requests` (migración
`20260922120000_notify_professional_portal_requests_service_role.sql`) llama
a esta función desde la base con la service role leída de **Vault**, secreto
`edge_service_role_key`. Sin ese secreto la reserva/reprogramación se guarda
igual, pero el aviso por email al profesional se omite y queda un `WARNING`
en los logs de Postgres.

Checklist de despliegue, en este orden:

1. Crear el secreto **desde el SQL Editor de Supabase** (no en migraciones,
   no en el chat de Lovable, no en el frontend):

   ```sql
   select vault.create_secret('<SUPABASE_SERVICE_ROLE_KEY>', 'edge_service_role_key');
   ```

2. Verificar que existe, sin mostrar su valor:

   ```sql
   select name, created_at from vault.secrets where name = 'edge_service_role_key';
   ```

   Tiene que devolver exactamente una fila. (`vault.secrets` no expone el
   valor descifrado; no uses `vault.decrypted_secrets` en pantalla.)

3. Publicar (función + migración). Al aplicar la migración, Postgres emite un
   `NOTICE` diciendo si el secreto está presente o ausente.

4. Verificar en producción:
   - `POST .../functions/v1/send-resend-email` sin header → `401`.
   - Lo mismo con `Authorization: Bearer <anon key>` → `401`.
   - Una reserva pública de prueba (datos ficticios) sigue mandando la
     confirmación al email de prueba.
   - Una reserva desde el portal de un paciente de prueba genera el mail
     "Nueva reserva desde el portal" al `contact_email` del consultorio.

Si se rota la service role, hay que actualizar el secreto:

```sql
select vault.update_secret(
  (select id from vault.secrets where name = 'edge_service_role_key'),
  '<NUEVA_SERVICE_ROLE_KEY>'
);
```

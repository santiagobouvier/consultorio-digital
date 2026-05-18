## Plan — Mejoras flujo de pagos portal paciente

### Contexto verificado
- El portal real al que entra el paciente es `ClinicPortal.tsx` (ruta `/portal/:slug`), que ya tiene `handlePaySession` y llama a la edge function `create-session-payment` (recibe `appointment_id` solamente). `PatientPortal.tsx` no pasa `onPaySession` — se queda igual por ahora (no rompemos nada ahí).
- La edge function actual está atada a `appointment_id` (busca policy, calcula desde `session_price`, crea `payments` row vinculada a la cita). No sirve para pagos sin cita.
- El webhook `mercadopago-webhook` procesa `session_payment` por `appointment_id` único. Necesitamos un nuevo tipo `payment_batch` con `payment_ids[]`.
- El branding/banner del portal vive en `PatientPortalView.tsx` (header arriba de tabs).

### Archivos a tocar

**Frontend**
1. `src/components/portal/PatientPortalView.tsx`
   - Nuevo prop `mpConnected: boolean` (si false, ocultar todos los botones online).
   - Nuevo prop `onPayPayments: (paymentIds: string[]) => Promise<void>` y `payingPaymentIds: string[]`.
   - **Banner global** debajo del header, encima del contenido de tabs: rojo suave (bg-destructive/10, border-destructive/30, text-destructive), visible si `overdueCount > 0`. Texto: "⚠️ Tenés N pago(s) vencido(s) por $X. [Pagar ahora]". Click:
     - 1 vencido → `onPayPayments([id])`.
     - 2+ vencidos → cambiar a tab "pagos" y scrollear a la sección "Vencidos" (estado interno + ref).
   - **Card alerta en tab Resumen**: misma info + botón "Pagar todos"/"Pagar ahora".
   - **Tab Pagos**: agregar sección "Vencidos" arriba con botón "Pagar todos" cuando hay 2+. El botón "Pagar online" se muestra para todo pago con `status ∈ {pending, due_soon, overdue}` independientemente de `appointment_id` (siempre que `mpConnected`).
   - Wording: pago con cita → "Pagar sesión"; pago sin cita → "Pagar online"; banner → "Pagar ahora".
   - Reemplazar `onPaySession(apptId)` actual por `onPayPayments([paymentId])` internamente (o mantener ambos por compatibilidad con Demo). Voy a **mantener `onPaySession`** para el botón inline de citas y agregar `onPayPayments` para el resto.
   - Mobile 375px: banner stackeable, botones min-h-11.

2. `src/pages/ClinicPortal.tsx`
   - Cargar `mp_connected` (ya hay query similar? si no, leer `payment_policies.mp_access_token IS NOT NULL` para el business). Pasar a la view.
   - Nueva `handlePayPayments(paymentIds[])`: invoke edge function nueva `create-patient-payment` con body `{ business_id, payment_ids }`. Open `init_point` en window.location. Manejar polling al volver (param `?payment=success`) — ya existe lógica similar para session, ampliar para refetch payments.
   - Modal de confirmación previa (Dialog shadcn) si `paymentIds.length > 1`: lista + total + "Confirmar y pagar".

**Backend (edge functions)**
3. `supabase/functions/create-patient-payment/index.ts` (NUEVA)
   - Body: `{ business_id, payment_ids: string[] }`.
   - Valida JWT, verifica que el patient (auth_user_id) es dueño de todos los `payment_ids` y que pertenecen al business.
   - Suma `amount`, valida que todos estén en `status ∈ {pending, overdue, due_soon-equiv}` y no `paid/cancelled`.
   - Lee `payment_policies.mp_access_token` del business (sin tocar `session_price`/`deposit` — el monto sale de la suma real de los `payments.amount`).
   - Crea 1 preferencia MP con título "Pago — {clinic} ({N} pagos)" si batch, o `notes` del único pago si N=1.
   - `external_reference = JSON.stringify({ type: "payment_batch", payment_ids, business_id, patient_id })`.
   - Update `payments.mp_preference_id` en cada uno.
   - Retorna `init_point`.

4. `supabase/functions/mercadopago-webhook/index.ts`
   - Agregar branch para `extRef.type === "payment_batch"` con `payment.status === "approved"`: `UPDATE payments SET status='paid', paid_at=now(), method='mercadopago' WHERE id = ANY(payment_ids) AND status != 'paid'`. Si alguno tiene `appointment_id`, actualizar también el appointment a `payment_status='pagado'`.

**Sin cambios**
- Esquema DB (`payments` ya tiene todo lo necesario).
- `create-session-payment` queda como está (lo sigue usando el botón "Pagar sesión" inline en la lista de citas).
- Flujo de pagos manuales del panel profesional.

### Edge cases manejados
- MP no conectado → ningún botón visible (banner tampoco muestra CTA, solo el aviso informativo — o lo ocultamos completo: confirmá cuál preferís).
- Pago ya pagado entre el click y el webhook → la EF filtra por status.
- Polling: al volver de MP con `?payment=success` ya hay `loadData()`. Lo aprovecho.

### Pregunta abierta
**Si MP no está conectado**, ¿mostramos el banner igual (informativo, sin botón) o lo ocultamos completamente? Por defecto voy con **ocultar el botón pero mostrar el banner** (el paciente debe saber que debe). Si preferís ocultar todo, decime.

¿Dale OK y arranco con la edge function nueva + cambios frontend?

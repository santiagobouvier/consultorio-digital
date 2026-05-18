## Resumen
Rediseño profundo de la experiencia de pagos en el portal del paciente: tab Pagos con 3 secciones jerarquizadas, botón individual de pago por cada item, pagos inline en Historial, comprobantes PDF descargables (client-side con jsPDF) y flujo MP en misma pestaña con feedback claro.

## Archivos a tocar

### Frontend
- `src/components/portal/PatientPortalView.tsx` — pieza central
  - Rediseño completo de la tab "Pagos": secciones Vencidos (rojo) / Pendientes (ámbar) / Historial (neutro) con cards individuales
  - Botón "Pagar" por item (single payment, no batch)
  - Botón "Pagar todos los vencidos/pendientes" solo si hay 2+
  - Tab "Historial" (citas pasadas): badge + botón inline ("Pagar" / "Comprobante") según estado del pago asociado
  - Loading spinner por botón (no full screen)
  - Detección de `?payment=success` y `?payment=cancelled` con toasts (sonner) grandes + `history.replaceState`
  - Mobile: padding 16-20px, botones full-width min-h-11, sticky bottom bar opcional con "Pagar vencidos"
- `src/pages/ClinicPortal.tsx` — wiring de los handlers
  - `handlePaySingle(payment)` → invoca `create-session-payment` (si tiene appointment_id) o `create-patient-payment` (genérico con 1 id)
  - `handlePayAllOverdue` / `handlePayAllPending` → batch existente
  - Manejo de query params al volver de MP
- `src/lib/receipt-pdf.ts` (nuevo) — generación client-side del comprobante con `jsPDF`
  - Recibe: payment, patient, business (logo/nombre), professional opcional
  - Genera PDF con número correlativo derivado del `payment.id` (últimos 8 chars upper) — sin tocar DB
  - Descarga con `comprobante-{numero}.pdf`

### Dependencias
- Agregar `jspdf` (~50KB gz) vía `bun add jspdf`

### Backend
- **Sin cambios en edge functions ni schema.** Reusamos `create-session-payment` y `create-patient-payment` existentes.
- **Sin columna `receipt_number`**: derivamos el número del `payment.id` (ej: `CD-{primeros 8 chars del uuid en mayúsculas}`). Es estable, único y no requiere migración. Si en el futuro se quiere correlativo secuencial, se agrega como columna aparte.

## Decisiones técnicas confirmadas

1. **PDF**: client-side con jsPDF. Más rápido de implementar, sin costo de edge function, sin latencia de red. El paciente solo descarga comprobantes de sus propios pagos (los datos ya vienen del query RLS-protegido).
2. **receipt_number**: derivado del id, sin migración. Formato `CD-XXXXXXXX`.
3. **No tocar**: modelo de payments, banner global, card alerta del Resumen, panel del profesional, lógica de creación de pagos.

## Flujo de pago unificado
```
click "Pagar" → setLoading(paymentId) → invoke edge function
              → window.location.href = init_point (misma pestaña)
              → MP redirige a /portal/:slug?payment=success&payment_id=X
              → useEffect detecta param → toast success → replaceState → refetch
```

## Criterios de aceptación que cubre
Todos los del brief excepto: no se implementa generación server-side de PDF (se hace client-side, equivalente funcional confirmado en el brief como alternativa válida).

¿OK para codear?

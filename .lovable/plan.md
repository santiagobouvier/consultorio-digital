## Plan — Pendientes unificados + UX agenda

### Problema 1 — Unificar "Solicitudes" → "Pendientes"

**URL y naming**
- Mantener URL `/solicitudes` (evita romper links/bookmarks). Cambiar:
  - Título de página: "Pendientes de aprobar"
  - Label del sidebar: "Pendientes"
  - Texto del breadcrumb/botón "Volver"

**Query unificada (frontend, sin RPC)**
Dos `useQuery` en paralelo dentro de `AppointmentRequests.tsx`, merge en memoria. Razón: las tablas tienen RLS distintas y schemas distintos; una RPC agregaría complejidad sin beneficio. El volumen es bajo (límite 50 c/u).

```
Q1: appointment_requests where status='pending'
Q2: appointments where status='pending' AND source='patient_portal'
     join patients(full_name, email, whatsapp_phone)
```

Normalizar a un tipo común `PendingItem`:
```ts
{ kind: 'portal_booking' | 'public_request',
  id, datetime, name, email, phone, notes, modality,
  patient_id?, appointment_id?, request_id? }
```

Ordenar por `datetime` ascendente. Render con borde lateral:
- `portal_booking` → `border-l-primary` (azul) + badge "Paciente registrado"
- `public_request` → `border-l-violet-500` + badge "Primera consulta"

**Acciones**
- Confirmar portal booking: `update appointments set status='scheduled'` + `notifyPatient` (push, ya existe) + toast "Cita confirmada. {Paciente} fue notificado."
- Rechazar portal booking: `update appointments set status='cancelled', cancellation_reason, cancelled_at=now()` + notifyPatient
- Aceptar/Rechazar public request: lógica actual intacta

**Reprogramaciones**: NO unificar en este pass (queda donde está, en detalle de cita). Riesgo/scope mayor sin pedido explícito firme.

**Contador sidebar**
Modificar `use-pending-requests-count.ts` para sumar:
- `appointment_requests` count where status='pending'
- `appointments` count where status='pending' AND source='patient_portal'

### Problema 2 — UX vista mensual de agenda

Tocar **solo** `MonthViewV2.tsx` (y `MonthDayDrawer.tsx` si hace falta para colores). No tocar la lógica de datos.

**Cards en celdas de día**
- Replace text-overflow ellipsis con lógica de abreviación: si nombre no entra, usar `Nombre I.` (inicial apellido). Si sigue sin entrar, solo nombre.
- Mostrar máx 2 citas + `+N más` si hay 3+. Click en `+N` abre el `MonthDayDrawer` (ya existe).

**Código de colores unificado** (helper en `calendar-v2/types.ts`)
```
scheduled/confirmed → primary (azul)
pending (portal)    → amber-500
reschedule_requested → yellow-400
cancelled_by_patient → red-500
cancelled / attended → gray-400
```
Aplicar en Month/Week/Day views (border-left de la card).

**Indicadores día**
- Total de citas: número pequeño gris top-right (info, no alerta)
- Punto rojo SOLO si: hay pagos vencidos del día O hay reservas pending del portal. Tooltip al hover explicando.

**Mobile**
- En `CalendarV2.tsx`, si `useIsMobile()` y no hay viewType en URL → default `day`.
- Banner sutil al cambiar a `month` en mobile: "Se ve mejor en horizontal."

### Archivos a tocar

- `src/pages/AppointmentRequests.tsx` — rediseño completo (query unificada, render dual)
- `src/components/AppSidebar.tsx` / `PremiumSidebar.tsx` — label "Pendientes"
- `src/hooks/use-pending-requests-count.ts` — sumar ambos counts
- `src/components/calendar-v2/MonthViewV2.tsx` — cards, abreviación, indicadores
- `src/components/calendar-v2/types.ts` — helper de colores unificado por status
- `src/components/calendar-v2/DayViewV2.tsx`, `WeekViewV2.tsx` — aplicar colores
- `src/pages/CalendarV2.tsx` — default mobile a day, banner month-mobile

### Preguntas que me hiciste

1. **URL**: mantener `/solicitudes`, solo cambia título y sidebar label.
2. **Query**: 2 queries en frontend con merge. Sin RPC.
3. **Cards de agenda**: cambios estructurales (no solo CSS) — necesito ajustar lógica de truncado y agregar helper de colores en `types.ts`.

¿OK para ejecutar?

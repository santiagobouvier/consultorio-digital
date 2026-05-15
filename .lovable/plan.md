# Refactor de portales del paciente

## Problema bloqueante: las 3 UIs HOY son diferentes

Leí los 3 archivos y la regla "cero cambios visibles" choca con "unificar en un componente". Hoy renderizan UIs distintas:

| Archivo | Tab Resumen actual |
|---|---|
| `PatientPortal.tsx` | Layout asimétrico 8/12 + 4/12. Hero "Próxima cita" grande con blur. "Hola, {firstName} 👋" arriba a la izq. |
| `PatientPortalDemo.tsx` | Layout simétrico. Welcome card con gradiente arriba + grid 4 stats + 2 columnas iguales abajo. |
| `ClinicPortal.tsx` | Layout simétrico viejo (similar al demo pero con menos pulido). El que estás viendo en `/portal/digitalbuilders`. |

Los datos también difieren:
- `ClinicPortal`: `appointments[]` plano (mezcla pasadas/futuras).
- `PatientPortal`: separados en `upcoming` / `past`.
- `Demo`: arrays hardcodeados con shape distinto (`date: Date`, `start: string`, sin `business_id`).

Si hago un wrapper que pase todo por props sin cambiar UI, **el componente unificado tendría que tener `if (variant === "clinic") ... else if (variant === "legacy") ... else ...`** en cada tab. Eso no es refactor: es mover la duplicación de archivo a archivo.

## Pregunta que necesito que respondas

¿Cuál de los 3 layouts actuales es el "bueno" — el que querés que sea el único después del refactor?

- **Opción A:** El de `PatientPortal.tsx` (asimétrico 8/12, hero próxima cita con blur, "Hola, X 👋" inline). Es el más nuevo y el que pediste para escritorio.
- **Opción B:** El de `PatientPortalDemo.tsx` (welcome card con gradiente + grid 4 stats simétrico).
- **Opción C:** El de `ClinicPortal.tsx` actual (lo que estás viendo ahora en `/portal/digitalbuilders`).

Si decís A, el refactor cambia la UI de `/portal/:slug` (la que estás viendo ahora) hacia el layout asimétrico — que es justo lo que pediste hace 2 mensajes. Eso **no** es "cero cambios visibles", es el cambio que ya querías + dedupe.

## Plan condicional a tu respuesta

Asumiendo que elegís **A** (lo más coherente con lo que pediste antes):

### 1. Crear `src/components/portal/PatientPortalView.tsx` (~900 líneas)

Componente puro que recibe props y renderiza tabs Resumen / Citas / Historial / Pagos / Perfil con el layout asimétrico de `PatientPortal.tsx`.

Props:
```ts
interface PatientPortalViewProps {
  branding: { name; specialty; contactEmail; logoUrl; lightColor; darkColor; slug };
  patient: { id; full_name; email; whatsapp_phone; avatar_url; reason_for_consultation; private_notes?; created_at };
  upcomingAppointments: NormalizedAppointment[];
  pastAppointments: NormalizedAppointment[];
  payments: NormalizedPayment[];
  isDark: boolean; onToggleDark: () => void;
  isDemo?: boolean;
  // callbacks
  onPay?: (appointmentId: string) => Promise<void> | void;
  onSaveProfile?: (data: ProfileEditData, avatarFile: File | null) => Promise<void>;
  onLogout?: () => void;
  onBookAppointment?: () => void;
  onInstallApp?: () => void;
  canInstall?: boolean;
  isInstalled?: boolean;
}
```

Normalizo el shape de appointment/payment a un único tipo. El wrapper de cada ruta convierte sus datos a ese shape antes de pasarlos.

Banner "Demo" se renderiza dentro cuando `isDemo === true`.

### 2. `ClinicPortal.tsx` → wrapper (~120 líneas, no 80)

Mantiene **idéntica**:
- Resolución slug por `public_slug` o `custom_subdomain`.
- Pantalla `BrandedLogin` cuando no hay sesión.
- Inyección de manifest dinámico vía `get-clinic-manifest` + apple-touch-icon + cleanup.
- Callback `?payment=success&appointment_id=...` con reload diferido.
- Bloqueo si el usuario logueado es profesional/owner del consultorio.

Pasa datos crudos de DB → normaliza → `<PatientPortalView ...>`.

### 3. `PatientPortal.tsx` → wrapper (~80 líneas)

- Lee `auth.getUser()` → busca rol `patient` → carga `patients` por `auth_user_id` → carga `business`.
- Sin manifest dinámico, sin `BrandedLogin` (redirige a `/` si no hay sesión, igual que hoy).
- Pasa a `<PatientPortalView ...>` con `isDemo={false}`.

### 4. `PatientPortalDemo.tsx` → wrapper (~80 líneas)

- Carga branding del consultorio `is_demo=true` (o por `businessId` si está logueado).
- Pasa `DEMO_PATIENT_INITIAL`, `UPCOMING`, `PAST`, `PAYMENTS` normalizados.
- `isDemo={true}` → banner visible, callbacks de pago/save son no-op con toast "modo demo".

### 5. Sin tocar

- `App.tsx` (rutas idénticas).
- Edge functions.
- DB / RLS.
- Otros componentes (`PortalWelcomeInstall`, `NotificationActivationCard`, `PWAInstallBanner`, `PatientBookingModal`).

## Riesgos

- Es 1 PR grande, sin pasos intermedios. Si algo se rompe se rompe los 3 portales a la vez.
- El layout asimétrico de `PatientPortal.tsx` no muestra hoy todos los campos que muestra `ClinicPortal` (ej: el flujo `payAppointment` con `setPayingAppointment`). Tengo que portar esa lógica al view unificado.
- `ClinicPortal` tiene `BrandedLogin` embebido que NO existe en los otros 2. Lo dejo en el wrapper, no en el view.

## Lo que necesito de vos antes de escribir código

**Confirmá qué layout debe quedar (A / B / C) y arranco.** Si es A, asumo que aceptás el cambio visual en `/portal/:slug` como parte del refactor.

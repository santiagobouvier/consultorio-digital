# Plan — Alinear UX al PDF de Oferta de Valor

Norte: el PDF de oferta de valor. Flujo de 4 pasos (Configurá → Reservá → Cobrá → Fidelizá) y "fácil de usar" para un psicólogo que atiende solo. Este plan **no agrega features nuevos**: orquesta lo que ya existe y corrige inconsistencias entre la promesa del PDF y el producto actual.

> Plan separado: `.lovable/plan-espacios.md` (espacios / coordination_mode, pospuesto).

## Diagnóstico verificado

1. **OnboardingWizard (`src/pages/OnboardingWizard.tsx`)** cubre solo los 4 pasos de **perfil del negocio** (datos, branding, slug). NO orquesta el flujo operativo del PDF: semana tipo → generar slots → conectar MP → compartir link. Esas piezas existen sueltas (WeeklyTemplateEditor, GenerateSlotsDialog, connect-mercadopago, PublicClinic). **Este es el hueco principal.**
2. **Modo privacidad** hoy: solo oculta monto de ingresos (localStorage, scope dashboard). NO oculta nombres. El PDF promete ocultar nombres en agenda/listas.
3. Sidebar (`AppSidebar.tsx` / `PremiumSidebar.tsx`) tiene 8+ items flat. El PDF sintetiza en 6 áreas.
4. Ficha de paciente: datos clínicos por debajo de pagos/turnos.
5. Página pública y portal PWA son entradas separadas sin módulo único.

---

## Fase 1 — Barata, antes de mostrar a usuarios reales

### 1.1 Checklist de activación persistente en el Dashboard

**Objetivo:** orquestar las piezas existentes en el orden del PDF, sin reescribir flujos.

**Ubicación:** card destacada arriba del Dashboard (mobile + desktop), visible solo mientras quede ≥1 ítem pendiente. Se autodestruye cuando los 4 están completos.

**Ítems y detección (verificado contra schema real):**

| # | Ítem | "Done" cuando… | CTA |
|---|---|---|---|
| 1 | Definí tu semana tipo | `availability_templates` del business tiene ≥1 fila con `is_active=true` | → `/horarios-disponibles` |
| 2 | Generá tus horarios del mes | `availability_slots` del business con `date >= current_date` existe (≥1) | → `/horarios-disponibles` |
| 3 | Conectá Mercado Pago | `payment_policies.mp_access_token IS NOT NULL` para el business (keyed por `business_id`, confirmado en `PaymentPolicySettings.tsx`) | → `/billing` (o `/mi-consultorio` sección pagos) |
| 4 | Compartí tu link público | `businesses.onboarding_link_shared_at IS NOT NULL` (campo nuevo, set al copiar/compartir) | → modal con link `/consultorio/:slug` + copiar/WhatsApp |

**Único cambio de schema:** `ALTER TABLE businesses ADD COLUMN onboarding_link_shared_at timestamptz`. No toca límites, RLS ni cobros.

**UX:** cada ítem es una fila con check verde (done) o círculo (pending) + CTA. Dark theme actual.

**Notas de implementación verificadas:**
- `availability_slots` usa `date` (date) + `start_time` (time), NO `start_at`. Por eso la condición es `date >= current_date`.
- MP NO está en `businesses.mp_access_token`; está en `payment_policies.mp_access_token` (verificado en `PaymentPolicySettings.tsx` líneas 30, 97, 157).
- `availability_templates` tiene `is_active` boolean.

### 1.2 Pantalla post-activación
Modal celebración una sola vez con link + copiar + WhatsApp + "Ir al dashboard". Se dispara al transicionar "pending → all done". **(No se ejecuta todavía.)**

### 1.3 Reagrupar sidebar en las 6 áreas del PDF
Solo navegación. Agenda / Reserva / Pagos / Recordatorios / Ficha / Pacientes. **(No se ejecuta todavía.)**

### 1.4 Reordenar ficha de paciente
Subir Motivo de consulta + Notas de sesión por encima de Pagos/Turnos en `PatientDetail.tsx`. **(No se ejecuta todavía.)**

---

## Fase 2 — Después de validar con psicólogos reales

### 2.5 Módulo unificado "Tu presencia online"
Ruta `/presencia-online` con dos cards: página pública + portal PWA. Reemplaza item "Portal pacientes".

### 2.6 Bandeja de recordatorios pendientes del día
Mejora de UI sobre `PendingReminders` agrupando por día.

### 2.7 Modo privacidad — decisión
- **A.** Extender a contexto global y aplicar a agenda V2, lista pacientes, ficha, recordatorios.
- **B.** Ajustar copy del PDF para que no prometa ocultar nombres.

Recomendación tentativa: A. Decidir tras Fase 1.

---

## Lo que este plan NO hace
- No toca precios, límites, gating ni lógica de cobro.
- No toca espacios / coordination_mode (ver `plan-espacios.md`).
- No reescribe el OnboardingWizard.

## Orden de ejecución acordado
**1.1 primero y solo.** Verificar con el usuario antes de pasar a 1.2.

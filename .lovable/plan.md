# Plan: Sistema PWA install impecable

## 1. Estado actual

- **`usePWAInstall`** ya existe (`src/hooks/use-pwa-install.ts`) pero su API es mínima: solo `canInstall`, `install`, `isInstalled`, `isPreview`, `isIOS`. Hay que extenderla.
- **Manifest dinámico**: ya implementado en `ClinicPortal.tsx` (líneas ~336-370) vía edge function `get-clinic-manifest` — recibe `slug` y `origin`, devuelve manifest con `name`, `short_name`, `theme_color`, `start_url=/portal/{slug}`, `icons`. **No hay que tocarlo**, solo verificar que tenga `display: standalone`, `scope`, `orientation: any`, `description`.
- **`PortalWelcomeInstall`** ya tiene flujo welcome, detecta plataforma manualmente con `detectPlatform()` propio (duplicado de lo que va al hook). Hay que refactorizar para usar el hook centralizado y abrir el tutorial nuevo en lugar del bloque inline `showInstructions`.
- **`IOSInstallGuideModal`** existe pero es estático con iconos lucide. Lo reemplazamos por `IOSInstallTutorial` con SVG animados.
- **`PWAInstallBanner`** sticky/inline ya existe para el portal del paciente (`PatientPortalView`). Lo dejamos como está pero sumamos un `InstallAppButton` en el header.
- Panel profesional: no hay header propio centralizado; el sidebar (`AppSidebar` / `PremiumSidebar`) y `MobileHeader` son los puntos de inserción. La card dismissible va en `Dashboard.tsx`.

## 2. Decisiones técnicas

**Centralización**: toda la lógica (detección + dispatch) vive en `usePWAInstall`. Los componentes UI (botón, tutoriales) consumen el hook. Cero duplicación.

**API extendida del hook**:
```ts
{
  canInstall, isInstalled, isIOS, isAndroid, isDesktop,
  isUnsupported,            // Firefox + otros sin beforeinstallprompt y no iOS/desktop-safari
  isDesktopSafari,
  triggerInstall: () => Promise<'accepted' | 'dismissed' | 'ios' | 'desktop-safari' | 'unsupported'>,
}
```
`triggerInstall` no abre modales — devuelve un discriminador y el componente caller decide qué modal abrir. Esto mantiene el hook sin acoplamiento a UI.

**Animaciones SVG**: **CSS keyframes** (no SMIL). Razón: SMIL está deprecado en Chromium hace años, CSS keyframes funcionan en todos los browsers, son trivialmente debuggeables y permiten `prefers-reduced-motion`. Cada ilustración es un componente React con `<style>` scoped por clase única.

**No agregamos dependencias**. Animaciones puras CSS, SVG inline.

**Toast**: `sonner` (ya está integrado en el proyecto).

## 3. Archivos a crear

```text
src/hooks/use-pwa-install.ts                          (REFACTOR — extender API)
src/components/pwa/InstallAppButton.tsx               (NUEVO — reemplaza al existente)
src/components/pwa/IOSInstallTutorial.tsx             (NUEVO — modal con 3 pasos animados)
src/components/pwa/DesktopSafariTutorial.tsx          (NUEVO)
src/components/pwa/UnsupportedBrowserModal.tsx        (NUEVO)
src/components/pwa/illustrations/IOSShareStep.tsx     (NUEVO — SVG animado paso 1)
src/components/pwa/illustrations/IOSAddToHomeStep.tsx (NUEVO — SVG animado paso 2)
src/components/pwa/illustrations/IOSConfirmStep.tsx   (NUEVO — SVG animado paso 3)
src/components/pwa/illustrations/SafariMenuStep.tsx   (NUEVO — para desktop Safari)
src/components/pwa/InstallPromptCard.tsx              (NUEVO — card dismissible para dashboard)
```

## 4. Archivos a modificar

- **`src/components/InstallAppButton.tsx`** (existente, viejo): borrar. El nuevo vive en `src/components/pwa/`. Actualizar el único import en `src/pages/Landing.tsx` si existe.
- **`src/components/portal/PortalWelcomeInstall.tsx`**: borrar `detectPlatform` local, `showInstructions`, bloques de pasos inline (`iosSteps`/`androidSteps`). Reemplazar handler `handleInstallClick` por `const result = await triggerInstall()` y abrir el modal apropiado (`IOSInstallTutorial`, `DesktopSafariTutorial`, `UnsupportedBrowserModal`). Conservar confetti, branding hero, features grid, justInstalled state.
- **`src/components/portal/PatientPortalView.tsx`**: insertar `<InstallAppButton variant="icon-text" />` (desktop) / `variant="icon-only"` (mobile) en el header entre theme toggle y logout. Decidir variant por breakpoint con clases responsive (renderizar ambos, ocultar con `hidden md:inline-flex`).
- **`src/components/IOSInstallGuideModal.tsx`**: deprecar (queda sin imports tras refactor de `PWAInstallBanner`). Actualizar `PWAInstallBanner` para usar `IOSInstallTutorial` nuevo en su lugar y borrar `IOSInstallGuideModal`.
- **`src/components/MobileHeader.tsx`**: agregar `<InstallAppButton variant="icon-only" />`.
- **`src/components/AppSidebar.tsx`** y/o **`src/components/PremiumSidebar.tsx`**: agregar `<InstallAppButton variant="icon-text" label="Instalar app" />` en el footer del sidebar (encima del logout o brand footer).
- **`src/pages/Dashboard.tsx`**: insertar `<InstallPromptCard />` (dismissible con localStorage key `pwa_install_card_dismissed_pro`).
- **`supabase/functions/get-clinic-manifest/index.ts`**: verificar y, si falta, asegurar `display: "standalone"`, `scope: "/"` (o `/portal/{slug}`), `orientation: "any"`, `description` cálida.

## 5. Comportamiento por plataforma

| Plataforma | `triggerInstall()` | UI resultante |
|---|---|---|
| Android Chrome/Edge con `beforeinstallprompt` | `prompt()` nativo | Toast éxito + reload (si accepted) |
| Desktop Chrome/Edge con `beforeinstallprompt` | `prompt()` nativo | Toast éxito + reload |
| iOS Safari | retorna `'ios'` | Abre `IOSInstallTutorial` |
| Desktop Safari | retorna `'desktop-safari'` | Abre `DesktopSafariTutorial` |
| Firefox / otros sin soporte | retorna `'unsupported'` | Abre `UnsupportedBrowserModal` |
| Android Chrome SIN `beforeinstallprompt` (ya rechazado, etc.) | retorna `'unsupported'` con mensaje específico "Buscá 'Instalar app' en el menú del navegador" | Modal informativo |
| Ya instalado | botón no renderiza | — |

Reload post-install: `setTimeout(() => window.location.reload(), 2000)` solo si `outcome === 'accepted'`.

## 6. Detalle ilustraciones SVG iOS

Cada ilustración: viewBox `0 0 200 360` (proporción iPhone), línea fina `stroke-width="1.5"` con `currentColor`, fills suaves con opacity. Un `<circle>` "dedo" animado con `@keyframes` que:

1. `opacity: 0 → 1` (300ms fade-in)
2. `transform: translate(...)` hacia el target (600ms)
3. Pulso `scale(1) → scale(0.85) → scale(1)` (200ms tap)
4. `opacity: 1 → 0` (400ms fade-out)
5. Pausa 500ms, loop.

Total ciclo ~2.5s. Respeta `@media (prefers-reduced-motion: reduce)` → desactiva animación.

## 7. Criterios de aceptación cubiertos

✅ Botón sutil en header (portal + profesional), oculto si instalado
✅ Android/Desktop Chrome: 1 tap → prompt nativo
✅ iOS: 1 tap → tutorial animado SVG
✅ Desktop Safari: 1 tap → tutorial Dock
✅ Firefox: 1 tap → modal explicativo
✅ Toast + reload tras instalar
✅ Manifest dinámico verificado
✅ Mobile 375px responsive
✅ Sin dependencias nuevas, sin GIFs

## 8. Fuera de scope

- No tocar service workers, cache strategies, ni `vite.config.ts` (workbox)
- No agregar pop-ups intrusivos fuera del welcome screen del paciente y la card dismissible del dashboard profesional
- No cambiar la lógica de `PortalWelcomeInstall.tsx` para decidir cuándo aparece (la flag `portal_welcomed_{slug}` ya está manejada en `ClinicPortal.tsx`)

Aprobá y arranco.
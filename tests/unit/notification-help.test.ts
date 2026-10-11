// Guía de notificaciones bloqueadas. npm run test:unit
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  BLOCKED_REASONS,
  PLATFORM_BROWSERS,
  detectHelpPlatform,
  getBlockedGuide,
  normalizeBrowser,
  type HelpGuide,
  type HelpPlatform,
} from "../../src/lib/notification-help.ts";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const src = (rel: string) => readFileSync(path.join(ROOT, rel), "utf8");

const UA = {
  androidChrome: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36",
  androidSamsung: "Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0.0.0 Mobile Safari/537.36",
  iphone: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
  iphoneChrome: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/129.0 Mobile/15E148 Safari/604.1",
  ipad: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15",
  macSafari: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15",
  macChrome: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36",
  macFirefox: "Mozilla/5.0 (Macintosh; Intel Mac OS X 14.6; rv:130.0) Gecko/20100101 Firefox/130.0",
  winChrome: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36",
  winEdge: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36 Edg/129.0.0.0",
};

test("detecta plataforma y navegador", () => {
  assert.deepEqual(detectHelpPlatform({ userAgent: UA.androidChrome }), { platform: "android", browser: "chrome" });
  assert.deepEqual(detectHelpPlatform({ userAgent: UA.androidSamsung }), { platform: "android", browser: "other" });
  assert.deepEqual(detectHelpPlatform({ userAgent: UA.iphone }), { platform: "iphone", browser: "safari" });
  assert.deepEqual(detectHelpPlatform({ userAgent: UA.iphoneChrome }), { platform: "iphone", browser: "safari" });
  assert.deepEqual(detectHelpPlatform({ userAgent: UA.ipad, maxTouchPoints: 5 }), { platform: "iphone", browser: "safari" });
  assert.deepEqual(detectHelpPlatform({ userAgent: UA.macSafari, maxTouchPoints: 0 }), { platform: "mac", browser: "safari" });
  assert.deepEqual(detectHelpPlatform({ userAgent: UA.macChrome }), { platform: "mac", browser: "chrome" });
  assert.deepEqual(detectHelpPlatform({ userAgent: UA.macFirefox }), { platform: "mac", browser: "other" });
  assert.deepEqual(detectHelpPlatform({ userAgent: UA.winChrome }), { platform: "windows", browser: "chrome" });
  assert.deepEqual(detectHelpPlatform({ userAgent: UA.winEdge }), { platform: "windows", browser: "other" });
});

test("un navegador que no aplica a la plataforma cae en el primero de esa plataforma", () => {
  assert.equal(normalizeBrowser("iphone", "chrome"), "safari");
  assert.equal(normalizeBrowser("windows", "safari"), "chrome");
  assert.equal(normalizeBrowser("mac", "chrome"), "chrome");
});

const allGuides = (): HelpGuide[] =>
  (Object.keys(PLATFORM_BROWSERS) as HelpPlatform[]).flatMap((p) => PLATFORM_BROWSERS[p].map((b) => getBlockedGuide(p, b)));

const allText = (g: HelpGuide) =>
  [
    ...(g.requirements ?? []),
    g.finish,
    ...g.sections.flatMap((s) => [s.heading, s.intro ?? "", ...s.steps.flatMap((st) => [st.title, st.detail ?? "", ...(st.path ?? [])])]),
  ].join("\n");

test("ningún texto atribuye el bloqueo a la persona", () => {
  const blame = /no permitir|le dijiste|se le dijo|rechazaste|bloqueaste|elegiste bloquear|tu culpa/i;
  for (const g of allGuides()) assert.doesNotMatch(allText(g), blame, `${g.platform}/${g.browser}`);
  assert.doesNotMatch(BLOCKED_REASONS, blame);
  assert.match(BLOCKED_REASONS, /navegador las bloqueó por su cuenta/);
  const card = src("src/components/NotificationActivationCard.tsx");
  assert.doesNotMatch(card, /En algún momento|No permitir/);
});

test("cada guía enlaza solo ayuda oficial", () => {
  const official = /^https:\/\/(support\.google\.com|support\.apple\.com|support\.microsoft\.com|webkit\.org|blog\.chromium\.org)\//;
  for (const g of allGuides()) {
    assert.ok(g.sources.length > 0, `${g.platform}/${g.browser} sin fuentes`);
    for (const s of g.sources) assert.match(s.url, official, s.url);
  }
});

test("iPhone: exige app en pantalla de inicio e iOS 16.4, y no usa pasos de Chrome de escritorio", () => {
  const g = getBlockedGuide("iphone", "safari");
  const text = allText(g);
  assert.match(text, /16\.4/);
  assert.match(text, /pantalla de inicio/);
  assert.match(text, /Configuración[\s\S]*Apps[\s\S]*Notificaciones/);
  assert.doesNotMatch(text, /Ver información del sitio|Privacidad y seguridad/);
  assert.ok(g.sources.some((s) => s.url.includes("webkit.org/blog/13878")));
});

test("Mac distingue Safari y Chrome, y suma el permiso del sistema", () => {
  const safari = allText(getBlockedGuide("mac", "safari"));
  const chrome = allText(getBlockedGuide("mac", "chrome"));
  assert.match(safari, /Safari[\s\S]*Sitios web[\s\S]*Notificaciones/);
  assert.doesNotMatch(safari, /Privacidad y seguridad/);
  assert.match(chrome, /Configuración de sitios/);
  assert.match(chrome, /Google Chrome/);
  for (const t of [safari, chrome]) assert.match(t, /Configuración del Sistema[\s\S]*Notificaciones/);
});

test("Windows y Android con Chrome: permiso del sitio y bloqueo del sistema por separado", () => {
  const win = getBlockedGuide("windows", "chrome");
  assert.deepEqual(win.sections.map((s) => s.id), ["chrome-site", "windows-system"]);
  assert.match(allText(win), /Sistema[\s\S]*Notificaciones[\s\S]*No molestar/);
  const android = getBlockedGuide("android", "chrome");
  assert.deepEqual(android.sections.map((s) => s.id), ["chrome-site", "android-system"]);
  assert.match(allText(android), /Notificaciones de apps[\s\S]*Chrome/);
});

test("las ilustraciones se rotulan como ilustración, nunca como captura", () => {
  const ill = src("src/components/notifications/HelpIllustration.tsx");
  assert.match(ill, />\s*Ilustración\s*</);
  assert.match(ill, /no es una captura de pantalla/);
  const guide = src("src/components/notifications/BlockedNotificationsGuide.tsx");
  assert.doesNotMatch(guide.replace(/no capturas de pantalla/g, ""), /captura/i);
});

test("el permiso se pide solo con el clic en «Activar notificaciones»", () => {
  const files = (dir: string): string[] =>
    readdirSync(path.join(ROOT, dir)).flatMap((n) => {
      const rel = path.join(dir, n);
      return statSync(path.join(ROOT, rel)).isDirectory() ? files(rel) : [rel];
    });
  const callers = files("src").filter((f) => /\.(ts|tsx)$/.test(f) && /requestPermission\s*\(/.test(src(f)));
  assert.deepEqual(callers, ["src/hooks/use-push-notifications.ts"]);
  const card = src("src/components/NotificationActivationCard.tsx");
  assert.doesNotMatch(card, /useEffect/, "la tarjeta no dispara nada al montarse");
  assert.equal((card.match(/subscribe\(\)/g) ?? []).length, 1);
  assert.match(card, /const handleActivate = async \(\) => \{\s*const ok = await subscribe\(\);/);
  const guide = src("src/components/notifications/BlockedNotificationsGuide.tsx");
  assert.doesNotMatch(guide, /subscribe|requestPermission|usePushNotifications/);
});

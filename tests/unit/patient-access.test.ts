// Pruebas de /acceso/paciente (CD-003). npm run test:unit
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { decideExistingSession, resolvePatientAccess } from "../../src/lib/patient-access.ts";

const src = (rel: string) => readFileSync(fileURLToPath(new URL(`../../${rel}`, import.meta.url)), "utf8");

test("un solo consultorio: entra directo a su portal", () => {
  assert.deepEqual(resolvePatientAccess([{ slug: "qa-psico", name: "QA" }]), { kind: "redirect", path: "/portal/qa-psico" });
});

test("varios consultorios: elige", () => {
  assert.deepEqual(resolvePatientAccess([{ slug: "a", name: "A" }, { slug: "b", name: "B" }]), { kind: "choose" });
});

test("ninguno (o sin slug): no hay portal", () => {
  assert.deepEqual(resolvePatientAccess([]), { kind: "none" });
  assert.deepEqual(resolvePatientAccess(null), { kind: "none" });
  assert.deepEqual(resolvePatientAccess([{ slug: "", name: "Sin slug" }]), { kind: "none" });
});

test("la pantalla inicia sesión ANTES de pedir los consultorios", () => {
  const page = src("src/pages/PatientAccess.tsx");
  const signIn = page.indexOf("signInWithPassword(");
  const lookup = page.indexOf('invoke("public-patient-lookup"');
  assert.ok(signIn > 0 && lookup > signIn, "signInWithPassword va antes de public-patient-lookup");
  // Si el inicio de sesión falla, corta antes de consultar
  const failBranch = page.slice(signIn, lookup);
  assert.match(failBranch, /if \(signInError \|\| !signIn\.session\)[\s\S]*return;/);
  // El email que se manda es el de la sesión, no el que se tipeó
  assert.match(page.slice(lookup, lookup + 200), /signIn\.session\.user\.email/);
});

test("el portal respeta la sesión ya abierta (no pide login dos veces)", () => {
  const portal = src("src/pages/ClinicPortal.tsx");
  assert.match(portal, /supabase\.auth\.getSession\(\)/);
  assert.match(portal, /\.eq\("auth_user_id", session\.user\.id\)/);
});

test("sesión ya iniciada: el paciente va a su portal o elige entre los suyos", () => {
  assert.deepEqual(decideExistingSession([{ slug: "qa-psico", name: "QA" }], null), { kind: "redirect", path: "/portal/qa-psico" });
  assert.deepEqual(decideExistingSession([{ slug: "a", name: "A" }, { slug: "b", name: "B" }], null), { kind: "choose" });
});

test("sesión ya iniciada: lo de paciente pesa más que el rol de profesional", () => {
  assert.deepEqual(decideExistingSession([{ slug: "qa-psico", name: "QA" }], "/dashboard"), { kind: "redirect", path: "/portal/qa-psico" });
});

test("sesión ya iniciada sin portal: profesional → su panel; otra cuenta → aviso", () => {
  assert.deepEqual(decideExistingSession([], "/dashboard"), { kind: "staff", path: "/dashboard" });
  assert.deepEqual(decideExistingSession([], "/saas-admin"), { kind: "staff", path: "/saas-admin" });
  assert.deepEqual(decideExistingSession(null, null), { kind: "no-portal" });
});

test("/acceso/paciente revisa la sesión al cargar antes de mostrar el formulario", () => {
  const page = src("src/pages/PatientAccess.tsx");
  assert.match(page, /useState\(true\)/, "arranca en 'verificando sesión'");
  const effect = page.indexOf("useEffect(");
  assert.ok(effect > 0 && page.indexOf("supabase.auth.getSession()", effect) > effect, "lee la sesión en un efecto al cargar");
  assert.match(page, /!checkingSession && !activeSession && !clinics &&/, "el formulario solo aparece después de verificar");
  assert.match(page, /getOwnPatientClinics\(\)/, "consulta solo los consultorios propios por sesión");
});

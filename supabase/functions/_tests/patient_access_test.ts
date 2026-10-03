// Regresión del acceso y la invitación reales de pacientes (y profesionales).
// Corre con `npm run test:functions`. Lee el repo; no toca red, base ni cuentas.
//
// 1) Solo pueden cambiar contraseñas las funciones de activación que validan un
//    token de invitación (existe, no usado, no vencido) ANTES de tocarla.
//    Una función nueva que cambie contraseñas sin estar en la lista falla acá.
// 2) Los flujos legítimos siguen conectados: invitar paciente → mail →
//    /portal-paciente/invitacion → activate-patient-account; y
//    /acceso/paciente → /portal/:slug → inicio de sesión con contraseña.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const FUNCTIONS_DIR = join(ROOT, "supabase/functions");
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");

// Funciones autorizadas a cambiar contraseñas (todas por token de invitación)
const PASSWORD_SETTERS = ["activate-business", "activate-patient-account", "activate-professional-account"];

const functionSources = readdirSync(FUNCTIONS_DIR, { withFileTypes: true })
  .filter((d) => d.isDirectory() && !d.name.startsWith("_"))
  .map((d) => ({ name: d.name, file: join(FUNCTIONS_DIR, d.name, "index.ts") }))
  .filter((f) => existsSync(f.file))
  .map((f) => ({ ...f, code: readFileSync(f.file, "utf8") }));

test("solo las funciones de activación por token cambian contraseñas", () => {
  const setters = functionSources
    .filter(({ code }) => /auth\.admin\s*\.\s*(updateUserById|createUser)\([^)]*\{[^}]*password/s.test(code)
      || /updateUserById\(\s*[\w.]+,\s*\{[^}]*\bpassword\b/s.test(code))
    .map(({ name }) => name)
    .filter((name) => !["create-patient-invite", "create-professional-invite", "create-business-owner", "register-professional"].includes(name))
    .sort();
  assert.deepEqual(setters, [...PASSWORD_SETTERS].sort());
});

for (const name of PASSWORD_SETTERS) {
  test(`${name}: valida el token (existe, no usado, no vencido) antes de cambiar la contraseña`, () => {
    const code = read(`supabase/functions/${name}/index.ts`);
    const update = code.indexOf("updateUserById");
    assert.ok(update > 0, "cambia la contraseña con updateUserById");
    for (const check of ['.eq("token"', "used_at", "expires_at"]) {
      const at = code.indexOf(check);
      assert.ok(at > 0 && at < update, `revisa ${check} antes de updateUserById`);
    }
  });
}

test("las funciones que crean cuentas exigen una sesión válida o un token", () => {
  const invite = read("supabase/functions/create-patient-invite/index.ts");
  assert.ok(invite.indexOf("auth.getUser") > 0 && invite.indexOf("auth.getUser") < invite.indexOf("createUser"),
    "create-patient-invite verifica al profesional antes de crear la cuenta del paciente");
});

test("invitación de pacientes: pantallas y funciones siguen conectadas", () => {
  assert.match(read("src/components/PatientInviteModal.tsx"), /invoke\("create-patient-invite"/);
  assert.match(read("src/components/PortalInviteBatch.tsx"), /invoke\("create-patient-invite"/);
  assert.match(read("src/pages/PatientInvitation.tsx"), /invoke\("activate-patient-account"/);
  assert.match(read("supabase/functions/create-patient-invite/index.ts"), /portal-paciente\/invitacion\?token=/);
  assert.match(read("src/App.tsx"), /path="\/portal-paciente\/invitacion"/);
});

test("acceso de pacientes: búsqueda, portal e inicio de sesión siguen conectados", () => {
  const app = read("src/App.tsx");
  assert.match(app, /path="\/acceso\/paciente"/);
  assert.match(app, /path="\/portal\/:slug"/);
  assert.match(read("src/pages/PatientAccess.tsx"), /invoke\("public-patient-lookup"/);
  assert.match(read("src/pages/ClinicPortal.tsx"), /signInWithPassword\(/);
  for (const fn of ["create-patient-invite", "activate-patient-account", "public-patient-lookup"]) {
    assert.ok(existsSync(join(FUNCTIONS_DIR, fn, "index.ts")), `existe ${fn}`);
  }
});

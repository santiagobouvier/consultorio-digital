// Pruebas de la lógica de /reset-password. npm run test:unit
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  classifyRecoveryFailure,
  classifyUpdateError,
  decideRecoveryReturn,
  readRecoveryParams,
} from "../../src/lib/password-recovery.ts";

const BASE = "https://consultoriodigital.app/reset-password";

test("enlace válido (implícito): detecta tokens en el #hash", () => {
  const p = readRecoveryParams(`${BASE}#access_token=xxx&refresh_token=yyy&expires_in=3600&token_type=bearer&type=recovery`);
  assert.equal(p.hasAccessToken, true);
  assert.equal(p.type, "recovery");
  assert.equal(p.error, null);
});

test("enlace vencido o ya usado (Supabase otp_expired) → expired", () => {
  const href = `${BASE}#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired`;
  const p = readRecoveryParams(href);
  assert.equal(p.errorCode, "otp_expired");
  assert.equal(classifyRecoveryFailure(p), "expired");
  // También cuando el error llega solo por initialize() (hash ya limpio)
  assert.equal(classifyRecoveryFailure(readRecoveryParams(BASE), "otp_expired", "Email link is invalid or has expired"), "expired");
});

test("errores en el query (?error=…) también se leen", () => {
  const p = readRecoveryParams(`${BASE}?error=server_error&error_description=Something+broke`);
  assert.equal(classifyRecoveryFailure(p), "invalid");
});

test("token_hash y code se reconocen; si fallan sin código claro → invalid", () => {
  const th = readRecoveryParams(`${BASE}?token_hash=abc&type=recovery`);
  assert.equal(th.tokenHash, "abc");
  assert.equal(classifyRecoveryFailure(th, null, "Token has expired or is invalid"), "expired");
  const pk = readRecoveryParams(`${BASE}?code=123`);
  assert.equal(pk.code, "123");
  assert.equal(classifyRecoveryFailure(pk, null, "invalid flow state, no valid flow state found"), "invalid");
});

test("sin enlace ni sesión → missing (no se muestra el formulario)", () => {
  assert.equal(classifyRecoveryFailure(readRecoveryParams(BASE)), "missing");
});

test("errores al guardar: sesión ausente, misma contraseña, débil", () => {
  assert.equal(classifyUpdateError({ name: "AuthSessionMissingError", message: "Auth session missing!" }), "session");
  assert.equal(classifyUpdateError({ code: "same_password", message: "New password should be different from the old password." }), "same");
  assert.equal(classifyUpdateError({ code: "weak_password", message: "Password should be at least 6 characters." }), "weak");
  assert.equal(classifyUpdateError({ message: "Network down" }), "other");
});

test("retorno: superadmin y profesional a su panel", () => {
  assert.deepEqual(decideRecoveryReturn({ isSuperAdmin: true, isProfessional: true, clinics: null }),
    { kind: "path", path: "/saas-admin", label: "Ir al panel" });
  assert.deepEqual(decideRecoveryReturn({ isSuperAdmin: false, isProfessional: true, clinics: [{ slug: "x", name: "X" }] }),
    { kind: "path", path: "/dashboard", label: "Ir a mi consultorio" });
});

test("retorno: paciente a su portal, o elige si tiene varios; sin datos → /acceso", () => {
  assert.deepEqual(decideRecoveryReturn({ isSuperAdmin: false, isProfessional: false, clinics: [{ slug: "qa-psico", name: "QA" }] }),
    { kind: "path", path: "/portal/qa-psico", label: "Ir a mi portal" });
  const many = decideRecoveryReturn({ isSuperAdmin: false, isProfessional: false, clinics: [{ slug: "a", name: "A" }, { slug: "b", name: "B" }] });
  assert.equal(many.kind, "choose");
  assert.deepEqual(decideRecoveryReturn({ isSuperAdmin: false, isProfessional: false, clinics: [] }),
    { kind: "path", path: "/acceso", label: "Ir a ingresar" });
});

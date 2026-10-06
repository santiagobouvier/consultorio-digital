// Supabase SIMULADO local para las pruebas de punta a punta (sin red, sin
// cuentas, sin correos reales). Implementa solo lo que usan esas pantallas.
import http from "node:http";

export const b64url = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
export const nowSec = () => Math.floor(Date.now() / 1000);
export const fakeJwt = (sub, email, role = "authenticated", exp = nowSec() + 3600) =>
  `${b64url({ alg: "HS256", typ: "JWT" })}.${b64url({ sub, email, role, aud: "authenticated", iat: nowSec(), exp })}.firma-de-prueba`;

export const userJson = (u) => ({
  id: u.id, aud: "authenticated", role: "authenticated", email: u.email,
  app_metadata: {}, user_metadata: {}, created_at: "2026-09-22T00:00:00Z",
});

/** Sesión lista para guardar en localStorage (clave sb-127-auth-token). */
export const sessionFor = (u, { expired = false } = {}) => ({
  access_token: u.token,
  refresh_token: `refresh-${u.id}`,
  token_type: "bearer",
  expires_in: 3600,
  expires_at: expired ? nowSec() - 60 : nowSec() + 3600,
  user: userJson(u),
});

/**
 * users: { clave: { id, email, password?, roles: string[], ownsBusiness?, clinics: [{slug,name}] } }
 * opciones: { port, refreshDelayMs, lookupFails }
 * Devuelve { log, close, users } — log registra pedidos sin contraseñas.
 */
export async function startMockSupabase(users, { port = 54399, refreshDelayMs = 0, lookupFails = false } = {}) {
  for (const u of Object.values(users)) u.token = fakeJwt(u.id, u.email);
  const byToken = (auth) => Object.values(users).find((u) => auth === `Bearer ${u.token}`) || null;
  const log = { passwordUpdates: [], recover: [], verify: [], lookups: [], logins: [], refreshes: [] };
  const state = { refreshDelayMs, lookupFails };

  const server = http.createServer(async (req, res) => {
    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "*",
      "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    };
    const send = (status, body) => {
      res.writeHead(status, { ...cors, "Content-Type": "application/json" });
      res.end(body === undefined ? "" : JSON.stringify(body));
    };
    if (req.method === "OPTIONS") return send(204);
    let raw = "";
    for await (const c of req) raw += c;
    const body = raw ? JSON.parse(raw) : {};
    const url = new URL(req.url, `http://127.0.0.1:${port}`);
    const who = byToken(req.headers.authorization);
    const session = (u) => ({ ...sessionFor(u), user: userJson(u) });

    if (url.pathname === "/auth/v1/user" && req.method === "GET") {
      return who ? send(200, userJson(who)) : send(401, { code: "bad_jwt", message: "invalid JWT" });
    }
    if (url.pathname === "/auth/v1/user" && req.method === "PUT") {
      if (!who) return send(403, { code: "session_not_found", message: "Auth session missing!" });
      log.passwordUpdates.push({ user: who.id, length: String(body.password || "").length });
      return send(200, userJson(who));
    }
    if (url.pathname === "/auth/v1/token") {
      const grant = url.searchParams.get("grant_type");
      if (grant === "password") {
        const u = Object.values(users).find((x) => x.email === body.email && x.password && x.password === body.password);
        log.logins.push({ email: body.email, ok: !!u });
        return u ? send(200, session(u)) : send(400, { code: "invalid_credentials", message: "Invalid login credentials" });
      }
      if (grant === "refresh_token") {
        const u = Object.values(users).find((x) => body.refresh_token === `refresh-${x.id}`);
        log.refreshes.push({ ok: !!u });
        if (state.refreshDelayMs) await new Promise((r) => setTimeout(r, state.refreshDelayMs));
        return u ? send(200, session(u)) : send(400, { code: "refresh_token_not_found", message: "Invalid Refresh Token" });
      }
      return send(400, { message: "grant no simulado" });
    }
    if (url.pathname === "/auth/v1/verify" && req.method === "POST") {
      const u = Object.values(users)[0];
      log.verify.push({ type: body.type, ok: body.token_hash === "hash-ok" });
      if (body.type === "recovery" && body.token_hash === "hash-ok") return send(200, session(u));
      return send(403, { code: "otp_expired", error_code: "otp_expired", msg: "Token has expired or is invalid" });
    }
    if (url.pathname === "/auth/v1/recover" && req.method === "POST") {
      log.recover.push({ email: body.email, redirectTo: url.searchParams.get("redirect_to") });
      return send(200, {});
    }
    if (url.pathname === "/auth/v1/logout") return send(204);
    if (url.pathname === "/rest/v1/rpc/is_super_admin") return send(200, !!who && (who.roles || []).includes("super_admin"));
    if (url.pathname === "/rest/v1/user_roles") return send(200, who ? (who.roles || []).map((role) => ({ role })) : []);
    if (url.pathname === "/rest/v1/businesses") return send(200, who && who.ownsBusiness ? [{ id: "biz-qa" }] : []);
    if (url.pathname.startsWith("/rest/v1/rpc/")) return send(200, null);
    if (url.pathname.startsWith("/rest/v1/")) return send(200, []);
    if (url.pathname === "/functions/v1/public-patient-lookup") {
      log.lookups.push({ user: who ? who.id : null, bodyKeys: Object.keys(body) });
      if (!who) return send(401, { error: "unauthorized" });
      if (state.lookupFails) return send(500, { error: "Error interno" });
      return send(200, { clinics: (who.clinics || []).map((c) => ({ ...c, specialty: null, logo_url: null })) });
    }
    return send(404, { message: "no simulado" });
  });

  await new Promise((r) => server.listen(port, "127.0.0.1", r));
  return { log, state, users, close: () => server.close() };
}

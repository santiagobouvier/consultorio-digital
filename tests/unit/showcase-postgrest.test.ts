// Emulador PostgREST del modo capturas, probado con el supabase-js REAL
// (las URLs y headers son exactamente los que arma la app). npm run test:unit
import { test } from "node:test";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { handleRest, type Store } from "../../src/lib/showcase/postgrest.ts";

const BIZ = "b0000000-0000-4000-8000-000000000001";
const P1 = "p0000000-0000-4000-8000-000000000001";
const P2 = "p0000000-0000-4000-8000-000000000002";

function makeStore(): Store {
  return {
    patients: [
      { id: P1, business_id: BIZ, full_name: "Lucía Ficticia", whatsapp_phone: "099 000 001", is_active: true, auth_user_id: null },
      { id: P2, business_id: BIZ, full_name: "Martín Inventado", whatsapp_phone: null, is_active: false, auth_user_id: "u-x" },
    ],
    services: [{ id: "s1", business_id: BIZ, name: "Sesión individual", duration_minutes: 50, is_active: true, mode: "ambas" }],
    appointments: [
      { id: "a1", business_id: BIZ, patient_id: P1, service_id: "s1", start_at: "2026-10-13T13:00:00+00:00", end_at: "2026-10-13T13:50:00+00:00", status: "confirmed" },
      { id: "a2", business_id: BIZ, patient_id: P2, service_id: null, start_at: "2026-10-14T15:00:00+00:00", end_at: "2026-10-14T15:50:00+00:00", status: "cancelled" },
      { id: "a3", business_id: BIZ, patient_id: P1, service_id: "s1", start_at: "2026-10-12T12:00:00+00:00", end_at: "2026-10-12T12:50:00+00:00", status: "completed" },
    ],
    payments: [
      { id: "pay1", business_id: BIZ, patient_id: P1, appointment_id: "a1", amount: 1800, status: "pending", paid_at: null },
      { id: "pay2", business_id: BIZ, patient_id: P1, appointment_id: "a3", amount: 1800, status: "paid", paid_at: "2026-10-12T13:00:00Z" },
    ],
    scheduled_reminders: [{ id: "r1", business_id: BIZ, patient_id: P1, appointment_id: "a1", status: "scheduled", channel: "whatsapp", type: "reminder", message: "x", scheduled_for: "2026-10-12T13:00:00Z", auto_send: true }],
    businesses: [{ id: BIZ, name: "Consultorio Ficticio", owner_user_id: "u1", public_slug: "ficticio", custom_subdomain: null }],
  };
}

function client(store: Store, log: { method: string; url: string }[] = []) {
  const fakeFetch = async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input instanceof Request ? input.url : input));
    const method = (init?.method ?? "GET").toUpperCase();
    log.push({ method, url: url.toString() });
    const headers = new Headers(init?.headers);
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    const r = handleRest(store, { method, table: url.pathname.replace("/rest/v1/", ""), params: url.searchParams, headers, body });
    return new Response(r.body === null || r.status === 204 ? null : JSON.stringify(r.body), { status: r.status, headers: r.headers });
  };
  return createClient("http://capturas.invalid", "clave-ficticia", { global: { fetch: fakeFetch }, auth: { persistSession: false, autoRefreshToken: false } });
}

test("select con relación to-one y filtros", async () => {
  const sb = client(makeStore());
  const { data, error } = await sb
    .from("appointments")
    .select("id, start_at, status, patients (full_name, whatsapp_phone), services(name)")
    .eq("business_id", BIZ)
    .not("status", "in", '("cancelled","cancelled_by_patient")')
    .gte("start_at", "2026-10-12T00:00:00.000Z")
    .order("start_at", { ascending: true });
  assert.equal(error, null);
  assert.deepEqual(data!.map((a) => a.id), ["a3", "a1"]);
  assert.deepEqual(data![1].patients, { full_name: "Lucía Ficticia", whatsapp_phone: "099 000 001" });
  assert.deepEqual(data![1].services, { name: "Sesión individual" });
});

test("relación por nombre de clave foránea (patients!fk_patient)", async () => {
  const sb = client(makeStore());
  const { data } = await sb.from("scheduled_reminders").select("id, patients!fk_patient ( full_name ), appointments ( start_at )").eq("status", "scheduled");
  assert.equal((data![0] as Record<string, Record<string, unknown>>).patients.full_name, "Lucía Ficticia");
  assert.equal((data![0] as Record<string, Record<string, unknown>>).appointments.start_at, "2026-10-13T13:00:00+00:00");
});

test("relación to-many y * con todas las columnas del esquema", async () => {
  const sb = client(makeStore());
  const { data } = await sb.from("patients").select("*, appointments(start_at)").eq("id", P1).maybeSingle();
  assert.equal((data as unknown as Record<string, unknown[]>).appointments.length, 2);
  assert.ok("emergency_contact_name" in (data as unknown as Record<string, unknown[]>), "columnas no cargadas en el dato ficticio vienen en null");
  assert.equal((data as unknown as Record<string, unknown[]>).emergency_contact_name, null);
});

test("maybeSingle sin filas: null sin error; single sin filas: error", async () => {
  const sb = client(makeStore());
  const m = await sb.from("businesses").select("id").eq("owner_user_id", "otro").maybeSingle();
  assert.equal(m.data, null);
  assert.equal(m.error, null);
  const s = await sb.from("businesses").select("id").eq("owner_user_id", "otro").single();
  assert.equal(s.data, null);
  assert.ok(s.error);
});

test("conteo exacto con head", async () => {
  const sb = client(makeStore());
  const { count, data } = await sb.from("patients").select("*", { count: "exact", head: true }).eq("is_active", true);
  assert.equal(count, 1);
  assert.equal(data, null);
});

test("or, is, ilike, in, neq, lt, limit y range", async () => {
  const sb = client(makeStore());
  const or = await sb.from("businesses").select("id").or("public_slug.eq.ficticio,custom_subdomain.eq.ficticio");
  assert.equal(or.data!.length, 1);
  const isNull = await sb.from("patients").select("id").is("auth_user_id", null);
  assert.deepEqual(isNull.data!.map((p) => p.id), [P1]);
  const notNull = await sb.from("patients").select("id").not("auth_user_id", "is", null);
  assert.deepEqual(notNull.data!.map((p) => p.id), [P2]);
  const il = await sb.from("patients").select("id").ilike("full_name", "%lucía%");
  assert.equal(il.data!.length, 1);
  const inn = await sb.from("payments").select("id").in("status", ["paid", "overdue"]);
  assert.deepEqual(inn.data!.map((p) => p.id), ["pay2"]);
  const ne = await sb.from("appointments").select("id").neq("status", "cancelled").lt("start_at", "2026-10-13T00:00:00Z");
  assert.deepEqual(ne.data!.map((a) => a.id), ["a3"]);
  const lim = await sb.from("appointments").select("id").order("start_at", { ascending: false }).limit(1);
  assert.deepEqual(lim.data!.map((a) => a.id), ["a2"]);
  const rng = await sb.from("appointments").select("id").order("start_at").range(1, 2);
  assert.deepEqual(rng.data!.map((a) => a.id), ["a1", "a2"]);
});

test("!inner con filtro sobre la relación descarta padres", async () => {
  const sb = client(makeStore());
  const { data } = await sb.from("payments").select("id, appointments!inner(status)").eq("appointments.status", "completed");
  assert.deepEqual(data!.map((p) => p.id), ["pay2"]);
});

test("escrituras: solo en memoria (insert, update, upsert, delete)", async () => {
  const store = makeStore();
  const sb = client(store);
  const ins = await sb.from("patients").insert({ business_id: BIZ, full_name: "Nueva Ficticia" }).select("id, full_name").single();
  assert.equal(ins.error, null);
  assert.equal(ins.data!.full_name, "Nueva Ficticia");
  assert.equal(store.patients.length, 3);
  const minimal = await sb.from("payments").insert({ business_id: BIZ, patient_id: P1, amount: 10, status: "pending" });
  assert.equal(minimal.error, null);
  const upd = await sb.from("payments").update({ status: "paid" }).eq("id", "pay1").select();
  assert.equal(upd.data![0].status, "paid");
  const ups = await sb.from("payments").upsert({ id: "pay1", amount: 2000 }, { onConflict: "id" }).select("amount").single();
  assert.equal(ups.data!.amount, 2000);
  assert.equal(store.payments.filter((p) => p.id === "pay1").length, 1);
  const del = await sb.from("appointments").delete().eq("id", "a2");
  assert.equal(del.error, null);
  assert.equal(store.appointments.length, 2);
});

// Emulador mínimo de PostgREST EN MEMORIA para el modo capturas.
//
// Recibe las mismas peticiones que supabase-js le haría a /rest/v1 y las
// resuelve sobre un conjunto de datos ficticios que vive solo en la memoria
// de la pestaña. Las escrituras (insert/update/upsert/delete) cambian esa
// copia en memoria —para que un tutorial "funcione"— y nunca salen a la red.
// Al recargar o salir del modo, se descarta.
//
// Soporta lo que usa la app: select con columnas, alias, `*` y relaciones
// embebidas (`patients(full_name)`, `alias:fk!inner(id)`), filtros eq/neq/
// gt/gte/lt/lte/like/ilike/is/in/cs/cd con not., or=(…)/and=(…), filtros
// sobre relaciones (`rel.col`), order, limit/offset/Range, conteo exacto,
// HEAD y respuesta de objeto único. Sin DOM: se prueba con node:test.

import { SHOWCASE_SCHEMA, type ShowcaseFk } from "./schema.generated.ts";

export type Row = Record<string, unknown>;
export type Store = Record<string, Row[]>;

export interface RestRequest {
  method: string;
  /** Ruta después de /rest/v1/, p. ej. "appointments" */
  table: string;
  params: URLSearchParams;
  headers: Headers;
  body: unknown;
}

export interface RestResponse {
  status: number;
  body: unknown;
  headers: Record<string, string>;
}

// ── select ──

interface FieldNode {
  kind: "field";
  name: string;
  alias: string;
}
interface StarNode {
  kind: "star";
}
interface EmbedNode {
  kind: "embed";
  target: string;
  alias: string;
  hint: string | null;
  inner: boolean;
  children: SelectNode[];
}
type SelectNode = FieldNode | StarNode | EmbedNode;

function splitTopLevel(s: string, sep = ","): string[] {
  const out: string[] = [];
  let depth = 0;
  let quoted = false;
  let cur = "";
  for (const ch of s) {
    if (ch === '"') quoted = !quoted;
    if (!quoted && ch === "(") depth++;
    if (!quoted && ch === ")") depth--;
    if (!quoted && depth === 0 && ch === sep) {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  if (cur.trim() !== "") out.push(cur);
  return out.map((x) => x.trim()).filter(Boolean);
}

export function parseSelect(raw: string | null): SelectNode[] {
  const s = (raw ?? "*").replace(/\s+/g, " ").trim() || "*";
  return splitTopLevel(s).map((item): SelectNode => {
    const compact = item.replace(/\s*\(\s*/, "(").replace(/\s+/g, "");
    if (compact === "*") return { kind: "star" };
    const paren = compact.indexOf("(");
    if (paren > 0 && compact.endsWith(")")) {
      let head = compact.slice(0, paren);
      const inside = compact.slice(paren + 1, -1);
      let alias: string | null = null;
      const colon = head.indexOf(":");
      if (colon > 0 && head[colon + 1] !== ":") {
        alias = head.slice(0, colon);
        head = head.slice(colon + 1);
      }
      const parts = head.split("!");
      const target = parts[0];
      let hint: string | null = null;
      let inner = false;
      for (const p of parts.slice(1)) {
        if (p === "inner") inner = true;
        else if (p === "left") inner = false;
        else hint = p;
      }
      return { kind: "embed", target, alias: alias ?? target, hint, inner, children: parseSelect(inside) };
    }
    let name = compact.replace(/::\w+$/, "");
    let alias = name;
    const colon = name.indexOf(":");
    if (colon > 0) {
      alias = name.slice(0, colon);
      name = name.slice(colon + 1);
    }
    return { kind: "field", name, alias };
  });
}

// ── relaciones ──

interface Relation {
  table: string;
  /** to-one: columna local → id remoto; to-many: columna remota → id local */
  localCol: string;
  remoteCol: string;
  many: boolean;
}

function fksOf(table: string): ShowcaseFk[] {
  return SHOWCASE_SCHEMA[table]?.fks ?? [];
}

export function resolveRelation(base: string, target: string, hint: string | null): Relation | null {
  const own = fksOf(base);
  // `alias:columna_fk(...)`: el destino es una columna con clave foránea
  const byColumn = own.find((f) => f.columns[0] === target);
  if (byColumn) return { table: byColumn.ref, localCol: target, remoteCol: "id", many: false };
  const matchesHint = (f: ShowcaseFk) => !hint || f.name === hint || f.columns[0] === hint;
  const toOne = own.filter((f) => f.ref === target && matchesHint(f));
  if (toOne.length > 0) return { table: target, localCol: toOne[0].columns[0], remoteCol: "id", many: false };
  const toMany = fksOf(target).filter((f) => f.ref === base && matchesHint(f));
  if (toMany.length > 0) return { table: target, localCol: "id", remoteCol: toMany[0].columns[0], many: true };
  return null;
}

// ── filtros ──

type Cond =
  | { kind: "op"; col: string; op: string; value: string; negate: boolean }
  | { kind: "group"; any: boolean; conds: Cond[]; negate: boolean };

function unquote(v: string): string {
  return v.length >= 2 && v.startsWith('"') && v.endsWith('"') ? v.slice(1, -1).replace(/\\"/g, '"') : v;
}

function parseOpValue(col: string, expr: string): Cond {
  let negate = false;
  let rest = expr;
  if (rest.startsWith("not.")) {
    negate = true;
    rest = rest.slice(4);
  }
  const dot = rest.indexOf(".");
  const op = dot >= 0 ? rest.slice(0, dot) : rest;
  const value = dot >= 0 ? rest.slice(dot + 1) : "";
  return { kind: "op", col, op, value, negate };
}

/** "a.eq.1,b.in.(x,y),and(c.gt.2,d.is.null)" → condiciones */
function parseLogicList(inner: string): Cond[] {
  return splitTopLevel(inner).map((part) => {
    const m = /^(not\.)?(and|or)\((.*)\)$/.exec(part);
    if (m) return { kind: "group", any: m[2] === "or", conds: parseLogicList(m[3]), negate: !!m[1] };
    // col.op.valor (la columna puede tener puntos solo si es rel.col; acá no)
    const firstDot = part.indexOf(".");
    return parseOpValue(part.slice(0, firstDot), part.slice(firstDot + 1));
  });
}

const RESERVED = new Set(["select", "order", "limit", "offset", "on_conflict", "columns"]);

interface ParsedFilters {
  top: Cond[];
  /** filtros sobre relaciones embebidas: alias → condiciones */
  embedded: Map<string, Cond[]>;
  embeddedOrder: Map<string, string>;
  embeddedLimit: Map<string, number>;
}

function parseFilters(params: URLSearchParams): ParsedFilters {
  const top: Cond[] = [];
  const embedded = new Map<string, Cond[]>();
  const embeddedOrder = new Map<string, string>();
  const embeddedLimit = new Map<string, number>();
  for (const [key, value] of params.entries()) {
    const dot = key.lastIndexOf(".");
    const head = dot > 0 ? key.slice(0, dot) : null;
    const last = dot > 0 ? key.slice(dot + 1) : key;
    if (RESERVED.has(key)) continue;
    if (head && last === "order") {
      embeddedOrder.set(head, value);
      continue;
    }
    if (head && last === "limit") {
      embeddedLimit.set(head, Number(value));
      continue;
    }
    if (head && (last === "or" || last === "and")) {
      const list = embedded.get(head) ?? [];
      list.push({ kind: "group", any: last === "or", conds: parseLogicList(value.slice(1, -1)), negate: false });
      embedded.set(head, list);
      continue;
    }
    if (key === "or" || key === "and" || key === "not.or" || key === "not.and") {
      top.push({ kind: "group", any: key.endsWith("or"), conds: parseLogicList(value.slice(1, -1)), negate: key.startsWith("not.") });
      continue;
    }
    if (head) {
      const list = embedded.get(head) ?? [];
      list.push(parseOpValue(last, value));
      embedded.set(head, list);
      continue;
    }
    top.push(parseOpValue(key, value));
  }
  return { top, embedded, embeddedOrder, embeddedLimit };
}

const DATE_LIKE = /^\d{4}-\d{2}-\d{2}/;

function coerceCompare(a: unknown, b: string): number {
  if (a === null || a === undefined) return NaN;
  if (typeof a === "number") return a - Number(b);
  if (typeof a === "boolean") return Number(a) - Number(b === "true");
  const sa = String(a);
  if (DATE_LIKE.test(sa) && DATE_LIKE.test(b)) {
    const da = Date.parse(sa.length === 10 ? `${sa}T00:00:00Z` : sa);
    const db = Date.parse(b.length === 10 ? `${b}T00:00:00Z` : b);
    if (!Number.isNaN(da) && !Number.isNaN(db)) return da - db;
  }
  return sa < b ? -1 : sa > b ? 1 : 0;
}

function likeToRegex(pattern: string, ci: boolean): RegExp {
  const esc = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/[%*]/g, ".*").replace(/_/g, ".");
  return new RegExp(`^${esc}$`, ci ? "i" : "");
}

function parseList(value: string): string[] {
  const inner = value.startsWith("(") && value.endsWith(")") ? value.slice(1, -1) : value;
  return splitTopLevel(inner).map(unquote);
}

function evalOp(row: Row, c: Extract<Cond, { kind: "op" }>): boolean {
  const v = row[c.col];
  const val = c.value; // URLSearchParams ya decodificó
  let r: boolean;
  switch (c.op) {
    case "eq":
      r = v !== null && v !== undefined && coerceCompare(v, unquote(val)) === 0;
      break;
    case "neq":
      r = v !== null && v !== undefined && coerceCompare(v, unquote(val)) !== 0;
      break;
    case "gt":
      r = coerceCompare(v, val) > 0;
      break;
    case "gte":
      r = coerceCompare(v, val) >= 0;
      break;
    case "lt":
      r = coerceCompare(v, val) < 0;
      break;
    case "lte":
      r = coerceCompare(v, val) <= 0;
      break;
    case "like":
      r = typeof v === "string" && likeToRegex(val, false).test(v);
      break;
    case "ilike":
      r = typeof v === "string" && likeToRegex(val, true).test(v);
      break;
    case "is":
      r = val === "null" ? v === null || v === undefined : val === "true" ? v === true : val === "false" ? v === false : false;
      break;
    case "in": {
      const list = parseList(val);
      r = v !== null && v !== undefined && list.some((x) => coerceCompare(v, x) === 0);
      break;
    }
    case "cs": {
      const want = val.startsWith("{") ? val.slice(1, -1).split(",").map(unquote) : (JSON.parse(val) as unknown[]).map(String);
      r = Array.isArray(v) && want.every((w) => (v as unknown[]).map(String).includes(w));
      break;
    }
    case "cd": {
      const allowed = val.startsWith("{") ? val.slice(1, -1).split(",").map(unquote) : (JSON.parse(val) as unknown[]).map(String);
      r = Array.isArray(v) && (v as unknown[]).every((x) => allowed.includes(String(x)));
      break;
    }
    default:
      r = false;
  }
  // NULL no cumple ni la condición ni su negación (como en SQL), salvo "is"
  if (c.negate) return c.op === "is" ? !r : v === null || v === undefined ? false : !r;
  return r;
}

function evalCond(row: Row, c: Cond): boolean {
  if (c.kind === "op") return evalOp(row, c);
  const r = c.any ? c.conds.some((x) => evalCond(row, x)) : c.conds.every((x) => evalCond(row, x));
  return c.negate ? !r : r;
}

function applyOrder(rows: Row[], order: string | null): Row[] {
  if (!order) return rows;
  const keys = splitTopLevel(order).map((part) => {
    const [col, ...mods] = part.split(".");
    return { col, desc: mods.includes("desc"), nullsFirst: mods.includes("nullsfirst") ? true : mods.includes("nullslast") ? false : mods.includes("desc") };
  });
  return [...rows].sort((a, b) => {
    for (const k of keys) {
      const va = a[k.col];
      const vb = b[k.col];
      const na = va === null || va === undefined;
      const nb = vb === null || vb === undefined;
      if (na || nb) {
        if (na && nb) continue;
        return na === k.nullsFirst ? -1 : 1;
      }
      const cmp = coerceCompare(va, String(vb));
      if (cmp !== 0) return k.desc ? -cmp : cmp;
    }
    return 0;
  });
}

// ── proyección ──

function project(store: Store, table: string, row: Row, nodes: SelectNode[], filters: ParsedFilters, path: string): Row | null {
  const out: Row = {};
  for (const n of nodes) {
    if (n.kind === "star") {
      const cols = SHOWCASE_SCHEMA[table]?.columns ?? Object.keys(row);
      for (const c of cols) out[c] = row[c] ?? null;
      for (const k of Object.keys(row)) if (!(k in out)) out[k] = row[k];
    } else if (n.kind === "field") {
      out[n.alias] = row[n.name] ?? null;
    }
  }
  for (const n of nodes) {
    if (n.kind !== "embed") continue;
    const rel = resolveRelation(table, n.target, n.hint);
    const key = path ? `${path}.${n.alias}` : n.alias;
    const conds = filters.embedded.get(key) ?? filters.embedded.get(n.target) ?? [];
    if (!rel) {
      out[n.alias] = null;
      if (n.inner) return null;
      continue;
    }
    let related = (store[rel.table] ?? []).filter((r) => r[rel.remoteCol] !== undefined && r[rel.remoteCol] === row[rel.localCol]);
    related = related.filter((r) => conds.every((c) => evalCond(r, c)));
    if (rel.many) {
      related = applyOrder(related, filters.embeddedOrder.get(key) ?? null);
      const lim = filters.embeddedLimit.get(key);
      if (lim !== undefined) related = related.slice(0, lim);
      const children = n.children.length === 1 && n.children[0].kind === "field" && n.children[0].name === "count";
      const projected = related.map((r) => project(store, rel.table, r, n.children, filters, key)).filter((x): x is Row => x !== null);
      if (n.inner && projected.length === 0) return null;
      out[n.alias] = children ? [{ count: projected.length }] : projected;
    } else {
      const one = related[0] ? project(store, rel.table, related[0], n.children, filters, key) : null;
      if (n.inner && !one) return null;
      out[n.alias] = one;
    }
  }
  return out;
}

// ── utilidades de respuesta ──

const json = (status: number, body: unknown, headers: Record<string, string> = {}): RestResponse => ({
  status,
  body,
  headers: { "Content-Type": "application/json; charset=utf-8", ...headers },
});

function preferOf(headers: Headers): Set<string> {
  return new Set(
    (headers.get("prefer") ?? "")
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean),
  );
}

function wantsObject(headers: Headers): boolean {
  return (headers.get("accept") ?? "").includes("application/vnd.pgrst.object+json");
}

function finish(rows: Row[], req: RestRequest, total: number | null, offset: number): RestResponse {
  const headers: Record<string, string> = {};
  if (total !== null) headers["Content-Range"] = rows.length ? `${offset}-${offset + rows.length - 1}/${total}` : `*/${total}`;
  if (wantsObject(req.headers)) {
    if (rows.length !== 1) {
      return json(406, {
        code: "PGRST116",
        details: `The result contains ${rows.length} rows`,
        hint: null,
        message: "JSON object requested, multiple (or no) rows returned",
      });
    }
    return json(200, rows[0], headers);
  }
  return json(req.method === "HEAD" ? 200 : 200, req.method === "HEAD" ? null : rows, headers);
}

let idCounter = 0;
export function newId(): string {
  idCounter++;
  const hex = (idCounter + Date.now()).toString(16).padStart(12, "0").slice(-12);
  return `5c0a5e00-0000-4000-8000-${hex}`;
}

// ── punto de entrada ──

export function handleRest(store: Store, req: RestRequest): RestResponse {
  const { table, params } = req;
  if (!SHOWCASE_SCHEMA[table] && !store[table]) {
    return json(404, { code: "42P01", message: `relation "${table}" does not exist (modo capturas)`, details: null, hint: null });
  }
  const rowsOf = () => (store[table] ??= []);
  const filters = parseFilters(params);
  const nodes = parseSelect(params.get("select"));
  const matches = (r: Row) => filters.top.every((c) => evalCond(r, c));
  const prefer = preferOf(req.headers);
  const countExact = [...prefer].some((p) => p.startsWith("count="));
  const returnRep = prefer.has("return=representation");
  const now = new Date().toISOString();
  const projectAll = (rows: Row[]) => rows.map((r) => project(store, table, r, nodes, filters, "")).filter((x): x is Row => x !== null);

  if (req.method === "GET" || req.method === "HEAD") {
    // filtros → orden → proyección (que descarta padres sin !inner) → paginación
    let rows = projectAll(applyOrder(rowsOf().filter(matches), params.get("order")));
    const total = rows.length;
    let offset = Number(params.get("offset") ?? 0);
    let limit = params.has("limit") ? Number(params.get("limit")) : Infinity;
    const range = req.headers.get("range");
    if (range && /^\d+-\d+$/.test(range)) {
      const [a, b] = range.split("-").map(Number);
      offset = a;
      limit = b - a + 1;
    }
    rows = rows.slice(offset, offset + limit);
    return finish(rows, req, countExact ? total : null, offset);
  }

  if (req.method === "POST") {
    const input = (Array.isArray(req.body) ? req.body : [req.body]).filter((x): x is Row => !!x && typeof x === "object");
    const merge = prefer.has("resolution=merge-duplicates");
    const ignore = prefer.has("resolution=ignore-duplicates");
    const conflictCols = (params.get("on_conflict") ?? "id").split(",").map((c) => c.trim());
    const written: Row[] = [];
    for (const raw of input) {
      const existing = (merge || ignore) ? rowsOf().find((r) => conflictCols.every((c) => raw[c] !== undefined && r[c] === raw[c])) : undefined;
      if (existing) {
        if (merge) Object.assign(existing, raw, { updated_at: now });
        written.push(existing);
        continue;
      }
      const row: Row = { id: newId(), created_at: now, updated_at: now, ...raw };
      rowsOf().push(row);
      written.push(row);
    }
    if (!returnRep) return json(201, null);
    return finish(projectAll(written), req, null, 0);
  }

  if (req.method === "PATCH") {
    const patch = (req.body && typeof req.body === "object" ? req.body : {}) as Row;
    const hit = rowsOf().filter(matches);
    for (const r of hit) Object.assign(r, patch, "updated_at" in r ? { updated_at: now } : {});
    if (!returnRep) return json(204, null, countExact ? { "Content-Range": `*/${hit.length}` } : {});
    return finish(projectAll(hit), req, null, 0);
  }

  if (req.method === "DELETE") {
    const all = rowsOf();
    const hit = all.filter(matches);
    store[table] = all.filter((r) => !hit.includes(r));
    if (!returnRep) return json(204, null);
    return finish(hit.map((r) => project(store, table, r, nodes, filters, "")).filter((x): x is Row => x !== null), req, null, 0);
  }

  return json(405, { message: "Método no soportado en modo capturas" });
}

import { createHmac, timingSafeEqual } from "crypto";
import { limpiarSecciones } from "@/lib/secciones";

export type Claims = {
  id: string;
  name: string;
  alto: boolean;
  del: boolean;
  rnap: boolean;
  files?: boolean;
  pd?: boolean;
  role?: string | null;
  sec?: string[];
  exp: number;
};

export type Filter = { type: "eq" | "neq"; column: string; value: unknown };

export type QuerySpec = {
  table: string;
  op: "select" | "insert" | "update" | "delete" | "upsert";
  columns?: string | null;
  order?: { column: string; ascending: boolean } | null;
  limit?: number | null;
  filters?: Filter[];
  values?: unknown;
  returning?: string | null;
  single?: "single" | "maybeSingle" | null;
};

const TABLES = new Set([
  "app_settings",
  "forum_posts",
  "aspirantes",
  "instructors",
  "logs",
  "pd_members",
  "records",
  "rnap_certificates",
  "salary_entries",
  "salary_months",
]);

const PUBLIC_BG_KEY = "site_background_url";
export const LOGIN_COLUMNS =
  "id, name, is_alto_mando, can_delete, can_emit_rnap, can_edit_files, can_edit_pd, role, avatar_url, descripcion, secciones";

/** Builds the browser session and signed token from a fresh instructors row. */
export function buildLogin(r: any) {
  const alto = !!r.is_alto_mando;
  const session = {
    id: r.id as string,
    name: r.name as string,
    is_alto_mando: alto,
    can_delete: alto || !!r.can_delete,
    can_emit_rnap: alto || !!r.can_emit_rnap,
    can_edit_files: alto || !!r.can_edit_files,
    can_edit_pd: alto || !!r.can_edit_pd,
    avatar_url: (r.avatar_url ?? null) as string | null,
    role: (r.role ?? null) as string | null,
    descripcion: (r.descripcion ?? null) as string | null,
    secciones: limpiarSecciones(r.secciones) as string[],
  };
  const token = issueToken({
    id: session.id, name: session.name, alto, del: session.can_delete, rnap: session.can_emit_rnap,
    files: session.can_edit_files, pd: session.can_edit_pd, role: session.role, sec: session.secciones,
  });
  return { session, token };
}

/** Re-reads permissions so changes made by Alto Mando apply immediately. */
export async function freshClaims(claims: Claims | null, admin: { from: (t: string) => any }): Promise<Claims | null> {
  if (!claims) return null;
  const { data: r } = await admin.from("instructors").select(LOGIN_COLUMNS).eq("id", claims.id).maybeSingle();
  if (!r) return null;
  const alto = !!r.is_alto_mando;
  return {
    ...claims, name: r.name, alto, del: alto || !!r.can_delete, rnap: alto || !!r.can_emit_rnap,
    files: alto || !!r.can_edit_files, pd: alto || !!r.can_edit_pd, role: r.role ?? null, sec: limpiarSecciones(r.secciones),
  };
}

const PROFILE_FIELDS = new Set(["name", "avatar_url", "descripcion"]);

function secret(): string {
  const s = process.env["SUPABASE_SERVICE_ROLE_KEY"] || process.env["SUPABASE_DB_URL"];
  if (!s) throw new Error("Server misconfigured");
  return s;
}

function b64url(input: Buffer | string): string {
  return Buffer.from(input as any).toString("base64url");
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function issueToken(claims: Omit<Claims, "exp">): string {
  const full: Claims = { ...claims, exp: Date.now() + 1000 * 60 * 60 * 12 };
  const payload = b64url(JSON.stringify(full));
  return `${payload}.${sign(payload)}`;
}

export function verifyToken(token: unknown): Claims | null {
  if (typeof token !== "string" || !token.includes(".")) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString()) as Claims;
    if (!claims?.id || typeof claims.exp !== "number" || claims.exp < Date.now()) return null;
    return claims;
  } catch {
    return null;
  }
}

function deny(msg = "No autorizado"): never {
  throw new Error(msg);
}

function filterValue(spec: QuerySpec, column: string): unknown {
  return spec.filters?.find(f => f.type === "eq" && f.column === column)?.value;
}

function patchKeys(values: unknown): string[] {
  return values && typeof values === "object" ? Object.keys(values as object) : [];
}

/** Server-side authorization. Returns a possibly-narrowed spec. */
export function authorize(spec: QuerySpec, claims: Claims | null): QuerySpec {
  if (!TABLES.has(spec.table)) deny("Tabla no permitida");
  const write = spec.op !== "select";
  const alto = !!claims?.alto;
  const need = (sec: string) => {
    if (!claims) deny();
    if (!alto && !claims.sec?.includes(sec)) deny("Sin acceso a este apartado");
  };

  switch (spec.table) {
    case "salary_months":
    case "salary_entries":
      if (write && !alto) deny("Solo Alto Mando puede editar");
      return spec;

    case "pd_members":
      if (write && !alto && !claims?.pd) deny("Sin permiso para editar el registro de policías");
      return spec;


    case "app_settings":
      if (write) {
        if (!alto) deny("Solo Alto Mando puede editar la configuración");
        return spec;
      }
      if (!claims && filterValue(spec, "key") !== PUBLIC_BG_KEY) deny();
      return spec;

    case "logs":
      if (!claims) deny();
      if (spec.op === "insert") return spec;
      if (spec.op === "select") {
        if (!alto) deny();
        return spec;
      }
      deny();

    case "instructors": {
      if (!claims) deny();
      if (spec.op === "select") {
        if (alto) return spec;
        const cols = (spec.columns ?? "*").split(",").map(c => c.trim()).filter(Boolean);
        const publicCols = new Set(["id", "name", "avatar_url", "descripcion", "role"]);
        if (cols.length > 0 && cols.every(c => publicCols.has(c))) return spec;
        return { ...spec, filters: [{ type: "eq", column: "id", value: claims.id }] };
      }
      if (spec.op === "update") {
        if (alto) return spec;
        const target = filterValue(spec, "id");
        if (target !== claims.id) deny();
        if (patchKeys(spec.values).some(k => !PROFILE_FIELDS.has(k))) deny("Campo no permitido");
        return spec;
      }
      if (!alto) deny("Solo Alto Mando");
      return spec;
    }

    case "forum_posts": {
      if (!claims) deny();
      need("forum");
      if (spec.op === "select" || spec.op === "insert") return spec;
      // Alto Mando y Cúpula editan cualquier fichero; el autor edita el suyo.
      if (alto || claims.role === "Cupula") return spec;
      return { ...spec, filters: [...(spec.filters ?? []), { type: "eq", column: "created_by_id", value: claims.id }] };
    }

    case "aspirantes":
    case "records":
    case "rnap_certificates":
      if (!claims) deny();
      need(spec.table === "records" ? "exsapd" : spec.table === "aspirantes" ? "aspirantes" : "rnap");
      if (spec.op === "delete" && !claims.del) deny("Sin permiso para borrar");
      return spec;

    default:
      deny();
  }
}

type AdminClient = {
  from: (table: string) => any;
};

export async function runQuery(spec: QuerySpec, claims: Claims | null, admin: AdminClient) {
  const safe = authorize(spec, claims);
  let q = admin.from(safe.table) as any;

  if (safe.op === "select") q = q.select(safe.columns ?? "*");
  else if (safe.op === "insert") q = q.insert(safe.values as any);
  else if (safe.op === "upsert") q = q.upsert(safe.values as any);
  else if (safe.op === "update") q = q.update(safe.values as any);
  else q = q.delete();

  for (const f of safe.filters ?? []) {
    q = f.type === "eq" ? q.eq(f.column, f.value) : q.neq(f.column, f.value);
  }
  if (safe.op !== "select" && safe.returning != null) q = q.select(safe.returning || "*");
  if (safe.order) q = q.order(safe.order.column, { ascending: safe.order.ascending });
  if (safe.limit != null) q = q.limit(safe.limit);
  if (safe.single === "single") q = q.single();
  else if (safe.single === "maybeSingle") q = q.maybeSingle();

  const { data, error } = await q;
  if (error) return { data: null, error: { message: error.message } };
  return { data: data ?? null, error: null };
}

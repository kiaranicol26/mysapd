import { createHmac, timingSafeEqual } from "crypto";
import { normalizeRango, permisosDeRango, puedeGestionar } from "@/lib/adminRango";

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
  capacitaciones?: boolean;
  rango?: string;
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
  "manual_salary_batches",
  "manual_salary_entries",
  "pd_members",
  "records",
  "rnap_certificates",
  "salary_entries",
  "salary_months",
]);

const PUBLIC_BG_KEY = "site_background_url";
const PUBLIC_LOGIN_KEY = "discord_code_login_enabled";
const PUBLIC_SALARY_TAB_KEYS = ["hide_salary_tab", "hide_manual_salary_tab"];
export const LOGIN_COLUMNS =
  "id, name, is_alto_mando, can_delete, can_emit_rnap, can_edit_files, can_edit_pd, can_edit_capacitaciones, role, avatar_url, descripcion, secciones, discord_id, discord_inhabilitado, discord_checked_at, admin_rango";

/** Builds the browser session and signed token from a fresh instructors row. */
export function buildLogin(r: any) {
  const rango = normalizeRango(r.admin_rango);
  const p = permisosDeRango(rango);
  const alto = p.alto;
  const session = {
    id: r.id as string,
    name: r.name as string,
    admin_rango: rango,
    is_alto_mando: alto,
    can_delete: p.del,
    can_emit_rnap: p.rnap,
    can_edit_files: p.files,
    can_edit_pd: p.pd,
    can_edit_capacitaciones: p.capacitaciones,
    avatar_url: (r.avatar_url ?? null) as string | null,
    role: (r.role ?? null) as string | null,
    descripcion: (r.descripcion ?? null) as string | null,
    secciones: [...p.extraSecciones] as string[],
  };
  const token = issueToken({
    id: session.id, name: session.name, alto, del: session.can_delete, rnap: session.can_emit_rnap,
    files: session.can_edit_files, pd: session.can_edit_pd, capacitaciones: session.can_edit_capacitaciones, role: session.role, sec: session.secciones, rango,
  });
  return { session, token };
}

/** Re-reads permissions so changes made by Administrador apply immediately. */
export async function freshClaims(claims: Claims | null, admin: { from: (t: string) => any }): Promise<Claims | null> {
  if (!claims) return null;
  const { data: r } = await admin.from("instructors").select(LOGIN_COLUMNS).eq("id", claims.id).maybeSingle();
  if (!r) return null;
  // ID-only login: no Discord membership gate on requests.
  const rango = normalizeRango(r.admin_rango);
  const p = permisosDeRango(rango);
  return {
    ...claims, name: r.name, alto: p.alto, del: p.del, rnap: p.rnap, files: p.files, pd: p.pd, capacitaciones: p.capacitaciones,
    role: r.role ?? null, sec: [...p.extraSecciones], rango,
  };
}

const PROFILE_FIELDS = new Set(["placa"]);

function secret(): string {
  const s = process.env["SUPABASE_SERVICE_ROLE_KEY"] || process.env["SUPABASE_DB_URL"];
  if (!s) throw new Error("Server misconfigured");
  return s;
}

function b64url(input: Buffer | string): string {
  return Buffer.from(input as any).toString("base64url");
}

function sign(payload: string): string {
  // Versioned signing context intentionally invalidates every token issued
  // before the Discord one-time-code authentication hardening.
  return createHmac("sha256", secret()).update("mysapd-session-v2:").update(payload).digest("base64url");
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

  const editor = permisosDeRango(claims?.rango).puedeEditar || alto;
  if (write && claims && !editor && !(spec.table === "logs" && spec.op === "insert")) deny("Tu rango Usuario solo permite ver, sin editar.");

  switch (spec.table) {
    case "manual_salary_batches":
    case "manual_salary_entries":
      if (!alto) deny("Solo Administrador puede acceder a los salarios manuales");
      return spec;

    case "salary_months":
    case "salary_entries":
      if (write && !alto) deny("Solo Administrador puede editar");
      return spec;

    case "pd_members": {
      if (!write) return spec;
      const restrictedSalaryFields = new Set(["sueldo_defecto", "division", "division_rango", "division2", "division2_rango", "es_instructor"]);
      const hasRestrictedFields = patchKeys(spec.values).some(k => restrictedSalaryFields.has(k)) ||
        (Array.isArray(spec.values) && spec.values.some(v => patchKeys(v).some(k => restrictedSalaryFields.has(k))));
      if (!alto && claims?.rango !== "moderador" && hasRestrictedFields) deny("Solo Moderador o Administrador puede modificar sueldos y divisiones");
      // The dedicated permission grants access only to training checkboxes.
      const CAP_FIELDS = new Set(["cap_m4", "cap_edc", "cap_mary", "cap_sniper", "cap_air", "cap_ak47"]);
      if (spec.op === "update" && claims?.capacitaciones && patchKeys(spec.values).length > 0 &&
          patchKeys(spec.values).every(k => CAP_FIELDS.has(k))) return spec;
      if (alto || claims?.pd) return spec;
      deny("Sin permiso para editar el registro de policías");
    }


    case "app_settings":
      if (write) {
        if (!alto) deny("Solo Administrador puede editar la configuración");
        return spec;
      }
      if (!claims && ![PUBLIC_BG_KEY, PUBLIC_LOGIN_KEY, ...PUBLIC_SALARY_TAB_KEYS].includes(String(filterValue(spec, "key")))) deny();
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
      if (spec.op === "select") {
        const cols = (spec.columns ?? "*").split(",").map(c => c.trim()).filter(Boolean);
        // Public Registro PD needs only these profile fields. Keep anonymous reads
        // restricted to this exact allowlist; all writes remain authenticated.
        if (!claims) {
          const anonymousPublicCols = new Set(["id", "name", "avatar_url", "role", "placa", "discord_joined_at", "discord_inhabilitado"]);
          if (cols.length > 0 && cols.every(c => anonymousPublicCols.has(c))) return spec;
          deny();
        }
        if (alto) return spec;
        const publicCols = new Set(["id", "name", "avatar_url", "descripcion", "role", "banner_url", "color_perfil", "pronombres", "placa",
          "discord_username", "tag", "admin_rango", "is_alto_mando", "can_delete", "can_emit_rnap", "can_edit_files", "can_edit_pd", "secciones", "discord_inhabilitado", "discord_joined_at"]);
        if (cols.length > 0 && cols.every(c => publicCols.has(c))) return spec;
        return { ...spec, filters: [{ type: "eq", column: "id", value: claims.id }] };
      }
      if (!claims) deny();
      if (spec.op === "update") {
        if (alto) return spec;
        const target = filterValue(spec, "id");
        if (target !== claims.id) deny();
        if (patchKeys(spec.values).some(k => !PROFILE_FIELDS.has(k))) deny("Campo no permitido");
        return spec;
      }
      if (!alto) deny("Solo Administrador");
      return spec;
    }

    case "forum_posts": {
      if (!claims) deny();
      need("forum");
      if (spec.op === "select" || spec.op === "insert") return spec;
      // Administrador puede editar cualquier publicación; el autor conserva la edición de sus propias publicaciones.
      if (alto) return spec;
      return { ...spec, filters: [...(spec.filters ?? []), { type: "eq", column: "created_by_id", value: claims.id }] };
    }

    case "aspirantes":
    case "records":
    case "rnap_certificates":
      if (!claims) deny();
      need(spec.table === "records" ? "exsapd" : spec.table === "aspirantes" ? "aspirantes" : "rnap");
      if (write && spec.table !== "rnap_certificates" && !alto && !claims.pd) deny("Se requiere rango Moderador");
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
  let safe = authorize(spec, claims);

  // Never trust client-supplied authorship for audit records or forum posts.
  // The signed, freshly revalidated session is the source of actor identity.
  if (safe.table === "logs" && safe.op === "insert" && claims) {
    const stamp = (value: unknown) => ({
      ...(value && typeof value === "object" ? value : {}),
      instructor_id: claims.id,
      instructor_name: claims.name,
    });
    safe = { ...safe, values: Array.isArray(safe.values) ? safe.values.map(stamp) : stamp(safe.values) };
  }
  if (safe.table === "forum_posts" && safe.op === "insert" && claims) {
    const stamp = (value: unknown) => ({
      ...(value && typeof value === "object" ? value : {}),
      created_by_id: claims.id,
      created_by: claims.name,
    });
    safe = { ...safe, values: Array.isArray(safe.values) ? safe.values.map(stamp) : stamp(safe.values) };
  }
  if (safe.table === "forum_posts" && safe.op === "update") {
    const stripAuthorFields = (value: unknown) => {
      const next = value && typeof value === "object" ? { ...(value as Record<string, unknown>) } : {};
      delete next.created_by_id;
      delete next.created_by;
      return next;
    };
    safe = { ...safe, values: Array.isArray(safe.values) ? safe.values.map(stripAuthorFields) : stripAuthorFields(safe.values) };
  }
  if (safe.table === "instructors" && ["insert", "upsert", "update"].includes(safe.op)) {
    const values = Array.isArray(safe.values) ? safe.values : [safe.values];
    const { factionMember } = await import("./discordGateway.server");
    const { membershipDisabled, REGISTRATION_MEMBERSHIP_ERROR } = await import("./discordMembership");
    for (const value of values) {
      if (!value || typeof value !== "object") deny("Datos inválidos");
      if (safe.op !== "update" || Object.hasOwn(value, "discord_id")) {
        if (typeof value.discord_id !== "string" || !/^\d{17,20}$/.test(value.discord_id)) deny(REGISTRATION_MEMBERSHIP_ERROR);
        const member = await factionMember(value.discord_id);
        if (membershipDisabled(member, value.discord_id)) deny(REGISTRATION_MEMBERSHIP_ERROR);
        value.discord_username = member.user.username;
        value.discord_inhabilitado = false;
        value.discord_checked_at = new Date().toISOString();
      }
    }
  }
  if (safe.table === "pd_members" && claims && !claims.alto) {
    const capOnly = safe.op === "update" && patchKeys(safe.values).length > 0 &&
      patchKeys(safe.values).every(k => k.startsWith("cap_"));
    if (!capOnly) {
      const targets: Array<string | null> = [];
      if (safe.op === "insert" || safe.op === "upsert") {
        const values = Array.isArray(safe.values) ? safe.values : [safe.values];
        for (const value of values) {
          targets.push(value && typeof value === "object" && typeof (value as any).instructor_id === "string"
            ? (value as any).instructor_id : null);
        }
      } else if (safe.op === "update" || safe.op === "delete") {
        const id = filterValue(safe, "id");
        if (!id) deny("Operación no permitida");
        const { data: current } = await admin.from("pd_members").select("instructor_id").eq("id", id).maybeSingle();
        const hasChangedOwner = safe.op === "update" && safe.values && typeof safe.values === "object" &&
          Object.hasOwn(safe.values as object, "instructor_id");
        const changed = hasChangedOwner ? (safe.values as any).instructor_id : undefined;
        if (hasChangedOwner && typeof changed !== "string") {
          deny("No se puede desvincular el registro de su usuario");
        }
        // Check both the current owner and the destination owner so a moderator
        // cannot reassign a higher-ranked user's record to bypass the hierarchy.
        targets.push(current?.instructor_id ?? null);
        if (typeof changed === "string" && changed !== current?.instructor_id) targets.push(changed);
      }
      for (const targetId of targets) {
        if (!targetId) deny("El registro debe estar vinculado a un usuario para comprobar su rango administrativo");
        const { data: target } = await admin.from("instructors").select("admin_rango").eq("id", targetId).maybeSingle();
        if (!target) deny("No se encontró el usuario vinculado al registro policial");
        const objetivo = target.admin_rango ?? "usuario";
        if (!puedeGestionar(claims.rango, objetivo)) {
          deny("Solo podés gestionar policías cuyo rango administrativo sea inferior al tuyo");
        }
      }
    }
  }
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

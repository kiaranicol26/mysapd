import { dbQuery } from "@/lib/data.functions";
import { LOGIN_MEMBERSHIP_ERROR } from "@/lib/discordMembership";
import { toast } from "sonner";

const TOKEN_KEY = "instructor_token";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null) {
  if (typeof window === "undefined") return;
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

/**
 * The signed session token is missing or expired: clear the stale local session
 * so the app sends the user back to the login screen instead of failing silently.
 */
function handleUnauthorized() {
  if (typeof window === "undefined") return;
  const hadSession = localStorage.getItem("instructor_session");
  if (!hadSession) return;
  localStorage.removeItem("instructor_session");
  localStorage.removeItem(TOKEN_KEY);
  window.dispatchEvent(new Event("session-change"));
}


type Result<T = any> = { data: T; error: { message: string } | null };

type Spec = {
  table: string;
  op: "select" | "insert" | "update" | "delete" | "upsert";
  columns?: string | null;
  order?: { column: string; ascending: boolean } | null;
  limit?: number | null;
  filters: { type: "eq" | "neq"; column: string; value: unknown }[];
  values?: unknown;
  returning?: string | null;
  single?: "single" | "maybeSingle" | null;
};

class Builder implements PromiseLike<Result> {
  private spec: Spec;

  constructor(spec: Spec) {
    this.spec = spec;
  }

  select(columns?: string) {
    if (this.spec.op === "select") this.spec.columns = columns ?? "*";
    else this.spec.returning = columns ?? "*";
    return this;
  }

  eq(column: string, value: unknown) {
    this.spec.filters.push({ type: "eq", column, value });
    return this;
  }

  neq(column: string, value: unknown) {
    this.spec.filters.push({ type: "neq", column, value });
    return this;
  }

  order(column: string, opts?: { ascending?: boolean }) {
    this.spec.order = { column, ascending: opts?.ascending !== false };
    return this;
  }

  limit(n: number) {
    this.spec.limit = n;
    return this;
  }

  single() {
    this.spec.single = "single";
    return this;
  }

  maybeSingle() {
    this.spec.single = "maybeSingle";
    return this;
  }

  private async exec(): Promise<Result> {
    try {
      const res = (await dbQuery({ data: { ...this.spec, token: getToken() } })) as Result;
      if (res?.error?.message === "No autorizado") handleUnauthorized();
      if (res?.error?.message === LOGIN_MEMBERSHIP_ERROR) {
        if (typeof window !== "undefined" && localStorage.getItem("instructor_session")) toast.error(LOGIN_MEMBERSHIP_ERROR);
        handleUnauthorized();
      }
      return res;
    } catch (e) {
      return { data: null, error: { message: (e as Error).message || "Error de red" } };
    }
  }


  then<TR1 = Result, TR2 = never>(
    onfulfilled?: ((value: Result) => TR1 | PromiseLike<TR1>) | null,
    onrejected?: ((reason: unknown) => TR2 | PromiseLike<TR2>) | null,
  ): PromiseLike<TR1 | TR2> {
    return this.exec().then(onfulfilled, onrejected);
  }
}

function table(name: string) {
  const base = (op: Spec["op"], values?: unknown) =>
    new Builder({ table: name, op, filters: [], values, columns: op === "select" ? "*" : null });

  return {
    select: (columns?: string) => base("select").select(columns),
    insert: (values: unknown) => base("insert", values),
    upsert: (values: unknown) => base("upsert", values),
    update: (values: unknown) => base("update", values),
    delete: () => base("delete"),
  };
}

/**
 * Server-mediated data client. All reads/writes go through a server function
 * that verifies the signed instructor session and enforces permissions.
 * Mirrors the small subset of the supabase-js query API used by this app.
 */
export const db = { from: table };

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const filterSchema = z.object({
  type: z.enum(["eq", "neq"]),
  column: z.string().max(64),
  value: z.any(),
});

const querySchema = z.object({
  token: z.string().max(4096).nullable().optional(),
  table: z.string().max(64),
  op: z.enum(["select", "insert", "update", "delete", "upsert"]),
  columns: z.string().max(500).nullable().optional(),
  order: z
    .object({ column: z.string().max(64), ascending: z.boolean() })
    .nullable()
    .optional(),
  limit: z.number().int().min(1).max(1000).nullable().optional(),
  filters: z.array(filterSchema).max(10).optional(),
  values: z.any().optional(),
  returning: z.string().max(500).nullable().optional(),
  single: z.enum(["single", "maybeSingle"]).nullable().optional(),
});

export const dbQuery = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => querySchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { verifyToken, runQuery, freshClaims } = await import("@/lib/dbAuth.server");
    const { token, ...spec } = data;
    try {
      const claims = await freshClaims(verifyToken(token ?? null), supabaseAdmin as any);
      if (spec.table === "instructors" && spec.op === "select" && claims) {
        const { checkInstructorMembership } = await import("./discordGateway.server");
        const { data: allRows } = await supabaseAdmin.from("instructors").select("id, discord_id, discord_checked_at");
        const rows = allRows?.filter(row => !row.discord_checked_at || Date.now() - new Date(row.discord_checked_at).getTime() > 60_000);
        // Reconcile on staff-list reads; outages never mark people as departed.
        for (let start = 0; rows && start < rows.length; start += 5) {
          await Promise.all(rows.slice(start, start + 5).map(row => checkInstructorMembership(row, supabaseAdmin as any).catch(() => null)));
        }
        // Auto-create web users for Discord members with the Policia role (rate-limited internally).
        const { syncGuildPolice } = await import("./discordGateway.server");
        await syncGuildPolice(supabaseAdmin as any).catch(() => null);
      }
      return await runQuery(spec as any, claims, supabaseAdmin as any);
    } catch (e) {
      return { data: null, error: { message: (e as Error).message || "No autorizado" } };
    }
  });

export const loginWithId = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ id: z.string().trim().min(1).max(64) }).parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { buildLogin, LOGIN_COLUMNS } = await import("@/lib/dbAuth.server");
    const { data: row } = await supabaseAdmin.from("instructors").select(LOGIN_COLUMNS).eq("id", data.id).maybeSingle();
    if (!row) return { ok: false as const, error: "ID no encontrado" };
    const { checkInstructorMembership } = await import("./discordGateway.server");
    const { LOGIN_MEMBERSHIP_ERROR } = await import("./discordMembership");
    try {
      if (!(await checkInstructorMembership(row, supabaseAdmin as any))) return { ok: false as const, error: LOGIN_MEMBERSHIP_ERROR };
      return { ok: true as const, ...buildLogin(row) };
    } catch {
      return { ok: false as const, error: "No se pudo verificar Discord. Intentá nuevamente en unos momentos." };
    }
  });

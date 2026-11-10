import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const forceDiscordSync = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ token: z.string().min(1).max(4096) }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { verifyToken, freshClaims } = await import("@/lib/dbAuth.server");
    const claims = await freshClaims(verifyToken(data.token), supabaseAdmin as any);
    if (!claims?.alto) return { ok: false as const, error: "Solo Alto Mando puede resincronizar Discord." };
    const { syncGuildPolice } = await import("@/lib/discordGateway.server");
    try {
      const result = await syncGuildPolice(supabaseAdmin as any, { force: true });
      if (!result) return { ok: false as const, error: "No se pudo completar la sincronización. Revisá la conexión del bot y el rol Policía." };
      return { ok: true as const, ...result };
    } catch (error) {
      return { ok: false as const, error: error instanceof Error ? error.message : "Error al sincronizar Discord." };
    }
  });


const bulkPromotionSchema = z.object({
  token: z.string().min(1).max(4096),
  items: z.array(z.object({
    discordId: z.string().regex(/^[0-9]{17,20}$/),
    externalRoleId: z.string().regex(/^[0-9]{17,20}$/),
  })).min(1).max(200),
});

/**
 * Applies a reviewed promotion batch. Rank names are resolved server-side from
 * the external role IDs; the browser cannot choose arbitrary Discord roles.
 */
export const applyBulkPromotions = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => bulkPromotionSchema.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { verifyToken, freshClaims } = await import("@/lib/dbAuth.server");
    const claims = await freshClaims(verifyToken(data.token), supabaseAdmin as any);
    if (!claims?.alto) return { ok: false as const, error: "Solo Administrador puede aplicar ascensos masivos." };

    const { parsePromotionRoleConfig, policeRankOrder } = await import("@/lib/promociones");
    const { FACTION_GUILD_ID } = await import("@/lib/discordMembership");
    const { discord } = await import("@/lib/discordGateway.server");
    const { data: roleSettings, error: roleSettingsError } = await (supabaseAdmin as any)
      .from("app_settings").select("value").eq("key", "bulk_promotion_role_mappings").maybeSingle();
    if (roleSettingsError) return { ok: false as const, error: "No se pudo leer la configuración de equivalencias." };
    const roleConfig = parsePromotionRoleConfig(roleSettings?.value);
    const seen = new Set<string>();
    for (const item of data.items) {
      if (seen.has(item.discordId)) return { ok: false as const, error: "El comunicado contiene policías duplicados." };
      seen.add(item.discordId);
      if (!Object.hasOwn(roleConfig.external, item.externalRoleId)) {
        return { ok: false as const, error: "El comunicado contiene un rol externo no configurado." };
      }
    }

    const results: {
      discordId: string;
      name?: string;
      rank?: string;
      status: "success" | "warning" | "error";
      message: string;
    }[] = [];

    for (const item of data.items) {
      const rank = roleConfig.external[item.externalRoleId];
      const targetRoleId = roleConfig.faction[rank];
      let targetRoleWasAdded = false;
      try {
        const { data: instructor, error: instructorError } = await (supabaseAdmin as any)
          .from("instructors").select("id,name,discord_id").eq("discord_id", item.discordId).maybeSingle();
        if (instructorError) throw new Error("No se pudo consultar el usuario en mySAPD.");
        if (!instructor) throw new Error("No existe una cuenta vinculada a este Discord ID.");

        const { data: linkedRows, error: pdError } = await (supabaseAdmin as any)
          .from("pd_members").select("id,nombre,rango").eq("instructor_id", instructor.id).limit(2);
        if (pdError) throw new Error("No se pudo consultar Registro PD.");
        if (!linkedRows || linkedRows.length !== 1) {
          throw new Error(linkedRows?.length ? "Hay más de una ficha vinculada; requiere revisión manual." : "No tiene una ficha vinculada en Registro PD.");
        }
        const pdMember = linkedRows[0];
        const currentRankOrder = policeRankOrder(pdMember.rango);
        const targetRankOrder = policeRankOrder(rank);
        if (currentRankOrder >= 0 && targetRankOrder >= currentRankOrder) {
          throw new Error("El rango destino no es superior al rango actual de Registro PD; se omitió para evitar una degradación o un cambio duplicado.");
        }

        const member = await discord(`guilds/${FACTION_GUILD_ID}/members/${item.discordId}`) as { user?: { id?: string }; roles?: string[] } | null;
        if (!member?.user?.id || member.user.id !== item.discordId) {
          throw new Error("El policía no pertenece al Discord de Westzone PD.");
        }

        const currentRankRoleIds = Object.values(roleConfig.faction);
        const rolesToRemove = currentRankRoleIds.filter(roleId => roleId !== targetRoleId && member.roles?.includes(roleId));
        if (!member.roles?.includes(targetRoleId)) {
          await discord(`guilds/${FACTION_GUILD_ID}/members/${item.discordId}/roles/${targetRoleId}`, { method: "PUT" });
          targetRoleWasAdded = true;
        }

        const { error: updateError } = await (supabaseAdmin as any)
          .from("pd_members").update({ rango: rank }).eq("id", pdMember.id);
        if (updateError) {
          if (targetRoleWasAdded) {
            try { await discord(`guilds/${FACTION_GUILD_ID}/members/${item.discordId}/roles/${targetRoleId}`, { method: "DELETE" }); } catch { /* best-effort rollback */ }
          }
          throw new Error("Discord recibió el nuevo rol, pero no se pudo actualizar Registro PD. Revisá este caso.");
        }

        const failedRemovals: string[] = [];
        for (const roleId of rolesToRemove) {
          try {
            await discord(`guilds/${FACTION_GUILD_ID}/members/${item.discordId}/roles/${roleId}`, { method: "DELETE" });
          } catch {
            failedRemovals.push(roleId);
          }
        }

        await (supabaseAdmin as any).from("logs").insert({
          instructor_id: claims.id,
          instructor_name: claims.name,
          action: "BULK_POLICE_PROMOTION",
          details: {
            target_instructor_id: instructor.id,
            target_discord_id: item.discordId,
            target_name: pdMember.nombre,
            previous_rank: pdMember.rango,
            new_rank: rank,
            source: "external_discord_announcement",
          },
        });

        results.push({
          discordId: item.discordId,
          name: pdMember.nombre || instructor.name,
          rank,
          status: failedRemovals.length ? "warning" : "success",
          message: failedRemovals.length
            ? "Rango actualizado; no se pudieron retirar uno o más roles policiales anteriores."
            : "Rango actualizado en Registro PD y Discord.",
        });
      } catch (error) {
        results.push({
          discordId: item.discordId,
          rank,
          status: "error",
          message: error instanceof Error ? error.message : "No se pudo aplicar el ascenso.",
        });
      }
    }

    return {
      ok: true as const,
      total: results.length,
      success: results.filter(row => row.status === "success").length,
      warnings: results.filter(row => row.status === "warning").length,
      failed: results.filter(row => row.status === "error").length,
      results,
    };
  });

/** Throttled (10 min) background sync launched when opening Registro PD or Salarios. */
export const autoDiscordSync = createServerFn({ method: "POST" })
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { syncGuildPolice } = await import("@/lib/discordGateway.server");
    const result = await syncGuildPolice(supabaseAdmin as any).catch(() => null);
    return { ran: !!result };
  });

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
      // Only the full, ordered Alto Mando staff-list query triggers the Discord
      // reconciliation. Profile lookups and single-instructor reads must stay cheap.
      const isStaffDirectoryRead = claims?.alto &&
        spec.table === "instructors" &&
        spec.op === "select" &&
        (spec.columns ?? "*") === "*" &&
        spec.order?.column === "created_at" &&
        spec.order.ascending === true &&
        !(spec.filters?.length);
      if (isStaffDirectoryRead) {
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

/** ID-only login, as requested by the owners. */
export const loginWithId = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ id: z.string().trim().min(1).max(64) }).parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { buildLogin, LOGIN_COLUMNS } = await import("@/lib/dbAuth.server");
    const { data: r } = await (supabaseAdmin as any).from("instructors").select(LOGIN_COLUMNS).ilike("id", data.id).maybeSingle();
    if (!r) return { ok: false as const, error: "ID de acceso inválido." };
    return { ok: true as const, ...buildLogin(r) };
  });


const publishCertificateSchema = z.object({
  token: z.string().min(1).max(4096),
  trainingId: z.string().uuid(),
  certificateImage: z.string().startsWith("data:image/png;base64,").max(12_000_000),
});

export const publishTrainingCertificate = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => publishCertificateSchema.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { verifyToken, freshClaims } = await import("@/lib/dbAuth.server");
    const claims = await freshClaims(verifyToken(data.token), supabaseAdmin as any);
    if (!claims?.capacitaciones) return { ok: false as const, error: "No tenés permisos para emitir certificados." };
    try {
      const { publishTrainingCertificateToForum } = await import("@/lib/discordGateway.server");
      const result = await publishTrainingCertificateToForum(supabaseAdmin as any, data.trainingId, data.certificateImage);
      return { ok: true as const, ...result };
    } catch (error) {
      return { ok: false as const, error: error instanceof Error ? error.message : "No se pudo publicar el certificado en Discord." };
    }
  });

const syncCertificateForumSchema = z.object({ token: z.string().min(1).max(4096) });

export const syncExistingCertificatesToForum = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => syncCertificateForumSchema.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { verifyToken, freshClaims } = await import("@/lib/dbAuth.server");
    const claims = await freshClaims(verifyToken(data.token), supabaseAdmin as any);
    if (!claims?.alto) return { ok: false as const, error: "Solo Administrador puede iniciar la sincronización masiva." };
    const { data: rows, error } = await supabaseAdmin.from("pd_trainings").select("id, certificate_image_url");
    if (error) return { ok: false as const, error: "No se pudieron leer los certificados." };
    const { publishTrainingCertificateToForum } = await import("@/lib/discordGateway.server");
    let sent = 0, skipped = 0, failed = 0;
    for (const row of rows ?? []) {
      if (!row.certificate_image_url) { skipped++; continue; }
      try {
        await publishTrainingCertificateToForum(supabaseAdmin as any, row.id);
        sent++;
      } catch { failed++; }
    }
    return { ok: true as const, sent, skipped, failed };
  });


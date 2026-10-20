import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const GATEWAY = "https://connector-gateway.lovable.dev/discord";
const usernameSchema = z.string().trim().toLowerCase().min(2).max(32).regex(/^[a-z0-9_.]+$/, "Usuario de Discord inválido");

async function discord(path: string, init?: RequestInit) {
  const lovable = process.env["LOVABLE_API_KEY"];
  const key = process.env["DISCORD_API_KEY"];
  if (!lovable || !key) throw new Error("El bot de Discord no está configurado");
  const res = await fetch(`${GATEWAY}/${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${lovable}`, "X-Connection-Api-Key": key, "Content-Type": "application/json" },
  });
  if (!res.ok) {
    console.error(`Discord ${path} [${res.status}]: ${await res.text()}`);
    throw new Error(`Discord ${res.status}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

async function hashCode(discordId: string, code: string) {
  const { createHmac } = await import("crypto");
  const s = process.env["SUPABASE_SERVICE_ROLE_KEY"] || process.env["SUPABASE_DB_URL"] || "";
  return createHmac("sha256", s).update(`${discordId}:${code}`).digest("hex");
}

async function findMember(username: string): Promise<{ id: string; username: string } | null> {
  const guilds = (await discord("users/@me/guilds?limit=200")) as { id: string }[];
  for (const g of guilds) {
    const members = (await discord(`guilds/${g.id}/members/search?query=${encodeURIComponent(username)}&limit=25`)) as any[];
    const m = members.find(x => x.user?.username?.toLowerCase() === username && !x.user?.bot);
    if (m) return { id: m.user.id, username: m.user.username };
  }
  return null;
}

/** Envía por MD un código de 6 dígitos al usuario de Discord indicado. */
export const requestDiscordCode = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ username: usernameSchema }).parse(d))
  .handler(async ({ data }) => {
    try {
      const member = await findMember(data.username);
      if (!member) return { ok: false as const, error: "No encontramos ese usuario en el servidor de Discord" };
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: prev } = await supabaseAdmin.from("discord_verifications").select("created_at").eq("discord_id", member.id).maybeSingle();
      if (prev && Date.now() - new Date(prev.created_at).getTime() < 60_000)
        return { ok: false as const, error: "Esperá un minuto antes de pedir otro código" };

      const { randomInt } = await import("crypto");
      const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
      const { error } = await supabaseAdmin.from("discord_verifications").upsert({
        discord_id: member.id, discord_username: member.username, code_hash: await hashCode(member.id, code),
        attempts: 0, expires_at: new Date(Date.now() + 10 * 60_000).toISOString(), created_at: new Date().toISOString(),
      });
      if (error) throw error;

      const dm = await discord("users/@me/channels", { method: "POST", body: JSON.stringify({ recipient_id: member.id }) });
      await discord(`channels/${dm.id}/messages`, {
        method: "POST",
        body: JSON.stringify({
          embeds: [{
            title: "mySAPD · Código de acceso",
            description: `Tu código es **${code}**\nVence en 10 minutos. Si no lo pediste, ignorá este mensaje.`,
            color: 0x5865f2,
            footer: { text: "San Andreas Police Department" },
          }],
        }),
      });
      return { ok: true as const };
    } catch (e) {
      console.error("requestDiscordCode", e);
      return { ok: false as const, error: "No se pudo enviar el MD. Revisá que tengas los mensajes directos del servidor habilitados." };
    }
  });

/** Verifica el código. Si es la primera vez, crea el usuario solo con acceso a myPerfil. */
export const verifyDiscordCode = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({
      username: usernameSchema,
      code: z.string().trim().regex(/^\d{6}$/, "Código inválido"),
      name: z.string().trim().min(3).max(60).optional(),
    }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { buildLogin, LOGIN_COLUMNS } = await import("@/lib/dbAuth.server");
    const { data: v } = await supabaseAdmin.from("discord_verifications").select("*").eq("discord_username", data.username).maybeSingle();
    if (!v || new Date(v.expires_at).getTime() < Date.now() || v.attempts >= 5)
      return { ok: false as const, error: "Código vencido. Pedí uno nuevo." };
    if ((await hashCode(v.discord_id, data.code)) !== v.code_hash) {
      await supabaseAdmin.from("discord_verifications").update({ attempts: v.attempts + 1 }).eq("discord_id", v.discord_id);
      return { ok: false as const, error: "Código incorrecto" };
    }

    let { data: row } = await supabaseAdmin.from("instructors").select(LOGIN_COLUMNS).eq("discord_id", v.discord_id).maybeSingle();
    if (!row) {
      if (!data.name) return { ok: false as const, needsName: true as const };
      const { randomBytes } = await import("crypto");
      const id = `DC-${randomBytes(4).toString("hex").toUpperCase()}`;
      const ins = await supabaseAdmin.from("instructors").insert({
        id, name: data.name, role: "Usuario", discord_id: v.discord_id, discord_username: v.discord_username,
        secciones: [], created_by: "Registro Discord",
      }).select(LOGIN_COLUMNS).single();
      if (ins.error) return { ok: false as const, error: "No se pudo crear el usuario" };
      row = ins.data;
      await supabaseAdmin.from("logs").insert({ instructor_id: id, instructor_name: data.name, action: "REGISTRO_DISCORD", details: { discord: v.discord_username } });
    }
    await supabaseAdmin.from("discord_verifications").delete().eq("discord_id", v.discord_id);
    return { ok: true as const, ...buildLogin(row) };
  });

/** Cambia el apodo del usuario en los servidores de Discord donde está el bot. */
export const syncDiscordNick = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: z.string().max(4096), nick: z.string().trim().min(1).max(32), placa: z.string().trim().regex(/^\d{0,6}$/).optional() }).parse(d))
  .handler(async ({ data }) => {
    const { verifyToken } = await import("@/lib/dbAuth.server");
    const claims = verifyToken(data.token);
    if (!claims) return { ok: false as const, error: "Sesión inválida" };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin.from("instructors").select("discord_id").eq("id", claims.id).maybeSingle();
    if (!row?.discord_id) return { ok: false as const, error: "Tu cuenta no tiene Discord vinculado" };
    try {
      const guilds = (await discord("users/@me/guilds?limit=200")) as { id: string }[];
      let done = 0;
      for (const g of guilds) {
        try {
          const m = await discord(`guilds/${g.id}/members/${row.discord_id}`);
          const actual: string = m?.nick || m?.user?.global_name || m?.user?.username || "";
          const tag = actual.match(/^\s*(\[[^\]]+\])/)?.[1];
          const base = data.nick.replace(/^\s*\[[^\]]+\]\s*/, "").replace(/\s*#\d+\s*$/, "");
          const suf = data.placa ? ` #${data.placa}` : "";
          const nick = `${tag ? `${tag} ` : ""}${base.slice(0, 32 - suf.length - (tag ? tag.length + 1 : 0))}${suf}`;
          await discord(`guilds/${g.id}/members/${row.discord_id}`, { method: "PATCH", body: JSON.stringify({ nick }) });
          done++;
        } catch { /* no está en ese servidor o falta permiso */ }
      }
      if (!done) return { ok: false as const, error: "El bot no pudo cambiar tu apodo (necesita 'Gestionar apodos' y un rol más alto que el tuyo; al dueño del servidor no se le puede cambiar)" };
      return { ok: true as const };
    } catch {
      return { ok: false as const, error: "No se pudo contactar a Discord" };
    }
  });

type DRole = { id: string; name: string; color: number; position: number; managed: boolean };

async function authed(token: string) {
  const { verifyToken, freshClaims } = await import("@/lib/dbAuth.server");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const claims = await freshClaims(verifyToken(token), supabaseAdmin as any);
  return { claims, supabaseAdmin };
}

/** Busca al miembro en los servidores del bot y devuelve servidor, miembro y roles asignables. */
async function memberContext(discordId: string) {
  const guilds = (await discord("users/@me/guilds?limit=200")) as { id: string }[];
  for (const g of guilds) {
    try {
      const m = await discord(`guilds/${g.id}/members/${discordId}`);
      const roles = (await discord(`guilds/${g.id}/roles`)) as DRole[];
      const me = await discord(`users/@me`);
      const botM = await discord(`guilds/${g.id}/members/${me.id}`);
      const botTop = Math.max(0, ...roles.filter(r => botM.roles.includes(r.id)).map(r => r.position));
      return { guildId: g.id, member: m, roles, botTop };
    } catch { /* no está en ese servidor */ }
  }
  return null;
}

const fmtRole = (r: DRole, botTop: number) => ({
  id: r.id, name: r.name, color: r.color ? `#${r.color.toString(16).padStart(6, "0")}` : null,
  editable: !r.managed && r.position < botTop && r.name !== "@everyone",
});

/** Lee el perfil de Discord: sincroniza el nombre (sin [TAG]) hacia la web y devuelve los roles. */
export const getDiscordInfo = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: z.string().max(4096), targetId: z.string().max(40).optional() }).parse(d))
  .handler(async ({ data }) => {
    const { claims, supabaseAdmin } = await authed(data.token);
    if (!claims) return { ok: false as const, error: "Sesión inválida" };
    const target = data.targetId ?? claims.id;
    if (target !== claims.id && !claims.alto) return { ok: false as const, error: "Sin permiso" };
    const { data: row } = await supabaseAdmin.from("instructors").select("name, discord_id, placa, sync_avatar, avatar_url").eq("id", target).maybeSingle();
    if (!row?.discord_id) return { ok: false as const, error: "Sin Discord vinculado" };
    try {
      const ctx = await memberContext(row.discord_id);
      if (!ctx) return { ok: false as const, error: "No está en el servidor de Discord" };
      const raw: string = ctx.member.nick || ctx.member.user?.global_name || ctx.member.user?.username || "";
      const sinTag = raw.replace(/^\s*\[[^\]]+\]\s*/, "");
      const placa = sinTag.match(/#(\d+)\s*$/)?.[1] ?? null;
      const limpio = sinTag.replace(/\s*#\d+\s*$/, "").trim().slice(0, 60);
      const u = ctx.member.user;
      const avatar = ctx.member.avatar
        ? `https://cdn.discordapp.com/guilds/${ctx.guildId}/users/${u.id}/avatars/${ctx.member.avatar}.png?size=512`
        : u?.avatar ? `https://cdn.discordapp.com/avatars/${u.id}/${u.avatar}.png?size=512` : null;
      let name = row.name as string;
      const patch: Record<string, unknown> = {};
      if (limpio && limpio !== name) { patch.name = limpio; name = limpio; }
      if (placa !== row.placa) patch.placa = placa;
      if (row.sync_avatar && avatar && avatar !== row.avatar_url) patch.avatar_url = avatar;
      if (Object.keys(patch).length) await supabaseAdmin.from("instructors").update(patch).eq("id", target);
      const all = ctx.roles.filter(r => r.name !== "@everyone").sort((a, b) => b.position - a.position);
      return {
        ok: true as const, name, placa, avatar_url: (patch.avatar_url as string | undefined) ?? row.avatar_url,
        roles: all.filter(r => ctx.member.roles.includes(r.id)).map(r => fmtRole(r, ctx.botTop)),
        allRoles: claims.alto ? all.map(r => fmtRole(r, ctx.botTop)) : [],
      };
    } catch {
      return { ok: false as const, error: "No se pudo contactar a Discord" };
    }
  });

/** Alto Mando: da o quita un rol de Discord a un usuario. */
export const setDiscordRole = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({
    token: z.string().max(4096), targetId: z.string().max(40), roleId: z.string().regex(/^\d+$/), add: z.boolean(),
  }).parse(d))
  .handler(async ({ data }) => {
    const { claims, supabaseAdmin } = await authed(data.token);
    if (!claims?.alto) return { ok: false as const, error: "Solo Alto Mando" };
    const { data: row } = await supabaseAdmin.from("instructors").select("discord_id, name").eq("id", data.targetId).maybeSingle();
    if (!row?.discord_id) return { ok: false as const, error: "Sin Discord vinculado" };
    try {
      const ctx = await memberContext(row.discord_id);
      const role = ctx?.roles.find(r => r.id === data.roleId);
      if (!ctx || !role || !fmtRole(role, ctx.botTop).editable) return { ok: false as const, error: "El bot no puede gestionar ese rol" };
      await discord(`guilds/${ctx.guildId}/members/${row.discord_id}/roles/${data.roleId}`, { method: data.add ? "PUT" : "DELETE" });
      await supabaseAdmin.from("logs").insert({
        instructor_id: claims.id, instructor_name: claims.name, action: data.add ? "DISCORD_ROL_DADO" : "DISCORD_ROL_QUITADO",
        details: { usuario: row.name, rol: role.name },
      });
      return { ok: true as const };
    } catch {
      return { ok: false as const, error: "Discord rechazó el cambio (revisá que el bot tenga 'Gestionar roles')" };
    }
  });

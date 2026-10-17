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

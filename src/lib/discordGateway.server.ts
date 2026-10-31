import { FACTION_GUILD_ID, membershipDisabled } from "./discordMembership";
import { rangoFromTag } from "./rangos";

export async function discord(path: string, init?: RequestInit) {
  const lovable = process.env["LOVABLE_API_KEY"];
  const key = process.env["DISCORD_API_KEY"];
  if (!lovable || !key) throw new Error("El bot de Discord no está configurado");
  const res = await fetch(`https://connector-gateway.lovable.dev/discord/${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${lovable}`, "X-Connection-Api-Key": key, "Content-Type": "application/json" },
  });
  // Only an actual missing-member response establishes that the member left.
  if (res.status === 404 && /^guilds\/\d+\/members\/\d+$/.test(path)) return null;
  if (!res.ok) throw new Error("No se pudo verificar Discord. Intentá nuevamente en unos momentos.");
  return res.status === 204 ? null : res.json();
}

export async function factionMember(discordId: string | null | undefined) {
  if (!discordId) return null;
  return discord(`guilds/${FACTION_GUILD_ID}/members/${discordId}`);
}

export async function checkInstructorMembership(row: { id: string; discord_id?: string | null }, admin: { from: (table: string) => any }) {
  const member = await factionMember(row.discord_id);
  const disabled = membershipDisabled(member, row.discord_id);
  const { error } = await admin.from("instructors").update({
    discord_inhabilitado: disabled, discord_checked_at: new Date().toISOString(),
  }).eq("id", row.id);
  if (error) throw new Error("No se pudo actualizar el estado de la cuenta");
  return !disabled;
}

type GuildMember = {
  user?: { id: string; username: string; global_name?: string | null; avatar?: string | null; bot?: boolean };
  nick?: string | null;
  avatar?: string | null;
  roles?: string[];
  joined_at?: string;
};

const SCAN_KEY = "guild_scan_at";
const SCAN_INTERVAL = 10 * 60_000;

function nickParts(m: GuildMember) {
  const raw = m.nick || m.user?.global_name || m.user?.username || "";
  const tag = raw.match(/^\s*(\[[A-Za-z]{3}\])/)?.[1] ?? null;
  const sinTag = raw.replace(/^\s*\[[^\]]+\]\s*\|?\s*/, "");
  const placa = sinTag.match(/#(\d+)\s*$/)?.[1] ?? null;
  // Discord nicknames sometimes use "|" as a visual separator, not as part of the name.
  const name = sinTag.replace(/\s*#\d+\s*$/, "").replace(/^\s*\|\s*/, "").replace(/\s*\|\s*$/, "").trim().slice(0, 60);
  return { tag, placa, name };
}

function normalizeRoleName(roleName: string): string {
  return roleName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function buildNick(tag: string | null, name: string, placa: string | null) {
  const suf = ` #${placa ?? "0000"}`;
  const pre = tag ? `${tag} ` : "";
  return `${pre}${name.slice(0, 32 - suf.length - pre.length)}${suf}`;
}

/**
 * Escanea el servidor de Discord: a todo miembro con el rol "Policia" sin
 * usuario en la web le crea uno (rol Usuario, sin apartados) y le ajusta el
 * apodo a [TAG]Nombre #placa. Limitado a una pasada cada 10 minutos.
 */
export async function syncGuildPolice(admin: { from: (table: string) => any }, options: { force?: boolean } = {}) {
  try {
    const { data: marker, error: markerReadError } = await admin.from("app_settings").select("value").eq("key", SCAN_KEY).maybeSingle();
    if (markerReadError) throw new Error("No se pudo comprobar el intervalo de sincronización de Discord");
    if (!options.force && marker?.value && Date.now() - new Date(marker.value).getTime() < SCAN_INTERVAL) return null;
    const { error: markerWriteError } = await admin.from("app_settings").upsert({ key: SCAN_KEY, value: new Date().toISOString() });
    // Fail closed: if the rate-limit marker cannot be persisted, do not start
    // a potentially expensive scan that could be repeated on every request.
    if (markerWriteError) throw new Error("No se pudo reservar la sincronización de Discord");

    const roles = (await discord(`guilds/${FACTION_GUILD_ID}/roles`)) as { id: string; name: string }[];
    const policeRole = roles.find(r => r.name.toLowerCase().includes("polic"));
    if (!policeRole) return null;

    const instructorRole = roles.find(r => normalizeRoleName(r.name) === "equipodeinstructores");
    if (!instructorRole) throw new Error("No se encontró el rol @Equipo de instructores en Discord. No se modificaron los estados de Instructor.");

    const members: GuildMember[] = [];
    for (let after = "0";;) {
      const page = (await discord(`guilds/${FACTION_GUILD_ID}/members?limit=1000&after=${after}`)) as GuildMember[];
      // A malformed or interrupted page must never be treated as a complete
      // guild snapshot; otherwise a forced sync could report success on partial data.
      if (!Array.isArray(page)) throw new Error("Discord devolvió una página de miembros inválida");
      if (!page.length) break;
      if (page.some(member => !member.user?.id)) {
        throw new Error("Discord devolvió miembros sin ID; se canceló la sincronización");
      }
      members.push(...page);
      if (page.length < 1000) break;
      after = page[page.length - 1].user!.id;
      // The safety cap is intentional, but reaching it must not silently
      // process only the first 5,000 members and claim a complete sync.
      if (members.length >= 5000) {
        const nextPage = (await discord(`guilds/${FACTION_GUILD_ID}/members?limit=1000&after=${after}`)) as GuildMember[];
        if (!Array.isArray(nextPage)) throw new Error("No se pudo confirmar el final del listado de Discord");
        if (nextPage.length) throw new Error("El servidor supera el límite seguro de 5.000 miembros; no se aplicaron cambios parciales");
        break;
      }
    }

    const police = members.filter(m => !m.user?.bot && m.user?.id && m.roles?.includes(policeRole.id));
    const { data: existing, error: existingError } = await admin.from("instructors").select("id, name, tag, avatar_url, discord_id, discord_username, placa");
    // Never create accounts from an incomplete snapshot: without this check a
    // transient database read failure could make every police member look new.
    if (existingError || !existing) throw new Error("No se pudo consultar el personal existente antes de sincronizar Discord");
    const byDiscord = new Map(existing.filter((r: any) => r.discord_id).map((r: any) => [r.discord_id, r]));

    let created = 0, renamed = 0, datesUpdated = 0;
    for (const m of police) {
      const { tag, placa, name } = nickParts(m);
      if (!name) continue;
      let row = byDiscord.get(m.user!.id) as any;
      if (!row) {
        const { randomBytes } = await import("crypto");
        const id = `DC-${randomBytes(4).toString("hex").toUpperCase()}`;
        const ins = await admin.from("instructors").insert({
          id, name, role: "Usuario", discord_id: m.user!.id, discord_username: m.user!.username,
          secciones: [], created_by: "Auto Discord", placa,
        }).select("id, name, discord_id, placa").single();
        if (ins.error || !ins.data) continue;
        row = ins.data;
        byDiscord.set(m.user!.id, row);
        created++;
        await admin.from("logs").insert({ instructor_id: id, instructor_name: name, action: "REGISTRO_AUTO_DISCORD", details: { discord: m.user!.username } });
      }
      // Discord is the source of truth for tag, display name, username and avatar.
      const oldName = String(row.name ?? "").trim();
      const discordName = name.trim();
      const avatar = m.avatar ? "https://cdn.discordapp.com/guilds/" + FACTION_GUILD_ID + "/users/" + m.user!.id + "/avatars/" + m.avatar + ".png?size=512" : m.user?.avatar ? "https://cdn.discordapp.com/avatars/" + m.user.id + "/" + m.user.avatar + ".png?size=512" : null;
      const profilePatch: Record<string, string | null> = {};
      if (discordName && discordName !== oldName) profilePatch.name = discordName;
      if (tag !== (row.tag ?? null)) profilePatch.tag = tag;
      if (m.user!.username !== row.discord_username) profilePatch.discord_username = m.user!.username;
      if (avatar && avatar !== row.avatar_url) profilePatch.avatar_url = avatar;
      if (Object.keys(profilePatch).length) {
        const { error: profileError } = await admin.from("instructors").update(profilePatch).eq("id", row.id);
        if (profileError) throw new Error("No se pudo sincronizar el perfil desde Discord");
      }
      // Los nombres solo sirven como vínculo de compatibilidad mientras existan fichas
      // antiguas sin instructor_id. Nunca actualizar por nombre si hay homónimos.
      const normalizedOldName = oldName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[|_]+/g, " ").replace(/\s+/g, " ").trim().toLocaleLowerCase("es");
      const sameNameInstructors = existing.filter((item: any) =>
        String(item.name ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
          .replace(/[|_]+/g, " ").replace(/\s+/g, " ").trim().toLocaleLowerCase("es") === normalizedOldName
      );
      const legacyNameIsUnique = !!normalizedOldName && sameNameInstructors.length === 1;

      if (discordName && discordName !== oldName) {
        // Update the stable linked PD row first; legacy rows are handled only
        // when the old name identifies exactly one instructor.
        const { error: linkedRenameError } = await admin.from("pd_members")
          .update({ nombre: discordName }).eq("instructor_id", row.id);
        if (linkedRenameError) throw new Error("No se pudo actualizar el nombre en Registro PD");
        if (legacyNameIsUnique) {
          const { data: legacyRows, error: legacyReadError } = await admin.from("pd_members")
            .select("id").is("instructor_id", null).eq("nombre", oldName);
          if (legacyReadError) throw new Error("No se pudo comprobar el registro anterior de PD");
          // Link only a single unambiguous legacy row; never bulk-claim homonyms.
          if (legacyRows?.length === 1) {
            const { error: legacyRenameError } = await admin.from("pd_members")
              .update({ nombre: discordName, instructor_id: row.id }).eq("id", legacyRows[0].id);
            if (legacyRenameError) throw new Error("No se pudo vincular el registro anterior de PD");
          }
        }
        // Salary entries still lack instructor_id. Keep historical names intact
        // until a stable foreign key can be introduced and backfilled safely.
        row.name = discordName;
        renamed++;
      }

      // El rango se determina por la etiqueta; Instructor, por el rol específico de Discord.
      const rangoDiscord = rangoFromTag(tag);
      const esInstructorDiscord = Boolean(instructorRole && m.roles?.includes(instructorRole.id));
      const pdPatch: Record<string, unknown> = { es_instructor: esInstructorDiscord };
      if (rangoDiscord) pdPatch.rango = rangoDiscord;
      const { error: linkedPdError } = await admin.from("pd_members").update(pdPatch).eq("instructor_id", row.id);
      if (linkedPdError) throw new Error("No se pudo sincronizar el rango/estado de Instructor en Registro PD");
      if (legacyNameIsUnique && oldName) {
        const { error: legacyPdError } = await admin.from("pd_members").update(pdPatch)
          .is("instructor_id", null).eq("nombre", oldName);
        if (legacyPdError) throw new Error("No se pudo sincronizar el registro anterior de PD");
      }
      row.tag = tag;
      row.discord_username = m.user!.username;
      row.avatar_url = avatar ?? row.avatar_url;
      if (m.joined_at) {
        const { error: dateError } = await admin.from("instructors").update({ discord_joined_at: m.joined_at }).eq("id", row.id);
        if (dateError) {
          if (options.force) throw new Error("No se pudieron guardar las fechas de ingreso de Discord. Verificá que esté aplicada la migración discord_joined_at en Supabase.");
        } else {
          datesUpdated++;
        }
      }
      const want = buildNick(tag, row.name, row.placa ?? placa);
      const current = m.nick || "";
      if (current !== want) {
        try {
          await discord(`guilds/${FACTION_GUILD_ID}/members/${m.user!.id}`, { method: "PATCH", body: JSON.stringify({ nick: want }) });
        } catch { /* sin permiso para ese miembro (dueño, rol más alto) */ }
      }
    }
    return { created, renamed, datesUpdated, total: police.length };
  } catch (e) {
    console.error("syncGuildPolice", e);
    if (options.force) throw e;
    return null;
  }
}
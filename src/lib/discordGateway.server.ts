import { FACTION_GUILD_ID, membershipDisabled } from "./discordMembership";

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
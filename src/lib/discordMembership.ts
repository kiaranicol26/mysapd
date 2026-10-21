export const FACTION_GUILD_ID = "1522748316243202190";
export const REGISTRATION_MEMBERSHIP_ERROR = "No formas parte de la Policia o no te encuentras en el Discord";
export const LOGIN_MEMBERSHIP_ERROR = "Tu usuario está inhabilitado o no te encuentras en el Discord de la facción";

export function membershipDisabled(member: { user?: { id?: string; bot?: boolean } } | null, discordId: string | null | undefined): boolean {
  return !discordId || !member?.user?.id || member.user.id !== discordId || !!member.user.bot;
}
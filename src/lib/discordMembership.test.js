import { expect, test } from "bun:test";
import { FACTION_GUILD_ID, membershipDisabled } from "./discordMembership";
import { checkInstructorMembership } from "./discordGateway.server";

test("registration and login are restricted to the requested faction server", () => {
  expect(FACTION_GUILD_ID).toBe("1522748316243202190");
});
test("a faction member can access the app", () => {
  expect(membershipDisabled({ user: { id: "123" } }, "123")).toBe(false);
});
test("a registered member who left is disabled", () => {
  expect(membershipDisabled(null, "123")).toBe(true);
});
test("an unlinked legacy account cannot bypass membership", () => {
  expect(membershipDisabled(null, null)).toBe(true);
});
test("a different Discord identity cannot satisfy membership", () => {
  expect(membershipDisabled({ user: { id: "456" } }, "123")).toBe(true);
});
test("unlinked accounts persist disabled status", async () => {
  let patch;
  const admin = { from: () => ({ update: v => { patch = v; return { eq: async () => ({ error: null }) }; } }) };
  expect(await checkInstructorMembership({ id: "old", discord_id: null }, admin)).toBe(false);
  expect(patch.discord_inhabilitado).toBe(true);
});
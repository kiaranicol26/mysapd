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
test("rejoining the faction restores access; provider outages never disable the account", async () => {
  const originalFetch = globalThis.fetch;
  const previousKey = process.env.DISCORD_API_KEY;
  const previousGateway = process.env.LOVABLE_API_KEY;
  process.env.DISCORD_API_KEY = "test";
  process.env.LOVABLE_API_KEY = "test";
  let patch;
  const admin = { from: () => ({ update: v => { patch = v; return { eq: async () => ({ error: null }) }; } }) };
  try {
    globalThis.fetch = async () => Response.json({ user: { id: "123" } });
    expect(await checkInstructorMembership({ id: "returning", discord_id: "123" }, admin)).toBe(true);
    expect(patch.discord_inhabilitado).toBe(false);
    patch = undefined;
    globalThis.fetch = async () => new Response("", { status: 429 });
    await expect(checkInstructorMembership({ id: "returning", discord_id: "123" }, admin)).rejects.toThrow();
    expect(patch).toBeUndefined();
  } finally {
    globalThis.fetch = originalFetch;
    if (previousKey === undefined) delete process.env.DISCORD_API_KEY; else process.env.DISCORD_API_KEY = previousKey;
    if (previousGateway === undefined) delete process.env.LOVABLE_API_KEY; else process.env.LOVABLE_API_KEY = previousGateway;
  }
});
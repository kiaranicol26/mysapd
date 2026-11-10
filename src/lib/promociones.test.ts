import { describe, expect, it } from "bun:test";
import {
  DEFAULT_PROMOTION_ROLE_CONFIG,
  formatRankIdLines,
  parsePromotionAnnouncement,
  parsePromotionRoleConfig,
  parseRankIdLines,
} from "./promociones";

describe("bulk promotion announcement parser", () => {
  it("reads Discord user mentions and external role mentions", () => {
    const raw = [
      "( <@&890703793321283625> ) El **Teniente** <@1283191049874833458> asciende a <@&890703788539801600>",
      "( <@&890703793321283625> ) El **Sargento** <@609887467574919211> asciende a <@&890703789340913675>",
      "🚨 **¡Felicidades!** ⭐",
    ].join("\n");

    const result = parsePromotionAnnouncement(raw);

    expect(result.promotions).toHaveLength(2);
    expect(result.promotions[0]).toMatchObject({
      discordId: "1283191049874833458",
      previousRankText: "Teniente",
      newRank: "Capitan",
    });
    expect(result.promotions[1]).toMatchObject({
      discordId: "609887467574919211",
      previousRankText: "Sargento",
      newRank: "Teniente",
    });
    expect(result.issues).toHaveLength(0);
  });

  it("accepts adjacent bold text and mention syntax without spaces", () => {
    const result = parsePromotionAnnouncement(
      "<@&890703793321283625> El **Cadete **<@1044682951927017482> asciende a <@&890703791232528404>",
    );

    expect(result.promotions).toHaveLength(1);
    expect(result.promotions[0].newRank).toBe("Cabo");
  });

  it("rejects duplicate police and non-promotion changes", () => {
    const result = parsePromotionAnnouncement([
      "El **Teniente** <@1283191049874833458> asciende a <@&890703788539801600>",
      "El **Teniente** <@1283191049874833458> asciende a <@&890703788539801600>",
      "El **Comisario** <@609887467574919211> asciende a <@&890703787717722122>",
    ].join("\n"));

    expect(result.promotions).toHaveLength(1);
    expect(result.issues).toHaveLength(2);
  });
});

describe("promotion role mappings", () => {
  it("round-trips all nine ranks", () => {
    const externalByRank = Object.fromEntries(
      Object.entries(DEFAULT_PROMOTION_ROLE_CONFIG.external).map(([id, rank]) => [rank, id]),
    );
    const external = Object.fromEntries(
      Object.entries(externalByRank).map(([rank, id]) => [id, rank]),
    );
    const config = { external, faction: DEFAULT_PROMOTION_ROLE_CONFIG.faction };
    const loaded = parsePromotionRoleConfig(JSON.stringify(config));

    expect(Object.keys(loaded.external)).toHaveLength(9);
    expect(Object.keys(loaded.faction)).toHaveLength(9);
  });

  it("validates editable rank-to-role text", () => {
    const text = formatRankIdLines(DEFAULT_PROMOTION_ROLE_CONFIG.faction);
    expect(parseRankIdLines(text)).toEqual(DEFAULT_PROMOTION_ROLE_CONFIG.faction);
  });
});

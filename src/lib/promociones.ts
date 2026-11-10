export const EXTERNAL_RANK_ROLE_IDS = {
  "890703786883026984": "Comisario",
  "890703787717722122": "Inspector",
  "890703788539801600": "Capitan",
  "890703789340913675": "Teniente",
  "890703790423035905": "Sargento",
  "890703791232528404": "Cabo",
  "890703791958159390": "Oficial",
  "890703792650215477": "Cadete",
  "1005337954270580837": "Aspirante",
} as const;

export type PoliceRank = (typeof EXTERNAL_RANK_ROLE_IDS)[keyof typeof EXTERNAL_RANK_ROLE_IDS];

export const FACTION_RANK_ROLE_IDS: Record<PoliceRank, string> = {
  Comisario: "1567296322321522748",
  Inspector: "1567296325815378101",
  Capitan: "1567296330571841596",
  Teniente: "1567296335298695299",
  Sargento: "1567296338540888187",
  Cabo: "1567296341674041404",
  Oficial: "1567296344530616411",
  Cadete: "1567296347508572260",
  Aspirante: "1522748316243202192",
};

export type ParsedPromotion = {
  discordId: string;
  previousRankText: string;
  externalRoleId: string;
  newRank: PoliceRank;
  line: number;
};

const normalizeRank = (value: string) =>
  value.normalize("NFD").replace(/[\\u0300-\\u036f]/g, "").trim().toLowerCase();

const RANK_ALIASES: Record<string, PoliceRank> = {
  comisario: "Comisario",
  inspector: "Inspector",
  capitan: "Capitan",
  teniente: "Teniente",
  sargento: "Sargento",
  cabo: "Cabo",
  oficial: "Oficial",
  cadete: "Cadete",
  aspirante: "Aspirante",
};

export function parsePromotionAnnouncement(raw: string) {
  const promotions: ParsedPromotion[] = [];
  const issues: { line: number; text: string; reason: string }[] = [];
  const seen = new Set<string>();
  const lines = raw.split(/\\r?\\n/);

  lines.forEach((text, index) => {
    if (!/asciende\\s+a/i.test(text)) return;
    const match = text.match(/(?:El|La)\\s+\\*\\*([^*]+)\\*\\*\\s*<@!?([0-9]{17,20})>\\s+asciende\\s+a\\s+<@&([0-9]{17,20})>/i);
    if (!match) {
      issues.push({ line: index + 1, text: text.trim(), reason: "No se pudo interpretar la línea. Revisá el formato de menciones." });
      return;
    }

    const [, previousRankText, discordId, externalRoleId] = match;
    const newRank = EXTERNAL_RANK_ROLE_IDS[externalRoleId as keyof typeof EXTERNAL_RANK_ROLE_IDS];
    if (!newRank) {
      issues.push({ line: index + 1, text: text.trim(), reason: "El rol de destino no pertenece a la equivalencia de rangos configurada." });
      return;
    }
    if (seen.has(discordId)) {
      issues.push({ line: index + 1, text: text.trim(), reason: "El mismo policía aparece más de una vez en el comunicado." });
      return;
    }
    seen.add(discordId);
    promotions.push({ discordId, previousRankText: previousRankText.trim(), externalRoleId, newRank, line: index + 1 });
  });

  return { promotions, issues };
}

export function rankTextMatches(actual: string | null | undefined, announced: string) {
  const expected = RANK_ALIASES[normalizeRank(announced)];
  return !!expected && normalizeRank(actual ?? "") === normalizeRank(expected);
}

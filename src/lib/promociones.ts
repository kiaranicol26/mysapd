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

export const POLICE_RANK_ORDER: PoliceRank[] = ["Comisario", "Inspector", "Capitan", "Teniente", "Sargento", "Cabo", "Oficial", "Cadete", "Aspirante"];

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

export type PromotionRoleConfig = {
  external: Record<string, PoliceRank>;
  faction: Record<PoliceRank, string>;
};

export const DEFAULT_PROMOTION_ROLE_CONFIG: PromotionRoleConfig = {
  external: { ...EXTERNAL_RANK_ROLE_IDS },
  faction: { ...FACTION_RANK_ROLE_IDS },
};

export type ParsedPromotion = {
  discordId: string;
  previousRankText: string;
  externalRoleId: string;
  newRank: PoliceRank;
  line: number;
};

const normalizeRank = (value: string) =>
  value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();

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

export function parseRankIdLines(text: string): Record<PoliceRank, string> {
  const result: Partial<Record<PoliceRank, string>> = {};
  const ids = new Set<string>();
  for (const [index, line] of text.split(/\r?\n/).entries()) {
    if (!line.trim()) continue;
    const match = line.match(/^\s*([^=]+?)\s*=\s*([0-9]{17,20})\s*$/);
    if (!match) throw new Error(\`Línea \${index + 1}: usá el formato Rango=ID_DEL_ROL.\`);
    const rank = RANK_ALIASES[normalizeRank(match[1])];
    if (!rank) throw new Error(\`Línea \${index + 1}: rango desconocido "\${match[1]}".\`);
    if (result[rank]) throw new Error(\`El rango \${rank} está repetido.\`);
    if (ids.has(match[2])) throw new Error(\`El ID \${match[2]} está repetido.\`);
    result[rank] = match[2];
    ids.add(match[2]);
  }
  const missing = POLICE_RANK_ORDER.filter(rank => !result[rank]);
  if (missing.length) throw new Error(\`Faltan rangos: \${missing.join(", ")}.\`);
  return result as Record<PoliceRank, string>;
}

export function formatRankIdLines(byRank: Record<PoliceRank, string>) {
  return POLICE_RANK_ORDER.map(rank => \`\${rank}=\${byRank[rank]}\`).join("\n");
}

export function parsePromotionRoleConfig(raw: string | null | undefined): PromotionRoleConfig {
  if (!raw?.trim()) return DEFAULT_PROMOTION_ROLE_CONFIG;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("La configuración de equivalencias de rangos no contiene JSON válido.");
  }
  if (!parsed || typeof parsed !== "object") throw new Error("La configuración de equivalencias de rangos está incompleta.");
  const value = parsed as { external?: unknown; faction?: unknown };
  if (!value.external || typeof value.external !== "object" || !value.faction || typeof value.faction !== "object") {
    throw new Error("La configuración debe incluir los mapas external y faction.");
  }

  const external = value.external as Record<string, unknown>;
  const faction = value.faction as Record<string, unknown>;
  const externalByRank: Partial<Record<PoliceRank, string>> = {};
  const externalMap: Record<string, PoliceRank> = {};
  for (const [roleId, rankValue] of Object.entries(external)) {
    const rank = typeof rankValue === "string" ? RANK_ALIASES[normalizeRank(rankValue)] : undefined;
    if (!/^[0-9]{17,20}$/.test(roleId) || !rank || externalMap[roleId]) {
      throw new Error("La equivalencia de roles externos contiene un ID o rango inválido.");
    }
    if (externalByRank[rank]) throw new Error(\`El rango \${rank} está repetido en los roles externos.\`);
    externalMap[roleId] = rank;
    externalByRank[rank] = roleId;
  }
  const factionMap = {} as Record<PoliceRank, string>;
  const seenFactionIds = new Set<string>();
  for (const rank of POLICE_RANK_ORDER) {
    const roleId = faction[rank];
    if (typeof roleId !== "string" || !/^[0-9]{17,20}$/.test(roleId) || seenFactionIds.has(roleId)) {
      throw new Error(\`Falta un ID válido o hay duplicados para el rango \${rank} en Westzone PD.\`);
    }
    factionMap[rank] = roleId;
    seenFactionIds.add(roleId);
  }
  const missingExternal = POLICE_RANK_ORDER.filter(rank => !externalByRank[rank]);
  if (missingExternal.length) throw new Error(\`Faltan equivalencias externas: \${missingExternal.join(", ")}.\`);
  return { external: externalMap, faction: factionMap };
}

export function parsePromotionAnnouncement(
  raw: string,
  externalRoleMap: Record<string, PoliceRank> = DEFAULT_PROMOTION_ROLE_CONFIG.external,
) {
  const promotions: ParsedPromotion[] = [];
  const issues: { line: number; text: string; reason: string }[] = [];
  const seen = new Set<string>();
  const lines = raw.split(/\r?\n/);

  lines.forEach((text, index) => {
    if (!/asciende\s+a/i.test(text)) return;
    const match = text.match(/(?:El|La)\s+\*\*([^*]+)\*\*\s*<@!?([0-9]{17,20})>\s+asciende\s+a\s+<@&([0-9]{17,20})>/i);
    if (!match) {
      issues.push({ line: index + 1, text: text.trim(), reason: "No se pudo interpretar la línea. Revisá el formato de menciones." });
      return;
    }

    const [, previousRankText, discordId, externalRoleId] = match;
    const newRank = externalRoleMap[externalRoleId];
    if (!newRank) {
      issues.push({ line: index + 1, text: text.trim(), reason: "El rol de destino no pertenece a la equivalencia de rangos configurada." });
      return;
    }
    const previousRank = RANK_ALIASES[normalizeRank(previousRankText)];
    if (!previousRank || POLICE_RANK_ORDER.indexOf(newRank) >= POLICE_RANK_ORDER.indexOf(previousRank)) {
      issues.push({ line: index + 1, text: text.trim(), reason: "El rango de destino no es superior al rango anterior indicado; no se aplicó como ascenso." });
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

export function policeRankOrder(value: string | null | undefined) {
  if (!value) return -1;
  const normalized = normalizeRank(value);
  const rank = RANK_ALIASES[normalized];
  return rank ? POLICE_RANK_ORDER.indexOf(rank) : -1;
}

export function rankTextMatches(actual: string | null | undefined, announced: string) {
  const expected = RANK_ALIASES[normalizeRank(announced)];
  return !!expected && normalizeRank(actual ?? "") === normalizeRank(expected);
}

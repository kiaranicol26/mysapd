export const TAG_RANGOS: Record<string, string> = {
  CMS: "Comisario",
  CPT: "Capitan",
  TTE: "Teniente",
  SGT: "Sargento",
  CBO: "Cabo",
  OFC: "Oficial",
  CDT: "Cadete",
  ASP: "Aspirante",
};

export function rangoFromTag(tag?: string | null): string | null {
  if (!tag) return null;
  return TAG_RANGOS[tag.replace(/^\[|\]$/g, "").toUpperCase()] ?? null;
}

export const RANGOS = [
  "Comisario",
  "Capitan",
  "Teniente",
  "Sargento",
  "Cabo",
  "Oficial",
  "Cadete",
  "Aspirante",
] as const;

/** Plural headings used as separators in the Registro de Policías. */
export const RANGO_PLURAL: Record<string, string> = {
  Comisario: "Comisarios",
  Capitan: "Capitanes",
  Teniente: "Tenientes",
  Sargento: "Sargentos",
  Cabo: "Cabos",
  Oficial: "Oficiales",
  Cadete: "Cadetes",
  Aspirante: "Aspirantes",
};

export const DIVISIONES = [
  "Ninguna",
  "SWAT",
  "Relaciones Publicas",
  "N/A",
  "N/A",
  "N/A",
] as const;

export const DIVISION_RANGOS = [
  "Lider",
  "Sub Lider",
  "Supervisor",
  "Miembro",
] as const;

export type Rango = (typeof RANGOS)[number];


const norm = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();

/** Lower index = higher rank. Unknown ranks go last. */
export function rangoOrder(rango?: string | null): number {
  if (!rango) return RANGOS.length + 1;
  const i = RANGOS.findIndex(r => norm(r) === norm(rango));
  return i === -1 ? RANGOS.length : i;
}

export function sortByRango<T>(
  items: T[],
  getRango: (x: T) => string | null | undefined,
  getName: (x: T) => string | null | undefined,
): T[] {
  return [...items].sort((a, b) => {
    const d = rangoOrder(getRango(a)) - rangoOrder(getRango(b));
    if (d !== 0) return d;
    return (getName(a) ?? "").localeCompare(getName(b) ?? "");
  });
}

/** Extra pay (Coins) for agents marked as Instructor. */
export const INSTRUCTOR_BONUS = 10;

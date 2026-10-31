type LegacySalaryRow = {
  nombre: string | null;
  pd_member_id: string | null;
};

/** Normalize display names only for conservative legacy duplicate detection. */
export function normalizeSalaryName(name: string | null | undefined): string {
  return (name ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[|_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("es");
}

/**
 * A legacy row is not an identity and must never be linked automatically.
 * It only blocks auto-creation of a second row with the same displayed name.
 */
export function hasLegacySalaryEntryForName(
  name: string | null | undefined,
  rows: LegacySalaryRow[],
): boolean {
  const normalized = normalizeSalaryName(name);
  if (!normalized) return false;
  return rows.some(
    row => !row.pd_member_id && normalizeSalaryName(row.nombre) === normalized,
  );
}

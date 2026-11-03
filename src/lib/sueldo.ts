const activa = (d?: string | null) => !!d && d !== "Ninguna" && d !== "N/A";

/** Full salary: base + 10 per active division (max 2) + 10 if instructor. Same rule as Lista PD. */
export function sueldoTotal(m: { sueldo_defecto?: number | null; division?: string | null; division2?: string | null; es_instructor?: boolean | null }) {
  return (Number(m.sueldo_defecto) || 0) + (activa(m.division) ? 10 : 0) + (activa(m.division2) ? 10 : 0) + (m.es_instructor ? 10 : 0);
}

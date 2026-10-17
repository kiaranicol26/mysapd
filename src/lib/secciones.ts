export const SECCIONES = [
  { key: "exsapd", label: "Ex Policías" },
  { key: "aspirantes", label: "Aspirantes" },
  { key: "rnap", label: "R.N.A.P" },
  { key: "certificar", label: "Certificar" },
  { key: "registro", label: "Registro PD" },
  { key: "lista", label: "Lista PD" },
  { key: "forum", label: "Forum" },
] as const;

export type SeccionKey = (typeof SECCIONES)[number]["key"];

const KEYS = new Set<string>(SECCIONES.map(s => s.key));

/** Alto Mando ve todo; el resto solo las secciones habilitadas. myPerfil y Salario siempre son visibles. */
export function puedeVer(
  user: { is_alto_mando?: boolean; secciones?: readonly string[] | null } | null,
  seccion: string | undefined,
): boolean {
  if (!seccion) return !!user;
  if (!user) return false;
  if (user.is_alto_mando) return true;
  return KEYS.has(seccion) && !!user.secciones?.includes(seccion);
}

export function limpiarSecciones(list: unknown): SeccionKey[] {
  if (!Array.isArray(list)) return [];
  return [...new Set(list.filter((s): s is SeccionKey => typeof s === "string" && KEYS.has(s)))];
}

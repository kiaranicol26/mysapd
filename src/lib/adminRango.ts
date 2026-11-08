/** Rangos administrativos de mySAPD, de menor a mayor. */
export const ADMIN_RANGOS = ["usuario", "ayudante", "moderador", "administrador"] as const;
export type AdminRango = (typeof ADMIN_RANGOS)[number];

export const ADMIN_RANGO_LABELS: Record<AdminRango, string> = {
  usuario: "Usuario",
  ayudante: "Ayudante",
  moderador: "Moderador",
  administrador: "Administrador",
};

export const ADMIN_RANGO_DESC: Record<AdminRango, string> = {
  usuario: "Solo puede ver, sin editar.",
  ayudante: "Crea certificados y da capacitaciones.",
  moderador: "Gestiona el Registro de Policías (solo de rangos inferiores).",
  administrador: "Control total.",
};

export function normalizeRango(v: unknown): AdminRango {
  return (ADMIN_RANGOS as readonly string[]).includes(String(v)) ? (v as AdminRango) : "usuario";
}

export function nivel(v: unknown): number {
  return ADMIN_RANGOS.indexOf(normalizeRango(v));
}

/** Permisos efectivos derivados únicamente del rango administrativo. */
export function permisosDeRango(v: unknown) {
  const n = nivel(v);
  return {
    alto: n >= 3,
    del: n >= 3,
    rnap: n >= 1,
    files: n >= 2,
    pd: n >= 2,
    capacitaciones: n >= 1,
    puedeEditar: n >= 1,
    extraSecciones: n >= 1 ? ["certificar"] : [],
  };
}

/** Un moderador solo gestiona fichas de rango administrativo inferior al suyo. */
export function puedeGestionar(actor: unknown, objetivo: unknown): boolean {
  const a = nivel(actor);
  if (a >= 3) return true;
  return a >= 2 && nivel(objetivo) < a;
}

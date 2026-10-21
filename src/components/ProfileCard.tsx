import type { ReactNode } from "react";
import { SECCIONES } from "@/lib/secciones";
import { Check, X, UserRound } from "lucide-react";

export type ProfileUser = {
  id: string; name: string; avatar_url: string | null; role: string | null;
  descripcion?: string | null; banner_url?: string | null; color_perfil?: string | null; pronombres?: string | null;
  discord_username?: string | null; placa?: string | null; is_alto_mando?: boolean; can_delete?: boolean; can_emit_rnap?: boolean;
  can_edit_files?: boolean; can_edit_pd?: boolean; secciones?: string[] | null;
  discord_inhabilitado?: boolean;
};

const label = "text-[11px] font-extrabold uppercase tracking-widest text-muted-foreground";

/** Tarjeta de perfil estilo Discord (sin mostrar el código de acceso). */
export function ProfileCard({ u, foto, extra, footer }: { u: ProfileUser; foto?: string | null; extra?: ReactNode; footer?: ReactNode }) {
  const color = u.color_perfil || "#5865f2";
  const avatar = u.avatar_url || foto;
  const permisos = [
    { label: "Alto Mando", on: !!u.is_alto_mando },
    { label: "Borrar registros", on: !!u.can_delete },
    { label: "Emitir RNAP", on: !!u.can_emit_rnap },
    { label: "Editar archivos", on: !!u.can_edit_files },
    { label: "Editar Registro PD", on: !!u.can_edit_pd },
  ];
  const sub = [u.discord_username ? `@${u.discord_username}` : null, u.placa ? `Placa #${u.placa}` : null, u.pronombres].filter(Boolean).join(" · ");
  return (
    <div className="overflow-hidden rounded-lg border bg-card shadow-lg flex flex-col">
      <div className="h-20 bg-cover bg-center" style={{ backgroundColor: color, backgroundImage: u.banner_url ? `url(${u.banner_url})` : undefined }} />
      <div className="px-3 pb-3 flex-1">
        <div className="-mt-10 w-20 h-20 rounded-full border-[5px] border-card bg-muted overflow-hidden flex items-center justify-center">
          {avatar ? <img src={avatar} alt={u.name} className="w-full h-full object-cover" /> : <UserRound className="w-8 h-8 text-muted-foreground" />}
        </div>
        <div className="mt-2 rounded-md bg-muted/60 p-3 space-y-2">
          <div>
            <p className="text-lg font-extrabold text-foreground leading-tight">{u.name}</p>
            {u.discord_inhabilitado && <span className="inline-flex border border-destructive/30 bg-destructive/10 px-2 py-1 text-xs font-bold text-destructive">Inhabilitado</span>}
            {sub && <p className="text-sm text-muted-foreground">{sub}</p>}
          </div>
          <div className="border-t pt-2">
            <p className={label}>Rango</p>
            <p className="text-sm font-bold text-foreground">{u.is_alto_mando ? "Alto Mando" : u.role || "Usuario"}</p>
          </div>
          {extra}
          {u.descripcion && (
            <div className="border-t pt-2">
              <p className={label}>Sobre mí</p>
              <p className="text-sm text-foreground whitespace-pre-wrap">{u.descripcion}</p>
            </div>
          )}
          <div className="border-t pt-2">
            <p className={label}>Apartados</p>
            <div className="mt-1 flex flex-wrap gap-1">
              {SECCIONES.filter(s => u.is_alto_mando || u.secciones?.includes(s.key)).map(s => (
                <span key={s.key} className="rounded px-2 py-0.5 text-[11px] font-bold bg-card border text-foreground" style={{ borderColor: color }}>{s.label}</span>
              ))}
              <span className="rounded px-2 py-0.5 text-[11px] font-bold bg-card border text-foreground">myPerfil</span>
            </div>
          </div>
          <div className="border-t pt-2">
            <p className={label}>Permisos</p>
            <ul className="mt-1 space-y-0.5">
              {permisos.map(p => (
                <li key={p.label} className="flex items-center gap-2 text-sm text-foreground">
                  {p.on ? <Check className="w-4 h-4 text-emerald-500" /> : <X className="w-4 h-4 text-red-500" />} {p.label}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
      {footer}
    </div>
  );
}

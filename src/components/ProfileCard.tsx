import type { ReactNode } from "react";
import { SECCIONES } from "@/lib/secciones";
import { UserRound } from "lucide-react";

export type ProfileUser = {
  id: string; name: string; avatar_url: string | null; role: string | null;
  descripcion?: string | null; banner_url?: string | null; color_perfil?: string | null; pronombres?: string | null;
  discord_username?: string | null; placa?: string | null; is_alto_mando?: boolean; can_delete?: boolean; can_emit_rnap?: boolean;
  can_edit_files?: boolean; can_edit_pd?: boolean; can_edit_capacitaciones?: boolean; secciones?: string[] | null;
  discord_inhabilitado?: boolean;
};

const label = "text-[11px] font-extrabold uppercase tracking-widest text-muted-foreground";

/** Tarjeta de perfil estilo Discord (sin mostrar el código de acceso). */
export function ProfileCard({ u, foto, extra, footer }: { u: ProfileUser; foto?: string | null; extra?: ReactNode; footer?: ReactNode }) {
  const color = u.color_perfil || "#5865f2";
  const avatar = u.avatar_url || foto;
  const permisos = [
    { label: "Administrador", on: !!u.is_alto_mando },
    { label: "Borrar registros", on: !!u.can_delete },
    { label: "Emitir RNAP", on: !!u.can_emit_rnap },
    { label: "Editar archivos", on: !!u.can_edit_files },
    { label: "Editar Registro PD", on: !!u.can_edit_pd },
    { label: "Dar capacitaciones", on: !!u.can_edit_capacitaciones },
  ].filter(p => p.on);
  const apartados = SECCIONES.filter(s => u.is_alto_mando || u.secciones?.includes(s.key));
  const sub = [u.discord_username ? `@${u.discord_username}` : null, u.placa ? `Placa #${u.placa}` : null, u.pronombres].filter(Boolean).join(" · ");
  return (
    <div className="overflow-hidden rounded-md border bg-card shadow-sm flex flex-col">
      <div className="h-14 bg-cover bg-center" style={{ backgroundColor: color, backgroundImage: u.banner_url ? `url(${u.banner_url})` : undefined }} />
      <div className="px-3 pb-2 flex-1">
        <div className="-mt-8 w-16 h-16 rounded-full border-4 border-card bg-muted overflow-hidden flex items-center justify-center">
          {avatar ? <img src={avatar} alt={u.name} loading="lazy" decoding="async" className="w-full h-full object-cover" /> : <UserRound className="w-8 h-8 text-muted-foreground" />}
        </div>
        <div className="mt-2 rounded-md bg-muted/50 p-2.5 space-y-1.5">
          <div>
            <p className="text-lg font-extrabold text-foreground leading-tight">{u.name}</p>
            {u.discord_inhabilitado && <span className="inline-flex border border-destructive/30 bg-destructive/10 px-2 py-1 text-xs font-bold text-destructive">Inhabilitado</span>}
            {sub && <p className="text-sm text-muted-foreground">{sub}</p>}
          </div>
          {extra}
          <div className="border-t pt-2">
            <p className={label}>Sobre mí</p>
            <p className="text-xs text-foreground/90 whitespace-pre-wrap">{u.descripcion?.trim() || "Este usuario aún no añadió una descripción"}</p>
          </div>
          {apartados.length > 0 && <div className="border-t pt-2">
            <p className={label}>Apartados</p>
            <div className="mt-1 flex flex-wrap gap-1">
              {apartados.map(s => <span key={s.key} className="rounded px-2 py-0.5 text-[10px] font-bold bg-card border text-foreground" style={{ borderColor: color }}>{s.label}</span>)}
            </div>
          </div>}
          {permisos.length > 0 && <div className="border-t pt-2">
            <p className={label}>Permisos</p>
            <ul className="mt-1 flex flex-wrap gap-1">
              {permisos.map(p => <li key={p.label} className="rounded border border-emerald-200 bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-800">{p.label}</li>)}
            </ul>
          </div>}
        </div>
      </div>
      {footer}
    </div>
  );
}

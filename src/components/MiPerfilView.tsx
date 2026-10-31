import { useEffect, useState } from "react";
import { db, getToken } from "@/lib/db";
import { setSession, logAction, type Session } from "@/lib/session";
import { SECCIONES } from "@/lib/secciones";
import { syncDiscordNick } from "@/lib/discordAuth.functions";
import { DiscordRoles } from "@/components/DiscordRoles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Save, UserRound, Check, X } from "lucide-react";

export function MiPerfilView({ session }: { session: Session }) {
  const [name, setName] = useState(session.name);
  const [descripcion, setDescripcion] = useState(session.descripcion ?? "");
  const [avatar, setAvatar] = useState(session.avatar_url ?? "");
  const [banner, setBanner] = useState("");
  const [color, setColor] = useState("#5865f2");
  const [pronombres, setPronombres] = useState("");
  const [discordUser, setDiscordUser] = useState<string | null>(null);
  const [tag, setTag] = useState<string | null>(null);
  
  const [placa, setPlaca] = useState("");
  const [placaOrig, setPlacaOrig] = useState("");
  
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    db.from("instructors")
      .select("name, tag, avatar_url, descripcion, banner_url, color_perfil, pronombres, discord_username, placa")
      .eq("id", session.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        const d = data as any;
        setName(d.name ?? "");
        setTag(d.tag ?? null);
        setAvatar(d.avatar_url ?? "");
        setDescripcion(d.descripcion ?? "");
        setBanner(d.banner_url ?? "");
        setColor(d.color_perfil ?? "#5865f2");
        setPronombres(d.pronombres ?? "");
        setDiscordUser(d.discord_username ?? null);
        setPlaca(d.placa ?? ""); setPlacaOrig(d.placa ?? "");
        
      });
  }, [session.id]);

  async function save() {
    const nuevaPlaca = placa.trim();
    setSaving(true);
    const { error } = await db.from("instructors").update({ placa: nuevaPlaca || null } as any).eq("id", session.id);
    if (error) { setSaving(false); return toast.error("No se pudo guardar la placa"); }
    await logAction(db, session, "PERFIL_PLACA_ACTUALIZADA", { id: session.id, placa: nuevaPlaca });
    if (discordUser && nuevaPlaca !== placaOrig) {
      const r = await syncDiscordNick({ data: { token: getToken() ?? "", nick: name.slice(0, 32), placa: nuevaPlaca || undefined } });
      if (r.ok) { setPlacaOrig(nuevaPlaca); toast.success("Placa actualizada en Discord"); }
      else toast.error("La placa se guardó en la web, pero Discord no pudo actualizarse: " + r.error);
    } else toast.success("Placa actualizada");
    setSaving(false);
  }

  const permisos = [
    { label: "Alto Mando", on: session.is_alto_mando },
    { label: "Borrar registros", on: session.can_delete },
    { label: "Emitir RNAP", on: session.can_emit_rnap },
    { label: "Editar archivos", on: !!session.can_edit_files },
    { label: "Editar Registro PD", on: !!session.can_edit_pd },
  ];
  const label = "text-[11px] font-extrabold uppercase tracking-widest text-muted-foreground";
  const inp = "mt-1 h-10 rounded-none font-semibold";

  return (
    <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
      {/* Tarjeta tipo Discord */}
      <div className="overflow-hidden rounded-lg border bg-card shadow-lg self-start">
        <div className="h-28 bg-cover bg-center" style={{ backgroundColor: color, backgroundImage: banner ? `url(${banner})` : undefined }} />
        <div className="px-4 pb-4">
          <div className="-mt-12 w-24 h-24 rounded-full border-[6px] border-card bg-muted overflow-hidden flex items-center justify-center">
            {avatar ? <img src={avatar} alt={name} className="w-full h-full object-cover" /> : <UserRound className="w-10 h-10 text-muted-foreground" />}
          </div>
          <div className="mt-2 rounded-md bg-muted/60 p-3 space-y-3">
            <div>
              <p className="text-xl font-extrabold text-foreground leading-tight">{tag ? tag + " " : ""}{name || "Sin nombre"}</p>
              <p className="text-sm text-muted-foreground">{discordUser ? `@${discordUser}` : "Sin Discord"}{placa && ` · Placa #${placa}`}{pronombres && ` · ${pronombres}`}</p>
            </div>
            <div className="border-t pt-2">
              <p className={label}>Rango</p>
              <p className="text-sm font-bold text-foreground">{session.is_alto_mando ? "Alto Mando" : session.role || "Usuario"}</p>
            </div>
            {descripcion && (
              <div className="border-t pt-2">
                <p className={label}>Sobre mí</p>
                <p className="text-sm text-foreground whitespace-pre-wrap">{descripcion}</p>
              </div>
            )}
            {discordUser && (
              <div className="border-t pt-2">
                <p className={label}>Roles en Discord</p>
                <div className="mt-1">
                  <DiscordRoles targetId={session.id} canManage={session.is_alto_mando}
                    onName={i => {
                      setTag(i.tag);
                      setName(i.name); setPlaca(i.placa ?? ""); setPlacaOrig(i.placa ?? "");
                      if (i.avatar_url) setAvatar(i.avatar_url);
                      if (i.name !== session.name || (i.avatar_url && i.avatar_url !== session.avatar_url))
                        setSession({ ...session, name: i.name, avatar_url: i.avatar_url ?? session.avatar_url });
                    }} />
                </div>
              </div>
            )}
            <div className="border-t pt-2">
              <p className={label}>Apartados</p>
              <div className="mt-1 flex flex-wrap gap-1">
                {SECCIONES.filter(s => session.is_alto_mando || session.secciones?.includes(s.key)).map(s => (
                  <span key={s.key} className="rounded px-2 py-0.5 text-[11px] font-bold bg-card border" style={{ borderColor: color }}>{s.label}</span>
                ))}
                <span className="rounded px-2 py-0.5 text-[11px] font-bold bg-card border">myPerfil</span>
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
      </div>

      {/* Editor */}
      <div className="rounded-lg border bg-card p-6 space-y-5">
        <h2 className="font-display font-extrabold uppercase tracking-widest text-sm text-foreground">Editar perfil</h2>
        <div className="border-b pb-4">
          <p className={label}>Mi ID de acceso</p>
          <p className="mt-1 break-all font-mono font-bold text-foreground">{session.id}</p>
        </div>
        <div>
          <label className={label}>Nombre de Discord</label>
          <div className="mt-1 h-10 flex items-center border bg-muted/40 px-3 font-semibold text-sm">
            {tag ? tag + " " : ""}{name || "Sin nombre"}
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">El Tag, el nombre y el avatar se sincronizan automáticamente desde Discord y no se pueden editar aquí.</p>
        </div>
        <div>
          <label className={label}>Número de placa</label>
          <Input value={placa} maxLength={6} inputMode="numeric" placeholder="0000" onChange={e => setPlaca(e.target.value.replace(/[^0-9]/g, ""))} className={inp} />
          <p className="mt-1 text-[11px] text-muted-foreground">Es el número que aparece al final de tu apodo de Discord (#0000).</p>
        </div>
        <Button onClick={save} disabled={saving} className="h-11 rounded-none font-extrabold uppercase tracking-widest">
          <Save className="w-4 h-4 mr-2" /> {saving ? "Guardando..." : "Guardar cambios"}
        </Button>
      </div>
    </div>
  );
}

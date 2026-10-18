import { useEffect, useState } from "react";
import { db, getToken } from "@/lib/db";
import { setSession, logAction, type Session } from "@/lib/session";
import { fileToCompressedDataUrl } from "@/lib/appearance";
import { SECCIONES } from "@/lib/secciones";
import { syncDiscordNick } from "@/lib/discordAuth.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Save, Upload, UserRound, Check, X, ImageIcon } from "lucide-react";

const COLORES = ["#5865f2", "#57f287", "#fee75c", "#eb459e", "#ed4245", "#23272a", "#3ba55d", "#faa61a"];

export function MiPerfilView({ session }: { session: Session }) {
  const [name, setName] = useState(session.name);
  const [descripcion, setDescripcion] = useState(session.descripcion ?? "");
  const [avatar, setAvatar] = useState(session.avatar_url ?? "");
  const [banner, setBanner] = useState("");
  const [color, setColor] = useState("#5865f2");
  const [pronombres, setPronombres] = useState("");
  const [discordUser, setDiscordUser] = useState<string | null>(null);
  const [syncNick, setSyncNick] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    db.from("instructors")
      .select("name, avatar_url, descripcion, banner_url, color_perfil, pronombres, discord_username")
      .eq("id", session.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        const d = data as any;
        setName(d.name ?? "");
        setAvatar(d.avatar_url ?? "");
        setDescripcion(d.descripcion ?? "");
        setBanner(d.banner_url ?? "");
        setColor(d.color_perfil ?? "#5865f2");
        setPronombres(d.pronombres ?? "");
        setDiscordUser(d.discord_username ?? null);
      });
  }, [session.id]);

  async function upload(file: File, set: (v: string) => void, size: number) {
    try { set(await fileToCompressedDataUrl(file, size)); } catch { toast.error("No se pudo procesar la imagen"); }
  }

  async function save() {
    const n = name.trim();
    if (!n) return toast.error("El nombre no puede estar vacío");
    setSaving(true);
    const { error } = await db.from("instructors").update({
      name: n, avatar_url: avatar.trim() || null, descripcion: descripcion.trim() || null,
      banner_url: banner.trim() || null, color_perfil: color, pronombres: pronombres.trim() || null,
    } as any).eq("id", session.id);
    if (error) { setSaving(false); return toast.error("No se pudo guardar"); }
    setSession({ ...session, name: n, avatar_url: avatar.trim() || null, descripcion: descripcion.trim() || null });
    await logAction(db, session, "PERFIL_ACTUALIZADO", { id: session.id });
    toast.success("Perfil actualizado");
    if (discordUser && syncNick && n !== session.name) {
      const r = await syncDiscordNick({ data: { token: getToken() ?? "", nick: n.slice(0, 32) } });
      r.ok ? toast.success("Apodo actualizado en Discord") : toast.error(r.error);
    }
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
              <p className="text-xl font-extrabold text-foreground leading-tight">{name || "Sin nombre"}</p>
              <p className="text-sm text-muted-foreground">{discordUser ? `@${discordUser}` : session.id}{pronombres && ` · ${pronombres}`}</p>
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
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={label}>Nombre</label>
            <Input value={name} onChange={e => setName(e.target.value)} className={inp} />
            {discordUser && (
              <label className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                <input type="checkbox" checked={syncNick} onChange={e => setSyncNick(e.target.checked)} />
                Cambiar también mi apodo en Discord
              </label>
            )}
          </div>
          <div>
            <label className={label}>Pronombres</label>
            <Input value={pronombres} maxLength={40} placeholder="ella/él..." onChange={e => setPronombres(e.target.value)} className={inp} />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={label}>Foto de perfil</label>
            <div className="mt-1 flex gap-2">
              <Input value={avatar.startsWith("data:") ? "" : avatar} placeholder={avatar.startsWith("data:") ? "Imagen subida" : "https://..."} onChange={e => setAvatar(e.target.value)} className="h-10 rounded-none" />
              <label className="flex h-10 px-3 items-center border cursor-pointer hover:bg-muted">
                <input type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) upload(f, setAvatar, 512); }} />
                <Upload className="w-4 h-4" />
              </label>
            </div>
          </div>
          <div>
            <label className={label}>Banner</label>
            <div className="mt-1 flex gap-2">
              <Input value={banner.startsWith("data:") ? "" : banner} placeholder={banner.startsWith("data:") ? "Imagen subida" : "https://..."} onChange={e => setBanner(e.target.value)} className="h-10 rounded-none" />
              <label className="flex h-10 px-3 items-center border cursor-pointer hover:bg-muted">
                <input type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) upload(f, setBanner, 1200); }} />
                <ImageIcon className="w-4 h-4" />
              </label>
              {banner && <Button variant="outline" className="h-10 rounded-none" onClick={() => setBanner("")}>Quitar</Button>}
            </div>
          </div>
        </div>

        <div>
          <label className={label}>Color del banner</label>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            {COLORES.map(c => (
              <button key={c} type="button" onClick={() => setColor(c)} aria-label={c}
                className={`w-8 h-8 rounded-full border-2 ${color === c ? "border-foreground" : "border-transparent"}`} style={{ backgroundColor: c }} />
            ))}
            <input type="color" value={color} onChange={e => setColor(e.target.value)} className="w-8 h-8 cursor-pointer" />
          </div>
        </div>

        <div>
          <label className={label}>Sobre mí</label>
          <Textarea value={descripcion} maxLength={500} onChange={e => setDescripcion(e.target.value)} placeholder="Escribe algo sobre ti..." className="mt-1 min-h-28 rounded-none" />
          <p className="text-right text-[11px] text-muted-foreground">{descripcion.length}/500</p>
        </div>

        <Button onClick={save} disabled={saving} className="h-11 rounded-none font-extrabold uppercase tracking-widest">
          <Save className="w-4 h-4 mr-2" /> {saving ? "Guardando..." : "Guardar cambios"}
        </Button>
      </div>
    </div>
  );
}

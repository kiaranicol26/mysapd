import { useEffect, useMemo, useRef, useState } from "react";
import { db } from "@/lib/db";
import { logAction, type Session } from "@/lib/session";
import { uploadForumFile } from "@/lib/forum.functions";
import { getToken } from "@/lib/db";
import { Markdown } from "@/lib/markdown";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Plus, Trash2, Pencil, Search, FileText, Paperclip, ImagePlus, Bold, Italic,
  List, ListChecks, Code, Quote, Heading, X,
} from "lucide-react";
import sapdLogo from "@/assets/sapd-logo.png.asset.json";

type Adjunto = { name: string; url: string; size: number; mime: string };

type Post = {
  id: string;
  titulo: string;
  contenido: string;
  nota: string | null;
  adjuntos: Adjunto[] | null;
  created_by_id: string | null;
  created_by: string | null;
  edited_by: string | null;
  edited_at: string | null;
  created_at: string;
};

const MAX_BYTES = 5 * 1024 * 1024;

const fecha = (iso?: string | null) =>
  iso
    ? new Date(iso).toLocaleString("es-ES", {
        day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
      })
    : "—";

const peso = (b: number) => (b > 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

function readBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1] ?? "");
    r.onerror = () => reject(new Error("No se pudo leer el archivo"));
    r.readAsDataURL(file);
  });
}

export function ForumView({ session }: { session: Session }) {
  const canManage = !!session.is_alto_mando || session.role === "Cupula";
  const [posts, setPosts] = useState<Post[]>([]);
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Post | "new" | null>(null);

  const [titulo, setTitulo] = useState("");
  const [nota, setNota] = useState("");
  const [contenido, setContenido] = useState("");
  const [adjuntos, setAdjuntos] = useState<Adjunto[]>([]);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const areaRef = useRef<HTMLTextAreaElement | null>(null);
  const imgRef = useRef<HTMLInputElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  async function load() {
    const { data, error } = await db
      .from("forum_posts")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) return toast.error(error.message);
    setPosts((data ?? []) as Post[]);
  }

  useEffect(() => { load(); }, []);

  const open = posts.find(p => p.id === openId) ?? null;

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return posts;
    return posts.filter(
      p =>
        p.titulo.toLowerCase().includes(t) ||
        (p.nota ?? "").toLowerCase().includes(t) ||
        (p.created_by ?? "").toLowerCase().includes(t),
    );
  }, [posts, q]);

  function startNew() {
    setEditing("new");
    setTitulo("");
    setNota("");
    setContenido("");
    setAdjuntos([]);
  }

  function startEdit(p: Post) {
    setEditing(p);
    setTitulo(p.titulo);
    setNota(p.nota ?? "");
    setContenido(p.contenido ?? "");
    setAdjuntos(p.adjuntos ?? []);
  }

  function insert(before: string, after = "", placeholder = "") {
    const el = areaRef.current;
    if (!el) return setContenido(c => c + before + placeholder + after);
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const sel = contenido.slice(start, end) || placeholder;
    const next = contenido.slice(0, start) + before + sel + after + contenido.slice(end);
    setContenido(next);
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + before.length + sel.length;
      el.setSelectionRange(pos, pos);
    });
  }

  async function upload(file: File): Promise<Adjunto | null> {
    if (file.size > MAX_BYTES) {
      toast.error(`"${file.name}" supera los 5MB`);
      return null;
    }
    const base64 = await readBase64(file);
    const res = await uploadForumFile({
      data: { token: getToken(), filename: file.name, mime: file.type || "application/octet-stream", base64 },
    });
    if (!res.ok) {
      toast.error(res.error ?? "Error al subir");
      return null;
    }
    return { name: file.name, url: res.url, size: file.size, mime: file.type };
  }

  async function handleImages(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    for (const f of Array.from(files)) {
      const a = await upload(f);
      if (a) setContenido(c => `${c}${c && !c.endsWith("\n") ? "\n" : ""}![${a.name}](${a.url})\n`);
    }
    setUploading(false);
  }

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    for (const f of Array.from(files)) {
      const a = await upload(f);
      if (a) setAdjuntos(prev => [...prev, a]);
    }
    setUploading(false);
  }

  async function save() {
    if (!titulo.trim()) return toast.error("Ponle un título al fichero");
    setSaving(true);
    try {
      if (editing === "new") {
        const { error } = await db.from("forum_posts").insert({
          titulo: titulo.trim(),
          contenido,
          nota: nota.trim() || null,
          adjuntos,
          created_by_id: session.id,
          created_by: session.name,
        });
        if (error) throw new Error(error.message);
        await logAction(db, session, "CREATE_FORUM_POST", { titulo: titulo.trim() });
        toast.success("Fichero creado");
      } else if (editing) {
        const { error } = await db
          .from("forum_posts")
          .update({
            titulo: titulo.trim(),
            contenido,
            nota: nota.trim() || null,
            adjuntos,
            edited_by: session.name,
            edited_at: new Date().toISOString(),
          })
          .eq("id", editing.id);
        if (error) throw new Error(error.message);
        await logAction(db, session, "EDIT_FORUM_POST", { titulo: titulo.trim() });
        toast.success("Fichero actualizado");
      }
      setEditing(null);
      await load();
    } catch (e: any) {
      toast.error(e.message ?? "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  }

  async function remove(p: Post) {
    if (!confirm(`¿Eliminar el fichero "${p.titulo}"?`)) return;
    const { error } = await db.from("forum_posts").delete().eq("id", p.id);
    if (error) return toast.error(error.message);
    await logAction(db, session, "DELETE_FORUM_POST", { titulo: p.titulo });
    setOpenId(null);
    load();
  }

  const puedeEditar = (p: Post) => canManage || p.created_by_id === session.id;

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden border-2 border-blue-300 bg-white shadow-md rounded-none">
        <div className="h-1.5 bg-blue-700" />
        <div className="p-5 flex flex-col lg:flex-row lg:items-center gap-4 justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 flex items-center justify-center bg-white border border-blue-200 p-1">
              <img src={sapdLogo.url} alt="SAPD" className="w-full h-full object-contain" />
            </div>
            <div>
              <p className="text-blue-600 text-xs uppercase tracking-[0.3em] font-bold">
                San Andreas Police Department
              </p>
              <h2 className="text-2xl font-black uppercase tracking-wide text-slate-900 font-display">
                Forum · Ficheros
              </h2>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-2 top-1/2 -translate-y-1/2" />
              <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar fichero"
                className="h-11 pl-8 rounded-none border-blue-300 bg-white text-slate-800 w-56" />
            </div>
            <Button onClick={startNew}
              className="h-11 rounded-none bg-blue-700 hover:bg-blue-800 text-white font-black uppercase tracking-widest">
              <Plus className="w-4 h-4 mr-2" /> Crear post
            </Button>
          </div>
        </div>
        <div className="px-5 pb-4 -mt-1">
          <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">
            Ficheros con texto, imágenes, archivos (máx 5MB) y checklists. Alto Mando y Cúpula pueden editar cualquier post.
          </p>
        </div>
      </Card>

      <div className="grid gap-3">
        {filtered.map(p => (
          <button key={p.id} type="button" onClick={() => setOpenId(p.id)}
            className="text-left border-2 border-blue-200 hover:border-blue-600 bg-white transition-colors p-4">
            <div className="flex flex-wrap items-center gap-2">
              <FileText className="w-4 h-4 text-blue-700" />
              <span className="font-black uppercase tracking-wide text-slate-900">{p.titulo}</span>
              {p.nota && (
                <span className="px-2 py-0.5 bg-blue-50 border border-blue-300 text-[10px] font-black uppercase tracking-widest text-blue-700">
                  {p.nota}
                </span>
              )}
              {(p.adjuntos?.length ?? 0) > 0 && (
                <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-slate-400">
                  <Paperclip className="w-3 h-3" /> {p.adjuntos!.length}
                </span>
              )}
            </div>
            <p className="mt-2 text-[11px] font-bold uppercase tracking-widest text-slate-500">
              Creado por: <span className="text-slate-800">{p.created_by ?? "—"}</span> · Fecha:{" "}
              <span className="text-slate-800">{fecha(p.created_at)}</span>
              {p.edited_by && (
                <>
                  {" "}· Editado por: <span className="text-slate-800">{p.edited_by}</span> ({fecha(p.edited_at)})
                </>
              )}
            </p>
          </button>
        ))}
        {filtered.length === 0 && (
          <div className="p-10 text-center text-slate-500 uppercase tracking-widest font-bold bg-white border-2 border-blue-200">
            Todavía no hay ficheros. Usa [Crear post].
          </div>
        )}
      </div>

      {/* Lectura */}
      <Dialog open={!!open} onOpenChange={o => !o && setOpenId(null)}>
        <DialogContent className="max-w-3xl rounded-none border-2 border-blue-300 bg-white max-h-[90vh] overflow-auto">
          {open && (
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-3 border-b-2 border-blue-200 pb-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-xl font-black uppercase tracking-wide text-slate-900 font-display">
                      {open.titulo}
                    </h3>
                    {open.nota && (
                      <span className="px-2 py-0.5 bg-blue-50 border border-blue-300 text-[10px] font-black uppercase tracking-widest text-blue-700">
                        {open.nota}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-[11px] font-bold uppercase tracking-widest text-slate-500">
                    Creado por: <span className="text-slate-800">{open.created_by ?? "—"}</span> · Fecha:{" "}
                    <span className="text-slate-800">{fecha(open.created_at)}</span>
                    {open.edited_by && (
                      <>
                        {" "}· Editado por: <span className="text-slate-800">{open.edited_by}</span>
                      </>
                    )}
                  </p>
                </div>
                {puedeEditar(open) && (
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" onClick={() => { setOpenId(null); startEdit(open); }}
                      className="rounded-none hover:bg-blue-100">
                      <Pencil className="w-4 h-4 text-blue-700" />
                    </Button>
                    <Button variant="ghost" onClick={() => remove(open)} className="rounded-none hover:bg-red-100">
                      <Trash2 className="w-4 h-4 text-red-600" />
                    </Button>
                  </div>
                )}
              </div>

              <Markdown text={open.contenido ?? ""} />

              {(open.adjuntos?.length ?? 0) > 0 && (
                <div className="border-t-2 border-blue-200 pt-3 space-y-2">
                  <p className="text-[11px] font-black uppercase tracking-widest text-slate-500">Archivos</p>
                  {open.adjuntos!.map((a, i) => (
                    <a key={i} href={a.url} target="_blank" rel="noreferrer"
                      className="flex items-center gap-2 bg-blue-50/60 border border-blue-200 p-2 text-sm font-bold text-blue-700 hover:bg-blue-100">
                      <Paperclip className="w-4 h-4" /> {a.name}
                      <span className="text-slate-400 font-mono text-xs ml-auto">{peso(a.size)}</span>
                    </a>
                  ))}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Crear / Editar */}
      <Dialog open={!!editing} onOpenChange={o => !o && setEditing(null)}>
        <DialogContent className="max-w-3xl rounded-none border-2 border-blue-300 bg-white max-h-[92vh] overflow-auto">
          <div className="space-y-4">
            <h3 className="text-xl font-black uppercase tracking-wide text-slate-900 font-display border-b-2 border-blue-200 pb-3">
              {editing === "new" ? "Crear post" : "Editar post"}
            </h3>

            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <p className="text-[11px] font-black uppercase tracking-widest text-slate-500 mb-1">Título</p>
                <Input value={titulo} onChange={e => setTitulo(e.target.value)}
                  placeholder="Título del fichero"
                  className="h-10 rounded-none border-blue-300 font-bold" />
              </div>
              <div>
                <p className="text-[11px] font-black uppercase tracking-widest text-slate-500 mb-1">
                  Nota (aparece junto al título)
                </p>
                <Input value={nota} onChange={e => setNota(e.target.value)} placeholder="Opcional"
                  className="h-10 rounded-none border-blue-300 font-bold" />
              </div>
            </div>

            <div>
              <p className="text-[11px] font-black uppercase tracking-widest text-slate-500 mb-1">Contenido</p>
              <div className="flex flex-wrap gap-1 border-2 border-blue-300 border-b-0 bg-blue-50/60 p-1">
                {[
                  { icon: Bold, label: "Negrita", run: () => insert("**", "**", "texto") },
                  { icon: Italic, label: "Cursiva", run: () => insert("*", "*", "texto") },
                  { icon: Heading, label: "Título", run: () => insert("## ", "", "Título") },
                  { icon: List, label: "Lista", run: () => insert("- ", "", "elemento") },
                  { icon: ListChecks, label: "Checklist", run: () => insert("- [ ] ", "", "tarea") },
                  { icon: Quote, label: "Cita", run: () => insert("> ", "", "cita") },
                  { icon: Code, label: "Código", run: () => insert("`", "`", "código") },
                ].map(b => (
                  <button key={b.label} type="button" title={b.label} onClick={b.run}
                    className="p-2 border border-blue-200 bg-white hover:bg-blue-100 text-blue-700">
                    <b.icon className="w-4 h-4" />
                  </button>
                ))}
                <button type="button" title="Subir imagen" onClick={() => imgRef.current?.click()}
                  className="p-2 border border-blue-200 bg-white hover:bg-blue-100 text-blue-700">
                  <ImagePlus className="w-4 h-4" />
                </button>
                <button type="button" title="Adjuntar archivo" onClick={() => fileRef.current?.click()}
                  className="p-2 border border-blue-200 bg-white hover:bg-blue-100 text-blue-700">
                  <Paperclip className="w-4 h-4" />
                </button>
                {uploading && (
                  <span className="self-center px-2 text-[10px] font-black uppercase tracking-widest text-blue-700">
                    Subiendo…
                  </span>
                )}
              </div>
              <Textarea ref={areaRef} value={contenido} onChange={e => setContenido(e.target.value)}
                placeholder={"Escribe aquí. Soporta **negrita**, listas, - [ ] checklists e imágenes."}
                className="rounded-none border-blue-300 min-h-[220px] font-mono text-sm" />
              <input ref={imgRef} type="file" accept="image/*" multiple hidden
                onChange={e => { handleImages(e.target.files); e.target.value = ""; }} />
              <input ref={fileRef} type="file" multiple hidden
                onChange={e => { handleFiles(e.target.files); e.target.value = ""; }} />
            </div>

            {adjuntos.length > 0 && (
              <div className="space-y-2">
                <p className="text-[11px] font-black uppercase tracking-widest text-slate-500">Archivos adjuntos</p>
                {adjuntos.map((a, i) => (
                  <div key={i} className="flex items-center gap-2 bg-blue-50/60 border border-blue-200 p-2 text-sm font-bold text-slate-700">
                    <Paperclip className="w-4 h-4 text-blue-700" /> {a.name}
                    <span className="text-slate-400 font-mono text-xs ml-auto">{peso(a.size)}</span>
                    <button type="button" onClick={() => setAdjuntos(prev => prev.filter((_, j) => j !== i))}
                      className="text-red-600 hover:text-red-800">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div>
              <p className="text-[11px] font-black uppercase tracking-widest text-slate-500 mb-1">Vista previa</p>
              <div className="border-2 border-blue-200 bg-blue-50/40 p-3 max-h-64 overflow-auto">
                <Markdown text={contenido} />
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t-2 border-blue-200 pt-4">
              <Button variant="ghost" onClick={() => setEditing(null)} className="rounded-none font-bold">
                Cancelar
              </Button>
              <Button onClick={save} disabled={saving || uploading}
                className="rounded-none bg-blue-700 hover:bg-blue-800 text-white font-black uppercase tracking-widest">
                {saving ? "Guardando…" : editing === "new" ? "Publicar" : "Guardar cambios"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

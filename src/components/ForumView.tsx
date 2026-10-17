
import { useEffect, useMemo, useRef, useState } from "react";
import { db, getToken } from "@/lib/db";
import { logAction, type Session } from "@/lib/session";
import { uploadForumFile } from "@/lib/forum.functions";
import { Markdown } from "@/lib/markdown";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Plus, Trash2, Pencil, Search, FileText, Paperclip,
  ImagePlus, Bold, Italic, List, ListChecks, Code,
  Quote, Heading, X, Hash, Shield,
} from "lucide-react";
import sapdLogo from "@/assets/sapd-logo.png.asset.json";
import "./forum-discord.css";

type Adjunto = {
  name: string;
  url: string;
  size: number;
  mime: string;
};

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
    ? new Date(iso).toLocaleString("es-AR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

const peso = (b: number) =>
  b >= 1024 * 1024
    ? `${(b / 1024 / 1024).toFixed(1)} MB`
    : `${Math.max(1, Math.round(b / 1024))} KB`;

function readBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () =>
      reject(new Error("No se pudo leer el archivo"));
    reader.readAsDataURL(file);
  });
}

export function ForumView({ session }: { session: Session }) {
  const canManage =
    !!session.is_alto_mando || session.role === "Cupula";

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

    if (error) {
      toast.error(error.message);
      return;
    }

    setPosts((data ?? []) as Post[]);
  }

  useEffect(() => {
    void load();
  }, []);

  const open = posts.find((p) => p.id === openId) ?? null;

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return posts;

    return posts.filter(
      (p) =>
        p.titulo.toLowerCase().includes(term) ||
        (p.nota ?? "").toLowerCase().includes(term) ||
        (p.created_by ?? "").toLowerCase().includes(term) ||
        (p.contenido ?? "").toLowerCase().includes(term),
    );
  }, [posts, q]);

  function startNew() {
    setOpenId(null);
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

    if (!el) {
      setContenido((c) => c + before + placeholder + after);
      return;
    }

    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = contenido.slice(start, end) || placeholder;

    const next =
      contenido.slice(0, start) +
      before +
      selected +
      after +
      contenido.slice(end);

    setContenido(next);

    requestAnimationFrame(() => {
      el.focus();
      const pos = start + before.length + selected.length;
      el.setSelectionRange(pos, pos);
    });
  }

  async function upload(file: File): Promise<Adjunto | null> {
    if (file.size > MAX_BYTES) {
      toast.error(`"${file.name}" supera los 5 MB`);
      return null;
    }

    try {
      const base64 = await readBase64(file);
      const res = await uploadForumFile({
        data: {
          token: getToken(),
          filename: file.name,
          mime: file.type || "application/octet-stream",
          base64,
        },
      });

      if (!res.ok) {
        toast.error(res.error ?? "Error al subir el archivo");
        return null;
      }

      return {
        name: file.name,
        url: res.url,
        size: file.size,
        mime: file.type,
      };
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Error al subir el archivo",
      );
      return null;
    }
  }

  async function handleImages(files: FileList | null) {
    if (!files?.length) return;

    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const attachment = await upload(file);

        if (attachment) {
          const markdown =
            `![${attachment.name}](${attachment.url})`;

          setContenido((current) =>
            `${current}${current && !current.endsWith("\n") ? "\n" : ""}${markdown}\n`,
          );
        }
      }
    } finally {
      setUploading(false);
    }
  }

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return;

    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const attachment = await upload(file);
        if (attachment) {
          setAdjuntos((prev) => [...prev, attachment]);
        }
      }
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    if (!titulo.trim()) {
      toast.error("Escribí un título para el fichero");
      return;
    }

    if (saving || uploading || !editing) return;

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

        await logAction(db, session, "CREATE_FORUM_POST", {
          titulo: titulo.trim(),
        });

        toast.success("Publicación creada");
      } else {
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

        await logAction(db, session, "EDIT_FORUM_POST", {
          titulo: titulo.trim(),
        });

        toast.success("Publicación actualizada");
      }

      setEditing(null);
      await load();
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "No se pudo guardar",
      );
    } finally {
      setSaving(false);
    }
  }

  async function remove(p: Post) {
    if (!puedeEditar(p)) return;

    if (!window.confirm(`¿Eliminar la publicación "${p.titulo}"?`)) {
      return;
    }

    const { error } = await db
      .from("forum_posts")
      .delete()
      .eq("id", p.id);

    if (error) {
      toast.error(error.message);
      return;
    }

    await logAction(db, session, "DELETE_FORUM_POST", {
      titulo: p.titulo,
    });

    setOpenId(null);
    toast.success("Publicación eliminada");
    await load();
  }

  const puedeEditar = (p: Post) =>
    canManage || p.created_by_id === session.id;

  const toolbar = [
    { icon: Bold, label: "Negrita", run: () => insert("**", "**", "texto") },
    { icon: Italic, label: "Cursiva", run: () => insert("*", "*", "texto") },
    { icon: Heading, label: "Título", run: () => insert("## ", "", "Título") },
    { icon: List, label: "Lista", run: () => insert("- ", "", "elemento") },
    { icon: ListChecks, label: "Checklist", run: () => insert("- [ ] ", "", "tarea") },
    { icon: Quote, label: "Cita", run: () => insert("> ", "", "cita") },
    { icon: Code, label: "Código", run: () => insert("`", "`", "código") },
  ];

  return (
    <div className="discord-forum space-y-4">
      {/* Cabecera del foro */}
      <Card className="df-header overflow-hidden">
        <div className="df-header-accent" />

        <div className="df-header-content">
          <div className="df-brand">
            <div className="df-logo">
              <img
                src={sapdLogo.url}
                alt="SAPD"
                className="h-full w-full object-contain"
              />
            </div>

            <div className="min-w-0">
              <p className="df-eyebrow">
                <Shield className="inline h-3.5 w-3.5 mr-1.5" />
                San Andreas Police Department
              </p>
              <h2 className="df-title">
                <Hash className="df-title-icon" />
                ficheros
              </h2>
              <p className="df-subtitle">
                Centro de documentos y publicaciones internas
              </p>
            </div>
          </div>

          <div className="df-header-actions">
            <div className="df-search">
              <Search className="df-search-icon" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar publicaciones..."
                aria-label="Buscar publicaciones"
                className="df-input"
              />
              {q && (
                <button
                  type="button"
                  className="df-clear-search"
                  onClick={() => setQ("")}
                  aria-label="Limpiar búsqueda"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            <Button
              onClick={startNew}
              className="df-primary-button"
            >
              <Plus className="h-4 w-4" />
              Crear post
            </Button>
          </div>
        </div>

        <div className="df-header-footer">
          <span>
            {filtered.length}{" "}
            {filtered.length === 1 ? "publicación" : "publicaciones"}
          </span>
          <span className="df-footer-dot" />
          <span>Archivos de hasta 5 MB</span>
        </div>
      </Card>

      {/* Lista de publicaciones */}
      <div className="grid gap-2">
        {filtered.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setOpenId(p.id)}
            className="df-post"
          >
            <div className="df-post-icon">
              <FileText className="h-5 w-5" />
            </div>

            <div className="df-post-main">
              <div className="df-post-heading">
                <span className="df-post-title">{p.titulo}</span>

                {p.nota && (
                  <span className="df-tag">{p.nota}</span>
                )}

                {(p.adjuntos?.length ?? 0) > 0 && (
                  <span className="df-attachment-count">
                    <Paperclip className="h-3.5 w-3.5" />
                    {p.adjuntos!.length}
                  </span>
                )}
              </div>

              <p className="df-post-preview">
                {p.contenido?.replace(/[#*`>\-\[\]!]/g, "").trim() ||
                  "Sin descripción"}
              </p>

              <div className="df-post-meta">
                <span className="df-author-avatar">
                  {(p.created_by ?? "?").charAt(0).toUpperCase()}
                </span>
                <span className="df-author">
                  {p.created_by ?? "Usuario desconocido"}
                </span>
                <span className="df-meta-dot">·</span>
                <span>{fecha(p.created_at)}</span>

                {p.edited_by && (
                  <>
                    <span className="df-meta-dot">·</span>
                    <span>Editado por {p.edited_by}</span>
                  </>
                )}
              </div>
            </div>

            <div className="df-post-arrow">›</div>
          </button>
        ))}

        {filtered.length === 0 && (
          <div className="df-empty">
            <div className="df-empty-icon">
              <FileText className="h-7 w-7" />
            </div>
            <h3>
              {q ? "No se encontraron publicaciones" : "Este canal está vacío"}
            </h3>
            <p>
              {q
                ? "Probá con otro término de búsqueda."
                : "Todavía no hay ficheros publicados en este canal."}
            </p>

            {!q && (
              <Button onClick={startNew} className="df-primary-button">
                <Plus className="h-4 w-4" />
                Crear primera publicación
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Ventana de lectura */}
      <Dialog
        open={!!open}
        onOpenChange={(value) => !value && setOpenId(null)}
      >
        <DialogContent className="df-dialog max-w-3xl max-h-[90vh] overflow-y-auto">
          {open && (
            <div className="space-y-5">
              <div className="df-dialog-heading">
                <div className="min-w-0">
                  <div className="df-dialog-channel">
                    <Hash className="h-4 w-4" />
                    ficheros
                  </div>

                  <h3 className="df-dialog-title">{open.titulo}</h3>

                  {open.nota && (
                    <span className="df-tag mt-2 inline-flex">
                      {open.nota}
                    </span>
                  )}
                </div>

                {puedeEditar(open) && (
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      aria-label="Editar publicación"
                      onClick={() => {
                        setOpenId(null);
                        startEdit(open);
                      }}
                      className="df-icon-button"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>

                    <Button
                      variant="ghost"
                      aria-label="Eliminar publicación"
                      onClick={() => void remove(open)}
                      className="df-delete-button"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>

              <div className="df-message-author">
                <span className="df-author-avatar df-avatar-large">
                  {(open.created_by ?? "?").charAt(0).toUpperCase()}
                </span>

                <div>
                  <p className="df-author">{open.created_by ?? "Usuario desconocido"}</p>
                  <p className="df-muted">
                    Publicado el {fecha(open.created_at)}
                  </p>
                  {open.edited_by && (
                    <p className="df-muted">
                      Editado por {open.edited_by}
                      {open.edited_at ? ` · ${fecha(open.edited_at)}` : ""}
                    </p>
                  )}
                </div>
              </div>

              <div className="df-markdown">
                <Markdown text={open.contenido ?? ""} />
              </div>

              {(open.adjuntos?.length ?? 0) > 0 && (
                <div className="df-attachments">
                  <h4 className="df-section-title">
                    <Paperclip className="h-4 w-4" />
                    Archivos adjuntos
                  </h4>

                  {open.adjuntos!.map((a, i) => (
                    <a
                      key={`${a.url}-${i}`}
                      href={a.url}
                      target="_blank"
                      rel="noreferrer"
                      className="df-attachment"
                    >
                      <div className="df-file-icon">
                        <FileText className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="df-file-name">{a.name}</p>
                        <p className="df-muted">{peso(a.size)}</p>
                      </div>
                      <span className="df-file-open">Abrir ↗</span>
                    </a>
                  ))}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Ventana de creación y edición */}
      <Dialog
        open={!!editing}
        onOpenChange={(value) => !value && setEditing(null)}
      >
        <DialogContent className="df-dialog max-w-3xl max-h-[92vh] overflow-y-auto">
          <div className="space-y-5">
            <div className="df-dialog-heading">
              <div>
                <div className="df-dialog-channel">
                  <Hash className="h-4 w-4" />
                  ficheros
                </div>

                <h3 className="df-dialog-title">
                  {editing === "new" ? "Crear publicación" : "Editar publicación"}
                </h3>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="df-label">Título</label>
                <Input
                  value={titulo}
                  onChange={(e) => setTitulo(e.target.value)}
                  placeholder="Título de la publicación"
                  className="df-input"
                  maxLength={200}
                />
              </div>

              <div className="space-y-2">
                <label className="df-label">Etiqueta (opcional)</label>
                <Input
                  value={nota}
                  onChange={(e) => setNota(e.target.value)}
                  placeholder="Ej. IMPORTANTE, GUÍA, SAPD"
                  className="df-input"
                  maxLength={80}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="df-label">Contenido del mensaje</label>

              <div className="df-editor">
                <div className="df-toolbar">
                  {toolbar.map((item) => (
                    <button
                      key={item.label}
                      type="button"
                      title={item.label}
                      aria-label={item.label}
                      onClick={item.run}
                      className="df-tool"
                    >
                      <item.icon className="h-4 w-4" />
                    </button>
                  ))}

                  <span className="df-toolbar-divider" />

                  <button
                    type="button"
                    title="Subir imágenes"
                    aria-label="Subir imágenes"
                    onClick={() => imgRef.current?.click()}
                    className="df-tool"
                    disabled={uploading}
                  >
                    <ImagePlus className="h-4 w-4" />
                  </button>

                  <button
                    type="button"
                    title="Adjuntar archivos"
                    aria-label="Adjuntar archivos"
                    onClick={() => fileRef.current?.click()}
                    className="df-tool"
                    disabled={uploading}
                  >
                    <Paperclip className="h-4 w-4" />
                  </button>

                  {uploading && (
                    <span className="df-uploading">Subiendo...</span>
                  )}
                </div>

                <Textarea
                  ref={areaRef}
                  value={contenido}
                  onChange={(e) => setContenido(e.target.value)}
                  placeholder={"Escribí tu publicación aquí...\n\nPodés usar Markdown, listas, checklists e imágenes."}
                  className="df-textarea min-h-[220px]"
                />

                <input
                  ref={imgRef}
                  type="file"
                  accept="image/*"
                  multiple
                  hidden
                  onChange={(e) => {
                    void handleImages(e.target.files);
                    e.target.value = "";
                  }}
                />

                <input
                  ref={fileRef}
                  type="file"
                  multiple
                  hidden
                  onChange={(e) => {
                    void handleFiles(e.target.files);
                    e.target.value = "";
                  }}
                />
              </div>

              <p className="df-hint">
                Markdown disponible: **negrita**, *cursiva*, títulos,
                listas, citas, código e imágenes.
              </p>
            </div>

            {adjuntos.length > 0 && (
              <div className="space-y-2">
                <h4 className="df-section-title">
                  <Paperclip className="h-4 w-4" />
                  Archivos adjuntos ({adjuntos.length})
                </h4>

                {adjuntos.map((a, i) => (
                  <div key={`${a.url}-${i}`} className="df-attachment">
                    <div className="df-file-icon">
                      <FileText className="h-5 w-5" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="df-file-name">{a.name}</p>
                      <p className="df-muted">{peso(a.size)}</p>
                    </div>

                    <button
                      type="button"
                      aria-label={`Quitar ${a.name}`}
                      onClick={() =>
                        setAdjuntos((prev) =>
                          prev.filter((_, j) => j !== i),
                        )
                      }
                      className="df-remove-file"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-2">
              <h4 className="df-label">Vista previa</h4>
              <div className="df-preview">
                {contenido.trim() ? (
                  <Markdown text={contenido} />
                ) : (
                  <p className="df-muted">
                    El contenido de tu publicación aparecerá aquí...
                  </p>
                )}
              </div>
            </div>

            <div className="df-dialog-actions">
              <Button
                variant="ghost"
                onClick={() => setEditing(null)}
                disabled={saving}
                className="df-cancel-button"
              >
                Cancelar
              </Button>

              <Button
                onClick={() => void save()}
                disabled={saving || uploading || !titulo.trim()}
                className="df-primary-button"
              >
                {saving
                  ? "Guardando..."
                  : uploading
                    ? "Subiendo archivos..."
                    : editing === "new"
                      ? "Publicar"
                      : "Guardar cambios"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* =========================================
   SAPD FORUM — DISCORD DARK THEME
   ========================================= */

.discord-forum {
  --df-bg: #313338;
  --df-card: #2b2d31;
  --df-panel: #232428;
  --df-hover: #383a40;
  --df-border: #3f4147;
  --df-blue: #5865f2;
  --df-blue-hover: #4752c4;
  --df-text: #f2f3f5;
  --df-muted: #b5bac1;
  --df-subtle: #949ba4;

  padding: 18px;
  color: var(--df-text);
  background: var(--df-bg);
  border-radius: 12px;
  font-size: 14px;
}

.discord-forum * {
  box-sizing: border-box;
}

/* Cabecera */

.discord-forum .df-header {
  display: block;
  padding: 0;
  overflow: hidden;
  background: var(--df-card);
  border: 1px solid var(--df-border);
  border-radius: 10px;
  box-shadow: none;
  color: var(--df-text);
}

.discord-forum .df-header-accent {
  height: 4px;
  background: var(--df-blue);
}

.discord-forum .df-header-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 20px;
  padding: 22px;
}

.discord-forum .df-brand {
  display: flex;
  align-items: center;
  gap: 15px;
  min-width: 0;
}

.discord-forum .df-logo {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 54px;
  height: 54px;
  flex-shrink: 0;
  padding: 7px;
  background: var(--df-panel);
  border: 1px solid var(--df-border);
  border-radius: 12px;
}

.discord-forum .df-eyebrow {
  margin: 0 0 5px;
  color: #8ea1ff;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 1.4px;
  text-transform: uppercase;
}

.discord-forum .df-title {
  display: flex;
  align-items: center;
  gap: 5px;
  margin: 0;
  color: var(--df-text);
  font-size: 25px;
  font-weight: 800;
  letter-spacing: -0.7px;
}

.discord-forum .df-title-icon {
  width: 24px;
  height: 24px;
  color: var(--df-muted);
}

.discord-forum .df-subtitle {
  margin: 5px 0 0;
  color: var(--df-muted);
  font-size: 12px;
}

.discord-forum .df-header-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
}

.discord-forum .df-search {
  position: relative;
  display: flex;
  align-items: center;
}

.discord-forum .df-search-icon {
  position: absolute;
  left: 12px;
  width: 16px;
  height: 16px;
  z-index: 1;
  color: var(--df-subtle);
  pointer-events: none;
}

.discord-forum .df-input {
  min-height: 40px;
  padding: 9px 36px;
  background: var(--df-panel) !important;
  color: var(--df-text) !important;
  border: 1px solid var(--df-border) !important;
  border-radius: 7px !important;
  box-shadow: none;
}

.discord-forum .df-search .df-input {
  width: 230px;
}

.discord-forum .df-clear-search {
  position: absolute;
  right: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 3px;
  color: var(--df-muted);
  background: transparent;
  border: 0;
  cursor: pointer;
}

.discord-forum .df-clear-search:hover {
  color: var(--df-text);
}

.discord-forum .df-primary-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 40px;
  padding: 0 16px;
  color: white;
  background: var(--df-blue);
  border: 0;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 700;
  transition: background 150ms ease;
}

.discord-forum .df-primary-button:hover {
  color: white;
  background: var(--df-blue-hover);
}

.discord-forum .df-primary-button:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.discord-forum .df-header-footer {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 11px 22px;
  color: var(--df-muted);
  background: rgba(0, 0, 0, 0.12);
  border-top: 1px solid var(--df-border);
  font-size: 11px;
}

.discord-forum .df-footer-dot,
.discord-forum .df-meta-dot {
  color: #6d717a;
}

/* Publicaciones */

.discord-forum .df-post {
  display: flex;
  align-items: flex-start;
  gap: 13px;
  width: 100%;
  padding: 16px;
  text-align: left;
  color: var(--df-text);
  background: var(--df-card);
  border: 1px solid var(--df-border);
  border-radius: 8px;
  cursor: pointer;
  transition: background 150ms ease, border-color 150ms ease;
}

.discord-forum .df-post:hover {
  background: var(--df-hover);
  border-color: #50535c;
}

.discord-forum .df-post:active {
  transform: scale(0.998);
}

.discord-forum .df-post-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 42px;
  height: 42px;
  flex-shrink: 0;
  color: #a5b4fc;
  background: #353b64;
  border-radius: 9px;
}

.discord-forum .df-post-main {
  flex: 1;
  min-width: 0;
}

.discord-forum .df-post-heading {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.discord-forum .df-post-title {
  color: var(--df-text);
  font-size: 15px;
  font-weight: 700;
  overflow-wrap: anywhere;
}

.discord-forum .df-tag {
  display: inline-flex;
  align-items: center;
  max-width: 100%;
  padding: 3px 7px;
  color: #b9c2ff;
  background: #353b64;
  border: 1px solid #454d83;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.4px;
  overflow-wrap: anywhere;
}

.discord-forum .df-attachment-count {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--df-muted);
  font-size: 11px;
}

.discord-forum .df-post-preview {
  margin: 7px 0 11px;
  color: var(--df-muted);
  font-size: 13px;
  line-height: 1.5;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}

.discord-forum .df-post-meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 7px;
  color: var(--df-subtle);
  font-size: 11px;
}

.discord-forum .df-author {
  color: #e3e5e8;
  font-size: 12px;
  font-weight: 700;
  overflow-wrap: anywhere;
}

.discord-forum .df-author-avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 23px;
  height: 23px;
  flex-shrink: 0;
  color: white;
  background: var(--df-blue);
  border-radius: 50%;
  font-size: 11px;
  font-weight: 800;
}

.discord-forum .df-post-arrow {
  align-self: center;
  color: #727680;
  font-size: 27px;
  transition: color 150ms ease;
}

.discord-forum .df-post:hover .df-post-arrow {
  color: #a5b4fc;
}

/* Estado vacío */

.discord-forum .df-empty {
  display: flex;
  align-items: center;
  flex-direction: column;
  gap: 10px;
  padding: 48px 20px;
  text-align: center;
  background: var(--df-card);
  border: 1px dashed #4a4d55;
  border-radius: 10px;
}

.discord-forum .df-empty-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 60px;
  height: 60px;
  margin-bottom: 5px;
  color: #8ea1ff;
  background: #353b64;
  border-radius: 16px;
}

.discord-forum .df-empty h3 {
  margin: 0;
  color: var(--df-text);
  font-size: 17px;
  font-weight: 800;
}

.discord-forum .df-empty p {
  margin: 0 0 8px;
  color: var(--df-muted);
  font-size: 13px;
}

/* Ventanas de diálogo */

.df-dialog {
  color: var(--df-text) !important;
  background: var(--df-card) !important;
  border: 1px solid var(--df-border) !important;
  border-radius: 12px !important;
  box-shadow: 0 20px 70px rgba(0, 0, 0, 0.45) !important;
}

.df-dialog [data-radix-dialog-close] {
  color: var(--df-muted);
}

.df-dialog [data-radix-dialog-close]:hover {
  color: var(--df-text);
  background: var(--df-hover);
}

.df-dialog-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding-bottom: 17px;
  border-bottom: 1px solid var(--df-border);
}

.df-dialog-channel {
  display: flex;
  align-items: center;
  gap: 5px;
  margin-bottom: 7px;
  color: var(--df-muted);
  font-size: 12px;
  font-weight: 700;
}

.df-dialog-title {
  margin: 0;
  color: var(--df-text);
  font-size: 22px;
  font-weight: 800;
  line-height: 1.3;
  overflow-wrap: anywhere;
}

.df-dialog .df-muted {
  margin: 3px 0 0;
  color: var(--df-muted);
  font-size: 12px;
  line-height: 1.5;
}

.df-dialog .df-section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
  color: var(--df-text);
  font-size: 13px;
  font-weight: 800;
}

.df-dialog .df-attachments {
  padding-top: 16px;
  border-top: 1px solid var(--df-border);
}

.df-dialog .df-attachment {
  display: flex;
  align-items: center;
  gap: 11px;
  margin-top: 8px;
  padding: 11px;
  color: var(--df-text);
  background: var(--df-panel);
  border: 1px solid var(--df-border);
  border-radius: 7px;
  text-decoration: none;
}

.df-dialog a.df-attachment:hover {
  background: var(--df-hover);
}

.df-dialog .df-file-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  flex-shrink: 0;
  color: #a5b4fc;
  background: #353b64;
  border-radius: 7px;
}

.df-dialog .df-file-name {
  margin: 0;
  color: var(--df-text);
  font-size: 13px;
  font-weight: 700;
  overflow-wrap: anywhere;
}

.df-dialog .df-file-open {
  flex-shrink: 0;
  color: #a5b4fc;
  font-size: 11px;
  font-weight: 700;
}

.df-dialog .df-remove-file {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 7px;
  color: #f38b92;
  background: transparent;
  border: 0;
  border-radius: 6px;
  cursor: pointer;
}

.df-dialog .df-remove-file:hover {
  background: #512d32;
}

/* Botones secundarios */

.df-dialog .df-icon-button,
.df-dialog .df-cancel-button {
  color: var(--df-muted);
  background: transparent;
  border-radius: 6px;
}

.df-dialog .df-icon-button:hover,
.df-dialog .df-cancel-button:hover {
  color: var(--df-text);
  background: var(--df-hover);
}

.df-dialog .df-delete-button {
  color: #f38b92;
  background: transparent;
  border-radius: 6px;
}

.df-dialog .df-delete-button:hover {
  color: #ffb4b8;
  background: #512d32;
}

/* Editor */

.df-dialog .df-label {
  display: block;
  color: var(--df-muted);
  font-size: 12px;
  font-weight: 800;
}

.df-dialog .df-input,
.df-dialog .df-textarea {
  width: 100%;
  color: var(--df-text) !important;
  background: var(--df-panel) !important;
  border: 1px solid var(--df-border) !important;
  border-radius: 7px !important;
  box-shadow: none;
}

.df-dialog .df-input {
  min-height: 42px;
}

.df-dialog .df-input:focus,
.df-dialog .df-textarea:focus {
  border-color: var(--df-blue) !important;
  box-shadow: 0 0 0 1px var(--df-blue);
  outline: none;
}

.df-dialog .df-input::placeholder,
.df-dialog .df-textarea::placeholder {
  color: #777d87;
}

.df-dialog .df-editor {
  overflow: hidden;
  background: var(--df-panel);
  border: 1px solid var(--df-border);
  border-radius: 8px;
}

.df-dialog .df-toolbar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px;
  padding: 8px;
  background: #292a2f;
  border-bottom: 1px solid var(--df-border);
}

.df-dialog .df-tool {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 33px;
  height: 33px;
  color: var(--df-muted);
  background: transparent;
  border: 0;
  border-radius: 5px;
  cursor: pointer;
  transition: background 150ms ease, color 150ms ease;
}

.df-dialog .df-tool:hover {
  color: white;
  background: #404249;
}

.df-dialog .df-tool:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.df-dialog .df-toolbar-divider {
  width: 1px;
  height: 22px;
  margin: 0 4px;
  background: var(--df-border);
}

.df-dialog .df-uploading {
  margin-left: auto;
  padding: 0 6px;
  color: #a5b4fc;
  font-size: 11px;
  font-weight: 700;
}

.df-dialog .df-textarea {
  display: block;
  min-height: 220px;
  padding: 14px;
  resize: vertical;
  border: 0 !important;
  border-radius: 0 !important;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 13px;
  line-height: 1.7;
}

.df-dialog .df-hint {
  margin: 7px 0 0;
  color: var(--df-subtle);
  font-size: 11px;
  line-height: 1.5;
}

.df-dialog .df-preview {
  max-height: 280px;
  overflow: auto;
  padding: 15px;
  color: var(--df-text);
  background: var(--df-panel);
  border: 1px solid var(--df-border);
  border-radius: 8px;
}

/* Markdown */

.df-dialog .df-markdown,
.df-dialog .df-preview {
  overflow-wrap: anywhere;
  line-height: 1.7;
}

.df-dialog .df-markdown p,
.df-dialog .df-preview p {
  margin: 0 0 12px;
}

.df-dialog .df-markdown h1,
.df-dialog .df-markdown h2,
.df-dialog .df-markdown h3,
.df-dialog .df-preview h1,
.df-dialog .df-preview h2,
.df-dialog .df-preview h3 {
  margin: 20px 0 10px;
  color: var(--df-text);
  font-weight: 800;
  line-height: 1.3;
}

.df-dialog .df-markdown h1,
.df-dialog .df-preview h1 {
  font-size: 24px;
}

.df-dialog .df-markdown h2,
.df-dialog .df-preview h2 {
  font-size: 20px;
}

.df-dialog .df-markdown h3,
.df-dialog .df-preview h3 {
  font-size: 17px;
}

.df-dialog .df-markdown ul,
.df-dialog .df-markdown ol,
.df-dialog .df-preview ul,
.df-dialog .df-preview ol {
  margin: 8px 0 14px;
  padding-left: 25px;
}

.df-dialog .df-markdown li,
.df-dialog .df-preview li {
  margin: 4px 0;
}

.df-dialog .df-markdown blockquote,
.df-dialog .df-preview blockquote {
  margin: 12px 0;
  padding: 4px 12px;
  color: var(--df-muted);
  border-left: 4px solid var(--df-blue);
}

.df-dialog .df-markdown pre,
.df-dialog .df-preview pre {
  overflow-x: auto;
  padding: 12px;
  background: #1e1f22;
  border: 1px solid var(--df-border);
  border-radius: 6px;
}

.df-dialog .df-markdown code,
.df-dialog .df-preview code {
  padding: 2px 4px;
  color: #c7d0ff;
  background: #232428;
  border-radius: 4px;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}

.df-dialog .df-markdown pre code,
.df-dialog .df-preview pre code {
  padding: 0;
  background: transparent;
}

.df-dialog .df-markdown img,
.df-dialog .df-preview img {
  display: block;
  max-width: 100%;
  height: auto;
  margin: 12px 0;
  border-radius: 8px;
}

.df-dialog .df-markdown a,
.df-dialog .df-preview a {
  color: #8ea1ff;
  text-decoration: none;
}

.df-dialog .df-markdown a:hover,
.df-dialog .df-preview a:hover {
  text-decoration: underline;
}

/* Acciones del editor */

.df-dialog .df-dialog-actions {
  display: flex;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 8px;
  padding-top: 16px;
  border-top: 1px solid var(--df-border);
}

/* Adaptación móvil */

@media (max-width: 640px) {
  .discord-forum {
    padding: 9px;
    border-radius: 8px;
  }

  .discord-forum .df-header-content {
    align-items: stretch;
    padding: 15px;
  }

  .discord-forum .df-brand {
    gap: 10px;
  }

  .discord-forum .df-logo {
    width: 43px;
    height: 43px;
  }

  .discord-forum .df-title {
    font-size: 21px;
  }

  .discord-forum .df-header-actions {
    align-items: stretch;
    flex-direction: column;
  }

  .discord-forum .df-search,
  .discord-forum .df-search .df-input,
  .discord-forum .df-header-actions .df-primary-button {
    width: 100%;
  }

  .discord-forum .df-header-footer {
    flex-wrap: wrap;
    padding: 10px 15px;
  }

  .discord-forum .df-post {
    gap: 10px;
    padding: 12px;
  }

  .discord-forum .df-post-icon {
    width: 35px;
    height: 35px;
  }

  .discord-forum .df-post-title {
    font-size: 14px;
  }

  .discord-forum .df-post-arrow {
    display: none;
  }

  .df-dialog .df-dialog-title {
    font-size: 19px;
  }

  .df-dialog .df-dialog-actions {
    flex-direction: column-reverse;
  }

  .df-dialog .df-dialog-actions button {
    width: 100%;
  }
}

import { useEffect, useState } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import sapdLogo from "@/assets/sapd-logo.png.asset.json";
import { db, getToken } from "@/lib/db";
import { forceDiscordSync } from "@/lib/data.functions";
import { Session, logAction } from "@/lib/session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  getWebhookUrl, setWebhookUrl,
  getRnapWebhookUrl, setRnapWebhookUrl,
  getArchivoWebhookUrl, setArchivoWebhookUrl,
  getDiscordCodeLoginEnabled, setDiscordCodeLoginEnabled,
} from "@/lib/discord";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { getBackground, setBackground, fileToCompressedDataUrl } from "@/lib/appearance";
import { toast } from "sonner";
import { SECCIONES } from "@/lib/secciones";
import { LazyDiscordRoles } from "@/components/DiscordRoles";
import { Trash2, Shield, Webhook, FileText, Image as ImageIcon, RefreshCw, Settings, Users } from "lucide-react";


type Instructor = {
  id: string;
  name: string;
  is_alto_mando: boolean;
  role: string;
  can_delete: boolean;
  can_emit_rnap: boolean;
  can_edit_files: boolean;
  can_edit_pd: boolean;
  secciones: string[] | null;
  discord_username: string | null;
  discord_id: string | null;
  discord_inhabilitado: boolean;

  created_at: string;
  created_by: string | null;
};

type Log = {
  id: string;
  instructor_id: string | null;
  instructor_name: string | null;
  action: string;
  details: any;
  created_at: string;
};

export function AltoMando({ session }: { session: Session }) {
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [logs, setLogs] = useState<Log[]>([]);
  const [newId, setNewId] = useState("");
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState("Usuario");
  const [newDiscordId, setNewDiscordId] = useState("");

  const [webhook, setWebhook] = useState("");
  const [savingHook, setSavingHook] = useState(false);
  const [rnapHook, setRnapHook] = useState("");
  const [savingRnap, setSavingRnap] = useState(false);
  const [archivoHook, setArchivoHook] = useState("");
  const [savingArchivo, setSavingArchivo] = useState(false);
  const [bg, setBg] = useState("");
  const [savingBg, setSavingBg] = useState(false);
  const [discordCodeLoginEnabled, setDiscordCodeLoginEnabledState] = useState(true);
  const [savingDiscordLoginSetting, setSavingDiscordLoginSetting] = useState(false);
  const search = useSearch({ from: "/alto-mando" });
  const navigate = useNavigate({ from: "/alto-mando" });
  const activeSection = search.section;
  const setActiveSection = (section: "config" | "gestion") => navigate({ search: prev => ({ ...prev, section }) });
  const [syncingDiscord, setSyncingDiscord] = useState(false);


  async function loadAll() {
    const [i, l] = await Promise.all([
      db.from("instructors").select("*").order("created_at", { ascending: true }),
      db.from("logs").select("*").order("created_at", { ascending: false }).limit(200),
    ]);
    if (i.data) setInstructors(i.data as Instructor[]);
    if (l.data) setLogs(l.data as Log[]);
  }

  useEffect(() => {
    loadAll();
    getWebhookUrl(true).then(setWebhook);
    getRnapWebhookUrl(true).then(setRnapHook);
    getArchivoWebhookUrl(true).then(setArchivoHook);
    getBackground().then(setBg);
    getDiscordCodeLoginEnabled(true).then(setDiscordCodeLoginEnabledState);
  }, []);

  async function saveBg(value: string) {
    setSavingBg(true);
    try {
      await setBackground(value);
      setBg(value);
      await logAction(db, session, "UPDATE_BACKGROUND", { value: value ? "(set)" : "(cleared)" });
      toast.success(value ? "Fondo actualizado" : "Fondo restaurado");
    } catch (e: any) { toast.error(e.message ?? "Error"); }
    finally { setSavingBg(false); }
  }

  async function onBgFile(file?: File | null) {
    if (!file) return;
    try {
      const dataUrl = await fileToCompressedDataUrl(file);
      await saveBg(dataUrl);
    } catch (e: any) { toast.error(e.message ?? "Error al subir la imagen"); }
  }


  async function saveWebhook() {
    setSavingHook(true);
    try {
      await setWebhookUrl(webhook);
      await logAction(db, session, "UPDATE_WEBHOOK", { url: webhook ? "(set)" : "(cleared)" });
      toast.success("Webhook guardado");
    } catch (e: any) { toast.error(e.message ?? "Error"); }
    finally { setSavingHook(false); }
  }

  async function saveRnapWebhook() {
    setSavingRnap(true);
    try {
      await setRnapWebhookUrl(rnapHook);
      await logAction(db, session, "UPDATE_RNAP_WEBHOOK", { url: rnapHook ? "(set)" : "(cleared)" });
      toast.success("Webhook de RNAP guardado");
    } catch (e: any) { toast.error(e.message ?? "Error"); }
    finally { setSavingRnap(false); }
  }

  async function saveArchivoWebhook() {
    setSavingArchivo(true);
    try {
      await setArchivoWebhookUrl(archivoHook);
      await logAction(db, session, "UPDATE_ARCHIVO_WEBHOOK", { url: archivoHook ? "(set)" : "(cleared)" });
      toast.success("Webhook de Archivo guardado");
    } catch (e: any) { toast.error(e.message ?? "Error"); }
    finally { setSavingArchivo(false); }
  }

  async function saveDiscordCodeLoginEnabled(value: boolean) {
    setSavingDiscordLoginSetting(true);
    try {
      await setDiscordCodeLoginEnabled(value);
      setDiscordCodeLoginEnabledState(value);
      await logAction(db, session, "UPDATE_DISCORD_CODE_LOGIN_VISIBILITY", { enabled: value });
      toast.success(value ? "Acceso por código de Discord visible en el login" : "Acceso por código de Discord oculto en el login");
    } catch (e: any) {
      toast.error(e.message ?? "No se pudo guardar la configuración");
    } finally {
      setSavingDiscordLoginSetting(false);
    }
  }

  async function resyncDiscord() {
    if (!confirm("¿Iniciar una resincronización completa de los miembros con el rol Policía en Discord?")) return;
    setSyncingDiscord(true);
    try {
      const token = getToken();
      if (!token) throw new Error("Tu sesión expiró. Volvé a iniciar sesión.");
      const result = await forceDiscordSync({ data: { token } });
      if (!result.ok) throw new Error(result.error);
      await logAction(db, session, "DISCORD_FULL_RESYNC", { total: result.total, created: result.created, datesUpdated: result.datesUpdated, renamed: result.renamed });
      toast.success(`Sincronización completa: ${result.total} policías revisados, ${result.datesUpdated} fechas actualizadas, ${result.created} usuarios creados y ${result.renamed} apodos corregidos.`);
      await loadAll();
    } catch (e: any) {
      toast.error(e.message ?? "No se pudo sincronizar Discord.");
    } finally {
      setSyncingDiscord(false);
    }
  }

  async function createInstructor(e: React.FormEvent) {
    e.preventDefault();
    const id = newId.trim().toUpperCase();
    const name = newName.trim();
    if (!id || !name) return toast.error("ID y nombre requeridos");
    const isAlto = newRole === "Comisario";
    const { error } = await db.from("instructors").insert({
      id, name,
      discord_id: newDiscordId.trim(),
      is_alto_mando: isAlto,
      role: newRole,
      can_delete: isAlto,
      can_emit_rnap: isAlto,
      created_by: session.id,
    } as any);
    if (error) return toast.error(error.message);
    await logAction(db, session, "CREATE_ID", { id, name, role: newRole });
    toast.success(`ID ${id} (${name}) creado como ${newRole}`);
    setNewId(""); setNewName(""); setNewRole("Usuario"); setNewDiscordId("");
    loadAll();
  }

  async function removeInstructor(id: string, name: string) {
    if (id === session.id) return toast.error("No puedes eliminarte a ti mismo");
    if (!confirm(`¿Eliminar ID ${id} (${name})?`)) return;
    const { error } = await db.from("instructors").delete().eq("id", id);
    if (error) return toast.error(error.message);
    await logAction(db, session, "DELETE_ID", { id, name });
    loadAll();
  }

  async function togglePerm(i: Instructor, field: "can_delete" | "can_emit_rnap" | "can_edit_files" | "can_edit_pd", value: boolean) {
    if (i.is_alto_mando) { toast.info("Los Comisarios tienen todos los permisos"); return; }
    setInstructors(prev => prev.map(x => x.id === i.id ? { ...x, [field]: value } : x));
    const { error } = await db.from("instructors").update({ [field]: value } as any).eq("id", i.id);
    if (error) { toast.error(error.message); loadAll(); return; }
    await logAction(db, session, "UPDATE_PERM", { id: i.id, name: i.name, field, value });
  }

  async function toggleSeccion(i: Instructor, key: string) {
    const cur = i.secciones ?? [];
    const next = cur.includes(key) ? cur.filter(k => k !== key) : [...cur, key];
    setInstructors(prev => prev.map(x => x.id === i.id ? { ...x, secciones: next } : x));
    const { error } = await db.from("instructors").update({ secciones: next } as any).eq("id", i.id);
    if (error) { toast.error(error.message); loadAll(); return; }
    await logAction(db, session, "UPDATE_SECCIONES", { id: i.id, name: i.name, secciones: next });
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-primary">Administración</p>
          <h1 className="text-2xl font-black uppercase tracking-wide font-display">Panel de Administración</h1>
          <p className="text-sm text-muted-foreground">Configuración de la web y gestión de usuarios y actividad.</p>
        </div>
        <div className="flex flex-wrap gap-2 border-b pb-3">
          <Button type="button" variant={activeSection === "config" ? "default" : "outline"} onClick={() => setActiveSection("config")} className="gap-2">
            <Settings className="h-4 w-4" /> Configuración Web
          </Button>
          <Button type="button" variant={activeSection === "gestion" ? "default" : "outline"} onClick={() => setActiveSection("gestion")} className="gap-2">
            <Users className="h-4 w-4" /> Gestión
          </Button>
        </div>
      </div>
      {activeSection === "gestion" && <>
      {/* CREAR ID */}
      <Card className="overflow-hidden border border-blue-200 bg-white shadow-sm rounded-none">
        <div className="h-1 bg-blue-600" />
        <div className="p-5 space-y-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 flex items-center justify-center bg-white border border-blue-200 p-1">
              <img src={sapdLogo.url} alt="SAPD" className="w-full h-full object-contain" />
            </div>
            <div>
              <p className="text-blue-600 text-xs uppercase tracking-[0.3em] font-bold">
                San Andreas Police Department
              </p>
              <h2 className="text-2xl font-black uppercase tracking-wide text-slate-900 font-display">
                Crear Nuevo ID
              </h2>
            </div>
          </div>
          <form onSubmit={createInstructor} className="grid gap-3 md:grid-cols-5">
            <Input placeholder="ID de acceso" value={newId}
              onChange={e => setNewId(e.target.value)}
              className="h-11 rounded-none border-blue-300 bg-white text-slate-800 font-mono uppercase focus:border-blue-600" />
            <Input placeholder="Nombre" value={newName}
              onChange={e => setNewName(e.target.value)}
              className="h-11 rounded-none border-blue-300 bg-white text-slate-800 focus:border-blue-600" />
            <Input placeholder="ID de Discord" aria-label="ID de Discord del nuevo usuario" required inputMode="numeric" value={newDiscordId} onChange={e => setNewDiscordId(e.target.value.replace(/\D/g, ""))} />
            <Select value={newRole} onValueChange={setNewRole}>
              <SelectTrigger className="h-11 rounded-none border-blue-300 bg-white text-slate-800">
                <SelectValue placeholder="Rol" />
              </SelectTrigger>
              <SelectContent className="bg-white border border-blue-200 text-slate-800 rounded-none">
                <SelectItem value="Comisario">Comisario (Alto Mando)</SelectItem>
                <SelectItem value="Cupula">Cúpula</SelectItem>
              </SelectContent>
            </Select>
            <Button type="submit"
              className="h-11 rounded-none bg-blue-600 hover:bg-blue-700 text-white font-semibold tracking-wider">
              Crear ID
            </Button>
          </form>
        </div>
      </Card>

      </>}
      {activeSection === "config" && <>
      {/* WEBHOOKS */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="overflow-hidden border border-blue-200 bg-white shadow-sm rounded-none">
          <div className="h-1 bg-blue-600" />
          <div className="p-5 space-y-4">
            <div className="flex items-center gap-3">
              <Webhook className="w-5 h-5 text-blue-600" />
              <h2 className="text-xl font-black uppercase tracking-wide text-slate-900 font-display">
                Webhook de Cambios
              </h2>
            </div>
            <p className="text-slate-500 text-sm">
              Notificaciones de cambios en Ex Policías y Aspirantes.
            </p>
            <div className="flex gap-2">
              <Input value={webhook} onChange={e => setWebhook(e.target.value)}
                placeholder="https://discord.com/api/webhooks/..."
                className="h-11 rounded-none border-blue-300 bg-white text-slate-800 font-mono text-sm" />
              <Button onClick={saveWebhook} disabled={savingHook}
                className="h-11 rounded-none bg-blue-600 hover:bg-blue-700 text-white font-semibold">
                {savingHook ? "..." : "Guardar"}
              </Button>
            </div>
          </div>
        </Card>

        <Card className="overflow-hidden border border-blue-200 bg-white shadow-sm rounded-none">
          <div className="h-1 bg-blue-600" />
          <div className="p-5 space-y-4">
            <div className="flex items-center gap-3">
              <FileText className="w-5 h-5 text-blue-600" />
              <h2 className="text-xl font-black uppercase tracking-wide text-slate-900 font-display">
                Enviar RNAP
              </h2>
            </div>
            <p className="text-slate-500 text-sm">
              Canal al que se enviará la imagen del RNAP al presionar “Enviar a Discord”.
            </p>
            <div className="flex gap-2">
              <Input value={rnapHook} onChange={e => setRnapHook(e.target.value)}
                placeholder="https://discord.com/api/webhooks/..."
                className="h-11 rounded-none border-blue-300 bg-white text-slate-800 font-mono text-sm" />
              <Button onClick={saveRnapWebhook} disabled={savingRnap}
                className="h-11 rounded-none bg-blue-600 hover:bg-blue-700 text-white font-semibold">
                {savingRnap ? "..." : "Guardar"}
              </Button>
            </div>
          </div>
        </Card>

        <Card className="overflow-hidden border border-blue-200 bg-white shadow-sm rounded-none">
          <div className="h-1 bg-blue-600" />
          <div className="p-5 space-y-4">
            <div className="flex items-center gap-3">
              <FileText className="w-5 h-5 text-blue-600" />
              <h2 className="text-xl font-black uppercase tracking-wide text-slate-900 font-display">
                Webhook de Archivo
              </h2>
            </div>
            <p className="text-slate-500 text-sm">
              Canal al que se enviarán las fichas del Archivo de Personas.
            </p>
            <div className="flex gap-2">
              <Input value={archivoHook} onChange={e => setArchivoHook(e.target.value)}
                placeholder="https://discord.com/api/webhooks/..."
                className="h-11 rounded-none border-blue-300 bg-white text-slate-800 font-mono text-sm" />
              <Button onClick={saveArchivoWebhook} disabled={savingArchivo}
                className="h-11 rounded-none bg-blue-600 hover:bg-blue-700 text-white font-semibold">
                {savingArchivo ? "..." : "Guardar"}
              </Button>
            </div>
          </div>
        </Card>
      </div>

      {/* FONDO DE LA WEB */}
      <Card className="overflow-hidden border-2 border-blue-300 bg-white shadow-md rounded-none">
        <div className="h-1.5 bg-blue-700" />
        <div className="p-5 space-y-4">
          <div className="flex items-center gap-3">
            <ImageIcon className="w-5 h-5 text-blue-700" />
            <h2 className="text-xl font-black uppercase tracking-wide text-slate-900 font-display">
              Fondo de la Web
            </h2>
          </div>
          <p className="text-slate-500 text-sm font-semibold">
            Pega un enlace de imagen o sube una desde tu equipo. Se mostrará detrás de las tablas.
          </p>
          <div className="flex flex-col lg:flex-row gap-3">
            <Input value={bg.startsWith("data:") ? "" : bg}
              onChange={e => setBg(e.target.value)}
              placeholder={bg.startsWith("data:") ? "(imagen subida)" : "https://…/fondo.jpg"}
              className="h-11 rounded-none border-blue-300 bg-white text-slate-800 font-mono text-sm" />
            <Button onClick={() => saveBg(bg)} disabled={savingBg}
              className="h-11 rounded-none bg-blue-700 hover:bg-blue-800 text-white font-bold">
              {savingBg ? "..." : "Guardar enlace"}
            </Button>
            <label className="h-11 px-4 inline-flex items-center justify-center border-2 border-blue-300 bg-white text-blue-800 font-bold cursor-pointer hover:bg-blue-50">
              Subir imagen
              <input type="file" accept="image/*" className="hidden"
                onChange={e => onBgFile(e.target.files?.[0])} />
            </label>
            <Button variant="outline" onClick={() => saveBg("")} disabled={savingBg}
              className="h-11 rounded-none border-blue-300 bg-white text-slate-700 font-bold">
              Quitar fondo
            </Button>
          </div>
          {bg && (
            <div className="border-2 border-blue-300 h-32 bg-slate-100 bg-center bg-cover"
              style={{ backgroundImage: `url(${bg})` }} />
          )}
        </div>
      </Card>



      <Card className="overflow-hidden border border-blue-200 bg-white shadow-sm rounded-none">
        <div className="h-1 bg-blue-600" />
        <div className="p-5 space-y-3">
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-1">
              <h2 className="text-lg font-black uppercase tracking-wide text-slate-900 font-display">Acceso por código de Discord</h2>
              <p className="text-sm text-slate-600">Controla si aparece en el login la opción para solicitar un código por mensaje directo de Discord. El ingreso habitual mediante ID permanece disponible.</p>
            </div>
            <Switch checked={discordCodeLoginEnabled} disabled={savingDiscordLoginSetting}
              onCheckedChange={saveDiscordCodeLoginEnabled} />
          </div>
          <p className="text-xs font-bold text-slate-500">{discordCodeLoginEnabled ? "Visible en el login" : "Oculto en el login"}</p>
        </div>
      </Card>

      <Card className="overflow-hidden border-2 border-blue-300 bg-white shadow-md rounded-none">
        <div className="h-1.5 bg-blue-700" />
        <div className="p-5 space-y-3">
          <div className="flex items-center gap-3">
            <RefreshCw className="w-5 h-5 text-blue-700" />
            <h2 className="text-xl font-black uppercase tracking-wide text-slate-900 font-display">Sincronizar bot de Discord</h2>
          </div>
          <p className="text-slate-600 text-sm">Vuelve a recorrer los miembros del servidor que tengan el rol Policía, crea los usuarios que falten y actualiza sus fechas de ingreso y apodos. Esta acción fuerza una sincronización aunque se haya ejecutado hace menos de 10 minutos.</p>
          <Button onClick={resyncDiscord} disabled={syncingDiscord} className="gap-2 bg-blue-700 hover:bg-blue-800 text-white">
            <RefreshCw className={`h-4 w-4 ${syncingDiscord ? "animate-spin" : ""}`} />
            {syncingDiscord ? "Sincronizando Discord..." : "Resincronizar todos los miembros"}
          </Button>
        </div>
      </Card>

      </>}
      {activeSection === "gestion" && <>
      {/* INSTRUCTORES + PERMISOS */}
      <Card className="overflow-hidden border border-blue-200 bg-white shadow-sm rounded-none">
        <div className="h-1 bg-blue-600" />
        <div className="p-5 space-y-4">
          <h2 className="text-2xl font-black uppercase tracking-wide text-slate-900 font-display">
            Personal Autorizado
          </h2>
          <div className="border border-blue-200">
            <table className="w-full text-sm font-table">
              <thead>
                <tr className="bg-blue-600 text-white">
                  <th className="p-3 text-left border border-blue-500 uppercase font-bold">ID</th>
                  <th className="p-3 text-left border border-blue-500 uppercase font-bold">Nombre</th>
                  <th className="p-3 text-left border border-blue-500 uppercase font-bold">Rol</th>
                  <th className="p-3 text-center border border-blue-500 uppercase font-bold">Borrar agentes</th>
                  <th className="p-3 text-center border border-blue-500 uppercase font-bold">Emitir RNAP</th>
                  <th className="p-3 text-center border border-blue-500 uppercase font-bold">Editar Archivos</th>
                  <th className="p-3 text-center border border-blue-500 uppercase font-bold">Registro PD</th>
                  <th className="p-3 text-left border border-blue-500 uppercase font-bold">Apartados visibles</th>

                  <th className="p-3 text-left border border-blue-500 uppercase font-bold">Creado por</th>
                  <th className="p-3 border border-blue-500 w-10" />
                </tr>
              </thead>
              <tbody>
                {instructors.map(i => (
                  <tr key={i.id} className="border-t border-slate-200 hover:bg-blue-50 transition-colors">
                    <td className="p-3 font-mono text-slate-700 border border-slate-200">{i.id}</td>
                    <td className="p-3 text-slate-700 border border-slate-200">{i.name}
                      {i.discord_inhabilitado && <span className="mt-1 block w-fit border border-destructive/30 bg-destructive/10 px-2 py-1 text-xs font-bold text-destructive">Inhabilitado</span>}
                      <Input aria-label={`ID de Discord de ${i.name}`} placeholder="Vincular ID de Discord" defaultValue={i.discord_id ?? ""} key={`${i.id}-${i.discord_id ?? ""}`} inputMode="numeric" className="mt-2 min-w-40 text-xs" onBlur={async e => {
                        const discordId = e.target.value.trim();
                        if (discordId === (i.discord_id ?? "")) return;
                        if (!/^\d{17,20}$/.test(discordId)) { toast.error("ID de Discord inválido"); return; }
                        const { error } = await db.from("instructors").update({ discord_id: discordId }).eq("id", i.id);
                        if (error) toast.error(error.message); else { toast.success("Discord vinculado"); loadAll(); }
                      }} />
                      {i.discord_username && (
                      <>
                        <span className="block text-[11px] text-slate-400">@{i.discord_username}</span>
                        <LazyDiscordRoles targetId={i.id} />
                      </>
                    )}</td>
                    <td className="p-3 border border-slate-200">
                      {i.role === "Comisario" ? (
                        <span className="inline-flex items-center gap-2 text-blue-700 font-semibold">
                          <Shield className="w-4 h-4" /> Comisario
                        </span>
                      ) : (
                        <span className="text-slate-600">{i.role}</span>
                      )}
                    </td>
                    <td className="p-3 text-center border border-slate-200">
                      <Switch
                        checked={i.is_alto_mando || !!i.can_delete}
                        disabled={i.is_alto_mando}
                        onCheckedChange={v => togglePerm(i, "can_delete", v)}
                      />
                    </td>
                    <td className="p-3 text-center border border-slate-200">
                      <Switch
                        checked={i.is_alto_mando || !!i.can_emit_rnap}
                        disabled={i.is_alto_mando}
                        onCheckedChange={v => togglePerm(i, "can_emit_rnap", v)}
                      />
                    </td>
                    <td className="p-3 text-center border border-slate-200">
                      <Switch
                        checked={i.is_alto_mando || !!i.can_edit_files}
                        disabled={i.is_alto_mando}
                        onCheckedChange={v => togglePerm(i, "can_edit_files", v)}
                      />
                    </td>
                    <td className="p-3 text-center border border-slate-200">
                      <Switch
                        checked={i.is_alto_mando || !!i.can_edit_pd}
                        disabled={i.is_alto_mando}
                        onCheckedChange={v => togglePerm(i, "can_edit_pd", v)}
                      />
                    </td>
                    <td className="p-2 border border-slate-200 min-w-[260px]">
                      {i.is_alto_mando ? (
                        <span className="text-xs text-slate-500 font-bold">Todos</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {SECCIONES.map(sec => {
                            const on = (i.secciones ?? []).includes(sec.key);
                            return (
                              <button key={sec.key} type="button" onClick={() => toggleSeccion(i, sec.key)}
                                aria-pressed={on}
                                className={`px-2 py-0.5 text-[11px] font-bold border ${on ? "bg-blue-600 text-white border-blue-700" : "bg-white text-slate-500 border-slate-300"}`}>
                                {sec.label}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </td>

                    <td className="p-3 text-slate-500 border border-slate-200">{i.created_by ?? "—"}</td>
                    <td className="p-3 text-center border border-slate-200">
                      <Button size="icon" variant="ghost"
                        onClick={() => removeInstructor(i.id, i.name)}
                        className="h-8 w-8 rounded-none hover:bg-red-100">
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </Button>
                    </td>
                  </tr>
                ))}
                {instructors.length === 0 && (
                  <tr>
                    <td colSpan={9} className="p-10 text-center text-slate-400 uppercase tracking-widest">
                      Sin personal autorizado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </Card>

      {/* LOGS */}
      <Card className="border border-blue-200 bg-white shadow-sm rounded-none">
        <div className="p-5 space-y-4">
          <h2 className="text-2xl font-black uppercase tracking-wide text-slate-900 font-display">
            Registro de Movimientos
          </h2>
          <div className="border border-blue-200 max-h-[500px] overflow-auto">
            <table className="w-full text-sm font-table">
              <thead className="sticky top-0">
                <tr className="bg-blue-600 text-white">
                  <th className="p-3 text-left border border-blue-500 uppercase font-bold">Fecha</th>
                  <th className="p-3 text-left border border-blue-500 uppercase font-bold">ID</th>
                  <th className="p-3 text-left border border-blue-500 uppercase font-bold">Nombre</th>
                  <th className="p-3 text-left border border-blue-500 uppercase font-bold">Acción</th>
                  <th className="p-3 text-left border border-blue-500 uppercase font-bold">Detalles</th>
                </tr>
              </thead>
              <tbody>
                {logs.map(l => (
                  <tr key={l.id} className="border-t border-slate-200 hover:bg-blue-50 transition-colors">
                    <td className="p-3 text-xs text-slate-500 whitespace-nowrap border border-slate-200">
                      {new Date(l.created_at).toLocaleString()}
                    </td>
                    <td className="p-3 font-mono text-slate-700 border border-slate-200">{l.instructor_id ?? "—"}</td>
                    <td className="p-3 text-slate-700 border border-slate-200">{l.instructor_name ?? "—"}</td>
                    <td className="p-3 font-semibold text-blue-700 border border-slate-200">{l.action}</td>
                    <td className="p-3 text-xs text-slate-500 max-w-[300px] border border-slate-200">
                      {l.details ? JSON.stringify(l.details) : "—"}
                    </td>
                  </tr>
                ))}
                {logs.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-10 text-center text-slate-400 uppercase tracking-widest">
                      Sin movimientos aún.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </Card>
      </>}
    </div>
  );
}

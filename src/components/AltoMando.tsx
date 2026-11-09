import { useEffect, useState } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
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
  getSalaryTabVisibility, setHideSalaryTab, setHideManualSalaryTab,
} from "@/lib/discord";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { getBackground, setBackground, fileToCompressedDataUrl } from "@/lib/appearance";
import { toast } from "sonner";
import { ADMIN_RANGOS, ADMIN_RANGO_LABELS, ADMIN_RANGO_DESC, normalizeRango, type AdminRango } from "@/lib/adminRango";
import { Webhook, FileText, Image as ImageIcon, RefreshCw, Settings, Users, Pencil, KeyRound, MessageCircle } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";


type Instructor = {
  id: string;
  name: string;
  admin_rango: string | null;
  discord_username: string | null;
  discord_id: string | null;
};

export function AltoMando({ session }: { session: Session }) {
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [editingUser, setEditingUser] = useState<Instructor | null>(null);
  const [editingRank, setEditingRank] = useState<AdminRango>("usuario");
  const [savingRank, setSavingRank] = useState(false);

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
  const [hideSalaryTab, setHideSalaryTabState] = useState(false);
  const [hideManualSalaryTab, setHideManualSalaryTabState] = useState(false);
  const [savingSalaryVisibility, setSavingSalaryVisibility] = useState<"normal" | "manual" | null>(null);
  const search = useSearch({ from: "/alto-mando" });
  const navigate = useNavigate({ from: "/alto-mando" });
  const activeSection = search.section;
  const setActiveSection = (section: "config" | "gestion") => navigate({ search: prev => ({ ...prev, section }) });
  const [syncingDiscord, setSyncingDiscord] = useState(false);


  async function loadAll() {
    const { data, error } = await db.from("instructors")
      .select("id, name, admin_rango, discord_username, discord_id")
      .order("created_at", { ascending: true });
    if (error) { toast.error(error.message); return; }
    if (data) setInstructors(data as Instructor[]);
  }

  useEffect(() => {
    loadAll();
    getWebhookUrl(true).then(setWebhook);
    getRnapWebhookUrl(true).then(setRnapHook);
    getArchivoWebhookUrl(true).then(setArchivoHook);
    getBackground().then(setBg);
    getDiscordCodeLoginEnabled(true).then(setDiscordCodeLoginEnabledState);
    getSalaryTabVisibility(true).then(v => { setHideSalaryTabState(v.hideSalary); setHideManualSalaryTabState(v.hideManualSalary); });
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

  async function saveSalaryVisibility(which: "normal" | "manual", hidden: boolean) {
    setSavingSalaryVisibility(which);
    try {
      if (which === "normal") { await setHideSalaryTab(hidden); setHideSalaryTabState(hidden); }
      else { await setHideManualSalaryTab(hidden); setHideManualSalaryTabState(hidden); }
      await logAction(db, session, "UPDATE_SALARY_TAB_VISIBILITY", { tab: which, hidden });
      toast.success(hidden ? "Pestaña ocultada" : "Pestaña visible nuevamente");
      window.dispatchEvent(new Event("salary-tabs-visibility-change"));
    } catch (e: any) { toast.error(e.message ?? "No se pudo guardar la configuración"); }
    finally { setSavingSalaryVisibility(null); }
  }

  async function resyncDiscord() {
    if (!confirm("¿Iniciar una resincronización completa? Se actualizarán los perfiles, rangos y estado de Instructor en la web, además de los apodos de Discord para los miembros con el rol Policía.")) return;
    setSyncingDiscord(true);
    try {
      const token = getToken();
      if (!token) throw new Error("Tu sesión expiró. Volvé a iniciar sesión.");
      const result = await forceDiscordSync({ data: { token } });
      if (!result.ok) throw new Error(result.error);
      await logAction(db, session, "DISCORD_FULL_RESYNC", { total: result.total, created: result.created, datesUpdated: result.datesUpdated, renamed: result.renamed });
      toast.success("Sincronización completa: " + result.total + " policías revisados, " + result.datesUpdated + " fechas actualizadas, " + result.created + " usuarios creados y " + result.renamed + " apodos corregidos. Se actualizaron rangos y estado de Instructor en la web.");
      await loadAll();
    } catch (e: any) {
      toast.error(e.message ?? "No se pudo sincronizar Discord.");
    } finally {
      setSyncingDiscord(false);
    }
  }

  function openRankEditor(user: Instructor) {
    setEditingUser(user);
    setEditingRank(normalizeRango(user.admin_rango));
  }

  async function saveRank() {
    if (!editingUser) return;
    if (editingUser.id === session.id && editingRank !== "administrador") {
      toast.error("No podés quitarte el rango Administrador.");
      return;
    }
    setSavingRank(true);
    const { error } = await db.from("instructors").update({
      admin_rango: editingRank,
      is_alto_mando: editingRank === "administrador",
    } as any).eq("id", editingUser.id);
    setSavingRank(false);
    if (error) { toast.error(error.message); return; }
    await logAction(db, session, "UPDATE_ADMIN_RANGO", {
      id: editingUser.id, name: editingUser.name, rango: editingRank,
    });
    toast.success(`Rango de ${editingUser.name} actualizado a ${ADMIN_RANGO_LABELS[editingRank]}.`);
    setEditingUser(null);
    await loadAll();
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
        <div className="p-5 space-y-4">
          <div><h2 className="text-lg font-black uppercase tracking-wide text-slate-900 font-display">Visibilidad de pestañas de salarios</h2>
            <p className="text-sm text-slate-600">Oculta o muestra cada apartado en el menú lateral. Esto no elimina ni modifica sus datos.</p></div>
          <div className="flex items-center justify-between gap-4 border-t pt-3">
            <div><p className="font-bold text-slate-800">Ocultar pestaña: «Salarios»</p><p className="text-xs text-slate-500">{hideSalaryTab ? "Actualmente oculta" : "Actualmente visible"}</p></div>
            <Switch checked={hideSalaryTab} disabled={savingSalaryVisibility !== null} onCheckedChange={value => saveSalaryVisibility("normal", value)} />
          </div>
          <div className="flex items-center justify-between gap-4 border-t pt-3">
            <div><p className="font-bold text-slate-800">Ocultar pestaña: «[M] Salarios»</p><p className="text-xs text-slate-500">{hideManualSalaryTab ? "Actualmente oculta" : "Actualmente visible"}</p></div>
            <Switch checked={hideManualSalaryTab} disabled={savingSalaryVisibility !== null} onCheckedChange={value => saveSalaryVisibility("manual", value)} />
          </div>
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
          <p className="text-slate-600 text-sm">Recorre los miembros con el rol Policía, crea los usuarios que falten y sincroniza perfiles, etiquetas, rangos y fechas. El rango se obtiene de la etiqueta del apodo. El estado de Instructor se administra manualmente desde Registro PD y no se sincroniza desde roles de Discord. Esta acción fuerza una sincronización aunque se haya ejecutado hace menos de 10 minutos.</p>
          <Button onClick={resyncDiscord} disabled={syncingDiscord} className="gap-2 bg-blue-700 hover:bg-blue-800 text-white">
            <RefreshCw className={`h-4 w-4 ${syncingDiscord ? "animate-spin" : ""}`} />
            {syncingDiscord ? "Sincronizando Discord..." : "Resincronizar todos los miembros"}
          </Button>
        </div>
      </Card>

      </>}
      {activeSection === "gestion" && <>
        <Card className="overflow-hidden border-0 bg-card shadow-sm">
          <div className="p-5 sm:p-6 space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold tracking-tight">Usuarios del sistema</h2>
                <p className="mt-1 text-sm text-muted-foreground">Administrá el rango de moderación de cada cuenta desde su perfil.</p>
              </div>
            <div className="space-y-2">
              {instructors.map(user => {
                return (
                  <div key={user.id} className="flex flex-col gap-3 rounded-2xl bg-muted/35 p-4 sm:flex-row sm:items-center">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold">{user.name}</p>
                      </div>
                      <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
                        <div className="flex min-w-0 items-center gap-2 text-muted-foreground">
                          <KeyRound className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate font-mono" title={user.id}>Clave de acceso: {user.id}</span>
                        </div>
                        <div className="flex min-w-0 items-center gap-2 text-muted-foreground">
                          <MessageCircle className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">{user.discord_username ? `@${user.discord_username}` : "Discord sin vincular"}</span>
                          {user.discord_id && <span className="truncate font-mono opacity-70">· {user.discord_id}</span>}
                        </div>
                      </div>
                    </div>
                    <Button type="button" variant="ghost" size="icon" title="Editar rango administrativo" aria-label={`Editar rango de ${user.name}`} className="shrink-0 rounded-xl" onClick={() => openRankEditor(user)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })}
              {instructors.length === 0 && <p className="rounded-xl bg-muted/40 p-8 text-center text-sm text-muted-foreground">Todavía no hay usuarios registrados.</p>}
            </div>
            <p className="text-xs text-muted-foreground">La clave de acceso actual es el ID de cuenta que se utiliza en el inicio de sesión; no existe una contraseña independiente.</p>
          </div>
        </Card>

        <Dialog open={!!editingUser} onOpenChange={open => { if (!open && !savingRank) setEditingUser(null); }}>
          <DialogContent className="sm:max-w-md rounded-2xl">
            <DialogHeader>
              <DialogTitle>Editar rango administrativo</DialogTitle>
              <DialogDescription>
                {editingUser ? `Seleccioná el rango de moderación para ${editingUser.name}. Esto no modifica su rango policial.` : ""}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <div className="rounded-xl bg-muted/50 p-3">
                <p className="text-sm font-semibold">{editingUser?.name}</p>
                <p className="mt-1 text-xs font-mono text-muted-foreground">{editingUser?.id}</p>
              </div>
              <Select value={editingRank} onValueChange={value => setEditingRank(value as AdminRango)}>
                <SelectTrigger><SelectValue placeholder="Seleccionar rango" /></SelectTrigger>
                <SelectContent>
                  {ADMIN_RANGOS.map(r => <SelectItem key={r} value={r}>{ADMIN_RANGO_LABELS[r]}</SelectItem>)}
                </SelectContent>
              </Select>
              <div className="rounded-xl bg-muted/50 p-3 text-sm text-muted-foreground">{ADMIN_RANGO_DESC[editingRank]}</div>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setEditingUser(null)} disabled={savingRank}>Cancelar</Button>
              <Button type="button" onClick={saveRank} disabled={savingRank || !editingUser}>{savingRank ? "Guardando…" : "Guardar rango"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>}
    </div>
  );
}
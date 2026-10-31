import { useEffect, useMemo, useState } from "react";
import sapdLogo from "@/assets/sapd-logo.png.asset.json";
import { db } from "@/lib/db";
import { ProfileCard, type ProfileUser } from "@/components/ProfileCard";
import { personnelForUser } from "@/lib/pdProfile";
import { Session, logAction } from "@/lib/session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { RANGOS, RANGO_PLURAL, DIVISIONES, DIVISION_RANGOS, sortByRango } from "@/lib/rangos";
import { fileToCompressedDataUrl } from "@/lib/appearance";
import { toast } from "sonner";
import { Trash2, Plus, Pencil, BadgeCheck, UserRound, Upload } from "lucide-react";

type PdMember = {
  id: string;
  instructor_id: string | null;
  nombre: string;
  rango: string | null;
  foto: string | null;
  placa: string | null;
  division: string | null;
  division_rango: string | null;
  division2: string | null;
  division2_rango: string | null;
  sueldo_defecto: number;
  es_instructor: boolean;
  cap_m4: boolean;
  cap_edc: boolean;
  cap_mary: boolean;
  cap_sniper: boolean;
  cap_air: boolean;
  cap_ak47: boolean;
  created_at: string;
};

const CAPACITACIONES = [
  { key: "cap_m4", label: "M4" },
  { key: "cap_edc", label: "EDC" },
  { key: "cap_mary", label: "MARY" },
  { key: "cap_sniper", label: "SNIPER" },
  { key: "cap_air", label: "AIR" },
  { key: "cap_ak47", label: "AK47" },
] as const;
type CapKey = (typeof CAPACITACIONES)[number]["key"];

type Draft = {
  id?: string;
  instructor_id?: string;
  nombre: string;
  rango: string;
  foto: string;
  placa: string;
  division: string;
  division_rango: string;
  division2: string;
  division2_rango: string;
  sueldo_defecto: number;
};

const ROLES = [
  { value: "Comisario", label: "Encargado de SAPD", plural: "Comisarios" },
  { value: "Cupula", label: "Cúpula", plural: "Cúpula Administrativa" },
  { value: "Instructor", label: "Instructor", plural: "Instructores" },
  { value: "Usuario", label: "Agente", plural: "Agentes" },
];
const roleKey = (r: string | null) => (r && ROLES.some(x => x.value === r) ? r : "Usuario");

const emptyDraft: Draft = {
  nombre: "", rango: "Oficial", foto: "", placa: "",
  division: "Ninguna", division_rango: "Miembro",
  division2: "Ninguna", division2_rango: "Miembro", sueldo_defecto: 0,
};

export function RegistroPdView({ session }: { session: Session }) {
  const [members, setMembers] = useState<PdMember[]>([]);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [saving, setSaving] = useState(false);
  const [avatars, setAvatars] = useState<Record<string, string>>({});
  const [users, setUsers] = useState<{ id: string; name: string; avatar_url: string | null; role: string | null }[]>([]);
  const [capConfirm, setCapConfirm] = useState<{ m: PdMember; cap: CapKey; value: boolean } | null>(null);
  const [capSaving, setCapSaving] = useState(false);

  const canEdit = !!session.is_alto_mando || !!session.can_edit_pd;
  const canEditCaps = canEdit || session.role === "Instructor" || session.role === "Cupula";

  async function load() {
    const { data } = await db.from("pd_members").select("*").order("nombre", { ascending: true });
    if (data) setMembers(data as unknown as PdMember[]);
  }

  async function loadAvatars() {
    const { data } = await db.from("instructors").select("id, name, avatar_url, role, descripcion, banner_url, color_perfil, pronombres, discord_username, is_alto_mando, can_delete, can_emit_rnap, can_edit_files, can_edit_pd, secciones, placa, discord_inhabilitado");
    if (!data) return;
    setUsers(data as any);
    const map: Record<string, string> = {};
    (data as any[]).forEach(u => {
      if (u?.name) map[String(u.name).trim().toLowerCase()] = u.avatar_url || "";
      if (u?.name && u?.avatar_url) map[String(u.name).trim().toLowerCase()] = u.avatar_url;
    });
    setAvatars(map);
  }

  const fotoDe = (m: PdMember) =>
    avatars[m.nombre.trim().toLowerCase()] || m.foto || null;

  useEffect(() => { load(); loadAvatars(); }, []);

  function openNew() {
    setDraft(emptyDraft);
    setOpen(true);
  }

  function openEdit(u: { id: string; name: string }, m?: PdMember) {
    setDraft({
      id: m?.id,
      instructor_id: u.id,
      nombre: u.name,
      rango: m?.rango ?? "Oficial",
      foto: m?.foto ?? "",
      placa: m?.placa ?? "",
      division: m?.division ?? "Ninguna",
      division_rango: m?.division_rango ?? "Miembro",
      division2: m?.division2 ?? "Ninguna",
      division2_rango: m?.division2_rango ?? "Miembro",
      sueldo_defecto: Number(m?.sueldo_defecto) || 0,
    });
    setOpen(true);
  }

  async function pickFile(file: File) {
    try {
      const url = await fileToCompressedDataUrl(file);
      setDraft(d => ({ ...d, foto: url }));
    } catch {
      toast.error("No se pudo procesar la imagen");
    }
  }

  async function save() {
    const nombre = draft.nombre.trim();
    if (!nombre) return toast.error("Escribe el Nombre_Apellido");
    setSaving(true);
    const values = {
      nombre,
      ...(draft.instructor_id ? { instructor_id: draft.instructor_id } : {}),
      rango: draft.rango || null,
      foto: draft.foto.trim() || null,
      placa: draft.placa.trim() || null,
      ...(session.is_alto_mando ? {
        division: draft.division || null,
        division_rango: draft.division === "Ninguna" ? null : draft.division_rango || null,
        division2: draft.division2 || "Ninguna",
        division2_rango: draft.division2 === "Ninguna" ? null : draft.division2_rango || null,
        sueldo_defecto: Math.max(0, Number(draft.sueldo_defecto) || 0),
      } : {}),
    };
    const res = draft.id
      ? await db.from("pd_members").update(values as any).eq("id", draft.id)
      : await db.from("pd_members").insert({ ...values, created_by: session.id } as any);
    setSaving(false);
    if (res.error) return toast.error(res.error.message);
    await logAction(db, session, draft.id ? "UPDATE_PD_MEMBER" : "CREATE_PD_MEMBER", { nombre, rango: draft.rango });
    toast.success(draft.id ? "Registro actualizado" : `${nombre} registrado`);
    setOpen(false);
    load();
  }

  async function remove(m: PdMember) {
    if (!confirm(`¿Eliminar a ${m.nombre} del Registro de Policías?`)) return;
    const { error } = await db.from("pd_members").delete().eq("id", m.id);
    if (error) return toast.error(error.message);
    await logAction(db, session, "DELETE_PD_MEMBER", { nombre: m.nombre });
    load();
  }

  const groups = useMemo(() => {
    const rows = users
      .map(u => ({ u, m: personnelForUser(members, u) }))
      .filter(({ u, m }) =>
        (u.name + " " + (u.role ?? "") + " " + (m?.rango ?? "") + " " + (m?.placa ?? "") + " " + (m?.division ?? ""))
          .toLowerCase().includes(q.toLowerCase()));
    return ROLES.map(r => ({
      rango: r.value, label: r.plural,
      items: sortByRango(rows.filter(x => roleKey(x.u.role) === r.value), x => x.m?.rango ?? null, x => x.u.name),
    })).filter(g => g.items.length > 0);
  }, [members, q, users]);

  async function changeRole(u: { id: string; name: string }, role: string) {
    const alto = role === "Comisario";
    const { error } = await db.from("instructors").update({ role, is_alto_mando: alto, ...(alto ? { can_delete: true, can_emit_rnap: true } : {}) } as any).eq("id", u.id);
    if (error) return toast.error(error.message);
    await logAction(db, session, "UPDATE_ROLE", { id: u.id, role });
    toast.success(`${u.name} ahora es ${role}`);
    loadAvatars();
  }

  async function toggleCap() {
    if (!capConfirm) return;
    const { m, cap, value } = capConfirm;
    setCapSaving(true);
    const { error } = await db.from("pd_members").update({ [cap]: value } as any).eq("id", m.id);
    setCapSaving(false);
    if (error) return toast.error(error.message);
    const label = CAPACITACIONES.find(c => c.key === cap)?.label ?? cap;
    await logAction(db, session, value ? "CAPACITACION_MARCADA" : "CAPACITACION_DESMARCADA", { nombre: m.nombre, capacitacion: label });
    toast.success(`${label} ${value ? "marcada" : "desmarcada"} para ${m.nombre}`);
    setCapConfirm(null);
    load();
  }

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden border-2 border-blue-300 bg-white shadow-md rounded-none">
        <div className="h-1.5 bg-blue-700" />
        <div className="p-5 space-y-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 flex items-center justify-center bg-white border-2 border-blue-300 p-1">
              <img src={sapdLogo.url} alt="SAPD" className="w-full h-full object-contain" />
            </div>
            <div>
              <p className="text-blue-700 text-xs uppercase tracking-[0.3em] font-extrabold">
                San Andreas Police Department
              </p>
              <h2 className="text-2xl font-black uppercase tracking-wide text-slate-900 font-display">
                Registro de Policías
              </h2>
            </div>
            <div className="ml-auto flex items-center gap-3">
              <div className="flex items-center gap-2 px-3 py-2 bg-blue-700 text-white">
                <BadgeCheck className="w-4 h-4" />
                <span className="font-mono font-bold">{users.length}</span>
                <span className="text-[10px] uppercase tracking-widest font-bold">Carnets</span>
              </div>
              {canEdit && (
                <Button onClick={openNew}
                  className="h-11 rounded-none bg-blue-700 hover:bg-blue-800 text-white font-bold tracking-wider">
                  <Plus className="w-4 h-4 mr-1" /> Nuevo policía
                </Button>
              )}
            </div>
          </div>

          <Input placeholder="Buscar por nombre, rango, placa, o división…" value={q}
            onChange={e => setQ(e.target.value)}
            className="h-10 rounded-none border-blue-300 bg-white font-semibold text-slate-800 max-w-md" />
          {!canEdit && (
            <p className="text-xs text-slate-500 font-semibold">
              Solo el Alto Mando (o con permiso “Registro PD”) puede crear, editar o borrar registros.
            </p>
          )}
        </div>
      </Card>

      {groups.map(g => (
        <div key={g.rango} className="space-y-3">
          <div className="flex items-center gap-3 bg-blue-700 text-white px-4 py-2">
            <h3 className="font-display font-black uppercase tracking-[0.25em] text-sm">[{g.label}]</h3>
            <span className="ml-auto font-mono font-bold text-xs">{g.items.length}</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {g.items.map(({ u, m }) => (
              <ProfileCard key={u.id} u={u as ProfileUser} foto={m?.foto}
                extra={m && (
                  <div className="border-t pt-2 text-sm text-foreground space-y-2">
                    <p className="text-[11px] font-extrabold uppercase tracking-widest text-muted-foreground">Registro PD</p>
                    <p className="font-bold">{m.rango ?? "Sin rango"} · Placa {(u as any).placa || m.placa || "—"}</p>
                    <p className="text-xs text-muted-foreground">{[m.division && m.division !== "Ninguna" ? m.division + " · " + (m.division_rango ?? "—") : null, m.division2 && m.division2 !== "Ninguna" ? m.division2 + " · " + (m.division2_rango ?? "—") : null].filter(Boolean).join(" | ") || "Sin división"}</p>
                    <div className="border-t pt-2">
                      <p className="text-[11px] font-extrabold uppercase tracking-widest text-muted-foreground mb-1">Capacitaciones</p>
                      <div className="grid grid-cols-3 gap-1">
                        {CAPACITACIONES.map(c => (
                          <label key={c.key}
                            className={`flex items-center gap-1.5 text-xs font-bold ${canEditCaps ? "cursor-pointer" : "cursor-default opacity-80"}`}>
                            <input type="checkbox" checked={!!m[c.key]} disabled={!canEditCaps}
                              onChange={() => canEditCaps && setCapConfirm({ m, cap: c.key, value: !m[c.key] })}
                              className="accent-blue-700 w-3.5 h-3.5" />
                            {c.label}
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
                footer={<>
                {session.is_alto_mando && (
                  <div className="border-t border-blue-200 p-2">
                    <Select value={roleKey(u.role)} onValueChange={v => changeRole(u, v)}>
                      <SelectTrigger className="h-8 rounded-none text-xs font-bold"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {ROLES.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {canEdit && (
                  <div className="flex border-t border-blue-200">
                    <Button variant="ghost" onClick={() => openEdit(u, m)}
                      className="flex-1 rounded-none h-9 text-blue-700 hover:bg-blue-50 font-bold text-xs uppercase">
                      <Pencil className="w-3.5 h-3.5 mr-1" /> Editar
                    </Button>
                    {m && <Button variant="ghost" onClick={() => remove(m)}
                      className="rounded-none h-9 w-10 hover:bg-red-100">
                      <Trash2 className="w-4 h-4 text-red-600" />
                    </Button>}
                  </div>
                )}
                </>} />
            ))}
          </div>
        </div>
      ))}

      {groups.length === 0 && (
        <Card className="border-2 border-blue-300 bg-white rounded-none p-10 text-center text-slate-400 uppercase tracking-widest font-bold">
          Sin policías registrados.
        </Card>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-none border-2 border-blue-300 bg-white">
          <DialogHeader>
            <DialogTitle className="font-display font-black uppercase tracking-wide text-slate-900">
              {draft.instructor_id || draft.id ? "Editar policía" : "Nuevo policía"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-20 h-20 border-2 border-blue-300 bg-blue-50 flex items-center justify-center overflow-hidden">
                {draft.foto ? (
                  <img src={draft.foto} alt="Foto" className="w-full h-full object-cover" />
                ) : (
                  <UserRound className="w-8 h-8 text-blue-300" />
                )}
              </div>
              <div className="flex-1 space-y-2">
                <Input placeholder="Enlace de la foto 4x4" value={draft.foto}
                  onChange={e => setDraft(d => ({ ...d, foto: e.target.value }))}
                  className="h-10 rounded-none border-blue-300 bg-white font-semibold text-slate-800" />
                <label className="inline-flex items-center gap-2 px-3 py-2 border border-blue-300 text-xs font-bold uppercase text-blue-700 cursor-pointer hover:bg-blue-50">
                  <Upload className="w-3.5 h-3.5" /> Subir imagen
                  <input type="file" accept="image/*" className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) pickFile(f); }} />
                </label>
              </div>
            </div>

            <Input placeholder="Nombre_Apellido" value={draft.nombre}
              disabled={!!draft.instructor_id}
              onChange={e => setDraft(d => ({ ...d, nombre: e.target.value }))}
              className="h-10 rounded-none border-blue-300 bg-white font-semibold text-slate-800" />

            <div className="grid gap-3 sm:grid-cols-2">
              <Select value={draft.rango} onValueChange={v => setDraft(d => ({ ...d, rango: v }))}>
                <SelectTrigger className="h-10 rounded-none border-blue-300 bg-white font-semibold text-slate-800">
                  <SelectValue placeholder="Rango" />
                </SelectTrigger>
                <SelectContent className="bg-white border border-blue-200 rounded-none">
                  {RANGOS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
              </Select>
              <Input placeholder="Número de placa" value={draft.placa}
                onChange={e => setDraft(d => ({ ...d, placa: e.target.value }))}
                className="h-10 rounded-none border-blue-300 bg-white font-mono font-bold text-slate-800" />
              <Select value={draft.division} disabled={!session.is_alto_mando} onValueChange={v => setDraft(d => ({ ...d, division: v }))}>
                <SelectTrigger className="h-10 rounded-none border-blue-300 bg-white font-semibold text-slate-800">
                  <SelectValue placeholder="División" />
                </SelectTrigger>
                <SelectContent className="bg-white border border-blue-200 rounded-none">
                  {DIVISIONES.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={draft.division_rango} disabled={!session.is_alto_mando || draft.division === "Ninguna"}
                onValueChange={v => setDraft(d => ({ ...d, division_rango: v }))}>
                <SelectTrigger disabled={draft.division === "Ninguna"}
                  className="h-10 rounded-none border-blue-300 bg-white font-semibold text-slate-800 disabled:opacity-60">
                  <SelectValue placeholder="Rango de división" />
                </SelectTrigger>
                <SelectContent className="bg-white border border-blue-200 rounded-none">
                  {DIVISION_RANGOS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {session.is_alto_mando && (
              <div className="space-y-3 border-t border-blue-200 pt-3">
                <p className="text-xs font-extrabold uppercase tracking-widest text-blue-700">Segunda división y remuneración · Alto Mando</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Select value={draft.division2} onValueChange={v => setDraft(d => ({ ...d, division2: v }))}>
                    <SelectTrigger className="h-10 rounded-none border-blue-300 bg-white font-semibold text-slate-800">
                      <SelectValue placeholder="Segunda división" />
                    </SelectTrigger>
                    <SelectContent className="bg-white border border-blue-200 rounded-none">
                      {DIVISIONES.filter(d => d === "Ninguna" || d !== draft.division).map((d, i) => <SelectItem key={d + i} value={d}>{d}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={draft.division2_rango} onValueChange={v => setDraft(d => ({ ...d, division2_rango: v }))}>
                    <SelectTrigger disabled={draft.division2 === "Ninguna"} className="h-10 rounded-none border-blue-300 bg-white font-semibold text-slate-800 disabled:opacity-60">
                      <SelectValue placeholder="Rango de segunda división" />
                    </SelectTrigger>
                    <SelectContent className="bg-white border border-blue-200 rounded-none">
                      {DIVISION_RANGOS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <div className="space-y-1">
                    <label className="text-xs font-extrabold uppercase tracking-widest text-blue-700">Sueldo básico</label>
                    <Input type="number" min="0" placeholder="Sueldo básico" value={String(draft.sueldo_defecto)}
                      onChange={e => setDraft(d => ({ ...d, sueldo_defecto: Number(e.target.value) || 0 }))}
                      className="h-10 rounded-none border-blue-300 bg-white font-mono font-bold text-slate-800" />
                    <p className="text-xs text-slate-500">El valor que aparece en 0 es el sueldo básico individual, antes de sumar los extras por divisiones.</p>
                  </div>
                </div>
                <p className="text-xs text-slate-500">Cada división asignada suma automáticamente +15 Coins al salario.</p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}
              className="rounded-none border-blue-300 font-bold">Cancelar</Button>
            <Button onClick={save} disabled={saving}
              className="rounded-none bg-blue-700 hover:bg-blue-800 text-white font-bold">
              {saving ? "Guardando…" : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!capConfirm} onOpenChange={v => !v && setCapConfirm(null)}>
        <DialogContent className="rounded-none border-2 border-blue-300 bg-white max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display font-black uppercase tracking-wide text-slate-900">
              {capConfirm?.value ? "Marcar" : "Desmarcar"} capacitación de {capConfirm?.m.nombre}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm font-semibold text-slate-600">
            ¿Confirmás {capConfirm?.value ? "marcar" : "desmarcar"} la capacitación{" "}
            <span className="font-black text-blue-700">
              {CAPACITACIONES.find(c => c.key === capConfirm?.cap)?.label}
            </span>{" "}
            para <span className="font-black">{capConfirm?.m.nombre}</span>?
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCapConfirm(null)}
              className="rounded-none border-blue-300 font-bold">NO</Button>
            <Button onClick={toggleCap} disabled={capSaving}
              className="rounded-none bg-blue-700 hover:bg-blue-800 text-white font-bold">
              {capSaving ? "Guardando…" : "SI"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

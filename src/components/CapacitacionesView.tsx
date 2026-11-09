import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { db } from "@/lib/db";
import type { Session } from "@/lib/session";
import { BadgeCheck, GraduationCap, Plus, RefreshCw } from "lucide-react";
import { toast } from "sonner";

type Member = { id: string; legajo: number; nombre: string; rango: string | null; es_instructor: boolean };
type Training = {
  id: string; pd_member_id: string; section: string; training: string; training_other: string | null;
  awarded_at: string; instructor_pd_member_id: string | null; created_by_id: string; created_by_name: string;
  created_at: string; pd_members?: { nombre: string; legajo: number } | null;
  instructor?: { nombre: string } | null;
};
const TRAINING_OPTIONS = ["M4", "EDC", "AK-47", "SNIPER", "OTRA"];
const today = () => new Date().toISOString().slice(0, 10);
const legajoLabel = (n: number) => String(n).padStart(4, "0");

export function CapacitacionesView({ session }: { session: Session | null }) {
  const [members, setMembers] = useState<Member[]>([]);
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [memberId, setMemberId] = useState("");
  const [section, setSection] = useState("Armas");
  const [training, setTraining] = useState("M4");
  const [trainingOther, setTrainingOther] = useState("");
  const [awardedAt, setAwardedAt] = useState(today());
  const [instructorId, setInstructorId] = useState("");
  const canEdit = !!session?.is_alto_mando || !!session?.can_edit_capacitaciones;
  const instructors = useMemo(() => members.filter(m => m.es_instructor), [members]);

  async function load() {
    setLoading(true);
    const [m, t] = await Promise.all([
      db.from("pd_members").select("id, legajo, nombre, rango, es_instructor").order("nombre", { ascending: true }),
      db.from("pd_trainings").select("id, pd_member_id, section, training, training_other, awarded_at, instructor_pd_member_id, created_by_id, created_by_name, created_at").order("awarded_at", { ascending: false }),
    ]);
    if (m.error) toast.error(m.error.message);
    else setMembers((m.data ?? []) as Member[]);
    if (t.error) toast.error(t.error.message);
    else setTrainings((t.data ?? []) as Training[]);
    setLoading(false);
  }
  useEffect(() => { void load(); }, []);

  async function register() {
    if (!memberId || !instructorId || !awardedAt || (training === "OTRA" && !trainingOther.trim())) {
      toast.error("Completá todos los campos obligatorios.");
      return;
    }
    setSaving(true);
    const { error } = await db.from("pd_trainings").insert({
      pd_member_id: memberId, section, training,
      training_other: training === "OTRA" ? trainingOther.trim() : null,
      awarded_at: awardedAt, instructor_pd_member_id: instructorId,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Capacitación registrada correctamente.");
    setShowForm(false); setMemberId(""); setTraining("M4"); setTrainingOther("");
    setSection("Armas"); setAwardedAt(today()); setInstructorId("");
    await load();
  }

  const memberById = (id: string) => members.find(m => m.id === id);
  return <AppShell session={session}>
    <div className="mx-auto max-w-6xl space-y-5">
      <Card className="overflow-hidden rounded-none border-2 border-blue-300 bg-white">
        <div className="h-1.5 bg-blue-700" />
        <div className="flex items-center gap-4 p-5">
          <div className="flex h-12 w-12 items-center justify-center border-2 border-blue-300 text-blue-700"><GraduationCap className="h-7 w-7" /></div>
          <div className="flex-1">
            <p className="text-xs font-extrabold uppercase tracking-[0.3em] text-blue-700">San Andreas Police Department</p>
            <h2 className="text-2xl font-black uppercase text-slate-900">Capacitaciones</h2>
            <p className="text-xs text-slate-500">Registro histórico de capacitaciones del personal SAPD</p>
          </div>
          <BadgeCheck className="h-6 w-6 text-blue-700" />
        </div>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h3 className="text-lg font-black uppercase text-slate-900">Registro de capacitaciones</h3><p className="text-xs text-slate-500">Cada otorgamiento queda guardado como un registro individual.</p></div>
        <div className="flex gap-2">
          <button onClick={() => void load()} className="inline-flex h-10 items-center gap-2 border border-slate-300 bg-white px-3 text-xs font-bold text-slate-700"><RefreshCw className="h-4 w-4" />Actualizar</button>
          {canEdit && <button onClick={() => setShowForm(v => !v)} className="inline-flex h-10 items-center gap-2 bg-blue-700 px-4 text-xs font-black uppercase text-white hover:bg-blue-800"><Plus className="h-4 w-4" />Nueva capacitación</button>}
        </div>
      </div>

      {showForm && canEdit && <Card className="rounded-none border-2 border-blue-200 bg-white p-5">
        <div className="mb-4 flex items-center justify-between border-b border-slate-200 pb-3"><h3 className="font-black uppercase text-slate-900">Nueva capacitación</h3><span className="text-xs font-mono text-blue-700">FORMULARIO SAPD</span></div>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-1 text-xs font-bold text-slate-700">SAPD destinatario · Legajo
            <select value={memberId} onChange={e => setMemberId(e.target.value)} className="h-10 w-full border border-slate-300 bg-white px-3 text-sm">
              <option value="">Seleccionar policía…</option>{members.map(m => <option key={m.id} value={m.id}>{m.nombre} · {legajoLabel(m.legajo)}{m.rango ? ` · ${m.rango}` : ""}</option>)}
            </select>
          </label>
          <label className="space-y-1 text-xs font-bold text-slate-700">Legajo (automático)
            <input readOnly value={memberId ? legajoLabel(memberById(memberId)?.legajo ?? 0) : "Se asigna automáticamente"} className="h-10 w-full border border-slate-200 bg-slate-100 px-3 font-mono text-sm text-slate-600" />
          </label>
          <label className="space-y-1 text-xs font-bold text-slate-700">Sección
            <select value={section} onChange={e => setSection(e.target.value)} className="h-10 w-full border border-slate-300 bg-white px-3 text-sm"><option>Armas</option><option>Vehículos</option></select>
          </label>
          <label className="space-y-1 text-xs font-bold text-slate-700">Capacitación
            <select value={training} onChange={e => setTraining(e.target.value)} className="h-10 w-full border border-slate-300 bg-white px-3 text-sm">{TRAINING_OPTIONS.map(v => <option key={v}>{v}</option>)}</select>
          </label>
          {training === "OTRA" && <label className="space-y-1 text-xs font-bold text-slate-700 md:col-span-2">Nombre de la capacitación
            <input value={trainingOther} onChange={e => setTrainingOther(e.target.value)} placeholder="Especificar capacitación…" className="h-10 w-full border border-slate-300 px-3 text-sm" />
          </label>}
          <label className="space-y-1 text-xs font-bold text-slate-700">Fecha de otorgamiento
            <input type="date" value={awardedAt} onChange={e => setAwardedAt(e.target.value)} className="h-10 w-full border border-slate-300 bg-white px-3 text-sm" />
          </label>
          <label className="space-y-1 text-xs font-bold text-slate-700">Capacitación dictada por
            <select value={instructorId} onChange={e => setInstructorId(e.target.value)} disabled={!instructors.length} className="h-10 w-full border border-slate-300 bg-white px-3 text-sm disabled:bg-slate-100">
              <option value="">{instructors.length ? "Seleccionar instructor…" : "No hay agentes asignados a la División de Instructores"}</option>
              {instructors.map(m => <option key={m.id} value={m.id}>{m.nombre} · {legajoLabel(m.legajo)}</option>)}
            </select>
          </label>
          <label className="space-y-1 text-xs font-bold text-slate-700">Capacitación añadida por
            <input readOnly value={session?.name ?? "Usuario actual"} className="h-10 w-full border border-slate-200 bg-slate-100 px-3 text-sm text-slate-600" />
          </label>
          <div className="space-y-1 text-xs font-bold text-slate-700 md:col-span-2">Certificado (imagen)
            <div className="flex min-h-16 items-center justify-center border border-dashed border-slate-300 bg-slate-50 px-3 text-xs font-medium text-slate-400">Espacio reservado · carga próximamente</div>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2"><button onClick={() => setShowForm(false)} disabled={saving} className="h-10 border border-slate-300 px-4 text-xs font-bold text-slate-600">Cancelar</button><button onClick={() => void register()} disabled={saving || !members.length || !instructors.length} className="h-10 bg-blue-700 px-5 text-xs font-black uppercase text-white disabled:opacity-50">{saving ? "Registrando…" : "Registrar capacitación"}</button></div>
      </Card>}

      {loading ? <Card className="rounded-none p-10 text-center text-slate-500">Cargando capacitaciones…</Card> :
        <Card className="overflow-hidden rounded-none border border-slate-200 bg-white">
          <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-slate-900 text-[10px] uppercase tracking-wider text-white"><tr><th className="p-3">Legajo</th><th className="p-3">Agente SAPD</th><th className="p-3">Sección</th><th className="p-3">Capacitación</th><th className="p-3">Otorgamiento</th><th className="p-3">Instructor</th><th className="p-3">Añadida por</th></tr></thead>
            <tbody>{trainings.map(t => { const target = memberById(t.pd_member_id); const instructor = memberById(t.instructor_pd_member_id ?? ""); return <tr key={t.id} className="border-t border-slate-100"><td className="p-3 font-mono font-bold">{target ? legajoLabel(target.legajo) : "—"}</td><td className="p-3 font-semibold">{target?.nombre ?? "Agente no disponible"}</td><td className="p-3">{t.section}</td><td className="p-3 font-bold">{t.training === "OTRA" ? t.training_other : t.training}</td><td className="p-3">{t.awarded_at}</td><td className="p-3">{instructor?.nombre ?? "—"}</td><td className="p-3">{t.created_by_name}</td></tr>; })}</tbody>
          </table></div>
          {!trainings.length && <p className="p-8 text-center text-sm text-slate-400">Todavía no hay capacitaciones registradas.</p>}
        </Card>
      }
    </div>
  </AppShell>;
}

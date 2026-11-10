import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import sapdLogo from "@/assets/sapd-logo.png.asset.json";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { db, getToken } from "@/lib/db";
import { publishTrainingCertificate } from "@/lib/data.functions";
import type { Session } from "@/lib/session";
import { BadgeCheck, Plus, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { CertCard, type CertificateForm } from "@/components/CertificarView";

type Member = { id: string; legajo: number; nombre: string; rango: string | null; es_instructor: boolean };
type Training = {
  id: string; pd_member_id: string; section: string; training: string; training_other: string | null;
  awarded_at: string | null; instructor_pd_member_id: string | null; created_by_id: string | null; created_by_name: string | null;
  created_at: string; is_legacy?: boolean; pd_members?: { nombre: string; legajo: number } | null;
  instructor?: { nombre: string } | null;
};
const TRAINING_OPTIONS = ["M4", "EDC", "AK-47", "SNIPER", "MARY", "AIR", "OTRA"];
const today = () => new Date().toISOString().slice(0, 10);
const legajoLabel = (n: number) => String(n).padStart(4, "0");

export function CapacitacionesView({ session }: { session: Session | null }) {
  const [members, setMembers] = useState<Member[]>([]);
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [certificateDraft, setCertificateDraft] = useState<{ form: CertificateForm; payload: Record<string, unknown> } | null>(null);
  const captureStarted = useRef(false);
  const [showForm, setShowForm] = useState(false);
  const [memberId, setMemberId] = useState("");
  const [section, setSection] = useState("Armas");
  const [training, setTraining] = useState("M4");
  const [trainingOther, setTrainingOther] = useState("");
  const [awardedAt, setAwardedAt] = useState(today());
  const [instructorId, setInstructorId] = useState("");
  const [filterMemberId, setFilterMemberId] = useState("");
  const [filterSection, setFilterSection] = useState("");
  const [filterTraining, setFilterTraining] = useState("");
  const [filterInstructorId, setFilterInstructorId] = useState("");
  const canEdit = !!session?.is_alto_mando || !!session?.can_edit_capacitaciones;
  const canDeleteTraining = session?.admin_rango === "administrador";
  const instructors = useMemo(() => members.filter(m => m.es_instructor), [members]);

  async function load() {
    setLoading(true);
    const [m, t] = await Promise.all([
      db.from("pd_members").select("id, legajo, nombre, rango, es_instructor").order("nombre", { ascending: true }),
      db.from("pd_trainings").select("id, pd_member_id, section, training, training_other, awarded_at, instructor_pd_member_id, created_by_id, created_by_name, created_at, is_legacy").order("awarded_at", { ascending: false }),
    ]);
    if (m.error) toast.error(m.error.message);
    else setMembers((m.data ?? []) as Member[]);
    if (t.error) toast.error(t.error.message);
    else setTrainings((t.data ?? []) as Training[]);
    setLoading(false);
  }
  useEffect(() => { void load(); }, []);

  const finishRegistration = useCallback(async (certificateImage: string) => {
    if (!certificateDraft) return;
    const { data, error } = await db.from("pd_trainings").insert({ ...certificateDraft.payload, certificate_image_url: certificateImage }).select("id").single();
    setSaving(false); setCertificateDraft(null); captureStarted.current = false;
    if (error) return toast.error(error.message);
    toast.success("Capacitación registrada y certificado generado.");
    const token = getToken();
    if (token && data?.id) {
      const published = await publishTrainingCertificate({ data: { token, trainingId: data.id, certificateImage } });
      if (published.ok) toast.success("Certificado publicado en el foro de Discord del SAPD.");
      else toast.warning("El certificado quedó guardado en mySAPD, pero no se publicó en Discord: " + published.error);
    }
    setShowForm(false); setMemberId(""); setTraining("M4"); setTrainingOther(""); setSection("Armas"); setAwardedAt(today()); setInstructorId("");
    await load();
  }, [certificateDraft]);

  const onCertificateGenerated = useCallback((image: string) => {
    if (!captureStarted.current) { captureStarted.current = true; void finishRegistration(image); }
  }, [finishRegistration]);

  const onCertificateError = useCallback(() => {
    captureStarted.current = false;
    setSaving(false);
    setCertificateDraft(null);
  }, []);

  async function register() {
    if (!memberId || !instructorId || !awardedAt || (training === "OTRA" && !trainingOther.trim())) { toast.error("Completá todos los campos obligatorios."); return; }
    const target = members.find(m => m.id === memberId);
    const instructor = members.find(m => m.id === instructorId);
    if (!target || !instructor) return toast.error("No se pudo recuperar el agente o instructor seleccionado.");
    const tipoMap: Record<string, string> = { M4: "Fusil M4", EDC: "Escopeta Spas12", "AK-47": "Fusil de Asalto AK-47", SNIPER: "Fusil de Precisión", MARY: "Unidad Motorizada Mary", AIR: "Unidad Aerea", OTRA: "Capacitación Especial" };
    const [year, month, day] = awardedAt.split("-");
    const form: CertificateForm = { tipo: tipoMap[training] ?? "Fusil M4", nombre: target.nombre, instructor: instructor.nombre, comisario: session?.name ?? "San Andreas Police Department", fecha: day + "/" + month + "/" + year, numero: String(Math.floor(100000 + Math.random() * 900000)) };
    setSaving(true);
    setCertificateDraft({ form, payload: { pd_member_id: memberId, section, training, training_other: training === "OTRA" ? trainingOther.trim() : null, awarded_at: awardedAt, instructor_pd_member_id: instructorId } });
  }

  async function deleteTraining(t: Training) {
    if (!canDeleteTraining) return toast.error("Solo Administrador puede borrar capacitaciones.");
    const target = memberById(t.pd_member_id);
    const label = t.training === "OTRA" ? t.training_other : t.training;
    if (!window.confirm(`¿Eliminar la capacitación ${label ?? t.training} de ${target?.nombre ?? "este policía"}? Esta acción no se puede deshacer.`)) return;
    const { error } = await db.from("pd_trainings").delete().eq("id", t.id);
    if (error) return toast.error("No se pudo eliminar la capacitación: " + error.message);
    setTrainings(current => current.filter(row => row.id !== t.id));
    const { error: logError } = await db.from("logs").insert({
      action: "DELETE_PD_TRAINING",
      details: {
        training_id: t.id,
        pd_member_id: t.pd_member_id,
        target_name: target?.nombre ?? null,
        section: t.section,
        training: t.training,
        training_other: t.training_other,
        awarded_at: t.awarded_at,
        instructor_pd_member_id: t.instructor_pd_member_id,
        created_by_name: t.created_by_name,
      },
    });
    if (logError) toast.warning("Capacitación eliminada, pero no se pudo guardar el registro de auditoría: " + logError.message);
    else toast.success("Capacitación eliminada correctamente.");
  }

  const memberById = (id: string) => members.find(m => m.id === id);
  const filteredTrainings = useMemo(() => trainings.filter(t =>
    (!filterMemberId || t.pd_member_id === filterMemberId) &&
    (!filterSection || t.section === filterSection) &&
    (!filterTraining || t.training === filterTraining) &&
    (!filterInstructorId || t.instructor_pd_member_id === filterInstructorId)
  ), [trainings, filterMemberId, filterSection, filterTraining, filterInstructorId]);
  const hasFilters = !!(filterMemberId || filterSection || filterTraining || filterInstructorId);
  const clearFilters = () => { setFilterMemberId(""); setFilterSection(""); setFilterTraining(""); setFilterInstructorId(""); };
  return <AppShell session={session}>
    <div className="mx-auto max-w-6xl space-y-5">
      <Card className="overflow-hidden rounded-none border-2 border-blue-300 bg-white">
        <div className="h-1.5 bg-blue-700" />
        <div className="flex items-center gap-4 p-5">
          <div className="w-12 h-12 flex items-center justify-center border-2 border-blue-300 bg-white p-1"><img src={sapdLogo.url} alt="SAPD" className="w-full h-full object-contain" /></div>
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

      {certificateDraft && <div aria-hidden="true" className="pointer-events-none fixed left-[-10000px] top-0 w-[900px]"><CertCard data={certificateDraft.form} autoGenerate onGenerated={onCertificateGenerated} onError={onCertificateError} /></div>}

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
          <div className="space-y-1 text-xs font-bold text-slate-700 md:col-span-2">Certificado automático
            <div className="flex min-h-16 items-center justify-center border border-dashed border-blue-300 bg-blue-50 px-3 text-center text-xs font-medium text-blue-700">Al registrar la capacitación se generará y guardará el PNG con la plantilla institucional.</div>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2"><button onClick={() => setShowForm(false)} disabled={saving} className="h-10 border border-slate-300 px-4 text-xs font-bold text-slate-600">Cancelar</button><button onClick={() => void register()} disabled={saving || !members.length || !instructors.length} className="h-10 bg-blue-700 px-5 text-xs font-black uppercase text-white disabled:opacity-50">{saving ? "Registrando…" : "Registrar capacitación"}</button></div>
      </Card>}

      {loading ? <Card className="rounded-none p-10 text-center text-slate-500">Cargando capacitaciones…</Card> :
        <Card className="overflow-hidden rounded-none border border-slate-200 bg-white">
          <div className="border-b border-slate-200 bg-slate-50 p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div><h3 className="text-xs font-black uppercase tracking-wider text-slate-800">Filtros de búsqueda</h3><p className="mt-1 text-xs text-slate-500">Podés combinar varios filtros para encontrar registros específicos.</p></div>
              <div className="flex items-center gap-3"><span className="text-xs font-bold text-slate-600">{filteredTrainings.length} de {trainings.length} registros</span>
                {hasFilters && <button onClick={clearFilters} className="h-8 border border-slate-300 bg-white px-3 text-xs font-bold text-slate-600 hover:bg-slate-100">Limpiar filtros</button>}
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <label className="space-y-1 text-xs font-bold text-slate-700">Policía SAPD
                <select value={filterMemberId} onChange={e => setFilterMemberId(e.target.value)} className="h-10 w-full border border-slate-300 bg-white px-3 text-sm font-normal">
                  <option value="">Todos los policías</option>
                  {members.map(m => <option key={m.id} value={m.id}>{m.nombre} · {legajoLabel(m.legajo)}</option>)}
                </select>
              </label>
              <label className="space-y-1 text-xs font-bold text-slate-700">Tipo de capacitación
                <select value={filterSection} onChange={e => setFilterSection(e.target.value)} className="h-10 w-full border border-slate-300 bg-white px-3 text-sm font-normal">
                  <option value="">Armas y vehículos</option><option value="Armas">Armas</option><option value="Vehículos">Vehículos</option>
                </select>
              </label>
              <label className="space-y-1 text-xs font-bold text-slate-700">Capacitación
                <select value={filterTraining} onChange={e => setFilterTraining(e.target.value)} className="h-10 w-full border border-slate-300 bg-white px-3 text-sm font-normal">
                  <option value="">Todas las capacitaciones</option>
                  {TRAINING_OPTIONS.map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </label>
              <label className="space-y-1 text-xs font-bold text-slate-700">Instructor
                <select value={filterInstructorId} onChange={e => setFilterInstructorId(e.target.value)} className="h-10 w-full border border-slate-300 bg-white px-3 text-sm font-normal">
                  <option value="">Todos los instructores</option>
                  {instructors.map(m => <option key={m.id} value={m.id}>{m.nombre} · {legajoLabel(m.legajo)}</option>)}
                </select>
              </label>
            </div>
          </div>
          <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-slate-900 text-[10px] uppercase tracking-wider text-white"><tr><th className="p-3">Legajo</th><th className="p-3">Agente SAPD</th><th className="p-3">Sección</th><th className="p-3">Capacitación</th><th className="p-3">Otorgamiento</th><th className="p-3">Instructor</th><th className="p-3">Añadida por</th><th className="p-3">Origen</th>{canDeleteTraining && <th className="p-3 text-right">Acciones</th>}</tr></thead>
            <tbody>{filteredTrainings.map(t => { const target = memberById(t.pd_member_id); const instructor = memberById(t.instructor_pd_member_id ?? ""); return <tr key={t.id} className="border-t border-slate-100"><td className="p-3 font-mono font-bold">{target ? legajoLabel(target.legajo) : "—"}</td><td className="p-3 font-semibold">{target?.nombre ?? "Agente no disponible"}</td><td className="p-3">{t.section}</td><td className="p-3 font-bold">{t.training === "OTRA" ? t.training_other : t.training}</td><td className="p-3">{t.awarded_at ?? "Nada"}</td><td className="p-3">{instructor?.nombre ?? "Nada"}</td><td className="p-3">{t.created_by_name ?? "Nada"}</td><td className="p-3">{t.is_legacy ? "Histórico" : "Nuevo registro"}</td>{canDeleteTraining && <td className="p-3 text-right"><button type="button" onClick={() => void deleteTraining(t)} className="inline-flex h-8 items-center gap-1 border border-red-200 px-2 text-xs font-bold text-red-700 hover:bg-red-50"><Trash2 className="h-3.5 w-3.5" />Borrar</button></td>}</tr>; })}</tbody>
          </table></div>
          {!filteredTrainings.length && <p className="p-8 text-center text-sm text-slate-400">{hasFilters ? "No hay capacitaciones que coincidan con los filtros seleccionados." : "Todavía no hay capacitaciones registradas."}</p>}
        </Card>
      }
    </div>
  </AppShell>;
}

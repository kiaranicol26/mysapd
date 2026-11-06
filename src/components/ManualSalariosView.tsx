import { useEffect, useMemo, useState } from "react";
import { db } from "@/lib/db";
import { Session, logAction } from "@/lib/session";
import { activePdMembers } from "@/lib/registroActivo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { ClipboardPaste, Plus, Trash2, Wallet, RefreshCw } from "lucide-react";

type PdMember = { id: string; instructor_id: string | null; created_at?: string | null; nombre: string; rango: string | null };
type Batch = { id: string; label: string; report_date: string | null; raw_text: string; created_at: string };
type Entry = { id: string; batch_id: string; pd_member_id: string | null; nombre: string; rango_snapshot: string | null; actividad: string; activity_minutes: number | null; sueldo: number; nota: string | null; pagado: boolean };

type Parsed = { nombre: string; actividad: string; minutes: number | null };
const normalize = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().replace(/\s+/g, "_").toLowerCase();

function parseMinutes(activity: string): number | null {
  if (/no\s*jug[oó]/i.test(activity)) return 0;
  const hours = activity.match(/(\d+)\s*horas?/i);
  const minutes = activity.match(/(\d+)\s*minutos?/i);
  if (!hours && !minutes) return null;
  return (hours ? Number(hours[1]) * 60 : 0) + (minutes ? Number(minutes[1]) : 0);
}

function parseReport(raw: string): { label: string; date: string | null; rows: Parsed[] } {
  const header = raw.match(/Actividad\s+de\s+SAPD\s*[-–—:]\s*(\d{1,2})\/(\d{1,2})\/(\d{4})/i);
  const date = header ? `${header[3]}-${header[2].padStart(2, "0")}-${header[1].padStart(2, "0")}` : null;
  const label = header ? `Actividad SAPD · ${header[1].padStart(2, "0")}/${header[2].padStart(2, "0")}/${header[3]}` : "Liquidación manual";
  const rows: Parsed[] = [];
  const body = raw.replace(/\*\*Actividad\s+de\s+SAPD[^*]*\*\*/i, "");
  const re = /([A-Za-z0-9_.-]+)\s*\(([^)]*)\)/g;
  let match: RegExpExecArray | null;
  const seen = new Set<string>();
  while ((match = re.exec(body))) {
    const nombre = match[1].trim();
    const key = normalize(nombre);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    rows.push({ nombre, actividad: match[2].trim(), minutes: parseMinutes(match[2]) });
  }
  return { label, date, rows };
}

export function ManualSalariosView({ session }: { session: Session }) {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [selectedBatch, setSelectedBatch] = useState("");
  const [members, setMembers] = useState<PdMember[]>([]);
  const [rawText, setRawText] = useState("");
  const [parsed, setParsed] = useState<Parsed[]>([]);
  const [busy, setBusy] = useState(false);

  async function loadAll(preferred?: string) {
    const [b, e, p, u] = await Promise.all([
      db.from("manual_salary_batches").select("*").order("created_at", { ascending: false }),
      db.from("manual_salary_entries").select("*").order("created_at", { ascending: true }),
      db.from("pd_members").select("id,instructor_id,created_at,nombre,rango").order("nombre", { ascending: true }),
      db.from("instructors").select("id,discord_inhabilitado"),
    ]);
    if (b.error) return toast.error(b.error.message);
    if (e.error) return toast.error(e.error.message);
    if (p.error) return toast.error(p.error.message);
    if (u.error) return toast.error(u.error.message);
    const active = activePdMembers((p.data ?? []) as PdMember[], (u.data ?? []) as any[]);
    setMembers(active);
    const nextBatches = (b.data ?? []) as Batch[];
    setBatches(nextBatches);
    setEntries((e.data ?? []) as Entry[]);
    const next = preferred && nextBatches.some(x => x.id === preferred) ? preferred : selectedBatch && nextBatches.some(x => x.id === selectedBatch) ? selectedBatch : nextBatches[0]?.id ?? "";
    setSelectedBatch(next);
  }

  useEffect(() => { loadAll(); }, []);

  const preview = useMemo(() => {
    const byName = new Map<string, PdMember[]>();
    for (const m of members) {
      const key = normalize(m.nombre);
      byName.set(key, [...(byName.get(key) ?? []), m]);
    }
    return parsed.map(row => {
      const found = byName.get(normalize(row.nombre)) ?? [];
      return { ...row, member: found.length === 1 ? found[0] : null, match: found.length === 1 ? "ok" : found.length > 1 ? "ambiguous" : "missing" };
    });
  }, [parsed, members]);

  async function prepareReport() {
    const result = parseReport(rawText);
    if (!result.rows.length) return toast.error("No encontré integrantes con el formato Nombre (actividad).");
    setParsed(result.rows);
    toast.success(`Se detectaron ${result.rows.length} integrantes. Revisá las coincidencias antes de guardar.`);
  }

  async function saveReport() {
    if (!preview.length) return toast.error("Primero pegá y procesá un informe.");
    if (batches.some(batch => batch.raw_text.trim() === rawText.trim())) return toast.error("Este informe ya fue importado. No se creó una liquidación duplicada.");
    setBusy(true);
    try {
      const report = parseReport(rawText);
      const label = report.label === "Liquidación manual" ? `Liquidación · ${new Date().toLocaleDateString("es-AR")}` : report.label;
      const { data: batch, error: batchError } = await db.from("manual_salary_batches").insert({
        label, report_date: report.date, raw_text: rawText, created_by: session.id,
      } as any).select("*").single();
      if (batchError || !batch) throw new Error(batchError?.message ?? "No se pudo crear la liquidación.");
      const rows = preview.map(row => ({
        batch_id: batch.id, pd_member_id: row.member?.id ?? null,
        nombre: row.nombre, rango_snapshot: row.member?.rango ?? "No encontrado",
        actividad: row.actividad, activity_minutes: row.minutes,
        sueldo: 0, nota: null, pagado: false,
      }));
      const { error } = await db.from("manual_salary_entries").insert(rows as any);
      if (error) {
        await db.from("manual_salary_batches").delete().eq("id", batch.id);
        throw new Error(error.message);
      }
      await logAction(db, session, "CREATE_MANUAL_SALARY_BATCH", { label, entries: rows.length, unmatched: rows.filter(x => !x.pd_member_id).length });
      setRawText(""); setParsed([]);
      await loadAll(batch.id);
      toast.success("Liquidación manual creada correctamente.");
    } catch (e: any) { toast.error(e.message ?? "No se pudo guardar la liquidación."); }
    finally { setBusy(false); }
  }

  function patchLocal(id: string, patch: Partial<Entry>) {
    setEntries(prev => prev.map(row => row.id === id ? { ...row, ...patch } : row));
  }
  async function saveEntry(id: string, patch: Partial<Entry>) {
    const { error } = await db.from("manual_salary_entries").update({ ...patch, updated_at: new Date().toISOString() } as any).eq("id", id);
    if (error) toast.error(error.message);
  }
  async function deleteBatch(batch: Batch) {
    if (!confirm(`¿Eliminar la liquidación "${batch.label}" y todas sus filas?`)) return;
    const { error } = await db.from("manual_salary_batches").delete().eq("id", batch.id);
    if (error) return toast.error(error.message);
    await logAction(db, session, "DELETE_MANUAL_SALARY_BATCH", { label: batch.label });
    await loadAll();
  }

  const currentBatch = batches.find(x => x.id === selectedBatch);
  const rows = entries.filter(x => x.batch_id === selectedBatch);
  const total = rows.reduce((sum, row) => sum + (Number(row.sueldo) || 0), 0);
  const paid = rows.filter(x => x.pagado).reduce((sum, row) => sum + (Number(row.sueldo) || 0), 0);
  const fmt = (value: number) => `${Math.round(value).toLocaleString("es-AR")} Coins`;

  return <div className="space-y-4">
    <Card className="overflow-hidden border-2 border-blue-300 bg-white shadow-md rounded-none">
      <div className="h-1.5 bg-blue-700" />
      <div className="p-5 space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 border-2 border-blue-300 flex items-center justify-center"><Wallet className="w-6 h-6 text-blue-700" /></div>
          <div><p className="text-xs uppercase tracking-[0.25em] font-extrabold text-blue-700">San Andreas Police Department</p><h1 className="text-2xl font-black uppercase text-slate-900 font-display">[M] Salarios</h1></div>
        </div>
        <p className="text-sm text-slate-600">Liquidaciones independientes y manuales. Este módulo no modifica la pestaña Salario automática.</p>
      </div>
    </Card>

    <Card className="border border-blue-200 bg-white rounded-none overflow-hidden">
      <div className="h-1 bg-blue-600" />
      <div className="p-5 space-y-3">
        <div className="flex items-center gap-2"><ClipboardPaste className="w-5 h-5 text-blue-700" /><h2 className="text-lg font-black uppercase text-slate-900">Carga masiva de actividad</h2></div>
        <textarea value={rawText} onChange={e => { setRawText(e.target.value); setParsed([]); }} rows={6}
          placeholder={"**Actividad de SAPD - 06/11/2026**\nVance_Rhymun (18 horas y 26 minutos) - Naomi_Moretti (15 horas y 30 minutos) - ..."}
          className="w-full min-h-36 rounded-none border border-blue-300 bg-white p-3 text-sm font-mono text-slate-800 outline-none focus:border-blue-700" />
        <div className="flex flex-wrap gap-2">
          <Button onClick={prepareReport} disabled={!rawText.trim()} variant="outline" className="gap-2 border-blue-300 text-blue-800"><RefreshCw className="w-4 h-4" /> Procesar informe</Button>
          <Button onClick={saveReport} disabled={!preview.length || busy} className="gap-2 bg-blue-700 text-white hover:bg-blue-800"><Plus className="w-4 h-4" /> {busy ? "Guardando…" : "Crear liquidación"}</Button>
        </div>
        {preview.length > 0 && <div className="border border-blue-200 overflow-x-auto">
          <div className="bg-blue-50 px-3 py-2 text-xs font-bold text-slate-700">{preview.length} integrantes · {preview.filter(x => x.match === "ok").length} vinculados · {preview.filter(x => x.match !== "ok").length} para revisar</div>
          <table className="w-full text-sm">
            <thead><tr className="bg-blue-700 text-white"><th className="p-2 text-left">Nombre_Apellido</th><th className="p-2 text-left">Rango</th><th className="p-2 text-left">Actividad</th><th className="p-2 text-left">Coincidencia</th></tr></thead>
            <tbody>{preview.map((row, i) => <tr key={row.nombre + i} className="border-t border-blue-100"><td className="p-2 font-mono font-bold text-slate-800">{row.nombre}</td><td className="p-2 text-slate-700">{row.member?.rango ?? (row.match === "ambiguous" ? "Coincidencia múltiple" : "No encontrado")}</td><td className="p-2 text-slate-700">{row.actividad}</td><td className="p-2">{row.match === "ok" ? <span className="text-emerald-700 font-bold">Vinculado</span> : <span className="text-amber-700 font-bold">Revisar</span>}</td></tr>)}</tbody>
          </table>
        </div>}
      </div>
    </Card>

    <Card className="border border-blue-200 bg-white rounded-none overflow-hidden">
      <div className="h-1 bg-blue-600" />
      <div className="p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="text-lg font-black uppercase text-slate-900">Liquidaciones guardadas</h2><p className="text-xs text-slate-500">Cada informe queda guardado por separado.</p></div>
          <div className="flex items-center gap-2">
            <select value={selectedBatch} onChange={e => setSelectedBatch(e.target.value)} className="h-10 max-w-xs border border-blue-300 bg-white px-3 text-sm text-slate-800">
              {batches.map(batch => <option key={batch.id} value={batch.id}>{batch.label}</option>)}
            </select>
            {currentBatch && <Button size="icon" variant="outline" onClick={() => deleteBatch(currentBatch)} className="border-red-200 text-red-600"><Trash2 className="w-4 h-4" /></Button>}
          </div>
        </div>
        {currentBatch ? <>
          <div className="flex flex-wrap gap-4 text-sm font-bold text-slate-700"><span>{rows.length} integrantes</span><span>Total: {fmt(total)}</span><span className="text-emerald-700">Pagado: {fmt(paid)}</span><span className="text-amber-700">Pendiente: {fmt(total - paid)}</span></div>
          <div className="overflow-x-auto border border-blue-200">
            <table className="w-full text-sm">
              <thead><tr className="bg-blue-700 text-white"><th className="p-3 text-left">Nombre_Apellido</th><th className="p-3 text-left">Rango</th><th className="p-3 text-left">Actividad</th><th className="p-3 text-left">Sueldo (Coins)</th><th className="p-3 text-left">Nota</th><th className="p-3 text-center">Estado</th></tr></thead>
              <tbody>{rows.map((row, index) => <tr key={row.id} className={`border-t border-blue-100 ${index % 2 ? "bg-slate-50" : "bg-blue-50/30"}`}>
                <td className="p-3 font-mono font-bold text-slate-800 whitespace-nowrap">{row.nombre}</td>
                <td className="p-3 font-semibold text-slate-700 whitespace-nowrap">{row.rango_snapshot || "No encontrado"}</td>
                <td className="p-3 text-slate-700 whitespace-nowrap">{row.actividad}</td>
                <td className="p-2 min-w-36"><Input type="number" min="0" value={String(row.sueldo ?? 0)} onChange={e => patchLocal(row.id, { sueldo: Number(e.target.value) })} onBlur={e => saveEntry(row.id, { sueldo: Math.max(0, Number(e.target.value) || 0) })} className="h-9 rounded-none border-blue-200 bg-white text-slate-800" /></td>
                <td className="p-2 min-w-44"><Input value={row.nota ?? ""} onChange={e => patchLocal(row.id, { nota: e.target.value })} onBlur={e => saveEntry(row.id, { nota: e.target.value.trim() || null })} placeholder="Nota…" className="h-9 rounded-none border-blue-200 bg-white text-slate-800" /></td>
                <td className="p-3 text-center"><button type="button" onClick={() => { const value = !row.pagado; patchLocal(row.id, { pagado: value }); saveEntry(row.id, { pagado: value }); }} className={`px-3 py-1.5 border text-xs font-extrabold uppercase ${row.pagado ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-red-300 bg-red-50 text-red-600"}`}>{row.pagado ? "Pagado" : "No pagado"}</button></td>
              </tr>)}</tbody>
            </table>
          </div>
        </> : <div className="p-8 text-center text-sm font-bold text-slate-400">Todavía no hay liquidaciones manuales guardadas.</div>}
      </div>
    </Card>
  </div>;
}

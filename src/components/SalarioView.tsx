import { useEffect, useRef, useState } from "react";
import sapdLogo from "@/assets/sapd-logo.png.asset.json";
import { db } from "@/lib/db";
import { Session, logAction } from "@/lib/session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";

import { INSTRUCTOR_BONUS, sortByRango } from "@/lib/rangos";
import { hasLegacySalaryEntryForName, normalizeSalaryName } from "@/lib/salaryEntries";
import { toast } from "sonner";
import { Trash2, Plus, ChevronDown, ChevronRight, Coins, Users, FileDown, ImageDown } from "lucide-react";

type Month = {
  id: string;
  label: string;
  created_by: string | null;
  created_at: string;
};

const DIVISION_BONUS = 15;

type Entry = {
  id: string;
  month_id: string;
  nombre: string | null;
  pd_member_id: string | null;
  paga: number;
  pagado: boolean;
  nota: string | null;
  ultima_edicion_por: string | null;
};

type PdMember = {
  id: string;
  nombre: string;
  rango: string | null;
  sueldo_defecto: number;
  es_instructor: boolean;
  division: string | null;
  division2: string | null;
  placa?: string | null;
};

export function SalarioView({ session }: { session: Session | null }) {
  const canEdit = !!session?.is_alto_mando;
  const [months, setMonths] = useState<Month[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [pd, setPd] = useState<PdMember[]>([]);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [newMonth, setNewMonth] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const slug = (s: string) =>
    s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase() || "mes";
  async function capture(monthId: string) {
    const node = cardRefs.current[monthId];
    if (!node) throw new Error("No se encontró la tabla");
    const { toPng } = await import("html-to-image");
    return await toPng(node, {
      pixelRatio: 3,
      cacheBust: true,
      backgroundColor: "#ffffff",
      width: node.scrollWidth,
      height: node.scrollHeight,
      style: { overflow: "visible" },
    });
  }

  async function exportImage(m: Month) {
    setBusy(m.id + "-img");
    try {
      const dataUrl = await capture(m.id);
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `salario-${slug(m.label)}.png`;
      a.click();
      toast.success("Imagen descargada");
    } catch (e: any) {
      toast.error(e?.message || "No se pudo generar la imagen");
    } finally {
      setBusy(null);
    }
  }

  async function exportPdf(m: Month) {
    setBusy(m.id + "-pdf");
    try {
      const dataUrl = await capture(m.id);
      const { jsPDF } = await import("jspdf");
      const img = new Image();
      img.src = dataUrl;
      await new Promise((res, rej) => { img.onload = res; img.onerror = rej; });
      const landscape = img.width > img.height;
      const pdf = new jsPDF({ orientation: landscape ? "landscape" : "portrait", unit: "pt", format: "a4", compress: true });
      const pw = pdf.internal.pageSize.getWidth();
      const ph = pdf.internal.pageSize.getHeight();
      const margin = 24;
      const scale = Math.min((pw - margin * 2) / img.width, (ph - margin * 2) / img.height);
      const w = img.width * scale;
      const h = img.height * scale;
      pdf.addImage(dataUrl, "PNG", (pw - w) / 2, (ph - h) / 2, w, h, undefined, "FAST");
      pdf.save(`salario-${slug(m.label)}.pdf`);
      toast.success("PDF descargado");
    } catch (e: any) {
      toast.error(e?.message || "No se pudo generar el PDF");
    } finally {
      setBusy(null);
    }
  }

  async function loadAll() {
    const [m, e, p] = await Promise.all([
      db.from("salary_months").select("*").order("created_at", { ascending: false }),
      db.from("salary_entries").select("*").order("created_at", { ascending: true }),
      db.from("pd_members").select("id, nombre, rango, sueldo_defecto, es_instructor, division, division2, placa").order("nombre", { ascending: true }),
    ]);
    if (m.data) {
      setMonths(m.data as Month[]);
      setOpen(prev => {
        const next = { ...prev };
        (m.data as Month[]).forEach((x, i) => { if (next[x.id] === undefined) next[x.id] = i === 0; });
        return next;
      });
    }
    if (e.data) setEntries(e.data as unknown as Entry[]);
    if (p.data) {
      // Cada ficha PD tiene su propio ID estable, incluso cuando hay homónimos.
      const currentPd = p.data as unknown as PdMember[];
      setPd(currentPd);
      // Todos los integrantes de Registro PD aparecen en cada mes, aunque su sueldo sea 0.
      if (m.data?.length && e.data && p.data) {
        // Indexar los registros existentes en una sola pasada evita filtrar toda la
        // tabla de salarios una vez por cada mes.
        const idsByMonth = new Map<string, Set<string>>();
        const legacyNamesByMonth = new Map<string, Set<string>>();
        for (const row of (e.data ?? []) as unknown as Entry[]) {
          let ids = idsByMonth.get(row.month_id);
          if (!ids) idsByMonth.set(row.month_id, ids = new Set<string>());
          if (row.pd_member_id) {
            ids.add(row.pd_member_id);
          } else {
            // Legacy rows remain visible and are never claimed by name. Their names
            // only suppress an automatic second row until an administrator reviews them.
            const name = normalizeSalaryName(row.nombre);
            if (name) {
              let names = legacyNamesByMonth.get(row.month_id);
              if (!names) legacyNamesByMonth.set(row.month_id, names = new Set<string>());
              names.add(name);
            }
          }
        }
        // Insertar los faltantes en lotes reduce las solicitudes cuando hay muchos meses.
        const rowsToInsert: {
          month_id: string;
          nombre: string;
          pd_member_id: string;
          paga: number;
          pagado: boolean;
          ultima_edicion_por: string | null;
        }[] = [];

        for (const month of m.data as Month[]) {
          const existingIds = idsByMonth.get(month.id) ?? new Set<string>();
          const legacyNames = legacyNamesByMonth.get(month.id) ?? new Set<string>();
          for (const member of currentPd) {
            if (existingIds.has(member.id) || legacyNames.has(normalizeSalaryName(member.nombre))) continue;
            existingIds.add(member.id);
            rowsToInsert.push({
              month_id: month.id,
              nombre: member.nombre,
              pd_member_id: member.id,
              paga: Number(member.sueldo_defecto) || 0,
              pagado: false,
              ultima_edicion_por: session?.name ?? null,
            });
          }
        }

        const batchSize = 500;
        for (let i = 0; i < rowsToInsert.length; i += batchSize) {
          const { error } = await db.from("salary_entries").insert(rowsToInsert.slice(i, i + batchSize) as any);
          if (error) {
            console.error("No se pudieron incorporar integrantes de Registro PD a Salarios:", error.message);
            break;
          }
        }

        if (rowsToInsert.length) {
          const refreshed = await db.from("salary_entries").select("*").order("created_at", { ascending: true });
          if (refreshed.data) setEntries(refreshed.data as unknown as Entry[]);
        }
      }
    }
  }

  useEffect(() => { loadAll(); }, []);

  async function syncMonth(monthId: string, existing: Entry[], silent = false) {
    const existingIds = new Set(existing.map(row => row.pd_member_id).filter((id): id is string => !!id));
    const missing = pd.filter(member =>
      !existingIds.has(member.id) && !hasLegacySalaryEntryForName(member.nombre, existing),
    );
    if (missing.length === 0) {
      if (!silent) toast.info("La tabla ya tiene a todo el Registro PD");
      return;
    }
    const { error } = await db.from("salary_entries").insert(
      missing.map(p => ({
        month_id: monthId,
        nombre: p.nombre,
        pd_member_id: p.id,
        paga: Number(p.sueldo_defecto) || 0,
        pagado: false,
        ultima_edicion_por: session?.name ?? null,
      })) as any,
    );
    if (error) return toast.error(error.message);
    if (!silent) toast.success(`${missing.length} agentes cargados desde Registro PD`);
    loadAll();
  }

  async function addMonth(ev: React.FormEvent) {
    ev.preventDefault();
    const label = newMonth.trim();
    if (!label) return toast.error("Escribe el nombre del mes");
    const { error } = await db
      .from("salary_months")
      .insert({ label, created_by: session?.id ?? null } as any);
    if (error) return toast.error(error.message);
    await logAction(db, session, "CREATE_SALARY_MONTH", { label });
    setNewMonth("");
    toast.success(`Mes "${label}" creado con Registro PD`);
    // loadAll incorpora automáticamente los integrantes faltantes a todos los meses.
    await loadAll();
  }

  async function removeMonth(m: Month) {
    if (!confirm(`¿Eliminar la tabla de "${m.label}" y todos sus registros?`)) return;
    const { error } = await db.from("salary_months").delete().eq("id", m.id);
    if (error) return toast.error(error.message);
    await logAction(db, session, "DELETE_SALARY_MONTH", { label: m.label });
    loadAll();
  }

  async function removeEntry(en: Entry) {
    if (!confirm("¿Eliminar esta fila?")) return;
    const { error } = await db.from("salary_entries").delete().eq("id", en.id);
    if (error) return toast.error(error.message);
    await logAction(db, session, "DELETE_SALARY_ENTRY", { nombre: en.nombre });
    loadAll();
  }

  function patchLocal(id: string, patch: Partial<Entry>) {
    setEntries(prev => prev.map(x => (x.id === id ? { ...x, ...patch } : x)));
  }

  async function saveEntry(id: string, patch: Partial<Entry>) {
    if (!canEdit) return;
    const { error } = await db
      .from("salary_entries")
      .update({ ...patch, ultima_edicion_por: session?.name ?? null } as any)
      .eq("id", id);
    if (error) toast.error(error.message);
  }

  const fmt = (n: number) => `${Math.round(n).toLocaleString("es-ES")} Coins`;
  // Only the stable Registro PD row ID may resolve a current profile; names are not identities.
  const pdDe = (entry: Entry) => entry.pd_member_id
    ? pd.find(member => member.id === entry.pd_member_id) ?? null
    : null;
  const rangoDe = (entry: Entry) => pdDe(entry)?.rango ?? null;
  const baseDe = (r: Entry) => {
    const m = pdDe(r);
    return m ? Number(m.sueldo_defecto) || 0 : Number(r.paga) || 0;
  };
  const extrasDe = (r: Entry) => {
    const m = pdDe(r);
    return (m?.division && m.division !== "Ninguna" && m.division !== "N/A" ? DIVISION_BONUS : 0) +
      (m?.division2 && m.division2 !== "Ninguna" && m.division2 !== "N/A" ? DIVISION_BONUS : 0) +
      (m?.es_instructor ? INSTRUCTOR_BONUS : 0);
  };
  const totalDe = (r: Entry) => baseDe(r) + extrasDe(r);

  return (
    <div className="space-y-4">
      {/* CABECERA / AÑADIR MES */}
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
                Salario
              </h2>
            </div>
          </div>
          {canEdit && (
            <form onSubmit={addMonth} className="flex flex-col sm:flex-row gap-3">
              <Input
                placeholder="Nombre del mes (Ej: Enero 2026)"
                value={newMonth}
                onChange={e => setNewMonth(e.target.value)}
                className="h-11 rounded-none border-blue-300 bg-white font-semibold text-slate-800 focus:border-blue-700 sm:max-w-xs"
              />
              <Button type="submit"
                className="h-11 rounded-none bg-blue-700 hover:bg-blue-800 text-white font-bold tracking-wider">
                <Plus className="w-4 h-4 mr-1" /> Añadir nuevo mes
              </Button>
            </form>
          )}
          <p className="text-xs text-slate-500 font-semibold">
            {canEdit
              ? "Los nombres y la paga se toman de Registro PD (sueldo individual +15 por cada división asignada y +10 por función de Instructor) y no se editan aquí."
              : "Vista pública de solo lectura. Solo el Alto Mando puede editar los salarios."}
          </p>
        </div>
      </Card>

      {months.length === 0 && (
        <Card className="border-2 border-blue-300 bg-white rounded-none">
          <div className="p-10 text-center text-slate-400 uppercase tracking-widest font-bold">
            Sin meses creados aún.
          </div>
        </Card>
      )}

      {months.map(m => {
        const monthRows = entries.filter(e => e.month_id === m.id);
        // Keep every legacy salary row visible: without a stable ID, equal names
        // may represent different people or separate historical payment records.
        const rows = sortByRango(
          monthRows,
          r => rangoDe(r),
          r => r.nombre,
        );
        const total = rows.reduce((s, r) => s + totalDe(r), 0);
        const pagado = rows.filter(r => r.pagado).reduce((s, r) => s + totalDe(r), 0);
        const isOpen = !!open[m.id];
        return (
          <Card key={m.id} className="overflow-hidden border-2 border-blue-300 bg-white shadow-md rounded-none">
            <div className="h-1.5 bg-blue-700" />
            <div className="flex items-center justify-between px-5 py-3 border-b-2 border-blue-200">
              <button
                onClick={() => setOpen(p => ({ ...p, [m.id]: !isOpen }))}
                className="flex items-center gap-3 text-left"
              >
                {isOpen ? <ChevronDown className="w-5 h-5 text-blue-700" /> : <ChevronRight className="w-5 h-5 text-blue-700" />}
                <span className="text-xl font-black uppercase tracking-wide text-slate-900 font-display">
                  {m.label}
                </span>
                <span className="text-xs text-slate-500 font-mono font-bold">{rows.length} agentes</span>
              </button>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" disabled={busy === m.id + "-pdf"}
                  onClick={async () => { setOpen(p => ({ ...p, [m.id]: true })); await new Promise(r => setTimeout(r, 60)); exportPdf(m); }}
                  className="h-9 rounded-none border-blue-300 bg-white text-blue-800 font-bold hover:bg-blue-50">
                  <FileDown className="w-4 h-4 mr-1" /> {busy === m.id + "-pdf" ? "Generando…" : "PDF"}
                </Button>
                <Button size="sm" variant="outline" disabled={busy === m.id + "-img"}
                  onClick={async () => { setOpen(p => ({ ...p, [m.id]: true })); await new Promise(r => setTimeout(r, 60)); exportImage(m); }}
                  className="h-9 rounded-none border-blue-300 bg-white text-blue-800 font-bold hover:bg-blue-50">
                  <ImageDown className="w-4 h-4 mr-1" /> {busy === m.id + "-img" ? "Generando…" : "Imagen"}
                </Button>
                {canEdit && (
                  <>
                    <Button size="sm" variant="outline"
                      onClick={() => syncMonth(m.id, monthRows)}
                      className="h-9 rounded-none border-blue-300 bg-white text-blue-800 font-bold hover:bg-blue-50">
                      <Users className="w-4 h-4 mr-1" /> Sincronizar Registro PD
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => removeMonth(m)}
                      className="h-9 w-9 rounded-none hover:bg-red-100">
                      <Trash2 className="w-4 h-4 text-red-600" />
                    </Button>
                  </>
                )}
              </div>
            </div>

            {isOpen && (
              <div ref={el => { cardRefs.current[m.id] = el; }} className="bg-white p-5 grid gap-4 lg:grid-cols-[1fr_auto] items-start">
                <div className="lg:col-span-2 flex items-center gap-3">
                  <img src={sapdLogo.url} alt="SAPD" className="w-9 h-9 object-contain" />
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.25em] font-extrabold text-blue-700">San Andreas Police Department</p>
                    <p className="text-lg font-black uppercase tracking-wide text-slate-900 font-display">Salario · {m.label}</p>
                  </div>
                </div>
                <div className="border-2 border-blue-300 overflow-x-auto">
                  <table className="w-full text-sm font-table">
                    <thead>
                      <tr className="bg-blue-700 text-white">
                        <th className="p-3 text-left border border-blue-600 uppercase font-extrabold tracking-wider">Nombre SAPD</th>
                        <th className="p-3 text-left border border-blue-600 uppercase font-extrabold tracking-wider">Rango</th>
                        <th className="p-3 text-left border border-blue-600 uppercase font-extrabold tracking-wider">Mes</th>
                        <th className="p-3 text-left border border-blue-600 uppercase font-extrabold tracking-wider">Paga total (Coins)</th>
                        <th className="p-3 text-left border border-blue-600 uppercase font-extrabold tracking-wider">Nota</th>
                        <th className="p-3 text-center border border-blue-600 uppercase font-extrabold tracking-wider">Pagado</th>
                        {canEdit && <th className="p-3 border border-blue-600 w-10" />}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r, idx) => (
                        <tr key={r.id}
                          className={`border-t border-blue-200 hover:bg-blue-100 transition-colors ${idx % 2 ? "bg-slate-50" : "bg-blue-50/40"}`}>
                          <td className="p-3 border border-blue-200 font-mono font-bold text-slate-800 whitespace-nowrap">
                            {r.nombre || "—"}{pdDe(r)?.placa ? `#${pdDe(r)?.placa}` : ""}
                          </td>
                          <td className="p-3 border border-blue-200 font-bold text-slate-600 whitespace-nowrap">
                            {rangoDe(r) ?? "—"}
                          </td>
                          <td className="p-3 border border-blue-200 font-semibold text-slate-600 whitespace-nowrap">{m.label}</td>
                          <td className="p-3 border border-blue-200 whitespace-nowrap">
                            <span className="font-mono font-bold text-slate-800">{fmt(totalDe(r))}</span>
                            {extrasDe(r) > 0 && (
                              <span className="ml-2 text-[10px] font-extrabold uppercase tracking-wider text-emerald-700">
                                +{extrasDe(r)} (Extras)
                              </span>
                            )}
                          </td>
                          <td className="p-2 border border-blue-200">
                            {canEdit ? (
                              <Input
                                placeholder="Nota:"
                                value={r.nota ?? ""}
                                onChange={e => patchLocal(r.id, { nota: e.target.value })}
                                onBlur={e => saveEntry(r.id, { nota: e.target.value.trim() || null })}
                                className="h-9 min-w-[180px] rounded-none border-blue-200 bg-white text-slate-800 font-semibold"
                              />
                            ) : (
                              <span className="font-semibold text-slate-600">{r.nota || "—"}</span>
                            )}
                          </td>
                          <td className="p-3 text-center border border-blue-200">
                            <button
                              type="button"
                              disabled={!canEdit}
                              onClick={() => {
                                if (!canEdit) return;
                                const v = !r.pagado;
                                patchLocal(r.id, { pagado: v });
                                saveEntry(r.id, { pagado: v });
                              }}
                              className={`px-3 py-1.5 text-xs font-extrabold uppercase tracking-wider border transition-colors ${
                                r.pagado
                                  ? "text-emerald-700 border-emerald-300 bg-emerald-50 hover:bg-emerald-100"
                                  : "text-red-600 border-red-300 bg-red-50 hover:bg-red-100"
                              } ${canEdit ? "cursor-pointer" : "cursor-default opacity-90"}`}
                            >
                              {r.pagado ? "Pagado" : "No Pagado"}
                            </button>
                          </td>
                          {canEdit && (
                            <td className="p-2 text-center border border-blue-200">
                              <Button size="icon" variant="ghost" onClick={() => removeEntry(r)}
                                className="h-8 w-8 rounded-none hover:bg-red-100">
                                <Trash2 className="w-4 h-4 text-red-600" />
                              </Button>
                            </td>
                          )}
                        </tr>
                      ))}
                      {rows.length === 0 && (
                        <tr>
                          <td colSpan={canEdit ? 7 : 6} className="p-8 text-center text-slate-400 uppercase tracking-widest font-bold">
                            Sin agentes en este mes.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* TOTAL DEL MES */}
                <div className="border-2 border-blue-300 bg-blue-50 min-w-[220px]">
                  <div className="bg-blue-700 text-white px-4 py-2 flex items-center gap-2">
                    <Coins className="w-4 h-4" />
                    <span className="uppercase font-extrabold tracking-wider text-xs">Total del Mes</span>
                  </div>
                  <div className="p-4 space-y-3">
                    <div>
                      <p className="text-[10px] uppercase tracking-widest text-slate-500 font-extrabold">Total</p>
                      <p className="text-2xl font-black text-slate-900 font-mono">{fmt(total)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-widest text-slate-500 font-extrabold">Pagado</p>
                      <p className="text-lg font-black text-emerald-700 font-mono">{fmt(pagado)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-widest text-slate-500 font-extrabold">Pendiente</p>
                      <p className="text-lg font-black text-red-600 font-mono">{fmt(total - pagado)}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}

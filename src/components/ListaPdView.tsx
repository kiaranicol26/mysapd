import { useEffect, useState } from "react";
import sapdLogo from "@/assets/sapd-logo.png.asset.json";
import { db } from "@/lib/db";
import { Session } from "@/lib/session";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { sortByRango } from "@/lib/rangos";
import { Users } from "lucide-react";

export type PdMember = {
  id: string;
  nombre: string;
  rango: string | null;
  sueldo_defecto: number;
  placa?: string | null;
  division?: string | null;
  division2?: string | null;
  es_instructor?: boolean;
  created_at: string;
  instructor_id?: string | null;
};

const normalizePdName = (name: string) =>
  name.replace(/\|/g, " ").replace(/\s+/g, " ").trim().toLocaleLowerCase("es");

export function ListaPdView(_props: { session: Session }) {
  const [members, setMembers] = useState<PdMember[]>([]);
   const [q, setQ] = useState("");
 

  async function load() {
    const { data } = await db
      .from("pd_members")
      .select("id, instructor_id, nombre, rango, sueldo_defecto, placa, division, division2, es_instructor, created_at")
      .order("nombre", { ascending: true });
    if (data) {
      const unique = new Map<string, PdMember>();
      for (const member of data as unknown as PdMember[]) {
        const key = normalizePdName(member.nombre) || `id:${member.instructor_id ?? member.id}`;
        const previous = unique.get(key);
        // Prefer the row linked to its Discord account when a legacy duplicate exists.
        if (!previous || (!previous.instructor_id && member.instructor_id)) unique.set(key, member);
      }
      setMembers([...unique.values()]);
    }
  }

  useEffect(() => { load(); }, []);

  const filtered = sortByRango(
    members.filter(m =>
      (m.nombre + " " + (m.rango ?? "")).toLowerCase().includes(q.toLowerCase()),
    ),
    m => m.rango,
    m => m.nombre,
  );

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
                Lista PD
              </h2>
            </div>
            <div className="ml-auto flex items-center gap-2 px-3 py-2 bg-blue-700 text-white">
              <Users className="w-4 h-4" />
              <span className="font-mono font-bold">{members.length}</span>
              <span className="text-[10px] uppercase tracking-widest font-bold">Agentes</span>
            </div>
          </div>

          <p className="text-xs text-slate-500 font-semibold">
            Los datos se sincronizan directamente desde Registro PD. El sueldo individual, las divisiones y la condición de Instructor se administran allí por Alto Mando.
          </p>
        </div>
      </Card>

      <Card className="overflow-hidden border-2 border-blue-300 bg-white shadow-md rounded-none">
        <div className="p-5 space-y-4">
          <Input placeholder="Buscar…" value={q} onChange={e => setQ(e.target.value)}
            className="h-10 rounded-none border-blue-300 bg-white font-semibold text-slate-800 max-w-xs" />
          <div className="border-2 border-blue-300 overflow-x-auto">
            <table className="w-full text-sm font-table">
              <thead>
                <tr className="bg-blue-700 text-white">
                  <th className="p-3 text-left border border-blue-600 uppercase font-extrabold tracking-wider">Nombre</th>
                  <th className="p-3 text-left border border-blue-600 uppercase font-extrabold tracking-wider">Rango</th>
                  <th className="p-3 text-left border border-blue-600 uppercase font-extrabold tracking-wider">Sueldo base</th>
                  <th className="p-3 text-left border border-blue-600 uppercase font-extrabold tracking-wider">Extras</th>
                  <th className="p-3 text-left border border-blue-600 uppercase font-extrabold tracking-wider">Total</th>
                  <th className="p-3 text-left border border-blue-600 uppercase font-extrabold tracking-wider">Divisiones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((m, idx) => (
                  <tr key={m.id}
                    className={`border-t border-blue-200 hover:bg-blue-100 transition-colors ${idx % 2 ? "bg-slate-50" : "bg-blue-50/40"}`}>
                    <td className="p-3 border border-blue-200 font-mono font-bold text-slate-800 whitespace-nowrap">
                      {m.nombre}{m.placa ? `#${m.placa}` : ""}
                    </td>
                    <td className="p-3 border border-blue-200 font-bold text-slate-600">{m.rango ?? "—"}</td>
                    <td className="p-3 border border-blue-200 font-mono font-bold">{Number(m.sueldo_defecto) || 0} Coins</td>
                    <td className="p-3 border border-blue-200 font-mono font-bold text-emerald-700">
                      {((m.division && m.division !== "Ninguna" && m.division !== "N/A" ? 10 : 0) + (m.division2 && m.division2 !== "Ninguna" && m.division2 !== "N/A" ? 10 : 0) + (m.es_instructor ? 10 : 0))} Coins
                    </td>
                    <td className="p-3 border border-blue-200 font-mono font-black text-blue-800">
                      {(Number(m.sueldo_defecto) || 0) + (m.division && m.division !== "Ninguna" && m.division !== "N/A" ? 10 : 0) + (m.division2 && m.division2 !== "Ninguna" && m.division2 !== "N/A" ? 10 : 0) + (m.es_instructor ? 10 : 0)} Coins
                    </td>
                    <td className="p-3 border border-blue-200 text-xs font-semibold text-slate-600">
                      {[m.division && m.division !== "Ninguna" && m.division !== "N/A" ? m.division : null, m.division2 && m.division2 !== "Ninguna" && m.division2 !== "N/A" ? m.division2 : null].filter(Boolean).join(" · ") || "Sin división"}{m.es_instructor ? " · Instructor" : ""}
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-10 text-center text-slate-400 uppercase tracking-widest font-bold">
                      Sin agentes en la lista.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
         </div>
      </Card>
    </div>
  );
}

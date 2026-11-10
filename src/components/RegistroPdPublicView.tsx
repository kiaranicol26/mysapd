import { useEffect, useMemo, useState } from "react";
import sapdLogo from "@/assets/sapd-logo.png.asset.json";
import { db } from "@/lib/db";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { UserRound, ShieldCheck } from "lucide-react";
import { RANGO_PLURAL } from "@/lib/rangos";
import type { Session } from "@/lib/session";
import pictoM4 from "@/assets/picto-m4.png.asset.json";
import pictoEdc from "@/assets/picto-edc.png.asset.json";
import pictoSniper from "@/assets/picto-sniper.png.asset.json";
import pictoAk from "@/assets/picto-ak.png.asset.json";
import pictoMary from "@/assets/picto-mary.png.asset.json";
import pictoAir from "@/assets/picto-air.png.asset.json";
 
type Member = {
  id: string; instructor_id: string | null; nombre: string; rango: string | null; foto: string | null;
  placa: string | null; es_instructor: boolean;
  division: string | null; division_rango: string | null;
  division2: string | null; division2_rango: string | null;
  division3: string | null; division3_rango: string | null;
  cap_m4: boolean; cap_edc: boolean; cap_mary: boolean; cap_sniper: boolean; cap_air: boolean; cap_ak47: boolean;
};
type User = { id: string; name: string; avatar_url: string | null; role: string | null; placa: string | null; discord_joined_at: string | null; discord_inhabilitado: boolean };

const CAPACITACIONES = [
  { key: "cap_m4", label: "M4", picto: pictoM4.url, category: "Armas" },
  { key: "cap_edc", label: "EDC", picto: pictoEdc.url, category: "Armas" },
  { key: "cap_mary", label: "MARY", picto: pictoMary.url, category: "Armas" },
  { key: "cap_sniper", label: "SNIPER", picto: pictoSniper.url, category: "Armas" },
  { key: "cap_air", label: "AIR", picto: pictoAir.url, category: "Vehículos" },
  { key: "cap_ak47", label: "AK47", picto: pictoAk.url, category: "Armas" },
] as const;

function daysSince(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  return Math.max(0, Math.floor((Date.now() - date.getTime()) / 86400000));
}

export function RegistroPdPublicView({ session }: { session: Session | null }) {
  const [members, setMembers] = useState<Member[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    Promise.all([
      db.from("pd_members").select("id, instructor_id, nombre, rango, foto, placa, es_instructor, division, division_rango, division2, division2_rango, division3, division3_rango, cap_m4, cap_edc, cap_mary, cap_sniper, cap_air, cap_ak47").order("nombre", { ascending: true }),
      db.from("instructors").select("id, name, avatar_url, role, placa, discord_joined_at, discord_inhabilitado").order("name", { ascending: true })
    ]).then(([a, b]) => {
      if (!active) return;
      if (a.data) setMembers(a.data as Member[]);
      if (b.data) setUsers(b.data as User[]);
      setLoading(false);
    }).catch(() => setLoading(false));
    return () => { active = false };
  }, []);

  const rows = useMemo(() => users.filter(u => !u.discord_inhabilitado).map(u => {
    const m = members.find(x => x.instructor_id === u.id) ??
      members.find(x => x.nombre.trim().toLowerCase() === u.name.trim().toLowerCase());
    return { u, m };
  }).filter(({ u, m }) => (u.name + " " + (u.placa ?? m?.placa ?? "") + " " + (m?.rango ?? "") + " " +
    CAPACITACIONES.filter(c => m?.[c.key]).map(c => c.label).join(" ")).toLowerCase().includes(query.toLowerCase())), [users, members, query]);

  const rankOrder = ["Comisario", "Inspector", "Capitan", "Capitán", "Teniente", "Sargento", "Cabo", "Oficial", "Cadete", "Aspirante"];
  const groupedRows = rankOrder.map(rank => ({
    rank,
    label: RANGO_PLURAL[rank] ?? (rank === "Capitan" || rank === "Capitán" ? "Capitanes" : rank + "s"),
    items: rows.filter(({ m }) => (m?.rango ?? "").toLowerCase() === rank.toLowerCase()),
  })).filter(group => group.items.length > 0);
  const unrankedRows = rows.filter(({ m }) => !m?.rango || !rankOrder.some(rank => rank.toLowerCase() === (m.rango ?? "").toLowerCase()));

  return <AppShell session={session}>
    <div className="max-w-6xl mx-auto space-y-5">
      <Card className="overflow-hidden border-2 border-blue-300 bg-white rounded-none">
        <div className="h-1.5 bg-blue-700" />
        <div className="p-5 flex flex-wrap items-center gap-4">
          <div className="w-12 h-12 flex items-center justify-center border-2 border-blue-300 bg-white p-1"><img src={sapdLogo.url} alt="SAPD" className="w-full h-full object-contain" /></div>
          <div className="flex-1 min-w-[180px]">
            <p className="text-blue-700 text-xs uppercase tracking-[0.3em] font-extrabold">San Andreas Police Department</p>
            <h2 className="text-2xl font-black uppercase text-slate-900">Registro de Policías</h2>
            <p className="text-xs text-slate-500">Listado oficial del personal activo</p>
          </div>
          <div className="bg-blue-700 text-white px-3 py-2 text-xs font-bold uppercase">{rows.length} agentes</div>
          <Input placeholder="Buscar por nombre, placa, rango, cargo o capacitación…" value={query} onChange={e => setQuery(e.target.value)} className="max-w-sm rounded-none border-blue-300" />
        </div>
      </Card>
      {loading ? <Card className="p-10 text-center">Cargando registro policial…</Card> : <>
        {groupedRows.map(group => <section key={group.rank} className="space-y-3">
          <div className="flex items-center gap-3 bg-blue-700 text-white px-4 py-2">
            <h3 className="font-display font-black uppercase tracking-[0.25em] text-sm">[{group.label}]</h3>
            <span className="ml-auto font-mono font-bold text-xs">{group.items.length}</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {group.items.map(({ u, m }) => {
            const age = daysSince(u.discord_joined_at);
            const photo = m?.foto || u.avatar_url || null;
            const caps = CAPACITACIONES.filter(c => m?.[c.key]);
            const divisions = [
              m?.division && m.division !== "Ninguna" ? m.division + (m.division_rango ? " · " + m.division_rango : "") : null,
              m?.division2 && m.division2 !== "Ninguna" ? m.division2 + (m.division2_rango ? " · " + m.division2_rango : "") : null,
              m?.division3 && m.division3 !== "Ninguna" ? m.division3 + (m.division3_rango ? " · " + m.division3_rango : "") : null,
            ].filter(Boolean);
            return <Card key={u.id} className="overflow-hidden rounded-none border-2 border-slate-200 bg-white">
              <div className="h-1.5 bg-blue-700" />
              <div className="p-4 flex gap-3 items-center">
                <div className="w-12 h-12 shrink-0 overflow-hidden border border-blue-200 bg-slate-100 flex items-center justify-center">
                  {photo ? <img src={photo} alt={u.name} className="w-full h-full object-cover" /> : <UserRound className="w-8 h-8 text-slate-400" />}
                </div>
                <div className="min-w-0">
                  <p className="font-black text-slate-900 break-words">{u.name}</p>
                  <p className="font-mono text-xs font-bold text-blue-700">#{u.placa || m?.placa || "0000"}</p>
                  {m && <p className="font-mono text-[9px] text-slate-400">SAPD-{m.id.slice(0, 8).toUpperCase()}</p>}
                </div>
              </div>
              <div className="px-4 pb-4 space-y-2 text-sm">
                <div className="border-t pt-2"><p className="text-[10px] uppercase tracking-widest text-slate-500 font-extrabold">Rango</p><p className="font-bold text-slate-900">{m?.rango || "Sin rango asignado"}</p></div>
                {(divisions.length > 0 || m?.es_instructor) && <div><p className="text-[10px] uppercase tracking-widest text-slate-500 font-extrabold">Divisiones / Cargo</p><div className="flex flex-wrap gap-1.5 mt-1">{divisions.map((division, index) => <span key={index} className="border border-blue-200 bg-blue-50 px-2 py-1 text-[10px] font-bold text-blue-800">{division}</span>)}{m?.es_instructor && <span className="border border-emerald-200 bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-800">Cargo: Instructor</span>}</div></div>}
                <div><p className="text-[10px] uppercase tracking-widest text-slate-500 font-extrabold">Cargo</p><p className="font-bold text-slate-900">{m?.es_instructor ? "Instructor" : "Personal policial"}</p></div>
                <div><p className="text-[10px] uppercase tracking-widest text-slate-500 font-extrabold">Antigüedad Academica</p><p className="font-bold text-slate-900">{age === null ? "Pendiente de sincronización" : age + " días"}</p></div>
              </div>
            </Card>
          })}
          </div>
        </section>)}
        {unrankedRows.length > 0 && <section className="space-y-3">
          <div className="flex items-center gap-3 bg-slate-600 text-white px-4 py-2"><h3 className="font-display font-black uppercase tracking-[0.25em] text-sm">[SIN RANGO ASIGNADO]</h3><span className="ml-auto font-mono font-bold text-xs">{unrankedRows.length}</span></div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{unrankedRows.map(({ u }) => <Card key={u.id} className="p-4 rounded-none border-2 border-slate-200 bg-white"><p className="font-black text-slate-900">{u.name}</p><p className="font-mono text-sm text-blue-700">#{u.placa || "0000"}</p><p className="text-xs text-slate-500 mt-2">Sin rango asignado</p></Card>)}</div>
        </section>}
      {!loading && rows.length === 0 && <Card className="p-10 text-center text-slate-500">No hay policías para mostrar.</Card>}
        </>}
    </div>
  </AppShell>;
}

import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { db } from "@/lib/db";
import type { Session } from "@/lib/session";
import { BadgeCheck, GraduationCap } from "lucide-react";
import { toast } from "sonner";
import pictoM4 from "@/assets/picto-m4.png.asset.json";
import pictoEdc from "@/assets/picto-edc.png.asset.json";
import pictoSniper from "@/assets/picto-sniper.png.asset.json";
import pictoAk from "@/assets/picto-ak.png.asset.json";
import pictoMary from "@/assets/picto-mary.png.asset.json";
import pictoAir from "@/assets/picto-air.png.asset.json";

type Member = {
  id: string; nombre: string; instructor_id: string | null;
  cap_m4: boolean; cap_edc: boolean; cap_mary: boolean; cap_sniper: boolean; cap_air: boolean; cap_ak47: boolean;
};
type User = { id: string; name: string; discord_inhabilitado: boolean };
const CAPACITACIONES = [
  { key: "cap_m4", label: "M4", picto: pictoM4.url, category: "Armas" },
  { key: "cap_edc", label: "EDC", picto: pictoEdc.url, category: "Armas" },
  { key: "cap_mary", label: "MARY", picto: pictoMary.url, category: "Armas" },
  { key: "cap_sniper", label: "SNIPER", picto: pictoSniper.url, category: "Armas" },
  { key: "cap_air", label: "AIR", picto: pictoAir.url, category: "Vehículos" },
  { key: "cap_ak47", label: "AK47", picto: pictoAk.url, category: "Armas" },
] as const;
type CapKey = (typeof CAPACITACIONES)[number]["key"];

export function CapacitacionesView({ session }: { session: Session | null }) {
  const [members, setMembers] = useState<Member[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const canEdit = !!session?.is_alto_mando || !!session?.can_edit_capacitaciones;

  async function load() {
    const [a, b] = await Promise.all([
      db.from("pd_members").select("id, nombre, instructor_id, cap_m4, cap_edc, cap_mary, cap_sniper, cap_air, cap_ak47").order("nombre", { ascending: true }),
      db.from("instructors").select("id, name, discord_inhabilitado").order("name", { ascending: true }),
    ]);
    if (a.data) setMembers(a.data as Member[]);
    if (b.data) setUsers(b.data as User[]);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  function getUser(m: Member) {
    return users.find(u => u.id === m.instructor_id) ?? users.find(u => u.name.trim().toLowerCase() === m.nombre.trim().toLowerCase());
  }
  async function change(m: Member, cap: CapKey, value: boolean) {
    const label = CAPACITACIONES.find(c => c.key === cap)?.label ?? cap;
    if (!window.confirm(`¿Confirmás ${value ? "asignar" : "quitar"} ${label} a ${m.nombre} (SAPD-${m.id.slice(0, 8).toUpperCase()})?`)) return;
    setSaving(true);
    const { error } = await db.from("pd_members").update({ [cap]: value } as any).eq("id", m.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(`${label} ${value ? "asignada a" : "quitada a"} ${m.nombre}`);
    await load();
  }

  return <AppShell session={session}>
    <div className="max-w-6xl mx-auto space-y-5">
      <Card className="overflow-hidden rounded-none border-2 border-blue-300 bg-white">
        <div className="h-1.5 bg-blue-700" />
        <div className="p-5 flex items-center gap-4">
          <div className="w-12 h-12 flex items-center justify-center border-2 border-blue-300 text-blue-700"><GraduationCap className="w-7 h-7" /></div>
          <div className="flex-1">
            <p className="text-blue-700 text-xs uppercase tracking-[0.3em] font-extrabold">San Andreas Police Department</p>
            <h2 className="text-2xl font-black uppercase text-slate-900">Capacitaciones</h2>
            <p className="text-xs text-slate-500">Personal SAPD habilitado por especialidad</p>
          </div>
          <BadgeCheck className="w-6 h-6 text-blue-700" />
        </div>
      </Card>
      {loading ? <Card className="p-10 text-center text-slate-500">Cargando capacitaciones…</Card> :
        (["Armas", "Vehículos"] as const).map(category => <section key={category} className="space-y-3">
          <div className="flex items-center gap-3 bg-blue-700 text-white px-4 py-2">
            <h3 className="font-black uppercase tracking-[0.2em] text-sm">{category}</h3>
            <span className="ml-auto text-xs font-mono">{CAPACITACIONES.filter(c => c.category === category).length} capacitaciones</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {CAPACITACIONES.filter(c => c.category === category).map(c => {
              const holders = members.filter(m => m[c.key]).map(m => ({ m, u: getUser(m) })).filter(x => x.u && !x.u.discord_inhabilitado);
              const available = members.filter(m => !m[c.key] && (!getUser(m) || !getUser(m)?.discord_inhabilitado));
              return <Card key={c.key} className="rounded-none border-2 border-slate-200 bg-white p-4 space-y-3">
                <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                  <img src={c.picto} alt="" className="h-7 w-7 object-contain" />
                  <span className="font-black text-slate-900">{c.label}</span>
                  <span className="ml-auto text-xs font-mono text-slate-500">{holders.length} SAPD</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {holders.length ? holders.map(({m,u}) => <span key={m.id} className="inline-flex items-center gap-1 bg-blue-50 px-2 py-1 text-[11px] font-bold text-blue-900">
                    {u?.name ?? m.nombre}<span className="font-mono text-[9px] text-blue-600">SAPD-{m.id.slice(0,8).toUpperCase()}</span>
                    {canEdit && <button disabled={saving} onClick={() => change(m,c.key,false)} aria-label={`Quitar ${c.label} a ${m.nombre}`} className="ml-1 text-red-600">×</button>}
                  </span>) : <p className="text-xs text-slate-400">Sin personal asignado</p>}
                </div>
                {canEdit && <select disabled={saving || available.length === 0} defaultValue="" onChange={e => { const m = members.find(x => x.id === e.target.value); if (m) change(m,c.key,true); e.target.value = ""; }} className="h-9 w-full border border-blue-200 bg-white px-2 text-xs font-semibold text-slate-700">
                  <option value="" disabled>Agregar SAPD…</option>
                  {available.map(m => <option key={m.id} value={m.id}>{getUser(m)?.name ?? m.nombre} · SAPD-{m.id.slice(0,8).toUpperCase()}</option>)}
                </select>}
              </Card>;
            })}
          </div>
        </section>)
      }
    </div>
  </AppShell>;
}

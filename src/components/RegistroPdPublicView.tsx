import { useEffect, useMemo, useState } from "react";
import { db } from "@/lib/db";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { UserRound, ShieldCheck } from "lucide-react";
import type { Session } from "@/lib/session";

type Member = { id:string; instructor_id:string|null; nombre:string; rango:string|null; foto:string|null; placa:string|null };
type User = { id:string; name:string; avatar_url:string|null; role:string|null; placa:string|null; discord_joined_at:string|null };

const CARGO: Record<string,string> = {
  Comisario:"Encargado de SAPD", Cupula:"Cúpula", Instructor:"Instructor", Usuario:"Agente"
};

function daysSince(value:string|null) {
  if (!value) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  return Math.max(0, Math.floor((Date.now()-date.getTime())/86400000));
}

export function RegistroPdPublicView({session}:{session:Session|null}) {
  const [members,setMembers]=useState<Member[]>([]);
  const [users,setUsers]=useState<User[]>([]);
  const [query,setQuery]=useState("");
  const [loading,setLoading]=useState(true);

  useEffect(()=>{
    let active=true;
    Promise.all([
      db.from("pd_members").select("id, instructor_id, nombre, rango, foto, placa").order("nombre",{ascending:true}),
      db.from("instructors").select("id, name, avatar_url, role, placa, discord_joined_at").order("name",{ascending:true})
    ]).then(([a,b])=>{
      if(!active)return;
      if(a.data)setMembers(a.data as Member[]);
      if(b.data)setUsers(b.data as User[]);
      setLoading(false);
    }).catch(()=>setLoading(false));
    return ()=>{active=false};
  },[]);

  const rows=useMemo(()=>users.map(u=>{
    const m=members.find(x=>x.instructor_id===u.id) ??
      members.find(x=>x.nombre.trim().toLowerCase()===u.name.trim().toLowerCase());
    return {u,m};
  }).filter(({u,m})=>(u.name+" "+(u.placa??m?.placa??"")+" "+(m?.rango??"")+" "+(CARGO[u.role??"Usuario"]??u.role??"Agente")).toLowerCase().includes(query.toLowerCase())),[users,members,query]);

  return <AppShell session={session}>
    <div className="max-w-6xl mx-auto space-y-5">
      <Card className="overflow-hidden border-2 border-blue-300 bg-white rounded-none">
        <div className="h-1.5 bg-blue-700"/>
        <div className="p-5 flex flex-wrap items-center gap-4">
          <div className="w-12 h-12 flex items-center justify-center border-2 border-blue-300 text-blue-700"><ShieldCheck className="w-7 h-7"/></div>
          <div className="flex-1 min-w-[180px]">
            <p className="text-blue-700 text-xs uppercase tracking-[0.3em] font-extrabold">San Andreas Police Department</p>
            <h2 className="text-2xl font-black uppercase text-slate-900">Registro de Policías</h2>
            <p className="text-xs text-slate-500">Listado oficial del personal activo</p>
          </div>
          <div className="bg-blue-700 text-white px-3 py-2 text-xs font-bold uppercase">{rows.length} agentes</div>
          <Input placeholder="Buscar por nombre, placa, rango o cargo…" value={query} onChange={e=>setQuery(e.target.value)} className="max-w-sm rounded-none border-blue-300"/>
        </div>
      </Card>
      {loading ? <Card className="p-10 text-center">Cargando registro policial…</Card> :
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {rows.map(({u,m})=>{
            const age=daysSince(u.discord_joined_at);
            const photo=m?.foto||u.avatar_url||null;
            return <Card key={u.id} className="overflow-hidden rounded-none border-2 border-slate-200 bg-white">
              <div className="h-1.5 bg-blue-700"/>
              <div className="p-4 flex gap-3 items-center">
                <div className="w-16 h-16 shrink-0 overflow-hidden border-2 border-blue-200 bg-slate-100 flex items-center justify-center">
                  {photo?<img src={photo} alt={u.name} className="w-full h-full object-cover"/>:<UserRound className="w-8 h-8 text-slate-400"/>}
                </div>
                <div className="min-w-0">
                  <p className="font-black text-slate-900 break-words">{u.name}</p>
                  <p className="font-mono text-sm font-bold text-blue-700">#{u.placa||m?.placa||"0000"}</p>
                </div>
              </div>
              <div className="px-4 pb-4 space-y-2 text-sm">
                <div className="border-t pt-2"><p className="text-[10px] uppercase tracking-widest text-slate-500 font-extrabold">Rango</p><p className="font-bold text-slate-900">{m?.rango||"Sin rango asignado"}</p></div>
                <div><p className="text-[10px] uppercase tracking-widest text-slate-500 font-extrabold">Cargo</p><p className="font-bold text-slate-900">{CARGO[u.role??"Usuario"]??u.role??"Agente"}</p></div>
                <div><p className="text-[10px] uppercase tracking-widest text-slate-500 font-extrabold">Antigüedad</p><p className="font-bold text-slate-900">{age===null?"Pendiente de sincronización":age+" días"}</p></div>
              </div>
            </Card>
          })}
        </div>}
      {!loading&&rows.length===0&&<Card className="p-10 text-center text-slate-500">No hay policías para mostrar.</Card>}
    </div>
  </AppShell>;
}

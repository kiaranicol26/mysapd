import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { db, getToken } from "@/lib/db";
import { managePdInstructor } from "@/lib/data.functions";
import type { Session } from "@/lib/session";
import { BadgeCheck, Plus, Trash2, RefreshCw, Loader2, Search, Users } from "lucide-react";
import { toast } from "sonner";

type Member = { id: string; instructor_id: string | null; nombre: string; rango: string | null; es_instructor: boolean };
type Account = { id: string; name: string; avatar_url: string | null; admin_rango: string | null };

export function InstructoresView({ session }: { session: Session | null }) {
  const [members, setMembers] = useState<Member[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState("");

  const accountById = useMemo(() => new Map(accounts.map(a => [a.id, a])), [accounts]);
  const accountByName = useMemo(() => {
    const map = new Map<string, Account[]>();
    for (const account of accounts) {
      const key = account.name.trim().toLowerCase();
      map.set(key, [...(map.get(key) ?? []), account]);
    }
    return map;
  }, [accounts]);

  const rows = useMemo(() => members.map(member => {
    const account = (member.instructor_id ? accountById.get(member.instructor_id) : undefined)
      ?? (accountByName.get(member.nombre.trim().toLowerCase())?.length === 1
        ? accountByName.get(member.nombre.trim().toLowerCase())?.[0] : undefined);
    return { ...member, account };
  }).filter(row => row.account), [members, accountById, accountByName]);

  const instructors = rows.filter(row => row.es_instructor)
    .filter(row => (row.nombre + " " + (row.rango ?? "")).toLowerCase().includes(query.toLowerCase()));
  const available = rows.filter(row => !row.es_instructor)
    .filter(row => (row.nombre + " " + (row.rango ?? "")).toLowerCase().includes(query.toLowerCase()));

  async function load() {
    setLoading(true);
    const [m, a] = await Promise.all([
      db.from("pd_members").select("id,instructor_id,nombre,rango,es_instructor").order("nombre", { ascending: true }),
      db.from("instructors").select("id,name,avatar_url,admin_rango").order("name", { ascending: true }),
    ]);
    if (m.error) toast.error("No se pudo cargar Registro PD: " + m.error.message);
    else setMembers((m.data ?? []) as Member[]);
    if (a.error) toast.error("No se pudieron cargar las cuentas: " + a.error.message);
    else setAccounts((a.data ?? []) as Account[]);
    setLoading(false);
  }

  useEffect(() => { void load(); }, []);

  async function changeStatus(pdMemberId: string, action: "add" | "remove", name: string) {
    const token = getToken();
    if (!token) return toast.error("Tu sesión expiró. Volvé a iniciar sesión.");
    setSavingId(pdMemberId);
    const result = await managePdInstructor({ data: { token, action, pdMemberId } });
    setSavingId("");
    if (!result.ok) return toast.error(result.error);
    toast.success(result.message);
    setSelectedId("");
    await load();
  }

  const canManage = session?.is_alto_mando || session?.admin_rango === "moderador";
  return <AppShell session={session}>
    <div className="mx-auto max-w-5xl space-y-5">
      <Card className="overflow-hidden rounded-none border-2 border-blue-300 bg-white">
        <div className="h-1.5 bg-blue-700" />
        <div className="flex items-center gap-4 p-5">
          <div className="flex h-12 w-12 items-center justify-center border-2 border-blue-300 text-blue-700"><Users className="h-6 w-6" /></div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-extrabold uppercase tracking-[0.3em] text-blue-700">San Andreas Police Department</p>
            <h2 className="text-2xl font-black uppercase text-slate-900">Instructores</h2>
            <p className="text-xs text-slate-500">Administración del personal habilitado para dictar capacitaciones</p>
          </div>
          <div className="flex items-center gap-2 bg-blue-700 px-3 py-2 text-white">
            <BadgeCheck className="h-4 w-4" /><span className="font-mono font-bold">{instructors.length}</span>
          </div>
        </div>
      </Card>

      <Card className="space-y-4 rounded-none border-2 border-blue-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-black uppercase text-slate-900">Agregar instructor</h3>
            <p className="text-xs text-slate-500">Solo aparecen usuarios que ya tienen ficha en Registro PD.</p>
          </div>
          <Button variant="outline" onClick={() => void load()} disabled={loading || !!savingId} className="rounded-none">
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Actualizar
          </Button>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <select value={selectedId} onChange={e => setSelectedId(e.target.value)}
            className="h-10 min-w-0 flex-1 border border-blue-200 bg-white px-3 text-sm font-semibold text-slate-800">
            <option value="">Seleccionar policía de Registro PD…</option>
            {available.map(row => <option key={row.id} value={row.id}>{row.nombre} · {row.rango ?? "Sin rango"}</option>)}
          </select>
          <Button disabled={!selectedId || !!savingId} onClick={() => {
            const member = available.find(row => row.id === selectedId);
            if (member) void changeStatus(member.id, "add", member.nombre);
          }} className="rounded-none bg-blue-700 text-white hover:bg-blue-800">
            <Plus className="mr-2 h-4 w-4" /> Agregar
          </Button>
        </div>
        <p className="text-xs text-slate-500">Al agregarlo se marca como instructor en Registro PD y se le asigna rango administrativo Ayudante si todavía era Usuario. Los rangos Moderador y Administrador se conservan.</p>
      </Card>

      <div className="flex items-center gap-2">
        <Search className="h-4 w-4 text-slate-500" />
        <Input placeholder="Buscar instructor por nombre o rango…" value={query} onChange={e => setQuery(e.target.value)}
          className="h-10 max-w-md rounded-none border-blue-200 bg-white" />
      </div>

      {loading ? <Card className="flex items-center justify-center gap-3 rounded-none border-2 border-blue-200 bg-white p-10 text-blue-700"><Loader2 className="h-6 w-6 animate-spin" /> Cargando instructores…</Card> :
        <Card className="overflow-hidden rounded-none border-2 border-blue-200 bg-white">
          <div className="flex items-center justify-between bg-blue-700 px-4 py-3 text-white">
            <h3 className="font-black uppercase tracking-wider">Instructores activos</h3>
            <span className="font-mono text-xs">{instructors.length}</span>
          </div>
          {instructors.length ? <div className="divide-y divide-blue-100">
            {instructors.map(row => <div key={row.id} className="flex items-center gap-3 p-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-blue-50 text-blue-700">
                {row.account?.avatar_url ? <img src={row.account.avatar_url} alt="" className="h-full w-full object-cover" /> : <Users className="h-5 w-5" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-extrabold text-slate-900">{row.nombre}</p>
                <p className="text-xs text-slate-500">{row.rango ?? "Sin rango"} · Administrativo: {row.account?.admin_rango ?? "usuario"}</p>
              </div>
              {canManage && <Button variant="outline" disabled={!!savingId} onClick={() => void changeStatus(row.id, "remove", row.nombre)}
                className="rounded-none border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700">
                {savingId === row.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Trash2 className="mr-2 h-4 w-4" /> Quitar</>}
              </Button>}
            </div>)}
          </div> : <div className="p-10 text-center text-sm font-semibold text-slate-400">No hay instructores que coincidan con la búsqueda.</div>}
        </Card>}
      {!loading && available.length === 0 && <p className="text-center text-xs text-slate-500">Todos los usuarios vinculados a Registro PD ya están agregados como instructores.</p>}
    </div>
  </AppShell>;
}

import { useEffect, useState } from "react";
import { getToken } from "@/lib/db";
import { getDiscordInfo, setDiscordRole } from "@/lib/discordAuth.functions";
import { toast } from "sonner";
import { Plus, X } from "lucide-react";

type Role = { id: string; name: string; color: string | null; editable: boolean };

/** Muestra los roles de Discord de un usuario; Alto Mando puede darlos o quitarlos. */
export function DiscordRoles({ targetId, canManage, onName }: { targetId?: string; canManage?: boolean; onName?: (n: string) => void }) {
  const [roles, setRoles] = useState<Role[] | null>(null);
  const [all, setAll] = useState<Role[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);

  async function load() {
    const r = await getDiscordInfo({ data: { token: getToken() ?? "", targetId } });
    if (!r.ok) { setError(r.error); setRoles([]); return; }
    setError(null); setRoles(r.roles); setAll(r.allRoles);
    onName?.(r.name);
  }
  useEffect(() => { load(); }, [targetId]);

  async function toggle(role: Role, add: boolean) {
    if (!targetId) return;
    setBusy(true);
    const r = await setDiscordRole({ data: { token: getToken() ?? "", targetId, roleId: role.id, add } });
    setBusy(false);
    if (!r.ok) return toast.error(r.error);
    toast.success(add ? `Rol ${role.name} dado` : `Rol ${role.name} quitado`);
    setAdding(false);
    load();
  }

  if (roles === null) return <p className="text-xs text-muted-foreground">Cargando roles...</p>;
  if (error) return <p className="text-xs text-muted-foreground">{error}</p>;
  const manage = canManage && !!targetId;
  const faltan = all.filter(a => a.editable && !roles.some(r => r.id === a.id));

  return (
    <div className="flex flex-wrap gap-1">
      {roles.length === 0 && <span className="text-xs text-muted-foreground">Sin roles</span>}
      {roles.map(r => (
        <span key={r.id} className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-bold bg-card border text-foreground">
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: r.color ?? "#99aab5" }} />
          {r.name}
          {manage && r.editable && (
            <button type="button" disabled={busy} onClick={() => toggle(r, false)} aria-label={`Quitar ${r.name}`} className="hover:text-destructive">
              <X className="w-3 h-3" />
            </button>
          )}
        </span>
      ))}
      {manage && faltan.length > 0 && (adding ? (
        <select autoFocus disabled={busy} defaultValue="" onBlur={() => setAdding(false)}
          onChange={e => { const r = faltan.find(f => f.id === e.target.value); if (r) toggle(r, true); }}
          className="h-6 text-[11px] border bg-card text-foreground">
          <option value="" disabled>Elegir rol...</option>
          {faltan.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
        </select>
      ) : (
        <button type="button" onClick={() => setAdding(true)} className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-bold border border-dashed text-muted-foreground hover:text-foreground">
          <Plus className="w-3 h-3" /> Rol
        </button>
      ))}
    </div>
  );
}

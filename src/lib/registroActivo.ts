/**
 * Registro de Policías manda: only Registro PD rows linked to an enabled web
 * user count. One row per user (the oldest wins when duplicates exist).
 */
export type RegistroUser = { id: string; discord_inhabilitado?: boolean | null };
export type RegistroRow = { id: string; instructor_id?: string | null; created_at?: string | null };

export function activePdMembers<T extends RegistroRow>(rows: T[], users: RegistroUser[]): T[] {
  const enabled = new Set(users.filter(u => !u.discord_inhabilitado).map(u => u.id));
  const byUser = new Map<string, T>();
  for (const r of rows) {
    if (!r.instructor_id || !enabled.has(r.instructor_id)) continue;
    const prev = byUser.get(r.instructor_id);
    if (!prev || String(r.created_at ?? "") < String(prev.created_at ?? "")) byUser.set(r.instructor_id, r);
  }
  return [...byUser.values()];
}

export type SalaryRow = { id: string; pd_member_id: string | null; pagado?: boolean };

/** Plan a month resync: which members to add and which rows to delete (not in registro or duplicated). */
export function planMonthSync<E extends SalaryRow>(entries: E[], activeIds: string[]) {
  const active = new Set(activeIds);
  const keep = new Map<string, E>();
  const remove: E[] = [];
  for (const e of entries) {
    if (!e.pd_member_id || !active.has(e.pd_member_id)) { remove.push(e); continue; }
    const prev = keep.get(e.pd_member_id);
    if (!prev) keep.set(e.pd_member_id, e);
    else if (!prev.pagado && e.pagado) { remove.push(prev); keep.set(e.pd_member_id, e); }
    else remove.push(e);
  }
  const missing = activeIds.filter(id => !keep.has(id));
  return { keep: [...keep.values()], remove, missing };
}

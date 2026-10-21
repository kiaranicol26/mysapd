export function personnelForUser<T extends { instructor_id?: string | null; nombre: string }>(members: T[], user: { id: string; name: string }): T | undefined {
  return members.find(m => m.instructor_id === user.id)
    ?? members.find(m => !m.instructor_id && m.nombre.trim().toLowerCase() === user.name.trim().toLowerCase());
}
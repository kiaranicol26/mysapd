import { useState } from "react";
import { LogIn } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { db, setToken } from "@/lib/db";
import { setSession, logAction } from "@/lib/session";
import { loginWithId } from "@/lib/data.functions";

export function IdLogin() {
  const [id, setId] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!id.trim()) return;
    setBusy(true);
    const r = await loginWithId({ data: { id: id.trim() } }).catch(() => ({ ok: false as const, error: "Error al ingresar" }));
    setBusy(false);
    if (!r.ok) return toast.error(r.error);
    setToken(r.token);
    setSession(r.session);
    await logAction(db, r.session, "LOGIN", { id: r.session.id });
    toast.success(`Bienvenido, ${r.session.name}`);
  }

  return (
    <form onSubmit={submit} className="mt-6 space-y-3">
      <Input placeholder="Ingrese su ID de acceso (ej: KI-26WZRP)" value={id} onChange={e => setId(e.target.value)}
        className="h-11 rounded-none border-blue-300 bg-white text-center font-mono text-slate-800" />
      <Button type="submit" disabled={busy}
        className="h-11 w-full rounded-none bg-blue-600 hover:bg-blue-700 text-white font-bold tracking-wider">
        <LogIn className="w-4 h-4 mr-2" /> {busy ? "..." : "INGRESAR AL SISTEMA"}
      </Button>
    </form>
  );
}

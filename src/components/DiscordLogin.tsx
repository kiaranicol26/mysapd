import { useState } from "react";
import { MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { db, setToken } from "@/lib/db";
import { setSession, logAction } from "@/lib/session";
import { requestDiscordCode, verifyDiscordCode } from "@/lib/discordAuth.functions";

export function DiscordLogin() {
  const [username, setUsername] = useState("");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [step, setStep] = useState<"user" | "code" | "name">("user");
  const [busy, setBusy] = useState(false);

  async function send() {
    if (!username.trim()) return;
    setBusy(true);
    const r = await requestDiscordCode({ data: { username: username.trim() } }).catch(() => ({ ok: false as const, error: "Usuario inválido" }));
    setBusy(false);
    if (!r.ok) return toast.error(r.error);
    toast.success("Te enviamos el código por MD en Discord");
    setStep("code");
  }

  async function verify() {
    setBusy(true);
    const r = await verifyDiscordCode({
      data: { username: username.trim(), code: code.trim(), name: step === "name" ? name.trim() : undefined },
    }).catch(() => ({ ok: false as const, error: "Datos inválidos" }));
    setBusy(false);
    if (!r.ok) {
      if ("needsName" in r && r.needsName) { setStep("name"); return; }
      return toast.error("error" in r ? r.error : "Error");
    }
    setToken(r.token);
    setSession(r.session);
    await logAction(db, r.session, "LOGIN_DISCORD", { id: r.session.id });
    toast.success(`Bienvenido, ${r.session.name}`);
  }

  const field = "h-11 rounded-none border-blue-300 bg-white text-center text-slate-800";
  return (
    <div className="mt-6 border-t border-blue-200 pt-5 space-y-3">
      <p className="text-center text-xs uppercase tracking-[0.25em] text-slate-500 font-extrabold">
        Registro / acceso con Discord
      </p>
      <Input placeholder="Tu usuario de Discord" value={username} disabled={step !== "user"}
        onChange={e => setUsername(e.target.value)} className={field} />
      {step !== "user" && (
        <Input placeholder="Código de 6 dígitos" inputMode="numeric" maxLength={6} value={code}
          onChange={e => setCode(e.target.value)} className={`${field} font-mono tracking-[0.4em]`} />
      )}
      {step === "name" && (
        <>
          <p className="text-center text-xs text-slate-500 font-bold">Primera vez: elegí tu Nombre_Apellido</p>
          <Input placeholder="Nombre_Apellido" value={name} onChange={e => setName(e.target.value)} className={field} />
        </>
      )}
      <Button type="button" disabled={busy} onClick={step === "user" ? send : verify}
        className="h-11 w-full rounded-none bg-blue-600 hover:bg-blue-700 text-white font-bold tracking-wider">
        <MessageCircle className="w-4 h-4 mr-2" />
        {busy ? "..." : step === "user" ? "ENVIARME CÓDIGO POR MD" : step === "name" ? "CREAR MI USUARIO" : "VERIFICAR CÓDIGO"}
      </Button>
      {step !== "user" && (
        <button type="button" onClick={() => { setStep("user"); setCode(""); }}
          className="w-full text-xs text-slate-500 font-bold hover:text-blue-700">
          Cambiar usuario / reenviar código
        </button>
      )}
    </div>
  );
}

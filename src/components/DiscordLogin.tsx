import { useState } from "react";
import { KeyRound, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { db, setToken } from "@/lib/db";
import { setSession, logAction } from "@/lib/session";
import { recoverDiscordKey, requestDiscordCode, verifyDiscordCode } from "@/lib/discordAuth.functions";

export function DiscordLogin() {
  const [mode, setMode] = useState<"code" | "recover">("code");
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

  async function recover() {
    if (!username.trim()) return;
    setBusy(true);
    const r = await recoverDiscordKey({ data: { username: username.trim() } }).catch(() => ({ ok: false as const, error: "Usuario inválido" }));
    setBusy(false);
    if (!r.ok) return toast.error(r.error);
    toast.success("Te enviamos tu clave actual por MD en Discord");
  }

  function switchMode(next: "code" | "recover") {
    setMode(next);
    setStep("user");
    setCode("");
    setName("");
  }

  const field = "h-11 rounded-none border-blue-300 bg-white text-center text-slate-800";
  const tab = (active: boolean) =>
    `flex-1 h-9 text-xs font-extrabold uppercase tracking-wider border ${active
      ? "bg-blue-600 text-white border-blue-600"
      : "bg-white text-slate-500 border-blue-200 hover:text-blue-700"}`;

  return (
    <div className="mt-6 border-t border-blue-200 pt-5 space-y-3">
      <p className="text-center text-xs uppercase tracking-[0.25em] text-slate-500 font-extrabold">
        Acceso con Discord
      </p>
      <div className="flex">
        <button type="button" onClick={() => switchMode("code")} className={tab(mode === "code")}>
          Código de registro
        </button>
        <button type="button" onClick={() => switchMode("recover")} className={tab(mode === "recover")}>
          Solicitar clave nuevamente
        </button>
      </div>

      <Input placeholder="Tu usuario de Discord" value={username} disabled={mode === "code" && step !== "user"}
        onChange={e => setUsername(e.target.value)} className={field} />

      {mode === "code" && step !== "user" && (
        <Input placeholder="Código de 6 dígitos" inputMode="numeric" maxLength={6} value={code}
          onChange={e => setCode(e.target.value)} className={`${field} font-mono tracking-[0.4em]`} />
      )}
      {mode === "code" && step === "name" && (
        <>
          <p className="text-center text-xs text-slate-500 font-bold">Primera vez: elegí tu Nombre_Apellido</p>
          <Input placeholder="Nombre_Apellido" value={name} onChange={e => setName(e.target.value)} className={field} />
        </>
      )}

      {mode === "code" ? (
        <Button type="button" disabled={busy} onClick={step === "user" ? send : verify}
          className="h-11 w-full rounded-none bg-blue-600 hover:bg-blue-700 text-white font-bold tracking-wider">
          <MessageCircle className="w-4 h-4 mr-2" />
          {busy ? "..." : step === "user" ? "ENVIARME CÓDIGO POR MD" : step === "name" ? "CREAR MI USUARIO" : "VERIFICAR CÓDIGO"}
        </Button>
      ) : (
        <Button type="button" disabled={busy} onClick={recover}
          className="h-11 w-full rounded-none bg-blue-600 hover:bg-blue-700 text-white font-bold tracking-wider">
          <KeyRound className="w-4 h-4 mr-2" />
          {busy ? "..." : "ENVIARME MI CLAVE POR MD"}
        </Button>
      )}

      {mode === "code" && step !== "user" && (
        <button type="button" onClick={() => { setStep("user"); setCode(""); }}
          className="w-full text-xs text-slate-500 font-bold hover:text-blue-700">
          Cambiar usuario / reenviar código
        </button>
      )}
      {mode === "recover" && (
        <p className="text-center text-xs text-slate-500 font-bold">
          Si ya tenés usuario en la web, te mandamos tu clave actual por MD.
        </p>
      )}
    </div>
  );
}

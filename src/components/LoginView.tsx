import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Coins } from "lucide-react";
import { db, setToken } from "@/lib/db";
import { loginWithId } from "@/lib/data.functions";


import { setSession, logAction } from "@/lib/session";
import { getBackground } from "@/lib/appearance";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import sapdLogo from "@/assets/sapd-logo.png.asset.json";
import { ThemeToggle } from "@/components/ThemeToggle";
import { DiscordLogin } from "@/components/DiscordLogin";

export function LoginView() {
  const [id, setId] = useState("");
  const [loading, setLoading] = useState(false);
  const [bg, setBg] = useState("");

  useEffect(() => {
    const load = () => getBackground().then(setBg).catch(() => {});
    load();
    window.addEventListener("background-change", load);
    return () => window.removeEventListener("background-change", load);
  }, []);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();

    if (!id.trim()) return;

    setLoading(true);

    const res = await loginWithId({ data: { id: id.trim() } });

    setLoading(false);

    if (!res.ok) {
      toast.error("ID no encontrado");
      return;
    }

    setToken(res.token);
    setSession(res.session);

    await logAction(db, res.session, "LOGIN", { id: res.session.id });

    toast.success(`Bienvenido, ${res.session.name}`);

  }

  return (
    <div
      className="relative min-h-screen bg-slate-100 bg-center bg-cover bg-fixed"
      style={bg ? { backgroundImage: `url(${bg})` } : undefined}
    >
      {bg && <div className="absolute inset-0 bg-slate-900/40" />}
      <div className="absolute top-4 right-4 z-10"><ThemeToggle /></div>
      <div className="relative flex min-h-screen items-center justify-center p-6">
        <div className="w-full max-w-2xl">
          <div className="bg-white border border-blue-200 border-b-0 px-3 py-2 flex items-center gap-2">
            <div className="flex-1 bg-slate-50 border border-blue-200 px-3 py-1 text-xs text-slate-500 font-mono truncate">
              www.mysapd.gov/login
            </div>
            <div className="flex gap-1">
              <span className="w-6 h-6 bg-slate-100 border border-blue-200 flex items-center justify-center text-slate-500 text-xs">◀</span>
              <span className="w-6 h-6 bg-slate-100 border border-blue-200 flex items-center justify-center text-slate-500 text-xs">▶</span>
            </div>
          </div>

          <Card className="w-full overflow-hidden rounded-none border border-blue-200 bg-white shadow-sm">
            <div className="h-1 bg-blue-600"></div>

            <div className="bg-white border-b border-blue-200 px-6 py-5 flex items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 flex items-center justify-center bg-white border border-blue-200 p-1">
                  <img src={sapdLogo.url} alt="SAPD" className="w-full h-full object-contain" />
                </div>
                <div>
                  <h1 className="text-blue-700 font-display font-extrabold text-3xl tracking-wider">
                    mySAPD
                  </h1>
                  <p className="text-slate-500 text-[10px] tracking-[0.3em] uppercase mt-1">
                    Police Management Database
                  </p>
                </div>
              </div>
              <div className="text-blue-600 text-4xl font-black">?</div>
            </div>

            <div className="bg-slate-50 border-b border-blue-200 px-6 py-3 flex justify-around text-slate-600 font-display font-bold uppercase text-sm tracking-wider">
              <span>A - E</span>
              <span>F - J</span>
              <span className="text-blue-700">K - O</span>
              <span>P - U</span>
              <span>V - Z</span>
            </div>

            <div className="p-8">
              <div className="flex justify-center mb-6">
                <div className="bg-white p-4 border border-blue-200">
                  <img
                    src={sapdLogo.url}
                    alt="SAPD"
                    className="w-36 h-36 object-contain"
                  />
                </div>
              </div>

              <div className="text-center">
                <h2 className="text-blue-600 text-xs tracking-[0.35em] uppercase font-semibold">
                  San Andreas State
                </h2>
                <h1 className="mt-2 text-4xl font-black uppercase tracking-wide text-slate-900 font-display">
                  my<span className="text-blue-700">SAPD</span>
                </h1>
                <div className="mx-auto mt-5 mb-5 h-px w-32 bg-blue-600"></div>
                <p className="text-slate-600 text-sm font-bold tracking-wide">
                  Web de Gestión de la Policía de San Andreas
                </p>
              </div>

              <form
                onSubmit={handleLogin}
                className="mt-8 space-y-5"
              >
                <Input
                  placeholder="Ingrese su ID de acceso"
                  value={id}
                  onChange={(e) => setId(e.target.value)}
                  autoFocus
                  className="
                    h-12
                    rounded-none
                    border
                    border-blue-300
                    bg-white
                    text-center
                    text-lg
                    text-slate-800
                    placeholder:text-slate-400
                    focus:border-blue-600
                    focus:ring-2
                    focus:ring-blue-600/20
                    transition-all
                  "
                />

                <Button
                  type="submit"
                  disabled={loading}
                  className="
                    h-12
                    w-full
                    rounded-none
                    bg-blue-600
                    text-white
                    font-semibold
                    tracking-wider
                    transition-all
                    duration-200
                    hover:bg-blue-700
                    hover:scale-[1.01]
                    active:scale-[0.99]
                  "
                >
                  {loading ? "VERIFICANDO..." : "INGRESAR AL SISTEMA"}
                </Button>
              </form>

              <DiscordLogin />

              <Button asChild variant="outline"
                className="mt-4 h-11 w-full rounded-none border-blue-300 bg-white text-blue-800 font-bold tracking-wider hover:bg-blue-50">
                <Link to="/salario">
                  <Coins className="w-4 h-4 mr-2" /> VER SALARIOS (PÚBLICO)
                </Link>
              </Button>


              <div className="mt-8">
                <div className="border-t border-blue-200 pt-5">
                  <p className="text-center text-xs uppercase tracking-[0.25em] text-slate-500 font-extrabold">
                    Gestión de mySAPD
                  </p>
                  <p className="mt-2 text-center text-[11px] text-slate-400 font-bold">
                    WestZone Roleplay
                  </p>
                  <p className="mt-1 text-center text-[10px] text-slate-400 font-bold">
                    SAN ANDREAS POLICE DEPARTMENT © 2026 - By Pokaim (Kendo)
                  </p>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Coins, IdCard } from "lucide-react";

import { getBackground } from "@/lib/appearance";
import { getDiscordCodeLoginEnabled } from "@/lib/discord";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import sapdLogo from "@/assets/sapd-logo.png.asset.json";
import { ThemeToggle } from "@/components/ThemeToggle";
import { DiscordLogin } from "@/components/DiscordLogin";

export function LoginView() {
  const [bg, setBg] = useState("");
  const [discordCodeLoginEnabled, setDiscordCodeLoginEnabled] = useState(true);

  useEffect(() => {
    const load = () => getBackground().then(setBg).catch(() => {});
    load();
    getDiscordCodeLoginEnabled(true).then(setDiscordCodeLoginEnabled).catch(() => setDiscordCodeLoginEnabled(true));
    window.addEventListener("background-change", load);
    return () => window.removeEventListener("background-change", load);
  }, []);

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

              <p className="mt-8 text-center text-sm font-semibold text-slate-600">
                Para proteger tu cuenta, el acceso se realiza verificando un código enviado por mensaje directo a tu Discord.
              </p>

              {discordCodeLoginEnabled && <DiscordLogin />}

              <Button asChild variant="outline"
                className="mt-4 h-11 w-full rounded-none border-blue-300 bg-white text-blue-800 font-bold tracking-wider hover:bg-blue-50">
                <Link to="/salario">
                  <Coins className="w-4 h-4 mr-2" /> VER SALARIOS (PÚBLICO)
                </Link>
              </Button>

              <Button asChild variant="outline"
                className="mt-2 h-11 w-full rounded-none border-blue-300 bg-white text-blue-800 font-bold tracking-wider hover:bg-blue-50">
                <Link to="/registro-policias">
                  <IdCard className="w-4 h-4 mr-2" /> REGISTRO PD (PÚBLICO)
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

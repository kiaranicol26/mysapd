import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowRight, BadgeCheck, Building2, CalendarDays, Coins, GraduationCap,
  IdCard, MapPin, Shield, Users, Wallet,
} from "lucide-react";

import { getBackground, getLoginBackground } from "@/lib/appearance";
import { getDiscordCodeLoginEnabled } from "@/lib/discord";
import { Button } from "@/components/ui/button";
import sapdLogo from "@/assets/sapd-logo.png.asset.json";
import { ThemeToggle } from "@/components/ThemeToggle";
import { IdLogin } from "@/components/IdLogin";
import { DiscordLogin } from "@/components/DiscordLogin";

const areas = [
  { icon: Users, title: "Personal policial", description: "Registro, legajos y seguimiento de cada integrante." },
  { icon: GraduationCap, title: "Formación", description: "Capacitaciones, instructores y certificaciones." },
  { icon: Shield, title: "Seguridad y control", description: "Antecedentes, administración y gestión interna." },
  { icon: Wallet, title: "Administración", description: "Liquidaciones, salarios y recursos del Departamento." },
];

export function LoginView() {
  const [bg, setBg] = useState("");
  const [loginBg, setLoginBg] = useState("");
  const [discordRegistrationEnabled, setDiscordRegistrationEnabled] = useState(true);
  const [joinMessage, setJoinMessage] = useState("");

  useEffect(() => {
    const load = () => getLoginBackground().then(setLoginBg).catch(() => {});
    const loadGeneral = () => getBackground().then(setBg).catch(() => {});
    const loadDiscord = () => getDiscordCodeLoginEnabled(true).then(setDiscordRegistrationEnabled).catch(() => {});
    load(); loadGeneral(); loadDiscord();
    window.addEventListener("login-background-change", load);
    window.addEventListener("background-change", loadGeneral);
    return () => { window.removeEventListener("login-background-change", load); window.removeEventListener("background-change", loadGeneral); };
  }, []);

  return (
    <div className="relative min-h-screen bg-slate-950 bg-center bg-cover bg-fixed text-slate-900"
      style={(loginBg || bg) ? { backgroundImage: `url(${loginBg || bg})` } : undefined}>
      <div className="absolute inset-0 bg-gradient-to-br from-slate-950/90 via-slate-950/75 to-blue-950/85" />
      <div className="relative">
        <header className="border-b border-white/10 bg-slate-950/85 backdrop-blur-md">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 lg:px-8">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center border border-white/20 bg-white p-1">
                <img src={sapdLogo.url} alt="Escudo SAPD" className="h-full w-full object-contain" />
              </div>
              <div>
                <p className="font-display text-xl font-black tracking-[0.12em] text-white">SAN ANDREAS <span className="text-blue-400">PD</span></p>
                <p className="text-[9px] font-bold uppercase tracking-[0.28em] text-slate-400">Official Department Portal</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="hidden text-xs font-bold uppercase tracking-[0.18em] text-slate-400 sm:block">WestZone Roleplay</span>
              <ThemeToggle />
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-7xl space-y-8 px-4 py-7 sm:px-6 lg:px-8 lg:py-10">
          <section className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_390px]">
            <div className="relative min-h-[300px] overflow-hidden rounded-2xl border border-white/15 bg-slate-900/65 p-7 shadow-2xl backdrop-blur-md sm:p-10">
              <div className="absolute right-0 top-0 h-64 w-64 translate-x-1/3 -translate-y-1/3 rounded-full border-[36px] border-blue-500/10" />
              <div className="relative flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.28em] text-blue-300">
                <span className="h-px w-8 bg-blue-400" /> San Andreas · Departamento de Policía
              </div>
              <div className="relative mt-8 max-w-3xl">
                <p className="text-sm font-bold uppercase tracking-[0.22em] text-slate-400">Portal institucional</p>
                <h1 className="mt-3 font-display text-4xl font-black uppercase leading-[1.05] tracking-tight text-white sm:text-6xl">
                  Proteger y servir.<br /><span className="text-blue-400">San Andreas.</span>
                </h1>
                <p className="mt-6 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">
                  Bienvenido al portal oficial del San Andreas Police Department. Un espacio dedicado a la organización,
                  formación y coordinación de quienes trabajan cada día por la seguridad de nuestra comunidad.
                </p>
              </div>
              <div className="relative mt-9 flex flex-wrap gap-3 text-xs font-bold uppercase tracking-wider text-slate-300">
                <span className="border border-white/15 bg-white/5 px-3 py-2">WestZone Roleplay</span>
                <span className="border border-white/15 bg-white/5 px-3 py-2">San Andreas</span>
                <span className="border border-white/15 bg-white/5 px-3 py-2">SAPD · 1869</span>
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-white/30 bg-white/95 shadow-2xl shadow-black/40 backdrop-blur-xl">
              <div className="h-1.5 bg-blue-700" />
              <div className="border-b border-slate-200 bg-white/80 px-6 py-5">
                <p className="text-[10px] font-extrabold uppercase tracking-[0.25em] text-blue-700">Área restringida</p>
                <h2 className="mt-1 font-display text-2xl font-black uppercase text-slate-900">Iniciar sesión</h2>
                <p className="mt-1 text-xs leading-5 text-slate-500">Accedé al sistema privado de gestión del Departamento.</p>
              </div>
              <div className="p-6">
                <IdLogin />
                {discordRegistrationEnabled && <DiscordLogin />}
                <div className="mt-5 border-t border-slate-200 pt-4">
                  <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    <BadgeCheck className="h-4 w-4 text-blue-700" /> Acceso exclusivo para personal autorizado
                  </div>
                  <p className="mt-2 text-[11px] leading-5 text-slate-400">Si todavía no tenés credenciales, contactá con la administración del SAPD.</p>
                </div>
              </div>
            </div>
          </section>

          <section className="grid gap-5 rounded-2xl border border-white/10 bg-slate-900/75 p-6 backdrop-blur-md sm:grid-cols-3 sm:p-7">
            <div className="sm:col-span-3">
              <p className="text-[10px] font-extrabold uppercase tracking-[0.25em] text-blue-300">Nuestra institución</p>
              <h2 className="mt-2 font-display text-2xl font-black uppercase text-white sm:text-3xl">Una historia de servicio</h2>
            </div>
            <div className="flex items-start gap-3">
              <CalendarDays className="mt-1 h-5 w-5 shrink-0 text-blue-400" />
              <div><p className="font-display text-2xl font-black text-white">1869</p><p className="mt-1 text-xs leading-5 text-slate-400">Año de fundación de referencia histórica, inspirado en los orígenes del LAPD.</p></div>
            </div>
            <div className="flex items-start gap-3">
              <Shield className="mt-1 h-5 w-5 shrink-0 text-blue-400" />
              <div><p className="font-bold text-white">Mando actual</p><p className="mt-1 text-sm text-slate-300">Kendo Lockser y Mike Holloway</p><p className="mt-1 text-xs leading-5 text-slate-400">Dirección y conducción institucional del Departamento.</p></div>
            </div>
            <div className="flex items-start gap-3">
              <MapPin className="mt-1 h-5 w-5 shrink-0 text-blue-400" />
              <div><p className="font-bold text-white">Nuestra jurisdicción</p><p className="mt-1 text-sm text-slate-300">San Andreas · WestZone</p><p className="mt-1 text-xs leading-5 text-slate-400">Al servicio de la comunidad dentro del universo de WestZone Roleplay.</p></div>
            </div>
            <p className="sm:col-span-3 border-t border-white/10 pt-5 text-sm leading-7 text-slate-300">
              Desde sus primeros pasos, el SAPD se construye sobre el compromiso, la disciplina y el trabajo en equipo.
              Cada agente representa esos valores en las calles de San Andreas. Nuestra historia continúa creciendo con
              nuevas generaciones, unidades especializadas y una estructura preparada para responder a los desafíos de la ciudad.
            </p>
          </section>

          <section className="space-y-4">
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-[0.25em] text-blue-300">Organización y recursos</p>
              <h2 className="mt-2 font-display text-2xl font-black uppercase text-white sm:text-3xl">Áreas del Departamento</h2>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {areas.map(({ icon: Icon, title, description }) => (
                <div key={title} className="border border-white/10 bg-slate-900/80 p-5">
                  <div className="flex h-10 w-10 items-center justify-center border border-blue-400/40 bg-blue-500/10 text-blue-300"><Icon className="h-5 w-5" /></div>
                  <h3 className="mt-4 font-bold uppercase tracking-wide text-white">{title}</h3>
                  <p className="mt-2 text-xs leading-5 text-slate-400">{description}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="grid gap-4 border border-white/10 bg-slate-900/80 p-6 sm:grid-cols-[1fr_auto] sm:items-center sm:p-7">
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-[0.25em] text-blue-300">WestZone Roleplay · San Andreas</p>
              <h2 className="mt-2 font-display text-2xl font-black uppercase text-white">Estado del portal</h2>
              <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold text-slate-300">
                <span className="inline-flex items-center gap-2 border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 text-emerald-300"><span className="h-2 w-2 rounded-full bg-emerald-400" /> Portal institucional</span>
                <span className="inline-flex items-center gap-2 border border-white/10 px-3 py-2"><Building2 className="h-3.5 w-3.5" /> Entorno de roleplay</span>
                <span className="inline-flex items-center gap-2 border border-white/10 px-3 py-2"><MapPin className="h-3.5 w-3.5" /> San Andreas</span>
              </div>
            </div>
            <div className="flex flex-col gap-2 sm:min-w-56">
              <Button asChild className="h-11 rounded-none bg-blue-700 font-extrabold uppercase tracking-wider text-white hover:bg-blue-600">
                <Link to="/salario"><Coins className="mr-2 h-4 w-4" /> Salarios públicos <ArrowRight className="ml-auto h-4 w-4" /></Link>
              </Button>
              <Button asChild variant="outline" className="h-11 rounded-none border-blue-300 bg-white font-extrabold uppercase tracking-wider text-blue-800 hover:bg-blue-50">
                <Link to="/registro-policias"><IdCard className="mr-2 h-4 w-4" /> Registro PD <ArrowRight className="ml-auto h-4 w-4" /></Link>
              </Button>
            </div>
          </section>

          <section className="border border-blue-400/30 bg-blue-950/60 px-6 py-8 text-center sm:px-10">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.3em] text-blue-300">Formá parte de la institución</p>
            <h2 className="mt-3 font-display text-3xl font-black uppercase text-white sm:text-4xl">Join SAPD</h2>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-300">¿Querés servir a San Andreas? Mantenete atento a los próximos llamados de ingreso.</p>
            <Button onClick={() => setJoinMessage("Convocatorias Cerradas, espera tu proxima oportunidad")}
              className="mt-6 h-12 min-w-56 rounded-none bg-white px-8 font-black uppercase tracking-[0.18em] text-blue-900 hover:bg-blue-100">
              Join SAPD <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            {joinMessage && <p role="status" className="mt-4 border border-blue-300/30 bg-slate-950/40 px-4 py-3 text-sm font-bold text-blue-100">{joinMessage}</p>}
          </section>

          <footer className="flex flex-col gap-2 border-t border-white/10 py-5 text-center text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 sm:flex-row sm:justify-between sm:text-left">
            <span>San Andreas Police Department · WestZone Roleplay</span>
            <span>mySAPD · Sistema de gestión institucional</span>
          </footer>
        </main>
      </div>
    </div>
  );
}

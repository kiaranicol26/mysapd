import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, BadgeCheck, ChevronDown, CalendarDays, Coins, GraduationCap, IdCard, MapPin, Shield, Users, Wallet } from "lucide-react";
import { getDiscordCodeLoginEnabled } from "@/lib/discord";
import { Button } from "@/components/ui/button";
import sapdLogo from "@/assets/sapd-logo.png.asset.json";
import { IdLogin } from "@/components/IdLogin";
import { DiscordLogin } from "@/components/DiscordLogin";

const areas = [
  { icon: Users, title: "Personal policial", description: "Legajos, registro y seguimiento institucional." },
  { icon: GraduationCap, title: "Formación", description: "Capacitaciones, instructores y certificaciones oficiales." },
  { icon: Shield, title: "Seguridad y control", description: "Supervisión, antecedentes y gestión interna." },
  { icon: Wallet, title: "Administración", description: "Salarios, recursos y organización del Departamento." },
];

export function LoginView() {
  const [discordRegistrationEnabled, setDiscordRegistrationEnabled] = useState(true);
  const [joinMessage, setJoinMessage] = useState("");
  const [loginOpen, setLoginOpen] = useState(false);

  useEffect(() => {
    getDiscordCodeLoginEnabled(true).then(setDiscordRegistrationEnabled).catch(() => {});
  }, []);

  return (
    <div className="sapd-login min-h-screen bg-white text-slate-800">
      <div className="relative">
        <header className="border-b border-slate-200 bg-white/95 shadow-sm">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 lg:px-8">
            <div className="flex items-center gap-3">
              <img src={sapdLogo.url} alt="Escudo SAPD" className="h-12 w-12 object-contain" />
              <div>
                <p className="text-lg font-black tracking-[0.12em] text-[#17345c]">SAN ANDREAS <span className="text-[#b18a3b]">POLICE DEPARTMENT</span></p>
                <p className="text-[9px] font-bold uppercase tracking-[0.28em] text-slate-700">mySAPD · Official Department Portal</p>
              </div>
            </div>
            <span className="hidden text-xs font-bold uppercase tracking-[0.18em] text-slate-600 sm:block">WestZone Roleplay</span>
          </div>
        </header>

        <main className="mx-auto max-w-7xl px-4 pb-12 pt-8 sm:px-6 lg:px-8">
          <section className="mx-auto flex max-w-3xl flex-col items-center px-2 pb-8 pt-4 text-center sm:pt-8">
            <div className="mx-auto flex h-56 w-56 items-center justify-center sm:h-72 sm:w-72">
              <img src={sapdLogo.url} alt="Logo oficial mySAPD" className="h-full w-full object-contain" />
            </div>
            <p className="mt-3 text-[11px] font-extrabold uppercase tracking-[0.34em] text-[#a17b32]">San Andreas · WestZone Roleplay</p>
            <h1 className="mt-3 text-3xl font-black uppercase leading-[1.08] tracking-tight text-[#17345c] sm:text-5xl">Servicio. <span className="text-[#9b7838]">Integridad. Compromiso.</span></h1>
            <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-slate-700 sm:text-base">Portal institucional del San Andreas Police Department. Una plataforma oficial para la gestión del personal, la formación, las certificaciones y los recursos del Departamento.</p>
            <div className="mt-6 flex flex-wrap justify-center gap-2 text-[10px] font-extrabold uppercase tracking-wider text-slate-700">
              <span className="border border-slate-300 bg-white px-4 py-2">Est. 1869</span><span className="border border-slate-300 bg-white px-4 py-2">San Andreas</span><span className="border border-slate-300 bg-white px-4 py-2">Public Safety</span>
            </div>

            <div className="mt-8 w-full max-w-xl overflow-hidden border border-slate-200 bg-white text-left shadow-[0_20px_60px_rgba(15,35,65,0.12)]">
              <div className="h-1.5 bg-[#17345c]" />
              <button
                type="button"
                onClick={() => setLoginOpen((open) => !open)}
                aria-expanded={loginOpen}
                aria-controls="login-panel"
                className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left transition-colors hover:bg-slate-50 sm:px-7"
              >
                <span>
                  <span className="block text-[10px] font-black uppercase tracking-[0.24em] text-[#9b7838]">Personal autorizado</span>
                  <span className="mt-1 block text-xl font-black uppercase text-[#17345c]">Acceso al sistema</span>
                  <span className="mt-1 block text-xs leading-5 text-slate-700">Ingresá con tus credenciales institucionales para continuar.</span>
                </span>
                <ChevronDown className={`h-6 w-6 shrink-0 text-[#17345c] transition-transform duration-200 ${loginOpen ? "rotate-180" : ""}`} />
              </button>
              {loginOpen && (
                <div id="login-panel" className="space-y-4 border-t border-slate-200 p-6 sm:p-7">
                  <IdLogin />
                  {discordRegistrationEnabled && <div className="border-t border-slate-200 pt-4"><DiscordLogin /></div>}
                  <div className="flex items-start gap-2 border-t border-slate-100 pt-4 text-[11px] leading-5 text-slate-700"><BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#9b7838]" /> Acceso exclusivo para integrantes autorizados del SAPD.</div>
                </div>
              )}
            </div>
          </section>

          <section className="mt-10 border-y border-slate-200 bg-white px-6 py-8 sm:px-9">
            <div className="grid gap-7 md:grid-cols-3">
              <div><p className="text-[10px] font-black uppercase tracking-[0.25em] text-[#9b7838]">Nuestra institución</p><h2 className="mt-2 text-2xl font-black uppercase text-[#17345c]">Una misión.<br />Una comunidad.</h2><p className="mt-3 text-sm leading-6 text-slate-700">El SAPD trabaja para proteger a los ciudadanos de San Andreas mediante disciplina, profesionalismo y servicio público.</p></div>
              <div className="border-y border-slate-100 py-5 md:border-x md:border-y-0 md:px-7 md:py-0"><CalendarDays className="h-5 w-5 text-[#9b7838]" /><p className="mt-3 text-2xl font-black text-[#17345c]">1869</p><p className="mt-1 text-xs leading-5 text-slate-700">Referencia histórica de la institución, dentro del universo de WestZone Roleplay.</p></div>
              <div><Shield className="h-5 w-5 text-[#9b7838]" /><p className="mt-3 font-black uppercase text-[#17345c]">Dirección institucional</p><p className="mt-2 text-sm text-slate-700">Kendo Lockser · Mike Holloway</p><p className="mt-1 text-xs leading-5 text-slate-700">Conducción y coordinación del Departamento.</p></div>
            </div>
          </section>

          <section className="mt-10">
            <div className="mb-5"><p className="text-[10px] font-black uppercase tracking-[0.25em] text-[#9b7838]">Estructura institucional</p><h2 className="mt-2 text-2xl font-black uppercase text-[#17345c]">Divisiones y servicios</h2></div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {areas.map(({ icon: Icon, title, description }) => <article key={title} className="border border-slate-200 bg-white p-5 shadow-sm"><div className="flex h-10 w-10 items-center justify-center bg-transparent text-[#17345c]"><Icon className="h-5 w-5" /></div><h3 className="mt-4 text-sm font-black uppercase tracking-wide text-[#17345c]">{title}</h3><p className="mt-2 text-xs leading-5 text-slate-700">{description}</p></article>)}
            </div>
          </section>

          <section className="mt-10 grid gap-5 border border-slate-200 bg-white p-6 sm:grid-cols-[1fr_auto] sm:items-center sm:p-8">
            <div><p className="text-[10px] font-black uppercase tracking-[0.25em] text-[#9b7838]">Servicios institucionales</p><h2 className="mt-2 text-2xl font-black uppercase text-[#17345c]">Información pública</h2><p className="mt-2 text-sm text-slate-700">Consultá los recursos y registros públicos disponibles del Departamento.</p></div>
            <div className="flex flex-col gap-2 sm:min-w-60">
              <Button asChild className="h-11 rounded-none bg-[#17345c] font-bold uppercase tracking-wider text-white hover:bg-[#254a78]"><Link to="/salario"><Coins className="mr-2 h-4 w-4" /> Salarios públicos <ArrowRight className="ml-auto h-4 w-4" /></Link></Button>
              <Button asChild variant="outline" className="h-11 rounded-none border-slate-300 bg-white font-bold uppercase tracking-wider text-[#17345c] hover:bg-slate-50"><Link to="/registro-policias"><IdCard className="mr-2 h-4 w-4" /> Registro PD <ArrowRight className="ml-auto h-4 w-4" /></Link></Button>
            </div>
          </section>

          <section className="mt-10 border border-[#d8c69f] bg-white px-6 py-8 text-center sm:px-10">
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[#9b7838]">Reclutamiento</p><h2 className="mt-3 text-3xl font-black uppercase text-[#17345c] sm:text-4xl">Join SAPD</h2><p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-700">¿Querés formar parte de la institución? Mantenete atento a los próximos llamados de ingreso.</p>
            <Button onClick={() => setJoinMessage("Convocatorias Cerradas, espera tu proxima oportunidad")} className="mt-6 h-12 min-w-56 rounded-none bg-[#17345c] px-8 font-black uppercase tracking-[0.18em] text-white hover:bg-[#254a78]">Consultar convocatorias <ArrowRight className="ml-2 h-4 w-4" /></Button>
            {joinMessage && <p role="status" className="mx-auto mt-4 max-w-md border border-[#d8c69f] bg-white px-4 py-3 text-sm font-bold text-[#17345c]">{joinMessage}</p>}
          </section>
          <footer className="mt-8 flex flex-col gap-2 border-t border-slate-200 py-5 text-center text-[10px] font-bold uppercase tracking-[0.18em] text-slate-700 sm:flex-row sm:justify-between sm:text-left"><span>San Andreas Police Department · WestZone Roleplay</span><span>mySAPD · Sistema de gestión institucional</span></footer>
        </main>
      </div>
    </div>
  );
}

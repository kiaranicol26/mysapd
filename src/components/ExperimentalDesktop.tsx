import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useLocation } from "@tanstack/react-router";
import { Search, Wifi, Volume2, BatteryFull, Power, LayoutGrid, X, Minus, Square, ChevronUp, type LucideIcon } from "lucide-react";
import type { Session } from "@/lib/session";
import sapdLogo from "@/assets/sapd-logo.png.asset.json";

type DesktopTab = { to: string; label: string; icon: LucideIcon; group: string; search?: { section: "config" | "gestion" } };
export function ExperimentalDesktop({ tabs, session, children, onLogout }: { tabs: DesktopTab[]; session: Session | null; children: ReactNode; onLogout: () => void }) {
  const location = useLocation();
  const [startOpen, setStartOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [clock, setClock] = useState(new Date());
  const [wallpaper, setWallpaper] = useState("linear-gradient(135deg,#102b55 0%,#1765a8 42%,#7146a5 100%)");
  const active = tabs.find(t => t.to === location.pathname) ?? tabs[0];
  const apps = useMemo(() => tabs.filter(t => !search || t.label.toLowerCase().includes(search.toLowerCase())), [tabs, search]);
  useEffect(() => { const id = window.setInterval(() => setClock(new Date()), 1000); return () => window.clearInterval(id); }, []);
  return <div className="win-desktop min-h-screen relative overflow-hidden" style={{ backgroundImage: wallpaper }}>
    <div className="win-desktop-glow" />
    <div className="relative z-10 min-h-[calc(100vh-58px)] p-5 pb-24">
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 gap-3 max-w-5xl">
        {tabs.map(tab => <Link key={tab.to+tab.label} to={tab.to as any} search={tab.search as any} onClick={() => setStartOpen(false)} className="win-desktop-icon group">
          <span className="win-app-icon"><tab.icon size={27}/></span><span>{tab.label}</span>
        </Link>)}
      </div>
      <section className="win-app-window mt-5 mx-auto w-full max-w-7xl overflow-hidden">
        <header className="win-window-titlebar">
          <div className="flex items-center gap-2 min-w-0"><img src={sapdLogo.url} className="h-5 w-5 object-contain" alt=""/><span className="truncate">{active?.label ?? "mySAPD"}</span></div>
          <div className="flex items-center gap-1"><button aria-label="Minimizar" title="Minimizar" className="win-window-control"><Minus size={15}/></button><button aria-label="Maximizar" title="Maximizar" className="win-window-control"><Square size={13}/></button><button aria-label="Cerrar ventana" title="Cerrar ventana" className="win-window-control" onClick={() => setStartOpen(true)}><X size={15}/></button></div>
        </header>
        <div className="win-window-content">{children}</div>
      </section>
    </div>
    {startOpen && <><button aria-label="Cerrar menú Inicio" className="fixed inset-0 z-30 cursor-default" onClick={() => setStartOpen(false)}/><div className="win-start-menu">
      <div className="flex items-center gap-2 text-sm font-semibold mb-4"><LayoutGrid size={18}/> Aplicaciones</div>
      <div className="relative mb-4"><Search size={16} className="absolute left-3 top-3 text-slate-500"/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar aplicaciones" className="win-start-search"/></div>
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-[48vh] overflow-y-auto">{apps.map(tab=><Link key={tab.to+tab.label} to={tab.to as any} search={tab.search as any} onClick={()=>{setStartOpen(false);setSearch("");}} className="win-start-app"><tab.icon size={24}/><span>{tab.label}</span></Link>)}</div>
      <footer className="mt-5 pt-3 border-t border-slate-200/70 flex items-center justify-between"><div className="flex items-center gap-2 text-sm"><img src={sapdLogo.url} className="w-8 h-8 object-contain rounded-full bg-white p-1" alt=""/><span>{session?.name ?? "Invitado"}</span></div><button onClick={onLogout} className="win-power" title="Cerrar sesión"><Power size={17}/></button></footer>
    </div></>}
    <div className="win-taskbar">
      <button onClick={()=>setStartOpen(v=>!v)} className={"win-start-button "+(startOpen?"active":"")} title="Inicio"><svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M2 3.5 10.5 2v9H2zm10 8V1.7L22 0v11.5zM2 13h8.5v9L2 20.5zm10 0H22V24l-10-1.7z"/></svg></button>
      <div className="win-task-apps">{tabs.slice(0,8).map(tab=><Link key={tab.to+tab.label} to={tab.to as any} search={tab.search as any} title={tab.label} className={"win-task-app "+(active?.to===tab.to?"selected":"")}><tab.icon size={19}/></Link>)}</div>
      <div className="win-tray"><ChevronUp size={14}/><Wifi size={16}/><Volume2 size={16}/><BatteryFull size={17}/><div className="text-right leading-tight ml-1"><div>{clock.toLocaleTimeString("es-AR",{hour:"2-digit",minute:"2-digit"})}</div><div>{clock.toLocaleDateString("es-AR")}</div></div></div>
    </div>
  </div>;
}

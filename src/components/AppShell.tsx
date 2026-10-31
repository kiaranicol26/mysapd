import { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { db } from "@/lib/db";
import { logAction, setSession, type Session } from "@/lib/session";
import { getBackground } from "@/lib/appearance";
import {
  LogOut, Shield, LogIn, UserRound, Archive, GraduationCap, FileSearch, Award, IdCard, ListOrdered,
  MessagesSquare, Wallet, Settings, PanelLeftClose, PanelLeftOpen, Menu, type LucideIcon,
} from "lucide-react";
import sapdLogo from "@/assets/sapd-logo.png.asset.json";
import { ThemeToggle } from "@/components/ThemeToggle";
import { puedeVer } from "@/lib/secciones";

type Tab = { to: string; label: string; icon: LucideIcon; public: boolean; alto: boolean; sec?: string; group: string };

const TABS: Tab[] = [
  { to: "/perfil", label: "myPerfil", icon: UserRound, public: false, alto: false, group: "Cuenta" },
  { to: "/exsapd", label: "Ex Policías", icon: Archive, public: false, alto: false, sec: "exsapd", group: "Gestión" },
  { to: "/aspirantes", label: "Aspirantes", icon: GraduationCap, public: false, alto: false, sec: "aspirantes", group: "Gestión" },
  { to: "/rnap", label: "R.N.A.P", icon: FileSearch, public: false, alto: false, sec: "rnap", group: "Gestión" },
  { to: "/certificar", label: "Certificar", icon: Award, public: false, alto: false, sec: "certificar", group: "Gestión" },
  { to: "/registro-policias", label: "Registro PD", icon: IdCard, public: true, alto: false, group: "Personal" },
  { to: "/policias", label: "Lista PD", icon: ListOrdered, public: false, alto: false, sec: "lista", group: "Personal" },
  { to: "/salario", label: "Salario", icon: Wallet, public: true, alto: false, group: "Personal" },
  { to: "/forum", label: "Forum", icon: MessagesSquare, public: false, alto: false, sec: "forum", group: "Comunidad" },
  { to: "/alto-mando", label: "Administración", icon: Settings, public: false, alto: true, group: "Administración" },
];

export function AppShell({ session, children }: { session: Session | null; children: ReactNode }) {
  const [bg, setBg] = useState("");
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    setCollapsed(localStorage.getItem("sapd_sidebar") === "1");
    const load = () => getBackground().then(setBg).catch(() => {});
    load();
    window.addEventListener("background-change", load);
    return () => window.removeEventListener("background-change", load);
  }, []);

  function toggleCollapse() {
    const v = !collapsed;
    setCollapsed(v);
    localStorage.setItem("sapd_sidebar", v ? "1" : "0");
  }

  async function handleLogout() {
    await logAction(db, session, "LOGOUT");
    setSession(null);
    navigate({ to: "/login" });
  }

  const tabs = TABS.filter(t => {
    if (!session) return t.public;
    if (t.alto) return session.is_alto_mando;
    return t.public || puedeVer(session, t.sec);
  });
  const groups = [...new Set(tabs.map(t => t.group))];
  const narrow = collapsed && !mobileOpen;

  const sidebar = (
    <aside className={`flex flex-col h-full bg-sidebar text-sidebar-foreground border-r border-sidebar-border transition-all duration-200 ${narrow ? "w-[72px]" : "w-64"}`}>
      <div className="flex items-center gap-3 px-4 h-16 border-b border-sidebar-border">
        <img src={sapdLogo.url} alt="SAPD" className="w-9 h-9 object-contain shrink-0" />
        {!narrow && (
          <div className="min-w-0">
            <p className="font-display font-black text-lg leading-none">my<span className="text-primary">SAPD</span></p>
            <p className="text-[9px] uppercase tracking-[0.25em] text-muted-foreground mt-1 truncate">San Andreas PD</p>
          </div>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-4">
        {groups.map(g => (
          <div key={g}>
            {!narrow && <p className="px-3 mb-1 text-[10px] font-extrabold uppercase tracking-[0.2em] text-muted-foreground">{g}</p>}
            <div className="space-y-0.5">
              {tabs.filter(t => t.group === g).map(t => (
                <Link key={t.to} to={t.to as any} onClick={() => setMobileOpen(false)} title={t.label}
                  activeProps={{ className: "bg-primary text-primary-foreground shadow-sm" }}
                  inactiveProps={{ className: "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground" }}
                  className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-bold transition-colors ${narrow ? "justify-center" : ""}`}>
                  <t.icon className="w-[18px] h-[18px] shrink-0" />
                  {!narrow && <span className="truncate">{t.label}</span>}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-sidebar-border p-2 space-y-2">
        <div className={`flex items-center gap-2 rounded-md bg-sidebar-accent/60 p-2 ${narrow ? "justify-center" : ""}`}>
          <div className="w-9 h-9 rounded-full overflow-hidden bg-muted flex items-center justify-center shrink-0">
            {session?.avatar_url ? <img src={session.avatar_url} alt={session.name} className="w-full h-full object-cover" /> : <UserRound className="w-4 h-4 text-muted-foreground" />}
          </div>
          {!narrow && (
            <div className="min-w-0 flex-1">
              <p className="text-sm font-extrabold truncate">{session ? session.name : "Invitado"}</p>
              <p className="text-[11px] text-muted-foreground truncate flex items-center gap-1">
                {session?.is_alto_mando ? <><Shield className="w-3 h-3" /> Alto Mando</> : session ? session.role || "Usuario" : "Solo lectura"}
              </p>
            </div>
          )}
        </div>
        <div className={`flex gap-1 ${narrow ? "flex-col items-center" : ""}`}>
          <ThemeToggle />
          {session ? (
            <button onClick={handleLogout} title="Salir"
              className="flex-1 flex items-center justify-center gap-2 h-9 rounded-md text-sm font-bold hover:bg-destructive/10 hover:text-destructive transition-colors px-2">
              <LogOut className="w-4 h-4" />{!narrow && "Salir"}
            </button>
          ) : (
            <Link to="/login" title="Iniciar sesión" className="flex-1 flex items-center justify-center gap-2 h-9 rounded-md text-sm font-bold hover:bg-sidebar-accent px-2">
              <LogIn className="w-4 h-4" />{!narrow && "Iniciar sesión"}
            </Link>
          )}
          <button onClick={toggleCollapse} title={collapsed ? "Expandir" : "Contraer"}
            className="hidden lg:flex items-center justify-center w-9 h-9 rounded-md hover:bg-sidebar-accent">
            {collapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </aside>
  );

  return (
    <div className="relative min-h-screen bg-background bg-center bg-cover bg-fixed font-semibold"
      style={bg ? { backgroundImage: `url(${bg})` } : undefined}>
      {bg && <div className="fixed inset-0 bg-background/40 pointer-events-none" />}

      <div className="hidden lg:block fixed inset-y-0 left-0 z-30">{sidebar}</div>

      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          {sidebar}
          <button className="flex-1 bg-foreground/40" aria-label="Cerrar menú" onClick={() => setMobileOpen(false)} />
        </div>
      )}

      <div className={`relative transition-all duration-200 ${collapsed ? "lg:pl-[72px]" : "lg:pl-64"}`}>
        <header className="sticky top-0 z-20 h-16 flex items-center gap-3 px-4 lg:px-6 bg-card/90 backdrop-blur border-b">
          <button className="lg:hidden w-9 h-9 flex items-center justify-center rounded-md hover:bg-muted" aria-label="Abrir menú" onClick={() => setMobileOpen(true)}>
            <Menu className="w-5 h-5" />
          </button>
          <div>
            <p className="text-primary text-[10px] uppercase font-bold tracking-[0.3em]">San Andreas Police Department</p>
            <h1 className="font-display font-black text-lg lg:text-xl leading-tight text-foreground">
              Welcome to <span className="text-primary">mySAPD</span>
            </h1>
          </div>
        </header>
        <main className="w-full p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}

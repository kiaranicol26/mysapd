import { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { db } from "@/lib/db";
import { logAction, setSession, type Session } from "@/lib/session";
import { getBackground } from "@/lib/appearance";
import {
  LogOut, LogIn, UserRound, Archive, BookOpenCheck, FileSearch, Award, ContactRound, ListOrdered, GraduationCap, IdCard,
  MessagesSquare, BadgeDollarSign, Settings, Users, UserRoundCheck, TrendingUp, PanelLeftClose, PanelLeftOpen, Menu, type LucideIcon,
} from "lucide-react";
import sapdLogo from "@/assets/sapd-logo.png.asset.json";
import { ThemeToggle } from "@/components/ThemeToggle";
import { puedeVer } from "@/lib/secciones";
import { getSalaryTabVisibility } from "@/lib/discord";
import { ADMIN_RANGO_LABELS, normalizeRango } from "@/lib/adminRango";

type Tab = { to: string; label: string; icon: LucideIcon; public: boolean; alto: boolean; moderator?: boolean; sec?: string; group: string; search?: { section: "config" | "gestion" } };

const TABS: Tab[] = [
  { to: "/perfil", label: "myPerfil", icon: UserRound, public: false, alto: false, group: "Cuenta" },
  { to: "/exsapd", label: "Anteriores Policías", icon: Archive, public: false, alto: false, sec: "exsapd", group: "Gestión" },
  { to: "/aspirantes", label: "Aspirantes", icon: GraduationCap, public: false, alto: false, sec: "aspirantes", group: "Gestión" },
  { to: "/rnap", label: "Antecedentes Penales", icon: FileSearch, public: false, alto: false, sec: "rnap", group: "Gestión" },
  { to: "/certificar", label: "Certificados", icon: Award, public: false, alto: false, sec: "certificar", group: "Gestión" },
  { to: "/registro-policias", label: "Registro de Policías", icon: ContactRound, public: true, alto: false, group: "Personal" },
  { to: "/registro-inhabilitados", label: "Pol. Inhabilitados", icon: IdCard, public: false, alto: false, sec: "registro", group: "Personal" },
  { to: "/capacitaciones", label: "Capacitaciones", icon: BookOpenCheck, public: true, alto: false, group: "Personal" },
  { to: "/instructores", label: "Instructores", icon: UserRoundCheck, public: false, alto: false, moderator: true, group: "Personal" },
  { to: "/policias", label: "Lista de Policías", icon: ListOrdered, public: false, alto: false, sec: "lista", group: "Personal" },
  { to: "/salario", label: "Salario", icon: BadgeDollarSign, public: true, alto: false, group: "Personal" },
  { to: "/salarios-manuales", label: "[M] Salarios", icon: BadgeDollarSign, public: false, alto: true, group: "Personal" },
  { to: "/ascensos-masivos", label: "Cargas Masivas", icon: TrendingUp, public: false, alto: true, group: "Administración" },
  { to: "/forum", label: "Foro Privado", icon: MessagesSquare, public: false, alto: false, sec: "forum", group: "Comunidad" },
  { to: "/alto-mando", label: "Configuración Web", icon: Settings, public: false, alto: true, group: "Administración", search: { section: "config" } },
  { to: "/alto-mando", label: "Gestión", icon: Users, public: false, alto: true, group: "Administración", search: { section: "gestion" } },
];

export function AppShell({ session, children }: { session: Session | null; children: ReactNode }) {
  const [bg, setBg] = useState("");
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [salaryVisibility, setSalaryVisibility] = useState({ hideSalary: false, hideManualSalary: false });
  const navigate = useNavigate();

  useEffect(() => {
    setCollapsed(localStorage.getItem("sapd_sidebar") === "1");
    const loadSalaryVisibility = () => getSalaryTabVisibility(true).then(setSalaryVisibility).catch(() => {});
    loadSalaryVisibility();
    window.addEventListener("salary-tabs-visibility-change", loadSalaryVisibility);
    const load = () => getBackground().then(setBg).catch(() => {});
    load();
    window.addEventListener("background-change", load);
    return () => { window.removeEventListener("background-change", load); window.removeEventListener("salary-tabs-visibility-change", loadSalaryVisibility); };
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
    if (t.to === "/salario" && salaryVisibility.hideSalary) return false;
    if (t.to === "/salarios-manuales" && salaryVisibility.hideManualSalary) return false;
    if (!session) return t.public;
    if (t.moderator) return session.admin_rango === "moderador" || session.is_alto_mando;
    if (t.alto) return session.is_alto_mando;
    if (t.to === "/registro-inhabilitados" && session.can_edit_pd) return true;
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
                <Link key={`${t.to}-${t.label}`} to={t.to as any} search={t.search as any} onClick={() => setMobileOpen(false)} title={t.label}
                  activeProps={{ className: "bg-primary text-primary-foreground shadow-sm" }}
                  inactiveProps={{ className: "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground" }}
                  className={`group flex items-center gap-3 rounded-lg px-2 py-2 text-sm font-bold transition-colors ${narrow ? "justify-center" : ""}`}>
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-sidebar-border/70 bg-sidebar-accent/70 text-primary shadow-sm transition-colors group-hover:bg-primary/10"><t.icon className="h-[17px] w-[17px]" /></span>
                  {!narrow && <span className="truncate">{t.label}</span>}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-sidebar-border p-2 space-y-2">
        <div className={`flex items-center gap-2 rounded-md bg-sidebar-accent/60 p-2 ${narrow ? "justify-center" : ""}`}>
          <div className="w-9 h-9 rounded-full overflow-hidden bg-white flex items-center justify-center shrink-0 p-1">
            <img src={sapdLogo.url} alt="SAPD" className="w-full h-full object-contain" />
          </div>
          {!narrow && (
            <div className="min-w-0 flex-1">
              <p className="text-sm font-extrabold truncate">{session ? session.name : "Invitado"}</p>
              <p className="text-[11px] text-muted-foreground truncate flex items-center gap-1">
                {session?.is_alto_mando ? <><img src={sapdLogo.url} alt="" className="h-3 w-3 object-contain" /> Administrador</> : session ? ADMIN_RANGO_LABELS[normalizeRango(session.admin_rango)] : "Solo lectura"}
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

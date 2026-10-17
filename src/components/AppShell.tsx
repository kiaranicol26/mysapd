import { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/db";
import { logAction, setSession, type Session } from "@/lib/session";
import { getBackground } from "@/lib/appearance";
import { LogOut, Shield, LogIn, UserRound } from "lucide-react";
import sapdLogo from "@/assets/sapd-logo.png.asset.json";
import { ThemeToggle } from "@/components/ThemeToggle";
import { puedeVer } from "@/lib/secciones";

const TABS: { to: string; label: string; public: boolean; alto: boolean; sec?: string }[] = [
  { to: "/exsapd", label: "EX POLICÍAS", public: false, alto: false, sec: "exsapd" },
  { to: "/aspirantes", label: "ASPIRANTES", public: false, alto: false, sec: "aspirantes" },
  { to: "/rnap", label: "R.N.A.P", public: false, alto: false, sec: "rnap" },
  { to: "/certificar", label: "CERTIFICAR", public: false, alto: false, sec: "certificar" },
  { to: "/registro-policias", label: "REGISTRO PD", public: false, alto: false, sec: "registro" },
  { to: "/policias", label: "LISTA PD", public: false, alto: false, sec: "lista" },

  { to: "/forum", label: "FORUM", public: false, alto: false, sec: "forum" },
  { to: "/salario", label: "SALARIO", public: true, alto: false },
  { to: "/perfil", label: "myPERFIL", public: false, alto: false },
  { to: "/alto-mando", label: "ALTO MANDO", public: false, alto: true },
];

export function AppShell({
  session,
  children,
}: {
  session: Session | null;
  children: ReactNode;
}) {
  const [bg, setBg] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const load = () => getBackground().then(setBg).catch(() => {});
    load();
    window.addEventListener("background-change", load);
    return () => window.removeEventListener("background-change", load);
  }, []);

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

  return (
    <div
      className="relative min-h-screen bg-slate-200 bg-center bg-cover bg-fixed font-semibold"
      style={bg ? { backgroundImage: `url(${bg})` } : undefined}
    >
      {bg && <div className="absolute inset-0 bg-slate-900/40" />}

      <div className="relative">
        <header className="border-b-2 border-blue-300 bg-white/95 backdrop-blur shadow-sm">
          <div className="w-full px-4 lg:px-6 pt-4 pb-2 relative">
            <div className="flex flex-col items-center text-center">
              <p className="text-blue-700 text-[10px] lg:text-xs uppercase font-bold tracking-[0.35em]">
                San Andreas Police Department
              </p>
              <div className="flex items-center gap-3 mt-1">
                <img src={sapdLogo.url} alt="SAPD" className="w-10 h-10 object-contain" />
                <h1 className="text-2xl lg:text-3xl font-black uppercase tracking-wide text-slate-900 font-display">
                  Welcome to <span className="text-blue-700">mySAPD</span>
                </h1>
              </div>
              <p className="text-[11px] text-slate-500 font-mono mt-1">
                {session ? (
                  <>
                    {session.id} · {session.name}
                    {session.is_alto_mando && (
                      <span className="ml-2 inline-flex items-center gap-1 text-blue-700 font-semibold">
                        <Shield className="w-3 h-3" /> Alto Mando
                      </span>
                    )}
                  </>
                ) : (
                  "Invitado · solo lectura"
                )}
              </p>
            </div>

            <div className="absolute top-3 right-4 lg:right-6 flex items-center gap-2">
              <ThemeToggle />
              <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 bg-blue-600 text-white border border-blue-700">
                {session?.avatar_url ? (
                  <img src={session.avatar_url} alt={session.name}
                    className="w-6 h-6 object-cover border border-blue-200" />
                ) : (
                  <span className="w-6 h-6 flex items-center justify-center border border-blue-200 bg-blue-500">
                    <UserRound className="w-3.5 h-3.5" />
                  </span>
                )}
                <span className="text-[11px] font-bold">{session ? session.name : "Invitado"}</span>
              </div>
              {session ? (
                <Button variant="outline" size="sm" onClick={handleLogout}
                  className="rounded-none border-blue-300 bg-white text-slate-700 hover:bg-blue-50 h-8">
                  <LogOut className="w-4 h-4 mr-1" /> Salir
                </Button>
              ) : (
                <Button asChild variant="outline" size="sm"
                  className="rounded-none border-blue-300 bg-white text-slate-700 hover:bg-blue-50 h-8">
                  <Link to="/login"><LogIn className="w-4 h-4 mr-1" /> Iniciar sesión</Link>
                </Button>
              )}
            </div>
          </div>


          <nav className="w-full px-4 lg:px-6">
            <div className="flex items-stretch gap-0 border-t-2 border-blue-600">
              {tabs.map(t => (
                <Link
                  key={t.to}
                  to={t.to as any}
                  activeProps={{ className: "text-blue-700 bg-blue-50" }}
                  inactiveProps={{ className: "text-slate-500 hover:text-blue-700 hover:bg-blue-50/50" }}
                  className="relative flex-1 px-4 lg:px-6 py-3 text-center font-display font-extrabold uppercase tracking-[0.2em] text-xs lg:text-sm transition-all border-r border-blue-200 last:border-r-0"
                >
                  {t.label}
                </Link>
              ))}
            </div>
          </nav>
        </header>

        <main className="w-full p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}


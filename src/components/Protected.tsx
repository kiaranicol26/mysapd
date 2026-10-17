import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AppShell } from "@/components/AppShell";
import { useSessionState, type Session } from "@/lib/session";
import { puedeVer } from "@/lib/secciones";

export function Protected({
  altoMando = false,
  seccion,
  children,
}: {
  altoMando?: boolean;
  seccion?: string;
  children: (session: Session) => ReactNode;
}) {
  const { session, ready } = useSessionState();

  if (!ready) return <div className="min-h-screen bg-slate-200" />;

  if (!session || (altoMando && !session.is_alto_mando) || !puedeVer(session, seccion)) {
    return (
      <AppShell session={session}>
        <Card className="border-2 border-blue-300 bg-white rounded-none max-w-xl mx-auto">
          <div className="p-8 text-center space-y-4">
            <p className="text-slate-600 font-bold uppercase tracking-widest text-sm">
              {!session ? "Necesitas iniciar sesión" : altoMando ? "Acceso solo para Alto Mando" : "Todavía no tenés acceso a este apartado. Pedíselo al Alto Mando."}
            </p>
            {!session && (
              <Button asChild className="rounded-none bg-blue-700 hover:bg-blue-800 text-white font-bold">
                <Link to="/login">Iniciar sesión</Link>
              </Button>
            )}
          </div>
        </Card>
      </AppShell>
    );
  }

  return <AppShell session={session}>{children(session)}</AppShell>;
}

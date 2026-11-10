import { createFileRoute } from "@tanstack/react-router";
import { useSessionState } from "@/lib/session";
import { InstructoresView } from "@/components/InstructoresView";

export const Route = createFileRoute("/instructores")({
  head: () => ({
    meta: [
      { title: "Instructores · mySAPD" },
      { name: "description", content: "Gestión de instructores del SAPD." },
    ],
  }),
  component: InstructoresRoute,
});

function InstructoresRoute() {
  const { session, ready } = useSessionState();
  if (!ready) return <div className="min-h-screen bg-slate-100" />;
  if (!session || (session.admin_rango !== "moderador" && !session.is_alto_mando)) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-100 p-6"><div className="max-w-md rounded-lg border bg-white p-8 text-center"><h1 className="text-xl font-black">Acceso restringido</h1><p className="mt-2 text-sm text-slate-500">Solo Moderador o Administrador puede gestionar instructores.</p></div></div>;
  }
  return <InstructoresView session={session} />;
}

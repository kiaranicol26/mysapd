import { createFileRoute } from "@tanstack/react-router";
import { Protected } from "@/components/Protected";
import { RegistroPdView } from "@/components/RegistroPdView";
import { useSessionState } from "@/lib/session";

export const Route = createFileRoute("/registro-inhabilitados")({
  head: () => ({
    meta: [
      { title: "Policías Inhabilitados · mySAPD" },
      { name: "description", content: "Registro interno de policías inhabilitados en Discord." },
    ],
  }),
  component: InhabilitadosRoute,
});

function InhabilitadosRoute() {
  const { session, ready } = useSessionState();
  if (!ready) return <div className="min-h-screen bg-slate-100" />;
  if (session && (session.is_alto_mando || session.can_edit_pd)) {
    return <Protected>{s => <RegistroPdView session={s} onlyDisabled />}</Protected>;
  }
  return <Protected seccion="registro">
    {s => <RegistroPdView session={s} onlyDisabled />}
  </Protected>;
}

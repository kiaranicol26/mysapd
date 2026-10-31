import { createFileRoute } from "@tanstack/react-router";
import { useSessionState } from "@/lib/session";
import { Protected } from "@/components/Protected";
import { RegistroPdView } from "@/components/RegistroPdView";
import { RegistroPdPublicView } from "@/components/RegistroPdPublicView";

export const Route = createFileRoute("/registro-policias")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { title: "Registro de Policías · mySAPD" },
      { name: "description", content: "Listado público del personal del San Andreas Police Department." },
      { property: "og:title", content: "Registro de Policías · mySAPD" },
      { property: "og:description", content: "Listado público del personal del San Andreas Police Department." },
    ],
  }),
  component: RegistroRoute,
});

function RegistroRoute() {
  const { session, ready } = useSessionState();
  if (!ready) return <div className="min-h-screen bg-slate-100" />;
  if (session && (session.is_alto_mando || session.can_edit_pd)) {
    return <Protected>{s => <RegistroPdView session={s} />}</Protected>;
  }
  return <RegistroPdPublicView session={session} />;
}

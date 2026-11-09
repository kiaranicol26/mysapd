import { createFileRoute } from "@tanstack/react-router";
import { useSessionState } from "@/lib/session";
import { CapacitacionesView } from "@/components/CapacitacionesView";

export const Route = createFileRoute("/capacitaciones")({
  head: () => ({
    meta: [
      { title: "Capacitaciones · mySAPD" },
      { name: "description", content: "Personal SAPD habilitado por capacitación." },
    ],
  }),
  component: CapacitacionesRoute,
});

function CapacitacionesRoute() {
  const { session, ready } = useSessionState();
  if (!ready) return <div className="min-h-screen bg-slate-100" />;
  return <CapacitacionesView session={session} />;
}

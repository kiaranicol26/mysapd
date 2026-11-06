import { createFileRoute } from "@tanstack/react-router";
import { Protected } from "@/components/Protected";
import { AppShell } from "@/components/AppShell";
import { ManualSalariosView } from "@/components/ManualSalariosView";

export const Route = createFileRoute("/salarios-manuales")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "[M] Salarios · mySAPD" },
      { name: "description", content: "Gestión manual de liquidaciones del San Andreas Police Department." },
      { property: "og:title", content: "[M] Salarios · mySAPD" },
    ],
  }),
  component: () => (
    <Protected altoMando>
      {session => <AppShell session={session}><ManualSalariosView session={session} /></AppShell>}
    </Protected>
  ),
});

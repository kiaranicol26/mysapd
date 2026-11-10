import { createFileRoute } from "@tanstack/react-router";
import { Protected } from "@/components/Protected";
import { AppShell } from "@/components/AppShell";
import { AscensosMasivosView } from "@/components/AscensosMasivosView";

export const Route = createFileRoute("/ascensos-masivos")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Ascensos masivos · mySAPD" },
      { name: "description", content: "Carga y aplicación masiva de ascensos policiales." },
      { property: "og:title", content: "Ascensos masivos · mySAPD" },
    ],
  }),
  component: () => (
    <Protected altoMando>
      {session => <AppShell session={session}><AscensosMasivosView session={session} /></AppShell>}
    </Protected>
  ),
});

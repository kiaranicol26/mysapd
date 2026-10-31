import { createFileRoute } from "@tanstack/react-router";
import { Protected } from "@/components/Protected";
import { AltoMando } from "@/components/AltoMando";

export const Route = createFileRoute("/alto-mando")({
  validateSearch: (search: Record<string, unknown>) => ({
    section: search.section === "gestion" ? "gestion" as const : "config" as const,
  }),
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { title: "Administración · mySAPD" },
      { name: "description", content: "Configuración y gestión administrativa del SAPD." },
      { property: "og:title", content: "Alto Mando · mySAPD" },
      { property: "og:description", content: "Panel de administración del Alto Mando del SAPD." },
    ],
  }),
  component: () => <Protected altoMando>{s => <AltoMando session={s} />}</Protected>,
});

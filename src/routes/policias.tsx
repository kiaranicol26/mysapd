import { createFileRoute } from "@tanstack/react-router";
import { Protected } from "@/components/Protected";
import { ListaPdView } from "@/components/ListaPdView";

export const Route = createFileRoute("/policias")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { title: "Lista PD · mySAPD" },
      { name: "description", content: "Lista de agentes activos del San Andreas Police Department." },
      { property: "og:title", content: "Lista PD · mySAPD" },
      { property: "og:description", content: "Lista de agentes activos del San Andreas Police Department." },
    ],
  }),
  component: () => <Protected seccion="lista">{s => <ListaPdView session={s} />}</Protected>,
});

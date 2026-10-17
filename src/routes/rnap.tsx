import { createFileRoute } from "@tanstack/react-router";
import { Protected } from "@/components/Protected";
import { RnapView } from "@/components/RnapView";

export const Route = createFileRoute("/rnap")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { title: "R.N.A.P · mySAPD" },
      { name: "description", content: "Registro Nacional de Antecedentes Policiales del SAPD." },
      { property: "og:title", content: "R.N.A.P · mySAPD" },
      { property: "og:description", content: "Registro Nacional de Antecedentes Policiales del SAPD." },
    ],
  }),
  component: () => <Protected seccion="rnap">{s => <RnapView session={s} />}</Protected>,
});

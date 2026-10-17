import { createFileRoute } from "@tanstack/react-router";
import { Protected } from "@/components/Protected";
import { AspirantesTable } from "@/components/AspirantesTable";

export const Route = createFileRoute("/aspirantes")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { title: "Aspirantes · mySAPD" },
      { name: "description", content: "Seguimiento de aspirantes a ingresar al SAPD." },
      { property: "og:title", content: "Aspirantes · mySAPD" },
      { property: "og:description", content: "Seguimiento de aspirantes a ingresar al SAPD." },
    ],
  }),
  component: () => <Protected seccion="aspirantes">{s => <AspirantesTable session={s} />}</Protected>,
});

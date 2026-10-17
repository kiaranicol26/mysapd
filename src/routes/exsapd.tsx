import { createFileRoute } from "@tanstack/react-router";
import { Protected } from "@/components/Protected";
import { RecordsTable } from "@/components/RecordsTable";

export const Route = createFileRoute("/exsapd")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { title: "Ex Policías · mySAPD" },
      { name: "description", content: "Registro de ex policías del San Andreas Police Department." },
      { property: "og:title", content: "Ex Policías · mySAPD" },
      { property: "og:description", content: "Registro de ex policías del San Andreas Police Department." },
    ],
  }),
  component: () => <Protected seccion="exsapd">{s => <RecordsTable session={s} />}</Protected>,
});

import { createFileRoute } from "@tanstack/react-router";
import { Protected } from "@/components/Protected";
import { ForumView } from "@/components/ForumView";

export const Route = createFileRoute("/forum")({
  head: () => ({
    meta: [
      { title: "Forum · Ficheros mySAPD" },
      { name: "description", content: "Ficheros del SAPD: texto, imágenes, archivos y checklists publicados por el personal." },
      { property: "og:title", content: "Forum · Ficheros mySAPD" },
      { property: "og:description", content: "Ficheros del SAPD: texto, imágenes, archivos y checklists publicados por el personal." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <Protected seccion="forum">{s => <ForumView session={s} />}</Protected>,
});

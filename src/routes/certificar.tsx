import { createFileRoute } from "@tanstack/react-router";
import { Protected } from "@/components/Protected";
import { CertificarView } from "@/components/CertificarView";

export const Route = createFileRoute("/certificar")({
  head: () => ({
    meta: [
      { title: "Certificados · mySAPD" },
      { name: "description", content: "Biblioteca de certificados generados desde las capacitaciones del SAPD." },
      { property: "og:title", content: "Certificados · mySAPD" },
      { property: "og:description", content: "Biblioteca de certificados generados desde las capacitaciones del SAPD." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <Protected seccion="certificar">{s => <CertificarView session={s} />}</Protected>,
});

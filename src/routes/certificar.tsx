import { createFileRoute } from "@tanstack/react-router";
import { Protected } from "@/components/Protected";
import { CertificarView } from "@/components/CertificarView";

export const Route = createFileRoute("/certificar")({
  head: () => ({
    meta: [
      { title: "Certificar · mySAPD" },
      { name: "description", content: "Emisión de certificados de capacitación del SAPD en alta resolución." },
      { property: "og:title", content: "Certificar · mySAPD" },
      { property: "og:description", content: "Emisión de certificados de capacitación del SAPD en alta resolución." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <Protected seccion="certificar">{s => <CertificarView session={s} />}</Protected>,
});

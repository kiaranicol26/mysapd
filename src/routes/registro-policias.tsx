import { createFileRoute } from "@tanstack/react-router";
import { Protected } from "@/components/Protected";
import { RegistroPdView } from "@/components/RegistroPdView";

export const Route = createFileRoute("/registro-policias")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { title: "Registro de Policías · mySAPD" },
      { name: "description", content: "Carnets oficiales del personal del San Andreas Police Department por rango, placa y división." },
      { property: "og:title", content: "Registro de Policías · mySAPD" },
      { property: "og:description", content: "Carnets oficiales del personal del San Andreas Police Department por rango, placa y división." },
    ],
  }),
  component: () => <Protected seccion="registro">{s => <RegistroPdView session={s} />}</Protected>,
});

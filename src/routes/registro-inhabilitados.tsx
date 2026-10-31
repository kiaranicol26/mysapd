import { createFileRoute } from "@tanstack/react-router";
import { Protected } from "@/components/Protected";
import { RegistroPdView } from "@/components/RegistroPdView";

export const Route = createFileRoute("/registro-inhabilitados")({
  head: () => ({
    meta: [
      { title: "Policías Inhabilitados · mySAPD" },
      { name: "description", content: "Registro interno de policías inhabilitados en Discord." },
    ],
  }),
  component: () => (
    <Protected seccion="registro">
      {session => <RegistroPdView session={session} onlyDisabled />}
    </Protected>
  ),
});

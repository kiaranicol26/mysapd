import { describe, expect, test } from "bun:test";
import { puedeVer, limpiarSecciones } from "./secciones";

describe("acceso por secciones", () => {
  test("un usuario nuevo sin secciones no ve ningún apartado", () => {
    expect(puedeVer({ secciones: [] }, "forum")).toBe(false);
    expect(puedeVer({ secciones: [] }, "exsapd")).toBe(false);
  });
  test("un usuario nuevo puede usar myPerfil", () => {
    expect(puedeVer({ secciones: [] }, undefined)).toBe(true);
  });
  test("solo ve las secciones habilitadas individualmente", () => {
    const u = { secciones: ["rnap"] };
    expect(puedeVer(u, "rnap")).toBe(true);
    expect(puedeVer(u, "aspirantes")).toBe(false);
  });
  test("Alto Mando ve todo", () => {
    expect(puedeVer({ is_alto_mando: true, secciones: [] }, "forum")).toBe(true);
  });
  test("descarta secciones desconocidas", () => {
    expect(limpiarSecciones(["forum", "hack", "forum"])).toEqual(["forum"]);
  });
});

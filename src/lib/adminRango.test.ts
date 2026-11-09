import { describe, expect, test } from "bun:test";
import { permisosDeRango, puedeGestionar, normalizeRango } from "./adminRango";

describe("rangos administrativos", () => {
  test("usuario por defecto y solo ve", () => {
    expect(normalizeRango(null)).toBe("usuario");
    const p = permisosDeRango("usuario");
    expect(p.puedeEditar).toBe(false);
    expect(p.pd).toBe(false);
    expect(p.capacitaciones).toBe(false);
  });
  test("ayudante crea certificados y da capacitaciones", () => {
    const p = permisosDeRango("ayudante");
    expect(p.capacitaciones).toBe(true);
    expect(p.extraSecciones).toEqual(["certificar"]);
    expect(p.pd).toBe(false);
    expect(p.rnap).toBe(false);
    expect(p.files).toBe(false);
  });
  test("moderador solo gestiona rangos inferiores", () => {
    const p = permisosDeRango("moderador");
    expect(p.pd).toBe(true);
    expect(p.files).toBe(false);
    expect(p.rnap).toBe(false);
    expect(puedeGestionar("moderador", "ayudante")).toBe(true);
    expect(puedeGestionar("moderador", "moderador")).toBe(false);
    expect(puedeGestionar("moderador", "administrador")).toBe(false);
  });
  test("administrador control total", () => {
    expect(permisosDeRango("administrador").alto).toBe(true);
    expect(puedeGestionar("administrador", "administrador")).toBe(true);
  });
});

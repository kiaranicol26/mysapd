import { describe, expect, it } from "bun:test";
import { DIVISIONES, INSTRUCTOR_BONUS, rangoFromTag } from "./rangos";

describe("Discord rank tags", () => {
  it("maps the extracted INS tag", () => {
    expect(rangoFromTag("[INS]")).toBe("Inspector");
  });

  it("maps the complete displayed INS rank label", () => {
    expect(rangoFromTag("[INS] INSPECTOR")).toBe("Inspector");
  });

  it("maps the CDT tag to Cadete", () => {
    expect(rangoFromTag("[CDT]")).toBe("Cadete");
    expect(rangoFromTag("[CDT] CADETE")).toBe("Cadete");
  });

  it("keeps plain three-letter codes working", () => {
    expect(rangoFromTag("INS")).toBe("Inspector");
  });

  it("returns null for unknown or empty tags", () => {
    expect(rangoFromTag("[XYZ] DESCONOCIDO")).toBe(null);
    expect(rangoFromTag(null)).toBe(null);
    expect(rangoFromTag("")).toBe(null);
  });
});

describe("salary instructor bonus", () => {
  it("uses the agreed +10 Coins bonus", () => {
    expect(INSTRUCTOR_BONUS).toBe(10);
  });
});

describe("division options", () => {
  it("does not expose duplicate values in the division selector", () => {
    expect(new Set(DIVISIONES).size).toBe(DIVISIONES.length);
  });
});

import { describe, expect, it } from "bun:test";
import { INSTRUCTOR_BONUS, rangoFromTag } from "./rangos";

describe("Discord rank tags", () => {
  it("maps the extracted INS tag", () => {
    expect(rangoFromTag("[INS]")).toBe("Inspector");
  });

  it("maps the complete displayed INS rank label", () => {
    expect(rangoFromTag("[INS] INSPECTOR")).toBe("Inspector");
  });

  it("keeps plain three-letter codes working", () => {
    expect(rangoFromTag("INS")).toBe("Inspector");
  });

  it("returns null for unknown or empty tags", () => {
    expect(rangoFromTag("[XYZ] DESCONOCIDO")).toBeNull();
    expect(rangoFromTag(null)).toBeNull();
    expect(rangoFromTag("")).toBeNull();
  });
});

describe("salary instructor bonus", () => {
  it("uses the agreed +10 Coins bonus", () => {
    expect(INSTRUCTOR_BONUS).toBe(10);
  });
});

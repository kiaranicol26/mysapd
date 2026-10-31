import { describe, expect, it } from "bun:test";
import { hasLegacySalaryEntryForName, normalizeSalaryName } from "./salaryEntries";

describe("legacy salary duplicate protection", () => {
  it("normalizes accents, case, separators and repeated whitespace", () => {
    expect(normalizeSalaryName("  José  |  Pérez ")).toBe("jose perez");
  });

  it("suppresses a new row when a legacy row has the same normalized name", () => {
    expect(
      hasLegacySalaryEntryForName("Jose Perez", [
        { nombre: "JOSÉ | PEREZ", pd_member_id: null },
      ]),
    ).toBe(true);
  });

  it("does not treat linked rows as legacy duplicates", () => {
    expect(
      hasLegacySalaryEntryForName("Jose Perez", [
        { nombre: "Jose Perez", pd_member_id: "pd-123" },
      ]),
    ).toBe(false);
  });

  it("does not match different names or blank names", () => {
    expect(
      hasLegacySalaryEntryForName("Ana Lopez", [
        { nombre: "Jose Perez", pd_member_id: null },
      ]),
    ).toBe(false);
    expect(
      hasLegacySalaryEntryForName(" ", [
        { nombre: " ", pd_member_id: null },
      ]),
    ).toBe(false);
  });
});

import { describe, expect, it } from "bun:test";
import { calculateSalaryExtras, hasLegacySalaryEntryForName, normalizeSalaryName } from "./salaryEntries";

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

describe("frozen salary extras", () => {
  it("adds one bonus per assigned division and the instructor bonus", () => {
    expect(calculateSalaryExtras({
      division: "Patrulla",
      division2: "Tránsito",
      es_instructor: true,
    })).toBe(40);
  });

  it("does not add bonuses for empty or unassigned divisions", () => {
    expect(calculateSalaryExtras({
      division: "",
      division2: "Ninguna",
      es_instructor: false,
    })).toBe(0);
  });

  it("supports one division without instructor status", () => {
    expect(calculateSalaryExtras({
      division: "Patrulla",
      division2: null,
      es_instructor: false,
    })).toBe(15);
  });
});

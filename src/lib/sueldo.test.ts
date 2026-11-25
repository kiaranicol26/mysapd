import { test, expect } from "bun:test";
import { sueldoTotal } from "./sueldo";

test("salary total includes all three divisions and instructor bonus", () => {
  expect(sueldoTotal({
    sueldo_defecto: 100,
    division: "Academia",
    division2: "SWAT",
    division3: "Tránsito",
    es_instructor: true,
  })).toBe(140);
});

test("unassigned divisions do not add bonuses", () => {
  expect(sueldoTotal({
    sueldo_defecto: 100,
    division: "Ninguna",
    division2: "N/A",
    division3: null,
    es_instructor: false,
  })).toBe(100);
});

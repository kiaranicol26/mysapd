import { expect, test } from "bun:test";
import { personnelForUser } from "./pdProfile";

test("older name-matched records remain editable", () => {
  const record = { id: "pd", nombre: "Juan_Perez" };
  expect(personnelForUser([record], { id: "old", name: "Juan_Perez" })).toBe(record);
});
test("a linked record remains editable after a profile name changes", () => {
  const record = { id: "pd", instructor_id: "old", nombre: "Nombre_Anterior" };
  expect(personnelForUser([record], { id: "old", name: "Nuevo_Nombre" })).toBe(record);
});
test("missing personnel records can be created rather than updating a nonexistent row", () => {
  expect(personnelForUser([], { id: "old", name: "Juan_Perez" })).toBeUndefined();
});
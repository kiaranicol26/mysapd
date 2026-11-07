import { test, expect } from "bun:test";
import { activePdMembers, planMonthSync } from "./registroActivo";

test("users not in Registro (unlinked or disabled) are excluded", () => {
  const rows = [{ id: "a", instructor_id: "U1" }, { id: "b", instructor_id: null }, { id: "c", instructor_id: "U2" }];
  const out = activePdMembers(rows, [{ id: "U1" }, { id: "U2", discord_inhabilitado: true }]);
  expect(out.map(r => r.id)).toEqual(["a"]);
});

test("month resync removes duplicates and outsiders, adds missing, keeps paid row", () => {
  const plan = planMonthSync(
    [{ id: "1", pd_member_id: "a" }, { id: "2", pd_member_id: "a", pagado: true }, { id: "3", pd_member_id: "x" }, { id: "4", pd_member_id: null }],
    ["a", "b"],
  );
  expect(plan.keep.map(e => e.id)).toEqual(["2"]);
  expect(plan.remove.map(e => e.id).sort()).toEqual(["1", "3", "4"]);
  expect(plan.missing).toEqual(["b"]);
});

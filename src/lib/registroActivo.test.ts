import { test, expect } from "bun:test";
import { activePdMembers, planMonthSync } from "./registroActivo";

test("users not in Registro (unlinked or disabled) are excluded", () => {
  const rows = [{ id: "a", instructor_id: "U1" }, { id: "b", instructor_id: null }, { id: "c", instructor_id: "U2" }];
  const out = activePdMembers(rows, [{ id: "U1", discord_inhabilitado: false }, { id: "U2", discord_inhabilitado: true }]);
  const unverified = activePdMembers(rows, [{ id: "U1", discord_inhabilitado: null }, { id: "U2", discord_inhabilitado: true }]);
  expect(unverified).toEqual([]);
  expect(out.map(r => r.id)).toEqual(["a"]);
});

test("month resync preserves inactive and legacy history, removes only active duplicates", () => {
  const plan = planMonthSync(
    [
      { id: "1", pd_member_id: "a" },
      { id: "2", pd_member_id: "a", pagado: true },
      { id: "3", pd_member_id: "x", pagado: true },
      { id: "4", pd_member_id: null },
    ],
    ["a", "b"],
  );
  expect(plan.keep.map(e => e.id)).toEqual(["2"]);
  expect(plan.preserve.map(e => e.id).sort()).toEqual(["3", "4"]);
  expect(plan.remove.map(e => e.id)).toEqual(["1"]);
  expect(plan.missing).toEqual(["b"]);
});

test("inactive unpaid salary rows are preserved without being re-priced", () => {
  const plan = planMonthSync(
    [{ id: "old", pd_member_id: "departed", pagado: false }],
    ["current"],
  );
  expect(plan.preserve.map(e => e.id)).toEqual(["old"]);
  expect(plan.remove).toEqual([]);
  expect(plan.missing).toEqual(["current"]);
});

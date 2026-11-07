import { describe, expect, it } from "vitest";
import { groupListStatus, selectGroupList } from "./group-list";

describe("group-list settlement filters", () => {
  const rows = [
    { full_name: "يوسف", statusKey: groupListStatus(100, 0, 100) },
    { full_name: "أحمد", statusKey: groupListStatus(20, 0, 100) },
    { full_name: "محمود", statusKey: groupListStatus(0, 100, 100) },
    { full_name: "إبراهيم", statusKey: groupListStatus(0, 0, 100) },
  ];
  it("shows all students alphabetically without changing the input", () => {
    expect(selectGroupList(rows, "all").map(row => row.full_name)).toEqual(["إبراهيم", "أحمد", "محمود", "يوسف"]);
    expect(rows[0].full_name).toBe("يوسف");
  });
  it("includes only settled students in the paid filter", () => {
    expect(selectGroupList(rows, "paid").map(row => row.full_name)).toEqual(["يوسف"]);
    expect(groupListStatus(60, 40, 100)).toBe("paid");
  });
  it("includes unpaid and partially paid students in the unpaid filter", () => {
    expect(selectGroupList(rows, "unpaid").map(row => row.full_name)).toEqual(["إبراهيم", "أحمد"]);
    expect(groupListStatus(0, 40, 100)).toBe("unpaid");
  });
  it("includes students fully exempted without payment in the exempt filter", () => {
    expect(selectGroupList(rows, "exempt").map(row => row.full_name)).toEqual(["محمود"]);
  });
});
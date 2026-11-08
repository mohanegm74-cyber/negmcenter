import { describe, expect, it } from "vitest";
import { examMatchesFilter, filterExams, groupsForExamFilter, resultMatchesFilter } from "./exam-filter";

const G1 = "11111111-1111-1111-1111-111111111111";
const G2 = "22222222-2222-2222-2222-222222222222";

const exams = [
  { id: "a", title: "نحو", grade: "الخامس الابتدائي", group_id: G1 },
  { id: "b", title: "قراءة", grade: "الخامس الابتدائي", group_id: null },
  { id: "c", title: "نصوص", grade: "الثالث الإعدادي", group_id: G2 },
  { id: "d", title: "مسابقة عامة", grade: null, group_id: null },
];

describe("exam tab grade/group filter", () => {
  it("keeps only the exams of the selected grade", () => {
    expect(filterExams(exams, { grade: "الخامس الابتدائي", group: "" }).map((e) => e.id)).toEqual(["a", "b", "d"]);
  });

  it("matches a grade written with or without the word الصف", () => {
    expect(examMatchesFilter(exams[0], { grade: "الصف الخامس الابتدائي", group: "" })).toBe(true);
    expect(examMatchesFilter(exams[2], { grade: "الصف الخامس الابتدائي", group: "" })).toBe(false);
  });

  it("keeps exams aimed at every group when a group is selected", () => {
    expect(filterExams(exams, { grade: "", group: G1 }).map((e) => e.id)).toEqual(["a", "b", "d"]);
  });

  it("drops exams aimed at another group", () => {
    expect(examMatchesFilter(exams[0], { grade: "", group: G2 })).toBe(false);
    expect(examMatchesFilter(exams[2], { grade: "", group: G2 })).toBe(true);
  });

  it("keeps a student result only when his group is the selected one", () => {
    expect(resultMatchesFilter({ grade: "الخامس الابتدائي", group_id: G1 }, { grade: "", group: G1 })).toBe(true);
    expect(resultMatchesFilter({ grade: "الخامس الابتدائي", group_id: G2 }, { grade: "", group: G1 })).toBe(false);
    expect(resultMatchesFilter({ grade: "الخامس الابتدائي", group_id: null }, { grade: "", group: G1 })).toBe(false);
  });

  it("keeps a student result only when his grade matches", () => {
    expect(resultMatchesFilter({ grade: "الثالث الإعدادي", group_id: G2 }, { grade: "الثالث الإعدادي", group: "" })).toBe(true);
    expect(resultMatchesFilter({ grade: "الخامس الابتدائي", group_id: G1 }, { grade: "الثالث الإعدادي", group: "" })).toBe(false);
  });

  it("lists only the groups of the selected grade in the filter bar", () => {
    const groups = [
      { id: G1, name: "مجموعة 1", grade: "الخامس الابتدائي" },
      { id: G2, name: "مجموعة 2", grade: "الثالث الإعدادي" },
    ];
    expect(groupsForExamFilter(groups, { grade: "الخامس الابتدائي", group: "" }).map((g) => g.id)).toEqual([G1]);
    expect(groupsForExamFilter(groups, { grade: "", group: "" })).toHaveLength(2);
  });

  it("lists third-preparatory groups despite hamza spelling differences", () => {
    const groups = [
      { id: G1, name: "تالتة بنات", grade: "الثالث الاعدادي" },
      { id: G2, name: "تانية بنين", grade: "الثاني الإعدادي" },
    ];
    expect(groupsForExamFilter(groups, { grade: "الثالث الإعدادي", group: "" }).map((g) => g.id)).toEqual([G1]);
  });
});

import { examMatchesFilter, groupsForExamFilter, type ExamFilterValue } from "@/lib/exam-filter";

type Group = { id: string; name: string; grade: string | null };
type Exam = { id: string; grade: string | null; group_id: string | null };

export function ExamGradeGroupFilter({
  exams, groups, value, onChange, resultCount, resultTotal,
}: {
  exams: Exam[];
  groups: Group[];
  value: ExamFilterValue;
  onChange: (v: ExamFilterValue) => void;
  resultCount: number;
  resultTotal: number;
}) {
  const grades = Array.from(new Set(exams.map((e) => e.grade).filter(Boolean))) as string[];
  const shownGroups = groupsForExamFilter(groups, value);
  const chip = (active: boolean) =>
    `rounded-full border px-3 py-1.5 text-xs font-black transition-all ${active ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-muted"}`;
  const count = (v: ExamFilterValue) => exams.filter((e) => examMatchesFilter(e, v)).length;

  return (
    <div className="space-y-2 rounded-2xl border bg-card p-3" dir="rtl">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-black text-muted-foreground">الصف:</span>
        <button className={chip(!value.grade)} onClick={() => onChange({ grade: "", group: "" })}>
          الكل ({exams.length})
        </button>
        {grades.map((g) => (
          <button key={g} className={chip(value.grade === g)} onClick={() => onChange({ grade: g, group: "" })}>
            {g} ({count({ grade: g, group: value.group })})
          </button>
        ))}
      </div>

      {shownGroups.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-black text-muted-foreground">المجموعة:</span>
          <button className={chip(!value.group)} onClick={() => onChange({ ...value, group: "" })}>
            الكل ({count({ grade: value.grade, group: "" })})
          </button>
          {shownGroups.map((g) => (
            <button key={g.id} className={chip(value.group === g.id)} onClick={() => onChange({ ...value, group: g.id })}>
              {g.name} ({count({ grade: value.grade, group: g.id })})
            </button>
          ))}
        </div>
      )}

      <div className="text-[11px] font-black text-muted-foreground">
        الاختبارات المعروضة: {count(value)} من {exams.length} — نتائج الطلاب المعروضة: {resultCount} من {resultTotal}
      </div>
    </div>
  );
}

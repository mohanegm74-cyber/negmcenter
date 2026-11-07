import { gradeMatches } from "./exam-constants";

/** قيمة تصفية تبويب الاختبارات الذكية */
export type ExamFilterValue = { grade: string; group: string };

export type Filterable = { grade?: string | null; group_id?: string | null };

/**
 * اختبار يطابق التصفية:
 * - الصف: مطابق، أو اختبار عام بلا صف (يُعرض لكل الصفوف).
 * - المجموعة: موجهة للمجموعة المختارة، أو موجهة لكل المجموعات (group_id فارغ).
 */
export function examMatchesFilter(exam: Filterable, f: ExamFilterValue) {
  if (f.grade && !gradeMatches(exam.grade, f.grade)) return false;
  if (f.group && exam.group_id && exam.group_id !== f.group) return false;
  return true;
}

/** تطبيق التصفية على قائمة الاختبارات */
export function filterExams<T extends Filterable>(exams: T[], f: ExamFilterValue) {
  return exams.filter((e) => examMatchesFilter(e, f));
}

/**
 * نتيجة طالب تطابق التصفية: صف الطالب ومجموعته هما المختاران
 * (خلافاً للاختبار، الطالب لا يملك حالة «كل المجموعات»).
 */
export function resultMatchesFilter(row: Filterable, f: ExamFilterValue) {
  if (f.grade && !gradeMatches(row.grade, f.grade)) return false;
  if (f.group && row.group_id !== f.group) return false;
  return true;
}

/** المجموعات المعروضة في شريط التصفية للصف المختار */
export function groupsForExamFilter<T extends { grade?: string | null }>(groups: T[], f: ExamFilterValue) {
  return groups.filter((g) => !f.grade || gradeMatches(g.grade, f.grade));
}

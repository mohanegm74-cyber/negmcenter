/** أنواع الأسئلة المدعومة في وحدة الاختبارات الذكية */
export const QUESTION_KINDS = [
  "اختيار من متعدد",
  "صح أو خطأ",
  "أكمل",
  "المزاوجة",
  "الترتيب",
  "السحب والإفلات",
  "اختر من القائمة",
  "التصنيف",
  "الإعراب الكامل",
  "تشكيل الكلمات",
  "التصويب اللغوي",
  "استخرج من القطعة",
  "علل",
  "بم تفسر",
  "اكتب السبب",
  "مقال قصير",
  "مقال طويل",
  "بلاغة",
  "نصوص",
  "شعر",
  "قراءة",
  "تعبير",
  "إملاء",
  "القرآن الكريم",
  "الحديث الشريف",
] as const;

/** الأنواع التي يمكن تصحيحها آلياً بالمطابقة */
export const AUTO_KINDS = ["اختيار من متعدد", "صح أو خطأ", "اختر من القائمة"];

export const DIFFICULTIES = [
  { id: "easy", label: "سهل" },
  { id: "medium", label: "متوسط" },
  { id: "hard", label: "صعب" },
  { id: "mixed", label: "متدرج" },
];

export const TERMS = ["الفصل الدراسي الأول", "الفصل الدراسي الثاني"];

export function isAuto(kind: string) {
  return AUTO_KINDS.includes(kind);
}

export function answerToText(v: unknown): string {
  if (Array.isArray(v)) return v.join(" - ");
  if (v == null) return "";
  return String(v);
}

/** قائمة الصفوف الدراسية الموحدة */
export const GRADES = [
  "الصف الأول الابتدائي","الثاني الابتدائي","الثالث الابتدائي","الرابع الابتدائي","الخامس الابتدائي","السادس الابتدائي",
  "الأول الإعدادي","الثاني الإعدادي","الثالث الإعدادي",
  "الأول الثانوي","الثاني الثانوي","الثالث الثانوي",
];

/** مطابقة مرنة لاسم الصف (تتجاهل كلمة «الصف» والمسافات) */
export function gradeMatches(a?: string | null, b?: string | null) {
  const n = (v?: string | null) =>
    String(v ?? "").replace(/الصف/g, "").replace(/\s+/g, "").replace(/[أإآ]/g, "ا");
  if (!a || !b) return true;
  const x = n(a), y = n(b);
  return x === y || x.includes(y) || y.includes(x);
}

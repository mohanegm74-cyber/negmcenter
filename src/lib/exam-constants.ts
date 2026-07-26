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

import { z } from "zod";
import type { ExamSpec, PaperSection } from "./paper-exam.functions";

export type SourceEvidence = { id: string; sourceId: string; title: string; page: number | null; locator: string; text: string };
export type PaperCitation = { evidenceId: string; sourceId: string; title: string; page: number | null; locator: string; quote: string };

export const paperGenerationSchema = z.object({
  grade: z.string().trim().min(1).max(120), term: z.string().max(120).optional(),
  subject: z.string().trim().min(1, "حدد المادة").max(200), lessons: z.string().max(3000),
  sourceIds: z.array(z.string().uuid()).max(20), strictSources: z.boolean().optional().default(false),
  spec: z.object({
    title: z.string().min(1).max(300), duration_minutes: z.number().positive().max(600),
    total_score: z.number().positive().max(10000), header_notes: z.string().max(5000),
    sections: z.array(z.object({ title: z.string().min(1).max(300), kind: z.string().min(1).max(200),
      count: z.number().int().min(1).max(100), score_each: z.number().min(0).max(1000), instructions: z.string().max(3000).optional() })).min(1).max(25),
  }),
}).superRefine((data, ctx) => {
  const sum = data.spec.sections.reduce((total, section) => total + section.count * section.score_each, 0);
  if (Math.abs(sum - data.spec.total_score) > 0.001) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "مجموع درجات الأقسام لا يساوي الدرجة الكلية", path: ["spec", "total_score"] });
  if (data.strictSources && !data.sourceIds.length) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "اختر مصدراً مفهرساً للتوليد الموثق", path: ["sourceIds"] });
});

export function normalizeArabic(text: string) {
  return text.normalize("NFKC").replace(/[\u064B-\u065F\u0670\u0640]/g, "").replace(/[أإآ]/g, "ا").replace(/ى/g, "ي").replace(/\s+/g, " ").trim();
}

export function selectEvidence(items: SourceEvidence[], query: string, budget = 40000): SourceEvidence[] {
  const terms = Array.from(new Set(normalizeArabic(query).split(/[\s,،؛;]+/).filter(t => t.length >= 3)));
  const ranked = items.filter(item => item.text.trim()).map(item => ({ item, score: terms.reduce((score, term) => score + (normalizeArabic(item.text).includes(term) ? 1 : 0), 0) }))
    .sort((a, b) => b.score - a.score || a.item.id.localeCompare(b.item.id));
  const chosen: SourceEvidence[] = [];
  let remaining = budget;
  const add = (item: SourceEvidence) => {
    if (chosen.some(c => c.id === item.id) || remaining < 80) return;
    const text = item.text.slice(0, Math.min(4000, remaining));
    chosen.push({ ...item, text }); remaining -= text.length;
  };
  // Reserve a relevant excerpt for every selected source before filling the remaining budget.
  for (const id of new Set(ranked.map(r => r.item.sourceId))) {
    const best = ranked.find(r => r.item.sourceId === id); if (best) add(best.item);
  }
  ranked.forEach(r => add(r.item));
  return chosen;
}

export function verifiedCitations(raw: unknown, evidence: SourceEvidence[]): PaperCitation[] {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, 5).flatMap(ref => {
    if (!ref || typeof ref !== "object") return [];
    const item = evidence.find(e => e.id === ref.evidenceId);
    const quote = typeof ref.quote === "string" ? ref.quote.trim().slice(0, 800) : "";
    const normalized = normalizeArabic(quote);
    if (!item || normalized.length < 12 || !normalizeArabic(item.text).includes(normalized)) return [];
    return [{ evidenceId: item.id, sourceId: item.sourceId, title: item.title, page: item.page, locator: item.locator, quote }];
  });
}

export function reviewPaper(spec: ExamSpec, sections: PaperSection[], strict: boolean) {
  const issues: string[] = [];
  const seen = new Set<string>();
  let cited = 0, count = 0, total = 0;
  if (sections.length !== spec.sections.length) issues.push("عدد الأقسام لا يطابق المواصفات");
  spec.sections.forEach((expected, i) => {
    const questions = sections[i]?.questions || [];
    if (questions.length !== expected.count) issues.push(`${expected.title}: عدد البنود لا يطابق المواصفات`);
    questions.forEach((q, j) => {
      count++; total += q.score;
      const label = `${expected.title} — البند ${j + 1}`;
      if (!q.prompt.trim() || !q.answer.trim()) issues.push(`${label}: سؤال أو إجابة غير مكتملة`);
      if (Math.abs(q.score - expected.score_each) > 0.001) issues.push(`${label}: درجة البند تخالف المواصفات`);
      const key = normalizeArabic(q.prompt);
      if (key && seen.has(key)) issues.push(`${label}: سؤال مكرر`);
      seen.add(key);
      if (/اختيار|متعدد/.test(expected.kind) && (q.options.length < 2 || new Set(q.options.map(normalizeArabic)).size !== q.options.length)) issues.push(`${label}: اختيارات ناقصة أو مكررة`);
      if (q.citations?.length) cited++; else if (strict) issues.push(`${label}: لا يوجد مرجع موثق`);
      if (q.citationStale) issues.push(`${label}: تم تعديل السؤال؛ راجع علاقته بالمصدر`);
    });
  });
  if (Math.abs(total - spec.total_score) > 0.001) issues.push("مجموع درجات الاختبار لا يطابق الدرجة الكلية");
  return { issues, count, cited, total, valid: !issues.length };
}
import type { ExamSpec, PaperSection } from "./paper-exam.functions";

export type FormatQuestion = { prompt: string; passage?: string; options: string[]; answer: string; score: number; lines: number; details?: string };
export type FormatSection = { title: string; instructions: string; questions: FormatQuestion[] };
export type FormatExam = { title: string; grade: string; subject: string; duration: number; total: number; notes: string; sections: FormatSection[] };
export type FormatSettings = { template: "school" | "mono"; mode: "compact" | "answers"; font: "Arial" | "Noto Naskh Arabic"; size: number; margin: number; spacing: number; answerScale: number; border: boolean; header: string; footer: string; instructions: string; order: number[]; heading: "blue" | "red" };
export const defaultFormat = (): FormatSettings => ({ template: "school", mode: "answers", font: "Noto Naskh Arabic", size: 13, margin: 12, spacing: 3, answerScale: 1, border: true, header: "سنتر الأستاذ محمد نجم", footer: "مع أطيب التمنيات بالتوفيق", instructions: "", order: [], heading: "blue" });
export const gradeFamily = (grade: string) => /الثالث|ثالث|تالت/.test(grade) ? "third" : "first-second";
const listening = (s: FormatSection) => /استماع/.test(s.title + s.instructions);
const reading = (s: FormatSection) => /قراءة|القراءه/.test(s.title);
export function orderedSections(exam: FormatExam, settings: FormatSettings) {
  const indices = [...new Set([...settings.order, ...exam.sections.map((_, i) => i)])].filter(i => i >= 0 && i < exam.sections.length);
  if (!settings.order.length) indices.sort((a, b) => {
    const priority = (i: number) => gradeFamily(exam.grade) === "third" ? (reading(exam.sections[i]) ? 0 : 1) : (listening(exam.sections[i]) ? 0 : 1);
    return priority(a) - priority(b);
  });
  return indices.map(i => ({ ...exam.sections[i], originalIndex: i }));
}
export function formatWarnings(exam: FormatExam) {
  return gradeFamily(exam.grade) === "third" && exam.sections.some(listening) ? ["الامتحان الأصلي يتضمن الاستماع رغم اختيار الصف الثالث؛ راجع الصف أو محتوى الامتحان الأصلي. لم يُحذف أي قسم."] : [];
}
export function answerLines(q: FormatQuestion, title: string, settings: FormatSettings) {
  if (settings.mode === "compact" || q.options.length) return 0;
  const base = /تعبير/.test(title) ? Math.max(q.lines, Math.ceil(q.score * 1.5), 6) : /خط عربي|الخط/.test(title) ? Math.max(q.lines, 4) : Math.max(q.lines, 2);
  return Math.ceil(base * settings.answerScale);
}
export function paperToFormat(spec: ExamSpec, sections: PaperSection[], info: { grade: string; subject: string }): FormatExam {
  return { title: spec.title, grade: info.grade, subject: info.subject, duration: spec.duration_minutes, total: spec.total_score, notes: spec.header_notes, sections: sections.map(s => ({ title: s.title, instructions: s.instructions || "", questions: s.questions.map(q => ({ ...q })) })) };
}
const existingValue = (value: unknown): string => typeof value === "string" ? value : value == null ? "" : JSON.stringify(value);
export function onlineToFormat(exam: Record<string, any>, questions: Record<string, any>[]): FormatExam {
  const sections: FormatSection[] = [];
  for (const q of questions) {
    const title = String(q.section_title || q.kind || "أسئلة الامتحان");
    let section = sections.find(s => s.title === title);
    if (!section) { section = { title, instructions: "", questions: [] }; sections.push(section); }
    section.questions.push({ prompt: String(q.prompt || ""), passage: q.passage || undefined, options: Array.isArray(q.options) ? q.options.map(existingValue) : [], answer: existingValue(q.correct_answer), score: Number(q.score ?? 0), lines: Number(q.lines ?? 2), details: [q.rationale, q.rubric, q.accepted_answers].filter(v => v != null && v !== "").map(existingValue).join("\n") });
  }
  return { title: String(exam.title || "امتحان"), grade: String(exam.grade || ""), subject: String(exam.subject || ""), duration: Number(exam.duration_minutes || 0), total: Number(exam.total_score || 0), notes: String(exam.header_notes || ""), sections };
}
export type FormatBlock = { kind: "section" | "passage" | "question" | "options" | "answer" | "line"; text: string; keepNext?: boolean };
export function examBlocks(exam: FormatExam, settings: FormatSettings, answers: boolean): FormatBlock[] {
  const blocks: FormatBlock[] = []; let number = 0;
  for (const s of orderedSections(exam, settings)) {
    blocks.push({ kind: "section", text: `${listening(s) ? "نص الاستماع" : s.title} — ${s.questions.reduce((n, q) => n + q.score, 0)} درجات`, keepNext: true });
    if (s.instructions) blocks.push({ kind: "question", text: s.instructions, keepNext: true });
    if (/خط عربي|الخط/.test(s.title) && !/النسخ.*الرقعة/.test(s.instructions)) blocks.push({ kind: "question", text: "اكتب مرة بخط النسخ ومرة بخط الرقعة", keepNext: true });
    let lastPassage = "";
    for (const q of s.questions) {
      if (q.passage && q.passage !== lastPassage) { blocks.push({ kind: "passage", text: q.passage, keepNext: true }); lastPassage = q.passage; }
      blocks.push({ kind: "question", text: `${++number}) ${q.prompt}  (${q.score} درجة)`, keepNext: !!q.options.length || answers });
      if (q.options.length) blocks.push({ kind: "options", text: q.options.map((o, i) => `${["أ", "ب", "ج", "د", "هـ", "و"][i] || i + 1}) ${o}`).join("     ") });
      if (answers) { blocks.push({ kind: "answer", text: q.answer || "لم تُسجّل إجابة نموذجية لهذا السؤال" }); if (q.details) blocks.push({ kind: "answer", text: q.details }); }
      else for (let i = 0; i < answerLines(q, s.title, settings); i++) blocks.push({ kind: "line", text: "" });
    }
  }
  return blocks;
}
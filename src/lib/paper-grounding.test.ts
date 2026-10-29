import { describe, expect, it } from "vitest";
import { paperGenerationSchema, reviewPaper, selectEvidence, verifiedCitations, type SourceEvidence } from "./paper-grounding";
import type { ExamSpec, PaperSection } from "./paper-exam.functions";

const spec: ExamSpec = { title: "اختبار", duration_minutes: 30, total_score: 2, header_notes: "", sections: [{ title: "الأول", kind: "مقالي", count: 1, score_each: 2 }] };
const evidence: SourceEvidence[] = [{ id: "a:1", sourceId: "a", title: "مرجع", page: 7, locator: "صفحة 7", text: "كان وأخواتها ترفع المبتدأ ويسمى اسمها وتنصب الخبر ويسمى خبرها." }];
const input = { grade: "الأول", subject: "لغة عربية", lessons: "كان", sourceIds: ["12345678-1234-4234-8234-123456789abc"], strictSources: true, spec };
const question = { prompt: "ما عمل كان؟", options: [], answer: "ترفع المبتدأ وتنصب الخبر", score: 2, lines: 2, citations: verifiedCitations([{ evidenceId: "a:1", quote: "كان وأخواتها ترفع المبتدأ" }], evidence) };
const sections: PaperSection[] = [{ ...spec.sections[0], questions: [question] }];
describe("paper specifications and source grounding", () => {
  it("rejects a total different from specification section scores", () => {
    expect(paperGenerationSchema.safeParse({ ...input, spec: { ...spec, total_score: 3 } }).success).toBe(false);
  });
  it("requires sources in source-only mode", () => {
    expect(paperGenerationSchema.safeParse({ ...input, sourceIds: [] }).success).toBe(false);
  });
  it("preserves the previous generation mode without sources", () => {
    expect(paperGenerationSchema.safeParse({ ...input, strictSources: false, sourceIds: [] }).success).toBe(true);
  });
  it("rejects invented quotes and unknown evidence references", () => {
    expect(verifiedCitations([{ evidenceId: "a:1", quote: "إن وأخواتها تنصب المبتدأ" }, { evidenceId: "missing", quote: evidence[0].text }], evidence)).toEqual([]);
  });
  it("derives source title and page from stored evidence, not the model", () => {
    const refs = verifiedCitations([{ evidenceId: "a:1", quote: "كان وأخواتها ترفع المبتدأ", title: "مزيف", page: 99 }], evidence);
    expect(refs[0]).toMatchObject({ title: "مرجع", page: 7 });
  });
  it("detects wrong question count against specifications", () => {
    expect(reviewPaper(spec, [{ ...sections[0], questions: [] }], true).valid).toBe(false);
  });
  it("rejects a question without a verified source in source-only mode", () => {
    expect(reviewPaper(spec, [{ ...sections[0], questions: [{ ...question, citations: [] }] }], true).valid).toBe(false);
  });
  it("detects incomplete answers instead of presenting empty generated items", () => {
    expect(reviewPaper(spec, [{ ...sections[0], questions: [{ ...question, answer: "" }] }], true).valid).toBe(false);
  });
  it("flags edited source-grounded questions for review", () => {
    expect(reviewPaper(spec, [{ ...sections[0], questions: [{ ...question, citationStale: true }] }], true).valid).toBe(false);
  });
  it("accepts a complete cited paper matching the specification", () => {
    expect(reviewPaper(spec, sections, true)).toMatchObject({ valid: true, count: 1, cited: 1, total: 2 });
  });
  it("retrieves relevant text across sources within the budget", () => {
    const items = [...evidence, { ...evidence[0], id: "a:2", text: "موضوع غير مرتبط" }, { ...evidence[0], id: "b:1", sourceId: "b", text: "كان فعل ناسخ" }];
    const result = selectEvidence(items, "كان", 200);
    expect(result[0].id).toBe("a:1");
    expect(result.some(item => item.sourceId === "b")).toBe(true);
    expect(result.reduce((sum, item) => sum + item.text.length, 0)).toBeLessThanOrEqual(200);
  });
});
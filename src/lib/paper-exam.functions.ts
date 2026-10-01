import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type SpecSection = { title: string; kind: string; count: number; score_each: number; instructions?: string };
export type ExamSpec = { title: string; duration_minutes: number; total_score: number; header_notes: string; sections: SpecSection[] };
export type PaperQuestion = { prompt: string; options: string[]; answer: string; score: number; lines: number };
export type PaperSection = SpecSection & { questions: PaperQuestion[] };

async function assertTeacher(ctx: any) {
  const { data: t } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "teacher" });
  if (t) return;
  const { data: a } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "admin" });
  if (!a) throw new Error("غير مصرح");
}

const ALLOWED = /\.(pdf|docx?|jpe?g|png)$/i;

export const createSourceUploadUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => d as { filename: string; kind?: "source" | "spec" })
  .handler(async ({ data, context }) => {
    await assertTeacher(context);
    if (!ALLOWED.test(data.filename || "")) throw new Error("الصيغ المسموحة: PDF, DOC, DOCX, JPG, PNG");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const ext = data.filename.split(".").pop()!.toLowerCase();
    const path = `${data.kind === "spec" ? "specs" : "sources"}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { data: res, error } = await supabaseAdmin.storage.from("exam-sources").createSignedUploadUrl(path);
    if (error) throw new Error(error.message);
    return { path, token: res.token };
  });

async function download(path: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.storage.from("exam-sources").download(path);
  if (error || !data) throw new Error("تعذر قراءة الملف المرفوع");
  return new Uint8Array(await data.arrayBuffer());
}

export const indexSource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => d as { path: string; filename: string; mime: string; title: string; grade: string; subject: string; lesson: string })
  .handler(async ({ data, context }) => {
    await assertTeacher(context);
    if (!data.path.startsWith("sources/")) throw new Error("مسار غير صالح");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { extractText } = await import("./paper-exam.server");
    let text = "", status = "indexed", err: string | null = null;
    try {
      text = await extractText(await download(data.path), data.mime || "", data.filename);
      if (!text) { status = "failed"; err = "لم يتم العثور على نص"; }
    } catch (e: any) { status = "failed"; err = e?.message || "فشل الاستخراج"; }
    const { data: row, error } = await supabaseAdmin.from("exam_sources").insert({
      title: data.title || data.filename, grade: data.grade || null, subject: data.subject || null, lesson: data.lesson || null,
      path: data.path, mime: data.mime, extracted_text: text || null, status, error: err,
    }).select("id, status, error").single();
    if (error) throw new Error(error.message);
    return { ...row, chars: text.length };
  });

export const listSources = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => d as { grade?: string; subject?: string; q?: string })
  .handler(async ({ data, context }) => {
    await assertTeacher(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin.from("exam_sources").select("id,title,grade,subject,lesson,mime,status,error,created_at,extracted_text").order("created_at", { ascending: false }).limit(200);
    if (data.grade) q = q.eq("grade", data.grade);
    if (data.subject) q = q.ilike("subject", `%${data.subject}%`);
    const term = (data.q || "").trim().replace(/[%,()]/g, " ");
    if (term) q = q.or(`title.ilike.%${term}%,lesson.ilike.%${term}%,extracted_text.ilike.%${term}%`);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return (rows || []).map((r: any) => {
      const t = String(r.extracted_text || "");
      let snippet = t.slice(0, 160);
      if (term) { const i = t.indexOf(term); if (i >= 0) snippet = "…" + t.slice(Math.max(0, i - 60), i + 100) + "…"; }
      const { extracted_text, ...rest } = r;
      return { ...rest, chars: t.length, snippet };
    });
  });

export const deleteSource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => d as { id: string })
  .handler(async ({ data, context }) => {
    await assertTeacher(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin.from("exam_sources").select("path").eq("id", data.id).single();
    if (row?.path) await supabaseAdmin.storage.from("exam-sources").remove([row.path]);
    const { error } = await supabaseAdmin.from("exam_sources").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

function normalizeSpec(s: any): ExamSpec {
  const sections: SpecSection[] = (Array.isArray(s?.sections) ? s.sections : []).map((x: any) => ({
    title: String(x?.title || "سؤال"), kind: String(x?.kind || "مقالي"),
    count: Math.max(1, Math.round(Number(x?.count) || 1)), score_each: Math.max(0, Number(x?.score_each) || 1),
    instructions: String(x?.instructions || ""),
  }));
  const total = Number(s?.total_score) || sections.reduce((a, b) => a + b.count * b.score_each, 0);
  return { title: String(s?.title || "امتحان"), duration_minutes: Number(s?.duration_minutes) || 120, total_score: total, header_notes: String(s?.header_notes || ""), sections };
}

const SPEC_PROMPT = `حلّل مواصفات الورقة الامتحانية الوزارية المصرية التالية واستخرج هيكل الامتحان.
أرجع JSON فقط بالشكل:
{"title":"عنوان الامتحان","duration_minutes":120,"total_score":40,"header_notes":"تعليمات عامة تُطبع أعلى الورقة","sections":[{"title":"السؤال الأول","kind":"اختيار من متعدد","count":5,"score_each":1,"instructions":"اختر الإجابة الصحيحة مما بين القوسين"}]}
تأكد أن مجموع (count × score_each) لكل الأقسام يساوي total_score.`;

export const analyzeSpecs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => d as { text?: string; path?: string; mime?: string; filename?: string; grade?: string; subject?: string })
  .handler(async ({ data, context }) => {
    await assertTeacher(context);
    const { callAi, callAiWithFile } = await import("./paper-exam.server");
    const { parseJson } = await import("./ai.server");
    const sys = "أنت خبير في مواصفات الامتحانات المصرية الصادرة عن وزارة التربية والتعليم. ترجع JSON صالحاً فقط.";
    const ctx = `الصف: ${data.grade || "—"} | المادة: ${data.subject || "—"}`;
    let raw: string;
    if (data.path) {
      if (!data.path.startsWith("specs/")) throw new Error("مسار غير صالح");
      const bytes = await download(data.path);
      const lower = (data.filename || "").toLowerCase();
      if (lower.endsWith(".docx") || lower.endsWith(".doc")) {
        const { extractText } = await import("./paper-exam.server");
        const t = await extractText(bytes, data.mime || "", data.filename || "");
        raw = await callAi(sys, `${ctx}\n${SPEC_PROMPT}\n\nالمواصفات:\n${t.slice(0, 20000)}${data.text ? `\n\nملاحظات المعلم: ${data.text}` : ""}`, true);
      } else {
        const mime = lower.endsWith(".pdf") ? "application/pdf" : (data.mime || "image/jpeg");
        raw = await callAiWithFile(sys, `${ctx}\n${SPEC_PROMPT}${data.text ? `\n\nملاحظات المعلم: ${data.text}` : ""}`, bytes, mime, true);
      }
    } else {
      if (!data.text?.trim()) throw new Error("أدخل المواصفات نصياً أو ارفع ملفاً");
      raw = await callAi(sys, `${ctx}\n${SPEC_PROMPT}\n\nالمواصفات:\n${data.text.slice(0, 20000)}`, true);
    }
    return normalizeSpec(parseJson(raw));
  });

export const generatePaperExam = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => d as { grade: string; subject: string; lessons: string; sourceIds: string[]; spec: ExamSpec })
  .handler(async ({ data, context }) => {
    await assertTeacher(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { callAi } = await import("./paper-exam.server");
    const { parseJson } = await import("./ai.server");
    const spec = normalizeSpec(data.spec);
    let sourceText = "";
    if (data.sourceIds?.length) {
      const { data: rows } = await supabaseAdmin.from("exam_sources").select("title,lesson,extracted_text").in("id", data.sourceIds.slice(0, 20));
      const per = Math.floor(40000 / Math.max(1, rows?.length || 1));
      sourceText = (rows || []).map((r: any) => `### المصدر: ${r.title}${r.lesson ? ` (${r.lesson})` : ""}\n${String(r.extracted_text || "").slice(0, per)}`).join("\n\n");
    }
    const prompt = `أنشئ امتحاناً ورقياً مصرياً مطابقاً للمواصفات التالية بدقة.
الصف: ${data.grade} | المادة: ${data.subject} | الدروس: ${data.lessons || "حسب المصادر"}
الهيكل (التزم بعدد الأسئلة في كل قسم حرفياً):
${spec.sections.map((s, i) => `${i + 1}) ${s.title} — النوع: ${s.kind} — عدد البنود: ${s.count} — درجة كل بند: ${s.score_each}${s.instructions ? ` — التعليمات: ${s.instructions}` : ""}`).join("\n")}
المجموع الكلي: ${spec.total_score}
${sourceText ? `اعتمد في صياغة الأسئلة على المصادر التالية فقط قدر الإمكان:\n${sourceText}` : "اعتمد على المنهج المصري الرسمي."}

أرجع JSON فقط: {"sections":[{"questions":[{"prompt":"نص البند","options":["أ","ب"],"answer":"الإجابة النموذجية"}]}]}
عدد عناصر sections يساوي ${spec.sections.length} وبنفس الترتيب. options فارغة إذا لم يكن السؤال اختيارياً.`;
    const out = parseJson(await callAi("أنت معلم أول خبير في وضع الامتحانات المصرية. ترجع JSON صالحاً فقط.", prompt, true));
    const gen = Array.isArray(out?.sections) ? out.sections : [];
    const sections: PaperSection[] = spec.sections.map((s, i) => {
      const qs = (Array.isArray(gen[i]?.questions) ? gen[i].questions : []).slice(0, s.count).map((q: any) => ({
        prompt: String(q?.prompt || ""), options: Array.isArray(q?.options) ? q.options.map(String) : [],
        answer: String(q?.answer || ""), score: s.score_each, lines: Array.isArray(q?.options) && q.options.length ? 0 : 2,
      }));
      while (qs.length < s.count) qs.push({ prompt: "", options: [], answer: "", score: s.score_each, lines: 2 });
      return { ...s, questions: qs };
    });
    const missing = spec.sections.reduce((a, s, i) => a + Math.max(0, s.count - ((gen[i]?.questions?.length) || 0)), 0);
    return { spec, sections, warnings: missing ? [`لم يولّد الذكاء الاصطناعي ${missing} بند/بنود، أُضيفت فارغة لتكملها يدوياً.`] : [] };
  });

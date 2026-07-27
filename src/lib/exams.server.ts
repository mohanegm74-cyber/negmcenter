/** Server-only helpers for the smart exams module. */

export async function callAi(system: string, prompt: string, json = false) {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("Missing LOVABLE_API_KEY");
  const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", "Lovable-API-Key": key },
    body: JSON.stringify({
      model: "google/gemini-3.6-flash",
      messages: [
        { role: "system", content: system },
        { role: "user", content: prompt },
      ],
      ...(json ? { response_format: { type: "json_object" } } : {}),
    }),
  });
  if (r.status === 429) throw new Error("تم تجاوز حد الاستخدام، حاول بعد قليل.");
  if (r.status === 402) throw new Error("انتهى رصيد الذكاء الاصطناعي، يرجى شحن الرصيد.");
  if (!r.ok) throw new Error(`AI error ${r.status}: ${await r.text()}`);
  const j = await r.json();
  return (j?.choices?.[0]?.message?.content as string) || "";
}

export function parseJson(text: string): any {
  const cleaned = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const s = cleaned.indexOf("{");
    const e = cleaned.lastIndexOf("}");
    if (s >= 0 && e > s) return JSON.parse(cleaned.slice(s, e + 1));
    throw new Error("تعذّر قراءة استجابة الذكاء الاصطناعي.");
  }
}

/** Normalize Arabic text for exact-match auto grading. */
export function norm(v: string) {
  return String(v ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/[.،,؛;!?"'`]/g, "")
    .toLowerCase();
}

export type GradeItem = {
  id: string; kind: string; prompt: string; correct: string; answer: string;
  score: number; skill?: string | null; autoCorrect?: boolean | null;
};

/** تصحيح ذكي + تحليل — منطق مشترك بين الطالب والمعلم */
export async function gradeAndAnalyze(data: {
  studentName: string; examTitle: string; classAverage: number | null; items: GradeItem[];
}) {
  const needAi = data.items.filter((i) => i.autoCorrect !== true);
  const graded: Record<string, { is_correct: boolean; score: number; feedback: string }> = {};

  if (needAi.length > 0) {
    const prompt = `صحّح إجابات الطالب التالية بدقة وعدالة. لكل سؤال حدد هل الإجابة صحيحة أم لا، والدرجة المستحقة (يمكن منح درجة جزئية للأسئلة المقالية)، وملاحظة تصحيح قصيرة موجّهة للطالب.

${needAi
  .map(
    (i, n) => `(${n + 1}) [id:${i.id}] النوع: ${i.kind} | الدرجة: ${i.score}
السؤال: ${i.prompt}
الإجابة النموذجية: ${i.correct}
إجابة الطالب: ${i.answer || "(لم يجب)"}`,
  )
  .join("\n\n")}

أرجع JSON فقط: {"results":[{"id":"...","is_correct":true,"score":0,"feedback":"..."}]}`;
    const out = parseJson(await callAi("أنت مصحح امتحانات مصري خبير وعادل. ترجع JSON صالحاً فقط.", prompt, true));
    for (const r of out?.results || []) {
      graded[r.id] = { is_correct: !!r.is_correct, score: Number(r.score) || 0, feedback: String(r.feedback || "") };
    }
  }

  const results = data.items.map((i) => {
    if (i.autoCorrect === true) {
      const ok = norm(i.answer) === norm(i.correct);
      return { id: i.id, is_correct: ok, score: ok ? i.score : 0, feedback: ok ? "إجابة صحيحة" : `الإجابة الصحيحة: ${i.correct}` };
    }
    return { id: i.id, ...(graded[i.id] || { is_correct: false, score: 0, feedback: "لم يتم التصحيح" }) };
  });

  const total = results.reduce((a, b) => a + b.score, 0);
  const max = data.items.reduce((a, b) => a + b.score, 0) || 1;
  const pct = Math.round((total / max) * 100);
  const wrong = data.items.filter((i) => !results.find((r) => r.id === i.id)?.is_correct);

  const a = parseJson(
    await callAi(
      "أنت مستشار تربوي مصري تكتب تحليلاً تعليمياً موجزاً بالعربية. ترجع JSON صالحاً فقط.",
      `الطالب: ${data.studentName}
الاختبار: ${data.examTitle}
الدرجة: ${total} من ${max} (${pct}%)
${data.classAverage != null ? `متوسط المجموعة: ${data.classAverage}%` : ""}
المهارات التي أخطأ فيها: ${wrong.map((w) => w.skill || w.prompt.slice(0, 40)).join("، ") || "لا يوجد"}

أرجع JSON فقط:
{"analysis":"تحليل من 3-4 أسطر لمستوى الطالب ومقارنته بالمتوسط","strengths":["..."],"weaknesses":["..."],"remedial_plan":"خطة علاجية عملية مع ترشيح دروس للمراجعة"}`,
      true,
    ),
  );

  return {
    results, total, max, percentage: pct,
    analysis: String(a?.analysis || ""),
    strengths: Array.isArray(a?.strengths) ? a.strengths : [],
    weaknesses: Array.isArray(a?.weaknesses) ? a.weaknesses : [],
    remedial_plan: String(a?.remedial_plan || ""),
  };
}

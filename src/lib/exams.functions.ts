import { createServerFn } from "@tanstack/react-start";

export type GenExamInput = {
  grade: string;
  term: string;
  subject: string;
  unit: string;
  lesson: string;
  questionCount: number;
  totalScore: number;
  difficulty: string;
  kinds: string[];
};

export type GenQuestion = {
  kind: string;
  prompt: string;
  passage?: string | null;
  options?: string[];
  correct_answer: string | string[];
  rationale?: string;
  distractor_explanations?: string[];
  skill?: string;
  learning_outcome?: string;
  difficulty?: string;
  expected_seconds?: number;
  score?: number;
  source_ref?: string;
};

async function callAi(system: string, prompt: string, json = false) {
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

function parseJson(text: string): any {
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

/** توليد بنك أسئلة جديد بالكامل اعتماداً على المنهج المصري */
export const generateExam = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => d as GenExamInput)
  .handler(async ({ data }) => {
    const system =
      "أنت خبير مناهج مصري ومعلم أول. تنشئ أسئلة أصلية غير منسوخة حرفياً، متوافقة مع أحدث المناهج المصرية ومواصفات الورقة الامتحانية، وتكتب بالعربية الفصحى الصحيحة. ترجع JSON صالحاً فقط.";

    const prompt = `أنشئ اختباراً إلكترونياً جديداً بالكامل وفق البيانات التالية:
- الصف: ${data.grade}
- الفصل الدراسي: ${data.term}
- المادة: ${data.subject}
- الوحدة: ${data.unit}
- الدرس: ${data.lesson}
- عدد الأسئلة: ${data.questionCount}
- الدرجة الكلية: ${data.totalScore} (وزّعها على الأسئلة بحيث يكون مجموع الدرجات مساوياً لها)
- مستوى الصعوبة العام: ${data.difficulty}
- أنواع الأسئلة المطلوبة (نوّع بينها): ${data.kinds.join("، ")}

اعتمد على معرفتك بالمنهج المصري الحالي وبنوك الأسئلة ونماذج الامتحانات الرسمية وأوراق العمل التعليمية المتاحة، واستخلص المفاهيم والمهارات ونواتج التعلم للدرس، ثم صُغ أسئلة جديدة غير مكررة ومتنوعة الصياغة.

أرجع JSON بهذا الشكل بالضبط:
{
  "sources": [{"title":"اسم المصدر التعليمي","note":"وصف موجز لنوع المصدر"}],
  "questions": [
    {
      "kind": "أحد الأنواع المطلوبة",
      "prompt": "نص السؤال",
      "passage": "القطعة أو النص إن لزم وإلا null",
      "options": ["خيار1","خيار2","خيار3","خيار4"],
      "correct_answer": "الإجابة الصحيحة (نص، أو مصفوفة نصوص لأسئلة الترتيب والمزاوجة والتصنيف)",
      "rationale": "سبب الإجابة الصحيحة",
      "distractor_explanations": ["تفسير خطأ كل خيار خاطئ بالترتيب"],
      "skill": "المهارة المقيسة",
      "learning_outcome": "ناتج التعلم",
      "difficulty": "easy | medium | hard",
      "expected_seconds": 60,
      "score": 5,
      "source_ref": "مرجع المصدر"
    }
  ]
}
ملاحظات: لأسئلة صح/خطأ اجعل options = ["صح","خطأ"]. لأسئلة المقال والإعراب والتعبير اجعل options = [] وضع الإجابة النموذجية في correct_answer.`;

    const out = parseJson(await callAi(system, prompt, true));
    const questions: GenQuestion[] = Array.isArray(out?.questions) ? out.questions : [];
    if (questions.length === 0) throw new Error("لم يتم توليد أي أسئلة، حاول مرة أخرى.");
    return { questions, sources: Array.isArray(out?.sources) ? out.sources : [] };
  });

export type GradeInput = {
  studentName: string;
  examTitle: string;
  classAverage: number | null;
  items: {
    id: string;
    kind: string;
    prompt: string;
    correct: string;
    answer: string;
    score: number;
    skill?: string | null;
    autoCorrect?: boolean | null;
  }[];
};

/** تصحيح ذكي + تحليل مستوى الطالب وخطة علاجية */
export const gradeAttempt = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => d as GradeInput)
  .handler(async ({ data }) => {
    const needAi = data.items.filter((i) => i.autoCorrect !== true);
    let graded: Record<string, { is_correct: boolean; score: number; feedback: string }> = {};

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
      const out = parseJson(
        await callAi("أنت مصحح امتحانات مصري خبير وعادل. ترجع JSON صالحاً فقط.", prompt, true),
      );
      for (const r of out?.results || []) {
        graded[r.id] = {
          is_correct: !!r.is_correct,
          score: Number(r.score) || 0,
          feedback: String(r.feedback || ""),
        };
      }
    }

    const results = data.items.map((i) => {
      if (i.autoCorrect === true) {
        const ok = norm(i.answer) === norm(i.correct);
        return {
          id: i.id,
          is_correct: ok,
          score: ok ? i.score : 0,
          feedback: ok ? "إجابة صحيحة" : `الإجابة الصحيحة: ${i.correct}`,
        };
      }
      return { id: i.id, ...(graded[i.id] || { is_correct: false, score: 0, feedback: "لم يتم التصحيح" }) };
    });

    const total = results.reduce((a, b) => a + b.score, 0);
    const max = data.items.reduce((a, b) => a + b.score, 0) || 1;
    const pct = Math.round((total / max) * 100);
    const wrong = data.items.filter((i) => !results.find((r) => r.id === i.id)?.is_correct);

    const analysisText = await callAi(
      "أنت مستشار تربوي مصري تكتب تحليلاً تعليمياً موجزاً بالعربية.",
      `الطالب: ${data.studentName}
الاختبار: ${data.examTitle}
الدرجة: ${total} من ${max} (${pct}%)
${data.classAverage != null ? `متوسط المجموعة: ${data.classAverage}%` : ""}
المهارات التي أخطأ فيها: ${wrong.map((w) => w.skill || w.prompt.slice(0, 40)).join("، ") || "لا يوجد"}

اكتب JSON فقط بهذا الشكل:
{"analysis":"تحليل من 3-4 أسطر لمستوى الطالب ومقارنته بالمتوسط","strengths":["..."],"weaknesses":["..."],"remedial_plan":"خطة علاجية عملية مع ترشيح دروس للمراجعة"}`,
      true,
    );
    const a = parseJson(analysisText);

    return {
      results,
      total,
      max,
      percentage: pct,
      analysis: String(a?.analysis || ""),
      strengths: Array.isArray(a?.strengths) ? a.strengths : [],
      weaknesses: Array.isArray(a?.weaknesses) ? a.weaknesses : [],
      remedial_plan: String(a?.remedial_plan || ""),
    };
  });

function norm(v: string) {
  return String(v ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/[.،,؛;!?"'`]/g, "")
    .toLowerCase();
}

import { createServerFn } from "@tanstack/react-start";
import { callAi, parseJson, gradeAndAnalyze } from "./exams.server";

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

/** تصحيح ذكي + تحليل مستوى الطالب وخطة علاجية (للمعلم) */
export const gradeAttempt = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => d as GradeInput)
  .handler(async ({ data }) => gradeAndAnalyze(data));

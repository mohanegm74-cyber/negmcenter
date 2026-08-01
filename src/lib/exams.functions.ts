import { createServerFn } from "@tanstack/react-start";

export type GenExamInput = {
  grade: string; term: string; subject: string; unit: string; lesson: string;
  questionCount: number; totalScore: number; difficulty: string; kinds: string[];
};

export const generateExam = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => d as GenExamInput)
  .handler(async ({ data }) => {
    const { callAi, parseJson } = await import("./ai.server");
    
    const system = `أنت خبير مناهج تعليمية مصري ومعلم أول خبير بجميع المراحل الدراسية.
مهمتك تصميم اختبارات احترافية تحاكي تماماً نمط أسئلة المصادر المصرية المعتمدة:
- منصات وزارة التربية والتعليم (بنك المعرفة المصري، منصة حصص مصر، الكتب الوزارية وكتاب الأنشطة).
- الكتب الخارجية الشهيرة (كتاب الامتحان، الأضواء، المعاصر، بيت العلوم، الشرح المتميز، سلاح التلميذ، الوافي، جيم).
- امتحانات المحافظات ونماذج الوزارة الاسترشادية وأسئلة المعلمين المشهورين على المنصات التعليمية.
يجب أن تكون الأسئلة دقيقة علمياً ولغوياً ومطابقة لمواصفات الورقة الامتحانية المصرية الحديثة.`;

    const prompt = `أنشئ اختباراً إلكترونياً مصرياً:
- الصف: ${data.grade}
- المادة: ${data.subject}
- الفصل الدراسي: ${data.term}
- الموضوع/الدرس: ${data.lesson}
- عدد الأسئلة المطلوب: ${data.questionCount}
- مستوى الصعوبة: ${data.difficulty} (سهل، متوسط، صعب، أو متدرج)
- أنواع الأسئلة المطلوبة (التزم بها وزّعها بالتساوي): ${data.kinds.join("، ")}

المطلوب إخراج JSON فقط يحتوي على مصفوفة questions، كل سؤال يحتوي على:
- kind: نوع السؤال (من الأنواع المطلوبة حرفياً).
- prompt: نص السؤال.
- options: مصفوفة خيارات (في حال الاختيار من متعدد أو اختر من القائمة).
- correct_answer: الإجابة الصحيحة (نصياً).
- rationale: شرح مبسط لسبب صحة الإجابة.
- skill: المهارة (فهم، تطبيق، تحليل، تذكر).
- difficulty: درجة الصعوبة لهذا السؤال تحديداً.
- score: الدرجة المقترحة (يجب أن يكون مجموع الدرجات الكلي ${data.totalScore}).
- passage: (اختياري) قطعة نصية إذا كان السؤال يتطلب ذلك (مثل القراءة أو النصوص).
- source_ref: المصدر المستوحى منه السؤال (مثال: كتاب الامتحان، الأضواء، المعاصر، بنك المعرفة، منصة حصص مصر، امتحان محافظة، نموذج الوزارة الاسترشادي).

وأضف أيضاً مفتاح sources: مصفوفة بأسماء المصادر المصرية المعتمدة التي بُني عليها الاختبار.
تأكد أن الأسئلة مطابقة لأفكار امتحانات المحافظات ونماذج الوزارة والكتب الخارجية الشهيرة والمناهج المصرية الرسمية الحديثة.`;

    const raw = await callAi(system, prompt, true);
    const out = parseJson(raw);
    return { questions: out?.questions || [], sources: out?.sources || [] };
  });

export const gradeAttempt = createServerFn({ method: "POST" })
  .inputValidator((d: any) => d)
  .handler(async ({ data }) => {
    const { gradeAndAnalyze } = await import("./exams.server");
    return gradeAndAnalyze(data);
  });
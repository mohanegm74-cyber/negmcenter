import { createServerFn } from "@tanstack/react-start";

export type GenExamInput = {
  grade: string; term: string; subject: string; unit: string; lesson: string;
  questionCount: number; totalScore: number; difficulty: string; kinds: string[];
};

export const generateExam = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => d as GenExamInput)
  .handler(async ({ data }) => {
    const { callAi, parseJson } = await import("./ai.server");
    const system = "أنت خبير مناهج مصري ومعلم أول...";
    const prompt = `أنشئ اختباراً إلكترونياً جديداً بالكامل: الصف ${data.grade}، الدرس ${data.lesson}...`;

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
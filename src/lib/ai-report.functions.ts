import { createServerFn } from "@tanstack/react-start";

type StudentReportInput = {
  student: { full_name: string; grade?: string | null; group?: string | null };
  attendance: { present: number; absent: number; late: number };
  homework: { title: string; score: number | null; max_score: number; status: string }[];
  finance: { due: number; paid: number; balance: number };
  notes: string[];
};

type CenterReportInput = {
  totals: { students: number; groups: number; income: number; dues: number; outstanding: number };
  attendance: { present: number; absent: number; late: number };
  topAbsent: { name: string; absent: number }[];
  gradeStats: { grade: string; students: number; present: number; absent: number }[];
  groupStats: { group: string; students: number; income: number; dues: number }[];
};

export const generateStudentReport = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => d as StudentReportInput)
  .handler(async ({ data }) => {
    const { callAi } = await import("./ai.server");
    const prompt = `أنت مستشار تربوي خبير. اكتب تقريراً احترافياً موجزاً لولي أمر الطالب باللغة العربية...
بيانات الطالب: ${data.student.full_name} | الحضور: ${data.attendance.present}...`;
    
    const text = await callAi("أنت مستشار تربوي محترف تكتب تقارير للأهالي بالعربية الفصحى.", prompt);
    return { text };
  });

export const generateCenterReport = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => d as CenterReportInput)
  .handler(async ({ data }) => {
    const { callAi } = await import("./ai.server");
    const prompt = `أنت مستشار إداري وتربوي لسنتر تعليمي. اكتب تقريراً شاملاً عن الوضع العام للسنتر...
إجمالي الطلاب: ${data.totals.students} | الإيرادات: ${data.totals.income}...`;

    const text = await callAi("أنت مستشار إداري لسنتر تعليمي تكتب تقارير احترافية للإدارة بالعربية الفصحى.", prompt);
    return { text };
  });
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

async function callAi(system: string, prompt: string) {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("Missing LOVABLE_API_KEY");
  const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", "Lovable-API-Key": key },
    body: JSON.stringify({
      model: "google/gemini-3.6-flash",
      messages: [{ role: "system", content: system }, { role: "user", content: prompt }],
    }),
  });
  if (!r.ok) throw new Error(`AI error ${r.status}: ${await r.text()}`);
  const j = await r.json();
  return j?.choices?.[0]?.message?.content || "تعذّر توليد التقرير.";
}

export const generateStudentReport = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => d as StudentReportInput)
  .handler(async ({ data }) => {
    const prompt = `أنت مستشار تربوي خبير. اكتب تقريراً احترافياً موجزاً لولي أمر الطالب باللغة العربية، بصيغة رسمية مشجعة، من 4-6 فقرات قصيرة، يشمل:
- ملخص عام عن أداء الطالب.
- تحليل الحضور والالتزام.
- تقييم مستوى الواجبات والدرجات.
- الحالة المالية إن وُجدت متأخرات.
- توصيات عملية لولي الأمر لتحسين مستوى الطالب.

بيانات الطالب:
الاسم: ${data.student.full_name}
الصف: ${data.student.grade || "—"}
المجموعة: ${data.student.group || "—"}
الحضور: حضر ${data.attendance.present} — غاب ${data.attendance.absent} — متأخر ${data.attendance.late}
الواجبات: ${data.homework.length === 0 ? "لا يوجد" : data.homework.map(h => `${h.title}: ${h.score ?? "لم يُقيَّم"}/${h.max_score} (${h.status})`).join(" | ")}
المالية: مستحق ${data.finance.due} — مدفوع ${data.finance.paid} — الرصيد ${data.finance.balance}
ملاحظات الأستاذ: ${data.notes.length === 0 ? "لا يوجد" : data.notes.join(" | ")}

اكتب التقرير مباشرة بدون عناوين تقنية.`;
    const text = await callAi("أنت مستشار تربوي محترف تكتب تقارير للأهالي بالعربية الفصحى.", prompt);
    return { text };
  });

export const generateCenterReport = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => d as CenterReportInput)
  .handler(async ({ data }) => {
    const prompt = `أنت مستشار إداري وتربوي لسنتر تعليمي. اكتب تقريراً شاملاً احترافياً باللغة العربية عن الوضع العام للسنتر، من 5-7 فقرات قصيرة، يتضمن:
- ملخص تنفيذي (عدد الطلاب والمجموعات).
- تحليل الحضور والانضباط العام.
- الوضع المالي (الإيرادات والمتأخرات) مع نصيحة عملية.
- أبرز الصفوف والمجموعات أداءً وتلك التي تحتاج انتباه.
- الطلاب الأعلى غياباً وتوصيات للمتابعة.
- توصيات إدارية للأستاذ لتحسين السنتر.

بيانات السنتر:
إجمالي الطلاب: ${data.totals.students}
عدد المجموعات: ${data.totals.groups}
إجمالي الإيرادات: ${data.totals.income} ج.م
إجمالي المستحقات: ${data.totals.dues} ج.م
المتأخرات: ${data.totals.outstanding} ج.م

الحضور الكلي: حضور ${data.attendance.present} — غياب ${data.attendance.absent} — تأخير ${data.attendance.late}

إحصائيات الصفوف:
${data.gradeStats.map(g => `- ${g.grade}: ${g.students} طالب، حضور ${g.present}، غياب ${g.absent}`).join("\n") || "لا يوجد"}

إحصائيات المجموعات:
${data.groupStats.map(g => `- ${g.group}: ${g.students} طالب، مدفوع ${g.income} — مستحق ${g.dues}`).join("\n") || "لا يوجد"}

الطلاب الأعلى غياباً:
${data.topAbsent.map(s => `- ${s.name}: ${s.absent} مرة`).join("\n") || "لا يوجد"}

اكتب التقرير مباشرة بدون عناوين تقنية.`;
    const text = await callAi("أنت مستشار إداري لسنتر تعليمي تكتب تقارير احترافية للإدارة بالعربية الفصحى.", prompt);
    return { text };
  });

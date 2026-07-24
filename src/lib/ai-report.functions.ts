import { createServerFn } from "@tanstack/react-start";

type ReportInput = {
  student: { full_name: string; grade?: string | null; group?: string | null };
  attendance: { present: number; absent: number; late: number };
  homework: { title: string; score: number | null; max_score: number; status: string }[];
  finance: { due: number; paid: number; balance: number };
  notes: string[];
};

export const generateStudentReport = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => d as ReportInput)
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");

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

    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", "Lovable-API-Key": key },
      body: JSON.stringify({
        model: "google/gemini-3.6-flash",
        messages: [
          { role: "system", content: "أنت مستشار تربوي محترف تكتب تقارير للأهالي بالعربية الفصحى." },
          { role: "user", content: prompt },
        ],
      }),
    });
    if (!r.ok) {
      const t = await r.text();
      throw new Error(`AI error ${r.status}: ${t}`);
    }
    const j = await r.json();
    const text = j?.choices?.[0]?.message?.content || "تعذّر توليد التقرير.";
    return { text };
  });

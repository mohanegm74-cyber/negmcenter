/** Server-only helpers for the public (code-based) student portal. */
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const admin = supabaseAdmin;

/** تنظيف الكود وجعله مرناً جداً (يقبل الكود ببادئة أو بدونها، ويحول الأرقام العربية، وينظف المسافات) */
export function cleanCode(code: unknown) {
  let c = String(code ?? "").trim().replace(/\s/g, "").toUpperCase();
  
  // تحويل الأرقام العربية/الفارسية إلى إنجليزية لضمان المطابقة
  const map: Record<string, string> = { '٠':'0','١':'1','٢':'2','٣':'3','٤':'4','٥':'5','٦':'6','٧':'7','٨':'8','٩':'9' };
  c = c.replace(/[٠-٩]/g, (d) => map[d] || d);

  if (!c) throw new Error("يرجى إدخال كود الطالب");

  // إذا أدخل الطالب 8 رموز فقط، نعتبر أنه نسي البادئة STU-
  if (c.length === 8 && !c.startsWith("STU-")) {
    c = "STU-" + c;
  }

  return c;
}

export async function requireStudent(code: unknown) {
  const cleaned = cleanCode(code);
  // البحث الدقيق في قاعدة البيانات عن الكود المنظف
  const { data, error } = await admin.from("students").select("*").eq("code", cleaned).maybeSingle();
  
  if (error) throw new Error("حدث خطأ تقني أثناء التحقق من الكود");
  if (!data) throw new Error(`عذراً، الكود (${cleaned}) غير مسجل. تأكد من كتابته بشكل صحيح أو تواصل مع السنتر.`);
  
  return { db: admin, student: data as any };
}

export function str(v: unknown, max = 500) {
  const s = String(v ?? "").trim();
  return s ? s.slice(0, max) : null;
}
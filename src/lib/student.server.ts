/** Server-only helpers for the public (code-based) student portal. */
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const admin = supabaseAdmin;

/** تنظيف الكود وجعله مرناً (يقبل الكود ببادئة أو بدونها، ويحول الأرقام العربية) */
export function cleanCode(code: unknown) {
  let c = String(code ?? "").trim().toUpperCase();
  
  // تحويل الأرقام العربية/الفارسية إلى إنجليزية
  const map: Record<string, string> = { '٠':'0','١':'1','٢':'2','٣':'3','٤':'4','٥':'5','٦':'6','٧':'7','٨':'8','٩':'9' };
  c = c.replace(/[٠-٩]/g, (d) => map[d] || d);

  if (!c) throw new Error("يرجى إدخال كود الطالب");

  // إذا أدخل الطالب الجزء العشوائي فقط، نضيف البادئة تلقائياً
  if (!c.startsWith("STU-")) {
    // إذا كان طول المدخل 8 رموز (طول الجزء العشوائي)، نضيف البادئة
    if (c.length === 8 || !c.includes("-")) {
      c = "STU-" + c;
    }
  }

  if (c.length < 8) throw new Error("الكود الذي أدخلته غير مكتمل");
  return c;
}

export async function requireStudent(code: unknown) {
  const cleaned = cleanCode(code);
  const { data, error } = await admin.from("students").select("*").eq("code", cleaned).maybeSingle();
  
  if (error) throw new Error("حدث خطأ أثناء التحقق من الكود");
  if (!data) throw new Error(`عذراً، الكود (${cleaned}) غير مسجل لدينا. تأكد من الكود أو سجل كطالب جديد.`);
  
  return { db: admin, student: data as any };
}

export function str(v: unknown, max = 500) {
  const s = String(v ?? "").trim();
  return s ? s.slice(0, max) : null;
}
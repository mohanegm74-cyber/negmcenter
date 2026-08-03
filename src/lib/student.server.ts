/** Server-only helpers for the public (code-based) student portal. */
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const admin = supabaseAdmin;

export function cleanCode(code: unknown) {
  const c = String(code ?? "").trim().toUpperCase();
  if (!c) throw new Error("يرجى إدخال الكود");
  if (!c.startsWith("STU-")) throw new Error("الكود غير صحيح (يجب أن يبدأ بـ -STU)");
  if (c.length < 8) throw new Error("الكود قصير جداً، تأكد من كتابته كاملاً");
  return c;
}

export async function requireStudent(code: unknown) {
  const { data, error } = await admin.from("students").select("*").eq("code", cleanCode(code)).maybeSingle();
  if (error || !data) throw new Error("عذراً، هذا الكود غير مسجل في النظام. تأكد من الكود أو سجل كطالب جديد.");
  return { db: admin, student: data as any };
}

export function str(v: unknown, max = 500) {
  const s = String(v ?? "").trim();
  return s ? s.slice(0, max) : null;
}
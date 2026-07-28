/** Server-only helpers for the public (code-based) student portal. */
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const admin = supabaseAdmin;

export function cleanCode(code: unknown) {
  const c = String(code ?? "").trim().toUpperCase();
  if (!/^STU-[A-Z0-9]{4,32}$/.test(c)) throw new Error("الكود غير صحيح");
  return c;
}

export async function requireStudent(code: unknown) {
  const { data, error } = await admin.from("students").select("*").eq("code", cleanCode(code)).maybeSingle();
  if (error || !data) throw new Error("الكود غير صحيح");
  return { db: admin, student: data as any };
}

export function str(v: unknown, max = 500) {
  const s = String(v ?? "").trim();
  return s ? s.slice(0, max) : null;
}
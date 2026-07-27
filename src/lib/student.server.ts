/** Server-only helpers for the public (code-based) student portal. */
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export function admin() {
  return createClient<Database>(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function cleanCode(code: unknown) {
  const c = String(code ?? "").trim().toUpperCase();
  if (!/^STU-[A-Z0-9]{4,32}$/.test(c)) throw new Error("الكود غير صحيح");
  return c;
}

/** Resolve a student from their private access code, or throw. */
export async function requireStudent(code: unknown) {
  const db = admin();
  const { data, error } = await db.from("students").select("*").eq("code", cleanCode(code)).maybeSingle();
  if (error || !data) throw new Error("الكود غير صحيح");
  return { db, student: data as any };
}

export function str(v: unknown, max = 500) {
  const s = String(v ?? "").trim();
  return s ? s.slice(0, max) : null;
}

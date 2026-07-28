import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** التحقق من أن المستخدم هو الأستاذ (بشكل مباشر لضمان عمل النسخ الاحتياطي) */
async function assertTeacher(context: any) {
  const { supabase, userId } = context;
  if (!userId) throw new Error("يجب تسجيل الدخول أولاً");
  
  // نستخدم supabaseAdmin للفحص لضمان تخطي أي قيود RLS مؤقتة أثناء النسخ
  const { supabaseAdmin } = await import("./backup.server");
  const db = supabaseAdmin();
  
  const { data } = await db.from("user_roles").select("role").eq("user_id", userId).maybeSingle();
  if (!data || (data.role !== "teacher" && data.role !== "admin")) {
    throw new Error("غير مصرح: هذه العملية للأستاذ فقط");
  }
}

export const exportBackup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertTeacher(context);
    const { dumpAll } = await import("./backup.server");
    return await dumpAll();
  });

export const importBackup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { file: any; mode: "merge" | "replace" }) => {
    if (!input || typeof input !== "object" || !input.file) throw new Error("ملف غير صالح");
    return { file: input.file, mode: input.mode === "replace" ? "replace" as const : "merge" as const };
  })
  .handler(async ({ data, context }) => {
    await assertTeacher(context);
    const { restoreAll } = await import("./backup.server");
    const counts = await restoreAll(data.file, data.mode);
    return { counts };
  });
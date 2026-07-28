import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** التحقق من أن المستخدم هو الأستاذ */
async function assertTeacher(context: any) {
  const { userId } = context;
  if (!userId) throw new Error("يجب تسجيل الدخول أولاً");
  
  // استيراد كائن الأدمن بشكل صحيح
  const { admin } = await import("./backup.server");
  const { data } = await admin.from("user_roles").select("role").eq("user_id", userId).maybeSingle();
  
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
    return input;
  })
  .handler(async ({ data, context }) => {
    await assertTeacher(context);
    const { restoreAll } = await import("./backup.server");
    const counts = await restoreAll(data.file, data.mode);
    return { counts };
  });
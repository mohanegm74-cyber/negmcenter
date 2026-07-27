import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertTeacher(supabase: any) {
  const { data, error } = await supabase.rpc("is_teacher");
  if (error || !data) throw new Error("غير مصرح: هذه العملية للأستاذ فقط");
}

export const exportBackup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertTeacher(context.supabase);
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
    await assertTeacher(context.supabase);
    const { restoreAll } = await import("./backup.server");
    const counts = await restoreAll(data.file, data.mode);
    return { counts };
  });

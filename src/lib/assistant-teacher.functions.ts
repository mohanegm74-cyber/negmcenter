import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { checkRateLimit } from "./assistant.server";

const schema = z.object({
  messages: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().min(1).max(3500) })).min(1).max(10),
});

/** مساعد الأستاذ بكامل الصلاحيات — يتحقق من دور الأستاذ قبل أي قراءة للبيانات */
export const askTeacherAssistantFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => schema.parse(d))
  .handler(async ({ data, context }) => {
    const { data: roles } = await context.supabase.from("user_roles").select("role").eq("user_id", context.userId);
    const isTeacher = (roles || []).some((r: any) => r.role === "teacher" || r.role === "admin");
    if (!isTeacher) return { reply: "", notTeacher: true };
    if (!checkRateLimit()) return { reply: "رسائل كتير في وقت قصير، استنى دقيقة وجرب تاني.", notTeacher: false };
    const { askTeacherAssistant } = await import("./assistant-teacher.server");
    try {
      return { reply: await askTeacherAssistant(data.messages), notTeacher: false };
    } catch (e: any) {
      return { reply: e?.message || "تعذر الاتصال بالمساعد الآن.", notTeacher: false };
    }
  });

/** تحويل الرد إلى صوت عربي طبيعي (عام، نص قصير فقط) */
export const speakTextFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ text: z.string().min(1).max(3500) }).parse(d))
  .handler(async ({ data }) => {
    if (!checkRateLimit()) return { audio: null };
    const { synthesizeSpeech } = await import("./assistant-teacher.server");
    return { audio: await synthesizeSpeech(data.text) };
  });

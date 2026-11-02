import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const speakContestFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ text: z.string().trim().min(1).max(500) }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: roles, error } = await context.supabase.from("user_roles").select("role").eq("user_id", context.userId);
    if (error || !roles?.some((role) => role.role === "teacher" || role.role === "admin")) {
      throw new Error("صوت المسابقات متاح للأستاذ فقط.");
    }
    const { synthesizeContestSpeech } = await import("./contest-speech.server");
    return { audio: await synthesizeContestSpeech(data.text) };
  });
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { askAssistant, checkRateLimit, isInjectionAttempt, OUT_OF_SCOPE_REPLY } from "./assistant.server";

const messageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(500),
});

const inputSchema = z.object({
  messages: z.array(messageSchema).min(1).max(10),
});

/**
 * مساعد إرشادي عام (بدون تسجيل دخول) للزوار والطلاب.
 * لا يتصل بقاعدة البيانات ولا يستقبل أي بيانات مستخدم — إرشاد استخدام فقط.
 */
export const askGuideAssistant = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ data }) => {
    if (!checkRateLimit()) {
      return { reply: "عدد الرسائل كبير خلال وقت قصير، انتظر دقيقة ثم حاول مرة أخرى." };
    }
    const lastUser = [...data.messages].reverse().find((m) => m.role === "user");
    if (!lastUser) return { reply: OUT_OF_SCOPE_REPLY };
    if (isInjectionAttempt(lastUser.content)) {
      return { reply: OUT_OF_SCOPE_REPLY };
    }
    try {
      const reply = await askAssistant(data.messages);
      return { reply };
    } catch (e: any) {
      return { reply: e?.message || "تعذر الاتصال بالمساعد الآن، حاول مرة أخرى بعد قليل." };
    }
  });

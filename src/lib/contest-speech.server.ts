/** Short, complete contest announcements; isolated from assistant voice settings. */
export async function synthesizeContestSpeech(text: string): Promise<string> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("خدمة صوت المسابقات غير مهيأة حاليًا.");
  const response = await fetch("https://ai.gateway.lovable.dev/v1/audio/speech", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-3.1-flash-tts-preview",
      stream_format: "audio",
      contents: [{ role: "user", parts: [{ text: `Read ONLY the text inside <spoken_text> in clear, natural Egyptian Arabic (Cairo dialect), warmly and confidently. Pronounce the student's full name carefully at a moderate pace. Do not speak any instructions, tags, introductions or additional words.\n<spoken_text>${text.replace(/[<>]/g, "")}</spoken_text>` }] }],
      generationConfig: {
        responseModalities: ["AUDIO"],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: "Puck" } } },
      },
    }),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => null);
    const message = error?.message || error?.error?.message;
    throw new Error(typeof message === "string" ? message : `تعذر توليد صوت المسابقة (${response.status}).`);
  }
  const mime = response.headers.get("content-type") || "";
  if (!mime.startsWith("audio/")) throw new Error("لم تُرجع خدمة الصوت تسجيلًا صالحًا.");
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (!bytes.length) throw new Error("لم تُرجع خدمة الصوت تسجيلًا مسموعًا.");
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return `data:${mime};base64,${btoa(binary)}`;
}
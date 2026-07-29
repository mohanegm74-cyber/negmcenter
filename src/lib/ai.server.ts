/** منطق السيرفر فقط للاتصال بالذكاء الاصطناعي */
export async function callAi(system: string, prompt: string, json = false) {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("Missing LOVABLE_API_KEY");
  
  const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { 
      "content-type": "application/json", 
      "Lovable-API-Key": key 
    },
    body: JSON.stringify({
      model: "google/gemini-3.6-flash",
      messages: [
        { role: "system", content: system }, 
        { role: "user", content: prompt }
      ],
      ...(json ? { response_format: { type: "json_object" } } : {}),
    }),
  });

  if (r.status === 429) throw new Error("تم تجاوز حد الاستخدام، حاول بعد قليل.");
  if (r.status === 402) throw new Error("انتهى رصيد الذكاء الاصطناعي.");
  if (!r.ok) throw new Error(`AI error ${r.status}`);
  
  const j = await r.json();
  return j?.choices?.[0]?.message?.content || "";
}

export function parseJson(text: string): any {
  const cleaned = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const s = cleaned.indexOf("{");
    const e = cleaned.lastIndexOf("}");
    if (s >= 0 && e > s) return JSON.parse(cleaned.slice(s, e + 1));
    throw new Error("تعذّر قراءة استجابة الذكاء الاصطناعي.");
  }
}
/** منطق السيرفر للاتصال بالذكاء الاصطناعي مع دعم مفاتيح خارجية */
export async function callAi(system: string, prompt: string, json = false) {
  const customKey = process.env.GEMINI_API_KEY;
  const lovableKey = process.env.LOVABLE_API_KEY;

  // إذا توفر مفتاح Gemini الخاص بالمستخدم، نستخدمه مباشرة (مجاني)
  if (customKey) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${customKey}`;
    const r = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: `${system}\n\n${prompt}` }] }],
        generationConfig: json ? { responseMimeType: "application/json" } : {}
      }),
    });
    
    if (!r.ok) throw new Error(`Gemini API Error: ${r.status}`);
    const j = await r.json();
    return j?.candidates?.[0]?.content?.parts?.[0]?.text || "";
  }

  // العودة لنظام Lovable الافتراضي في حال عدم وجود مفتاح خاص
  if (!lovableKey) throw new Error("Missing AI API Key");
  
  const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", "Lovable-API-Key": lovableKey },
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
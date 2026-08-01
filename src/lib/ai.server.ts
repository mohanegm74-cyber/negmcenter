/** منطق السيرفر للاتصال بالذكاء الاصطناعي مع دعم مفاتيح خارجية */
export async function callAi(system: string, prompt: string, json = false) {
  // المفتاح الذي زودتنا به أستاذ محمد
  const MASTER_KEY = "AQ.Ab8RN6KVID_i1yTCmhnBbwq1-Eo2ARbVDckm4VDWMgn_H07GlA";
  const customKey = process.env.GEMINI_API_KEY || MASTER_KEY;
  const lovableKey = process.env.LOVABLE_API_KEY;

  // استخدام واجهة Gemini API المباشرة (المجانية)
  if (customKey) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${customKey}`;
      const r = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: `${system}\n\n${prompt}` }] }],
          generationConfig: json ? { responseMimeType: "application/json" } : {}
        }),
      });
      
      if (r.ok) {
        const j = await r.json();
        const text = j?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) return text;
      }
    } catch (e) {
      console.error("[AI] Gemini Direct Call Failed, falling back...", e);
    }
  }

  // العودة لنظام Lovable الافتراضي في حال فشل المفتاح الخاص
  if (!lovableKey) throw new Error("تعذر الوصول لمفتاح الذكاء الاصطناعي. يرجى التأكد من صلاحية المفتاح المرفق.");
  
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
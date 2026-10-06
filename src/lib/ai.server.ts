/** منطق السيرفر للاتصال بالذكاء الاصطناعي مع دعم مفاتيح خارجية */
export async function callAi(system: string, prompt: string, json = false) {
  // المفتاح الذي زودتنا به أستاذ محمد
  const MASTER_KEY = "AQ.Ab8RN6KVID_i1yTCmhnBbwq1-Eo2ARbVDckm4VDWMgn_H07GlA";
  const customKey = process.env.GEMINI_API_KEY || MASTER_KEY;

  // الاعتماد على خدمة Gemini الخارجية فقط — بدون استهلاك نقاط Lovable
  if (!customKey) throw new Error("مفتاح الذكاء الاصطناعي الخارجي غير مضبوط.");

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${customKey}`;
  const r = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: `${system}\n\n${prompt}` }] }],
      generationConfig: json ? { responseMimeType: "application/json" } : {}
    }),
  });

  if (r.status === 429) throw new Error("تم تجاوز حد استخدام مفتاح الذكاء الاصطناعي، حاول بعد قليل.");
  if (!r.ok) throw new Error("تعذر الاتصال بخدمة الذكاء الاصطناعي الخارجية. تحقق من صلاحية المفتاح.");

  const j = await r.json();
  const text = j?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("لم تُرجع خدمة الذكاء الاصطناعي نتيجة، حاول مرة أخرى.");
  return text;
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
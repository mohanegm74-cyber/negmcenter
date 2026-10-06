/** الاتصال بالذكاء الاصطناعي: Gemini الخارجي أولاً، ثم Lovable AI كخيار احتياطي */
const GEMINI_MODEL = "gemini-2.5-flash";

type Part = { text: string } | { inline_data: { mime_type: string; data: string } };

async function geminiCall(parts: Part[], json: boolean): Promise<string> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("no gemini key");
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${key}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ contents: [{ role: "user", parts }], generationConfig: json ? { responseMimeType: "application/json" } : {} }),
  });
  if (!r.ok) throw new Error(`gemini ${r.status}`);
  const j = await r.json();
  const t = j?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!t) throw new Error("gemini empty");
  return String(t);
}

async function lovableCall(parts: Part[], json: boolean): Promise<string> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("مفتاح الذكاء الاصطناعي غير مضبوط.");
  const content = parts.map((p) =>
    "text" in p
      ? { type: "text", text: p.text }
      : p.inline_data.mime_type === "application/pdf"
        ? { type: "file", file: { filename: "file.pdf", file_data: `data:application/pdf;base64,${p.inline_data.data}` } }
        : { type: "image_url", image_url: { url: `data:${p.inline_data.mime_type};base64,${p.inline_data.data}` } },
  );
  const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
    body: JSON.stringify({ model: "google/gemini-2.5-flash", messages: [{ role: "user", content }], ...(json ? { response_format: { type: "json_object" } } : {}) }),
  });
  if (r.status === 429) throw new Error("تم تجاوز حد الاستخدام، حاول بعد قليل.");
  if (r.status === 402) throw new Error("نفد رصيد الذكاء الاصطناعي في Lovable، ومفتاح Gemini الخارجي لا يعمل.");
  if (!r.ok) throw new Error("تعذر الاتصال بخدمة الذكاء الاصطناعي، حاول مرة أخرى.");
  const j = await r.json();
  const t = j?.choices?.[0]?.message?.content;
  if (!t) throw new Error("لم تُرجع خدمة الذكاء الاصطناعي نتيجة، حاول مرة أخرى.");
  return String(t);
}

export async function callAiParts(parts: Part[], json = false): Promise<string> {
  try {
    return await geminiCall(parts, json);
  } catch (e) {
    console.warn("[ai] Gemini failed, falling back to Lovable AI:", (e as Error).message);
    return lovableCall(parts, json);
  }
}

export async function callAi(system: string, prompt: string, json = false) {
  return callAiParts([{ text: `${system}\n\n${prompt}` }], json);
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

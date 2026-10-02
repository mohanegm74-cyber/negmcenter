/** Server-only helpers: source text extraction (PDF/DOCX/OCR) and multimodal AI calls. */
import { callAi } from "./ai.server";

const MASTER_KEY = "AQ.Ab8RN6KVID_i1yTCmhnBbwq1-Eo2ARbVDckm4VDWMgn_H07GlA";

function toBase64(buf: Uint8Array) {
  return Buffer.from(buf).toString("base64");
}

/** Multimodal call (image/PDF + text) using the same AI service as smart exams. */
export async function callAiWithFile(system: string, prompt: string, bytes: Uint8Array, mime: string, json = false) {
  const key = process.env.GEMINI_API_KEY || MASTER_KEY;
  if (bytes.length > 18 * 1024 * 1024) throw new Error("الملف كبير على القراءة الضوئية (OCR) — الحد 18 ميجا للصور والملفات الممسوحة. ملفات PDF النصية وWord تُقرأ حتى 200 ميجا.");
  const b64 = toBase64(bytes);
  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: `${system}\n\n${prompt}` }, { inline_data: { mime_type: mime, data: b64 } }] }],
        generationConfig: json ? { responseMimeType: "application/json" } : {},
      }),
    });
    if (r.ok) {
      const j = await r.json();
      const t = j?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (t) return t as string;
    }
  } catch (e) {
    console.error("[AI file] direct call failed", e);
  }
  const lovableKey = process.env.LOVABLE_API_KEY;
  if (!lovableKey) throw new Error("تعذر الوصول لخدمة الذكاء الاصطناعي.");
  const part = mime === "application/pdf"
    ? { type: "file", file: { filename: "doc.pdf", file_data: `data:${mime};base64,${b64}` } }
    : { type: "image_url", image_url: { url: `data:${mime};base64,${b64}` } };
  const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", "Lovable-API-Key": lovableKey },
    body: JSON.stringify({
      model: "google/gemini-3.6-flash",
      messages: [{ role: "system", content: system }, { role: "user", content: [{ type: "text", text: prompt }, part] }],
      ...(json ? { response_format: { type: "json_object" } } : {}),
    }),
  });
  if (r.status === 429) throw new Error("تم تجاوز حد الاستخدام، حاول بعد قليل.");
  if (r.status === 402) throw new Error("انتهى رصيد الذكاء الاصطناعي.");
  if (!r.ok) throw new Error(`AI error ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const j = await r.json();
  return String(j?.choices?.[0]?.message?.content || "");
}

const OCR_SYSTEM = "أنت أداة OCR دقيقة للنصوص العربية التعليمية. انسخ النص الموجود في الملف حرفياً كما هو بدون شرح أو إضافات، مع الحفاظ على ترتيب الفقرات والأسئلة.";

/** Extract plain text from a PDF / DOCX / image. Falls back to OCR when needed. */
export async function extractText(bytes: Uint8Array, mime: string, filename: string): Promise<string> {
  const lower = filename.toLowerCase();
  if (mime === "application/pdf" || lower.endsWith(".pdf")) {
    let text = "";
    try {
      const { extractText: pdfText, getDocumentProxy } = await import("unpdf");
      const pdf = await getDocumentProxy(new Uint8Array(bytes));
      const res = await pdfText(pdf, { mergePages: true });
      text = String(res.text || "").trim();
    } catch (e) {
      console.error("[extract] pdf text failed", e);
    }
    if (text.replace(/\s/g, "").length >= 80) return text;
    return (await callAiWithFile(OCR_SYSTEM, "استخرج كل النص من ملف PDF المرفق.", bytes, "application/pdf")).trim();
  }
  if (lower.endsWith(".docx") || mime.includes("wordprocessingml")) {
    const mammoth: any = await import("mammoth");
    const m = mammoth.default || mammoth;
    const res = await m.extractRawText({ buffer: Buffer.from(bytes) });
    return String(res.value || "").trim();
  }
  if (lower.endsWith(".doc") || mime === "application/msword") {
    // Legacy binary .doc: recover readable runs of text (Arabic + Latin).
    const utf16 = Buffer.from(bytes).toString("utf16le");
    const runs = utf16.match(/[\u0600-\u06FF\u0020-\u007E\s]{4,}/g) || [];
    const text = runs.join(" ").replace(/\s+/g, " ").trim();
    if (text.length < 40) throw new Error("تعذر قراءة ملف DOC القديم، يرجى حفظه بصيغة DOCX ثم رفعه.");
    return text;
  }
  if (mime.startsWith("image/")) {
    return (await callAiWithFile(OCR_SYSTEM, "استخرج كل النص من الصورة المرفقة.", bytes, mime)).trim();
  }
  throw new Error("صيغة الملف غير مدعومة");
}

export { callAi };

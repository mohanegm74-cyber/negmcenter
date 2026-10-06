/** Server-only helpers: source text extraction (PDF/DOCX/OCR) and multimodal AI calls. */
import { callAi, callAiParts } from "./ai.server";

/** Multimodal call (image/PDF + text): Gemini first, Lovable AI fallback. */
export async function callAiWithFile(system: string, prompt: string, bytes: Uint8Array, mime: string, json = false) {
  if (bytes.length > 18 * 1024 * 1024) throw new Error("الملف كبير على القراءة الضوئية (OCR) — الحد 18 ميجا للصور والملفات الممسوحة. ملفات PDF النصية وWord تُقرأ حتى 200 ميجا.");
  const b64 = Buffer.from(bytes).toString("base64");
  return callAiParts([{ text: `${system}\n\n${prompt}` }, { inline_data: { mime_type: mime, data: b64 } }], json);
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

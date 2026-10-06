import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, X, Upload, Trash2, Search, FileDown, Printer, Plus, Sparkles, FolderPlus, ScrollText, AlertTriangle, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { TERMS, GRADES } from "@/lib/exam-constants";
import {
  createSourceUploadUrl, indexSource, saveSpec, createSourceRecord, saveSourcePages, finalizeSource, ocrPageImage, updateSource, getSourceFiles, getSourcePages, listSources, deleteSource, analyzeSpecs, generatePaperExam,
  type ExamSpec, type PaperSection,
} from "@/lib/paper-exam.functions";

const ACCEPT = ".pdf,.doc,.docx,.jpg,.jpeg,.png";
const inputCls = "w-full rounded-xl border border-input bg-background px-3 py-2 text-sm font-bold outline-none focus:border-primary";

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-foreground/40 p-3 sm:p-6" dir="rtl">
      <div className="w-full max-w-5xl rounded-3xl bg-card p-5 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-black">{title}</h2>
          <button onClick={onClose} className="rounded-full p-2 hover:bg-muted"><X className="h-5 w-5" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function useUpload() {
  const urlFn = useServerFn(createSourceUploadUrl);
  return async (file: File, kind: "source" | "spec") => {
    if (file.size > 200 * 1024 * 1024) throw new Error(`${file.name}: الحد الأقصى لحجم الملف 200 ميجا`);
    const { path, token } = await urlFn({ data: { filename: file.name, kind } });
    const { error } = await supabase.storage.from("exam-sources").uploadToSignedUrl(path, token, file);
    if (error) throw new Error(error.message);
    return path;
  };
}

/** Extract text on the device to avoid server memory limits for large files. */
async function extractInBrowser(f: File): Promise<string> {
  const name = f.name.toLowerCase();
  try {
    if (name.endsWith(".pdf")) {
      const { extractText, getDocumentProxy } = await import("unpdf");
      const pdf = await getDocumentProxy(new Uint8Array(await f.arrayBuffer()));
      const res = await extractText(pdf, { mergePages: true });
      const t = String(res.text || "").trim();
      return t.replace(/\s/g, "").length >= 80 ? t : "";
    }
    if (name.endsWith(".docx")) {
      const mammoth: any = await import("mammoth/mammoth.browser");
      const res = await (mammoth.default || mammoth).extractRawText({ arrayBuffer: await f.arrayBuffer() });
      return String(res.value || "").trim();
    }
  } catch (e) { console.error("browser extract failed", e); }
  return "";
}

/* ---------------- Sources (permanent library) ---------------- */
const PART_SIZE = 180 * 1024 * 1024; // auto-split above this, parts kept in order

async function blobToBase64(b: Blob): Promise<string> {
  const buf = new Uint8Array(await b.arrayBuffer());
  let bin = "";
  for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return btoa(bin);
}

async function canvasToJpeg(c: HTMLCanvasElement): Promise<Blob> {
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("render failed"))), "image/jpeg", 0.8));
}

async function imageFileToJpeg(f: File): Promise<Blob> {
  const url = URL.createObjectURL(f);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const scale = Math.min(1, 2000 / Math.max(img.width, img.height));
    const c = document.createElement("canvas");
    c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
    return await canvasToJpeg(c);
  } finally { URL.revokeObjectURL(url); }
}

type PageOut = { page_no: number; text: string; ocr?: boolean };

function SourcesManager({ onClose }: { onClose: () => void }) {
  const urlFn = useServerFn(createSourceUploadUrl);
  const createFn = useServerFn(createSourceRecord);
  const pagesFn = useServerFn(saveSourcePages);
  const finFn = useServerFn(finalizeSource);
  const ocrFn = useServerFn(ocrPageImage);
  const legacyIndexFn = useServerFn(indexSource);
  const listFn = useServerFn(listSources);
  const delFn = useServerFn(deleteSource);
  const updFn = useServerFn(updateSource);
  const filesFn = useServerFn(getSourceFiles);
  const viewFn = useServerFn(getSourcePages);
  const [meta, setMeta] = useState({ grade: GRADES[0] as string, term: "", subject: "", lesson: "", title: "" });
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [rows, setRows] = useState<any[]>([]);
  const [filter, setFilter] = useState({ grade: "", subject: "", q: "" });
  const [editing, setEditing] = useState<any | null>(null);
  const [viewing, setViewing] = useState<{ row: any; q: string; pages: any[] } | null>(null);

  async function load() {
    try { const r: any = await listFn({ data: filter }); setRows(Array.isArray(r) ? r : []); } catch (e: any) { toast.error(e.message); }
  }
  useEffect(() => { load(); }, []);

  async function uploadParts(f: File): Promise<string[]> {
    const n = Math.max(1, Math.ceil(f.size / PART_SIZE));
    const parts: string[] = [];
    for (let i = 0; i < n; i++) {
      setProgress(`رفع ${f.name}${n > 1 ? ` — الجزء ${i + 1} من ${n}` : ""}...`);
      const chunk = f.slice(i * PART_SIZE, Math.min(f.size, (i + 1) * PART_SIZE));
      const { path, token } = await urlFn({ data: { filename: f.name, kind: "source" } });
      const { error } = await supabase.storage.from("exam-sources").uploadToSignedUrl(path, token, chunk);
      if (error) throw new Error(error.message);
      parts.push(path);
    }
    return parts;
  }

  async function ocr(blob: Blob): Promise<string> {
    const r = await ocrFn({ data: { base64: await blobToBase64(blob), mime: "image/jpeg" } });
    return r.text;
  }

  async function processPdf(f: File, sourceId: string) {
    const { getDocumentProxy } = await import("unpdf");
    const pdf: any = await getDocumentProxy(new Uint8Array(await f.arrayBuffer()));
    const total = pdf.numPages as number;
    let batch: PageOut[] = [];
    let ocrFails = 0;
    for (let p = 1; p <= total; p++) {
      setProgress(`معالجة ${f.name}: صفحة ${p} من ${total}`);
      const page = await pdf.getPage(p);
      let text = "";
      try {
        const tc = await page.getTextContent();
        text = tc.items.map((it: any) => it.str).join(" ").replace(/\s+/g, " ").trim();
      } catch { /* ignore */ }
      let isOcr = false;
      if (text.replace(/\s/g, "").length < 40) {
        try {
          const vp = page.getViewport({ scale: 1.6 });
          const c = document.createElement("canvas");
          c.width = Math.round(vp.width); c.height = Math.round(vp.height);
          await page.render({ canvasContext: c.getContext("2d")!, viewport: vp }).promise;
          setProgress(`قراءة ضوئية عربية: ${f.name} — صفحة ${p} من ${total}`);
          text = await ocr(await canvasToJpeg(c));
          isOcr = true;
        } catch (e) { ocrFails++; console.error("ocr page failed", p, e); }
      }
      page.cleanup?.();
      batch.push({ page_no: p, text, ocr: isOcr });
      if (batch.length >= 20) { await pagesFn({ data: { sourceId, pages: batch } }); batch = []; }
    }
    if (batch.length) await pagesFn({ data: { sourceId, pages: batch } });
    return ocrFails ? `تعذرت قراءة ${ocrFails} صفحة` : undefined;
  }

  async function processDocx(f: File, sourceId: string) {
    const mammoth: any = await import("mammoth/mammoth.browser");
    const res = await (mammoth.default || mammoth).extractRawText({ arrayBuffer: await f.arrayBuffer() });
    const text = String(res.value || "");
    const pages: PageOut[] = [];
    for (let i = 0, n = 1; i < text.length; i += 3000, n++) pages.push({ page_no: n, text: text.slice(i, i + 3000) });
    for (let i = 0; i < pages.length; i += 50) await pagesFn({ data: { sourceId, pages: pages.slice(i, i + 50) } });
  }

  async function save() {
    if (!files.length) return toast.error("اختر ملفاً واحداً على الأقل");
    if (!meta.subject) return toast.error("حدد المادة");
    setBusy(true);
    for (const f of files) {
      const lower = f.name.toLowerCase();
      const t = toast.loading(`جاري معالجة ${f.name}...`);
      try {
        if (lower.endsWith(".doc")) {
          // Legacy .doc: server-side reader (single file).
          if (f.size > PART_SIZE) throw new Error("ملف DOC القديم كبير جداً");
          const [path] = await uploadParts(f);
          const r = await legacyIndexFn({ data: { path, size: f.size, filename: f.name, mime: f.type, title: meta.title || f.name, grade: meta.grade, subject: meta.subject, lesson: meta.lesson, term: meta.term } });
          if (r.status === "indexed") toast.success(`تمت فهرسة ${f.name}`, { id: t }); else toast.error(`${f.name}: ${r.error}`, { id: t });
          continue;
        }
        const parts = await uploadParts(f);
        const { id } = await createFn({ data: { parts, filename: f.name, mime: f.type, size: f.size, title: meta.title || f.name, grade: meta.grade, subject: meta.subject, lesson: meta.lesson, term: meta.term } });
        let warn: string | undefined;
        if (lower.endsWith(".pdf")) warn = await processPdf(f, id);
        else if (lower.endsWith(".docx")) await processDocx(f, id);
        else {
          setProgress(`قراءة ضوئية عربية: ${f.name}`);
          await pagesFn({ data: { sourceId: id, pages: [{ page_no: 1, text: await ocr(await imageFileToJpeg(f)), ocr: true }] } });
        }
        const r = await finFn({ data: { sourceId: id, error: warn } });
        if (r.status === "indexed") toast.success(`تم حفظ ${f.name} في المكتبة (${r.pages} صفحة${parts.length > 1 ? `، ${parts.length} أجزاء` : ""})${warn ? ` — ${warn}` : ""}`, { id: t });
        else toast.error(`حُفظ ${f.name} لكن لم يُستخرج نص`, { id: t });
      } catch (e: any) { toast.error(`${f.name}: ${e.message}`, { id: t }); }
    }
    setFiles([]); setBusy(false); setProgress(""); load();
  }

  async function openSource(r: any) {
    const t = toast.loading("جاري فتح المصدر...");
    try {
      const { urls, mime } = await filesFn({ data: { id: r.id } });
      if (!urls.length) throw new Error("الملف غير موجود");
      if (urls.length === 1) { window.open(urls[0], "_blank"); toast.dismiss(t); return; }
      // Reassemble split parts in order into the original file.
      const blobs: Blob[] = [];
      for (let i = 0; i < urls.length; i++) {
        toast.loading(`تجميع الجزء ${i + 1} من ${urls.length}...`, { id: t });
        blobs.push(await (await fetch(urls[i])).blob());
      }
      window.open(URL.createObjectURL(new Blob(blobs, { type: mime || "application/pdf" })), "_blank");
      toast.dismiss(t);
    } catch (e: any) { toast.error(e.message, { id: t }); }
  }

  async function showPages(row: any, q = "") {
    try { setViewing({ row, q, pages: await viewFn({ data: { id: row.id, q } }) }); } catch (e: any) { toast.error(e.message); }
  }

  async function saveEdit() {
    try { await updFn({ data: editing }); toast.success("تم حفظ التعديل"); setEditing(null); load(); } catch (e: any) { toast.error(e.message); }
  }

  return (
    <Modal title="مكتبة المصادر" onClose={onClose}>
      <div className="grid gap-3 rounded-2xl border p-4 sm:grid-cols-2">
        <select className={inputCls} value={meta.grade} onChange={(e) => setMeta({ ...meta, grade: e.target.value })}>{GRADES.map((g) => <option key={g}>{g}</option>)}</select>
        <select className={inputCls} value={meta.term || ""} onChange={(e) => setMeta({ ...meta, term: e.target.value })}><option value="">الفصل الدراسي (الكل)</option>{TERMS.map((t) => <option key={t}>{t}</option>)}</select>
        <input className={inputCls} placeholder="المادة" value={meta.subject} onChange={(e) => setMeta({ ...meta, subject: e.target.value })} />
        <input className={inputCls} placeholder="الدرس / الوحدة (اختياري للكتاب كامل)" value={meta.lesson} onChange={(e) => setMeta({ ...meta, lesson: e.target.value })} />
        <input className={inputCls} placeholder="عنوان المصدر (اختياري)" value={meta.title} onChange={(e) => setMeta({ ...meta, title: e.target.value })} />
        <label className="sm:col-span-2 flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed p-4 text-sm font-bold text-muted-foreground hover:bg-muted">
          <Upload className="h-5 w-5" /> {files.length ? files.map((f) => f.name).join("، ") : "PDF / Word / صور — أي حجم (يُقسَّم تلقائياً)"}
          <input type="file" multiple accept={ACCEPT} className="hidden" onChange={(e) => setFiles(Array.from(e.target.files || []))} />
        </label>
        {progress && <div className="sm:col-span-2 rounded-xl bg-muted px-3 py-2 text-xs font-bold">{progress} — لا تغلق النافذة</div>}
        <button disabled={busy} onClick={save} className="sm:col-span-2 inline-flex items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-black text-primary-foreground">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FolderPlus className="h-4 w-4" />} حفظ في المكتبة
        </button>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <select className={inputCls + " sm:w-48"} value={filter.grade} onChange={(e) => setFilter({ ...filter, grade: e.target.value })}><option value="">كل الصفوف</option>{GRADES.map((g) => <option key={g}>{g}</option>)}</select>
        <input className={inputCls + " sm:w-40"} placeholder="المادة" value={filter.subject} onChange={(e) => setFilter({ ...filter, subject: e.target.value })} />
        <input className={inputCls + " flex-1"} placeholder="بحث داخل نصوص المصادر..." value={filter.q} onChange={(e) => setFilter({ ...filter, q: e.target.value })} onKeyDown={(e) => e.key === "Enter" && load()} />
        <button onClick={load} className="rounded-xl bg-muted px-4 text-sm font-bold"><Search className="h-4 w-4" /></button>
      </div>
      <div className="mt-3 max-h-[45vh] space-y-2 overflow-y-auto">
        {rows.length === 0 && <div className="p-6 text-center text-sm font-bold text-muted-foreground">لا توجد مصادر</div>}
        {rows.map((r) => (
          <div key={r.id} className="rounded-2xl border p-3">
            {editing?.id === r.id ? (
              <div className="grid gap-2 sm:grid-cols-4">
                <input className={inputCls} value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} />
                <select className={inputCls} value={editing.grade} onChange={(e) => setEditing({ ...editing, grade: e.target.value })}>{GRADES.map((g) => <option key={g}>{g}</option>)}</select>
                <select className={inputCls} value={editing.term || ""} onChange={(e) => setEditing({ ...editing, term: e.target.value })}><option value="">الفصل الدراسي (الكل)</option>{TERMS.map((t) => <option key={t}>{t}</option>)}</select>
                <input className={inputCls} placeholder="المادة" value={editing.subject} onChange={(e) => setEditing({ ...editing, subject: e.target.value })} />
                <input className={inputCls} placeholder="الدرس" value={editing.lesson} onChange={(e) => setEditing({ ...editing, lesson: e.target.value })} />
                <div className="sm:col-span-4 flex gap-2">
                  <button onClick={saveEdit} className="rounded-xl bg-primary px-4 py-1.5 text-xs font-black text-primary-foreground">حفظ</button>
                  <button onClick={() => setEditing(null)} className="rounded-xl bg-muted px-4 py-1.5 text-xs font-bold">إلغاء</button>
                </div>
              </div>
            ) : (
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-black text-sm">{r.title}</div>
                  <div className="text-[11px] font-bold text-muted-foreground">
                    {[r.grade, r.subject, r.lesson].filter(Boolean).join(" • ")} • {r.status === "indexed" ? `${r.page_count ? `${r.page_count} صفحة • ` : ""}${r.chars} حرف` : r.status === "processing" ? "قيد المعالجة" : `فشل: ${r.error}`}
                    {Array.isArray(r.parts) && r.parts.length > 1 ? ` • ${r.parts.length} أجزاء` : ""}
                  </div>
                  {r.snippet && <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">{r.snippet}</div>}
                </div>
                <div className="flex shrink-0 gap-1">
                  <button onClick={() => openSource(r)} className="rounded-lg border px-2 py-1 text-[11px] font-bold hover:bg-muted">فتح</button>
                  <button onClick={() => showPages(r, filter.q)} className="rounded-lg border px-2 py-1 text-[11px] font-bold hover:bg-muted">الصفحات</button>
                  <button onClick={() => setEditing({ id: r.id, title: r.title || "", grade: r.grade || GRADES[0], subject: r.subject || "", lesson: r.lesson || "", term: r.term || "" })} className="rounded-lg border px-2 py-1 text-[11px] font-bold hover:bg-muted">تعديل</button>
                  <button onClick={async () => { if (!confirm("حذف المصدر بكل أجزائه؟")) return; await delFn({ data: { id: r.id } }); load(); }} className="rounded-lg p-1.5 text-destructive hover:bg-destructive/10"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {viewing && (
        <div className="mt-4 rounded-2xl border p-3">
          <div className="mb-2 flex items-center gap-2">
            <div className="flex-1 text-sm font-black">صفحات: {viewing.row.title}</div>
            <input className={inputCls + " w-48"} placeholder="بحث في الصفحات" value={viewing.q} onChange={(e) => setViewing({ ...viewing, q: e.target.value })} onKeyDown={(e) => e.key === "Enter" && showPages(viewing.row, viewing.q)} />
            <button onClick={() => setViewing(null)} className="rounded-full p-1 hover:bg-muted"><X className="h-4 w-4" /></button>
          </div>
          <div className="max-h-[40vh] space-y-2 overflow-y-auto">
            {viewing.pages.length === 0 && <div className="p-4 text-center text-xs text-muted-foreground">لا توجد نتائج</div>}
            {viewing.pages.map((p) => (
              <div key={p.page_no} className="rounded-xl bg-muted/50 p-2 text-xs">
                <div className="mb-1 font-black">صفحة {p.page_no}{p.ocr ? " • قراءة ضوئية" : ""}</div>
                <div className="whitespace-pre-wrap leading-6">{p.text}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </Modal>
  );
}

/* ---------------- Paper exam ---------------- */
const ARABIC_LETTERS = ["أ", "ب", "ج", "د", "هـ", "و"];

async function exportDocx(spec: ExamSpec, sections: PaperSection[], info: { grade: string; subject: string }, withAnswers: boolean) {
  const { Document, Packer, Paragraph, TextRun, AlignmentType, BorderStyle, Header, Footer, PageNumber } = await import("docx");
  const font = "Arial";
  const P = (text: string, o: any = {}) => new Paragraph({
    bidirectional: true, alignment: o.align ?? AlignmentType.RIGHT, spacing: { after: o.after ?? 80 },
    border: o.border, children: [new TextRun({ text, rightToLeft: true, font, size: o.size ?? 26, bold: o.bold })],
  });
  const children: any[] = [
    P(`${info.subject} — ${info.grade}`, { align: AlignmentType.CENTER, bold: true, size: 32 }),
    P(spec.title, { align: AlignmentType.CENTER, bold: true, size: 30 }),
    P(`الزمن: ${spec.duration_minutes} دقيقة          الدرجة الكلية: ${spec.total_score}`, { align: AlignmentType.CENTER }),
    P("اسم الطالب: ................................................   الفصل: ............", { after: 160 }),
  ];
  if (spec.header_notes) children.push(P(spec.header_notes, { size: 22, border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "999999", space: 4 } }, after: 200 }));
  sections.forEach((s) => {
    const sTotal = s.questions.reduce((a, q) => a + Number(q.score || 0), 0);
    children.push(P(`${s.title}: ${s.instructions || s.kind}   (${sTotal} درجة)`, { bold: true, size: 28, after: 120 }));
    s.questions.forEach((q, i) => {
      children.push(P(`${i + 1}- ${q.prompt}   (${q.score} د)`));
      if (q.options.length) children.push(P(q.options.map((o, k) => `${ARABIC_LETTERS[k] || k + 1}) ${o}`).join("     "), { size: 24 }));
      for (let l = 0; l < (q.lines || 0); l++) children.push(P("..................................................................................................................", { size: 22 }));
      if (withAnswers && q.answer) children.push(P(`الإجابة: ${q.answer}`, { size: 22, bold: true }));
    });
    children.push(P("", { after: 120 }));
  });
  children.push(P("انتهت الأسئلة — مع تمنياتنا بالتوفيق", { align: AlignmentType.CENTER, bold: true }));
  const doc = new Document({
    styles: { default: { document: { run: { font, size: 26 } } } },
    sections: [{
      properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1000, bottom: 1000, left: 1000, right: 1000 } } },
      headers: { default: new Header({ children: [P("سنتر الأستاذ محمد نجم", { align: AlignmentType.CENTER, size: 20 })] }) },
      footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ children: ["صفحة ", PageNumber.CURRENT], font, size: 20 })] })] }) },
      children,
    }],
  });
  const blob = await Packer.toBlob(doc);
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${spec.title}${withAnswers ? " - نموذج الإجابة" : ""}.docx`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

function printPreview(spec: ExamSpec, sections: PaperSection[], info: { grade: string; subject: string }) {
  const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]!));
  const body = sections.map((s) => `<h3>${esc(s.title)}: ${esc(s.instructions || s.kind)} <small>(${s.questions.reduce((a, q) => a + Number(q.score || 0), 0)} درجة)</small></h3>` +
    s.questions.map((q, i) => `<p>${i + 1}- ${esc(q.prompt)} <small>(${q.score} د)</small></p>` +
      (q.options.length ? `<p class="o">${q.options.map((o, k) => `${ARABIC_LETTERS[k] || k + 1}) ${esc(o)}`).join("&nbsp;&nbsp;&nbsp;&nbsp;")}</p>` : "") +
      '<div class="l"></div>'.repeat(q.lines || 0)).join("")).join("");
  const w = window.open("", "_blank");
  if (!w) return toast.error("اسمح بالنوافذ المنبثقة لعرض المعاينة");
  w.document.write(`<html dir="rtl"><head><title>${esc(spec.title)}</title><style>body{font-family:Arial;padding:24px;line-height:1.9}h1,h2{text-align:center;margin:4px}h3{margin-top:18px}.o{padding-right:24px}.l{border-bottom:1px dotted #555;height:28px}.meta{text-align:center}@page{size:A4;margin:15mm}</style></head><body>
  <h2>${esc(info.subject)} — ${esc(info.grade)}</h2><h1>${esc(spec.title)}</h1><p class="meta">الزمن: ${spec.duration_minutes} دقيقة — الدرجة الكلية: ${spec.total_score}</p>
  <p>اسم الطالب: ....................................... الفصل: ..........</p>${spec.header_notes ? `<p><b>${esc(spec.header_notes)}</b></p><hr/>` : ""}${body}
  <p style="text-align:center"><b>انتهت الأسئلة</b></p><script>setTimeout(()=>print(),300)</script></body></html>`);
  w.document.close();
}

function PaperExamBuilder({ onClose }: { onClose: () => void }) {
  const upload = useUpload();
  const listFn = useServerFn(listSources);
  const analyzeFn = useServerFn(analyzeSpecs);
  const genFn = useServerFn(generatePaperExam);
  const saveSpecFn = useServerFn(saveSpec);
  const [savedSpecs, setSavedSpecs] = useState<any[]>([]);
  const [specPath, setSpecPath] = useState<string | undefined>();
  const loadSpecs = () => listFn({ data: { grade: info.grade, term: info.term, kind: "spec" } }).then((r: any) => setSavedSpecs(Array.isArray(r) ? r : [])).catch(() => setSavedSpecs([]));
  const [info, setInfo] = useState({ grade: GRADES[0] as string, term: "", subject: "", lessons: "" });
  const [sources, setSources] = useState<any[]>([]);
  const [picked, setPicked] = useState<string[]>([]);
  const [specText, setSpecText] = useState("");
  const [specFile, setSpecFile] = useState<File | null>(null);
  const [spec, setSpec] = useState<ExamSpec | null>(null);
  const [sections, setSections] = useState<PaperSection[] | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    listFn({ data: { grade: info.grade, term: info.term, subject: info.subject } }).then((r: any) => setSources(Array.isArray(r) ? r.filter((x: any) => x.status === "indexed") : [])).catch(() => setSources([]));
    loadSpecs();
  }, [info.grade, info.term, info.subject]);

  async function storeSpec() {
    if (!spec) return;
    try { await saveSpecFn({ data: { grade: info.grade, term: info.term, subject: info.subject, spec, path: specPath } }); toast.success("تم حفظ المواصفات لهذا الصف"); loadSpecs(); }
    catch (e: any) { toast.error(e.message); }
  }

  const specSum = spec ? spec.sections.reduce((a, s) => a + s.count * s.score_each, 0) : 0;
  const examSum = sections ? sections.reduce((a, s) => a + (s.questions || []).reduce((b, q) => b + Number(q.score || 0), 0), 0) : 0;
  const countIssues = sections && spec ? sections.filter((s, i) => (s.questions?.length || 0) !== spec.sections?.[i]?.count).map((s) => s.title) : [];

  async function analyze() {
    if (!info.subject) return toast.error("حدد المادة");
    setBusy(true);
    const t = toast.loading("جاري تحليل المواصفات...");
    try {
      let path: string | undefined;
      if (specFile) path = await upload(specFile, "spec");
      setSpecPath(path);
      const s = await analyzeFn({ data: { text: specText, path, mime: specFile?.type, filename: specFile?.name, grade: info.grade, subject: info.subject } });
      setSpec(s); setSections(null);
      toast.success("تم استخراج المواصفات، راجعها وعدّلها", { id: t });
    } catch (e: any) { toast.error(e.message || "فشل التحليل", { id: t }); }
    finally { setBusy(false); }
  }

  async function generate() {
    if (!spec) return;
    if (specSum !== Number(spec.total_score)) return toast.error(`مجموع درجات الأقسام (${specSum}) لا يساوي الدرجة الكلية (${spec.total_score})`);
    setBusy(true);
    const t = toast.loading("جاري توليد الامتحان من المصادر...");
    try {
      const r = await genFn({ data: { grade: info.grade, term: info.term, subject: info.subject, lessons: info.lessons, sourceIds: picked, spec } });
      setSections(r.sections);
      r.warnings.forEach((w: string) => toast.warning(w));
      toast.success("تم توليد الامتحان", { id: t });
    } catch (e: any) { toast.error(e.message || "فشل التوليد", { id: t }); }
    finally { setBusy(false); }
  }

  const updSpec = (i: number, p: any) => setSpec((s) => s && { ...s, sections: s.sections.map((x, n) => (n === i ? { ...x, ...p } : x)) });
  const updQ = (si: number, qi: number, p: any) => setSections((ss) => ss && ss.map((s, n) => n !== si ? s : { ...s, questions: s.questions.map((q, m) => (m === qi ? { ...q, ...p } : q)) }));

  return (
    <Modal title="توليد امتحان ورقي (للمدرس فقط)" onClose={onClose}>
      {/* Step 1 */}
      <div className="grid gap-3 rounded-2xl border p-4 sm:grid-cols-3">
        <select className={inputCls} value={info.grade} onChange={(e) => setInfo({ ...info, grade: e.target.value })}>{GRADES.map((g) => <option key={g}>{g}</option>)}</select>
        <select className={inputCls} value={info.term || ""} onChange={(e) => setInfo({ ...info, term: e.target.value })}><option value="">الفصل الدراسي (الكل)</option>{TERMS.map((t) => <option key={t}>{t}</option>)}</select>
        <input className={inputCls} placeholder="المادة" value={info.subject} onChange={(e) => setInfo({ ...info, subject: e.target.value })} />
        <input className={inputCls} placeholder="الدروس (مفصولة بفواصل)" value={info.lessons} onChange={(e) => setInfo({ ...info, lessons: e.target.value })} />
        <div className="sm:col-span-3">
          <div className="mb-1 text-xs font-black text-muted-foreground">المصادر ({picked.length} مختار)</div>
          <div className="flex max-h-32 flex-wrap gap-2 overflow-y-auto">
            {sources.length === 0 && <span className="text-xs font-bold text-muted-foreground">لا توجد مصادر مفهرسة لهذا الصف/المادة — سيُعتمد على المنهج الرسمي.</span>}
            {sources.map((s) => (
              <button key={s.id} onClick={() => setPicked((p) => (p.includes(s.id) ? p.filter((x) => x !== s.id) : [...p, s.id]))}
                className={`rounded-full border px-3 py-1 text-xs font-bold ${picked.includes(s.id) ? "border-primary bg-primary/10 text-primary" : ""}`}>
                {s.title}{s.lesson ? ` • ${s.lesson}` : ""}
              </button>
            ))}
          </div>
        </div>
        {savedSpecs.length > 0 && (
          <div className="sm:col-span-3">
            <div className="mb-1 text-xs font-black text-muted-foreground">مواصفات محفوظة لهذا الصف</div>
            <div className="flex flex-wrap gap-2">
              {savedSpecs.map((x) => (
                <button key={x.id} onClick={() => { setSpec(x.spec); setSections(null); if (x.subject && !info.subject) setInfo({ ...info, subject: x.subject }); }} className="rounded-full border px-3 py-1 text-xs font-bold hover:bg-muted">
                  {x.title}{x.subject ? ` • ${x.subject}` : ""}
                </button>
              ))}
            </div>
          </div>
        )}
        <textarea className={inputCls + " sm:col-span-3"} rows={3} placeholder="اكتب مواصفات الوزارة هنا (أو ارفع صورة/PDF)..." value={specText} onChange={(e) => setSpecText(e.target.value)} />
        <label className="sm:col-span-2 flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed p-3 text-sm font-bold text-muted-foreground hover:bg-muted">
          <Upload className="h-4 w-4" /> {specFile ? specFile.name : "رفع المواصفات (صورة / PDF / Word)"}
          <input type="file" accept={ACCEPT} className="hidden" onChange={(e) => setSpecFile(e.target.files?.[0] || null)} />
        </label>
        <button disabled={busy} onClick={analyze} className="inline-flex items-center justify-center gap-2 rounded-xl bg-gold py-2.5 text-sm font-black text-gold-foreground">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} تحليل المواصفات
        </button>
      </div>

      {/* Step 2: review spec */}
      {spec && (
        <div className="mt-4 space-y-3 rounded-2xl border p-4">
          <div className="grid gap-2 sm:grid-cols-3">
            <input className={inputCls} value={spec.title} onChange={(e) => setSpec({ ...spec, title: e.target.value })} />
            <input className={inputCls} type="number" value={spec.duration_minutes} onChange={(e) => setSpec({ ...spec, duration_minutes: Number(e.target.value) })} placeholder="الزمن بالدقائق" />
            <input className={inputCls} type="number" value={spec.total_score} onChange={(e) => setSpec({ ...spec, total_score: Number(e.target.value) })} placeholder="الدرجة الكلية" />
            <textarea className={inputCls + " sm:col-span-3"} rows={2} value={spec.header_notes} onChange={(e) => setSpec({ ...spec, header_notes: e.target.value })} placeholder="تعليمات عامة" />
          </div>
          {spec.sections.map((s, i) => (
            <div key={i} className="grid items-center gap-2 rounded-xl bg-muted/50 p-2 sm:grid-cols-12">
              <input className={inputCls + " sm:col-span-3"} value={s.title} onChange={(e) => updSpec(i, { title: e.target.value })} />
              <input className={inputCls + " sm:col-span-2"} value={s.kind} onChange={(e) => updSpec(i, { kind: e.target.value })} />
              <input className={inputCls + " sm:col-span-3"} value={s.instructions || ""} onChange={(e) => updSpec(i, { instructions: e.target.value })} placeholder="التعليمات" />
              <input className={inputCls + " sm:col-span-1"} type="number" value={s.count} onChange={(e) => updSpec(i, { count: Number(e.target.value) })} title="العدد" />
              <input className={inputCls + " sm:col-span-2"} type="number" step="0.5" value={s.score_each} onChange={(e) => updSpec(i, { score_each: Number(e.target.value) })} title="درجة البند" />
              <button onClick={() => setSpec({ ...spec, sections: spec.sections.filter((_, n) => n !== i) })} className="text-destructive sm:col-span-1"><Trash2 className="mx-auto h-4 w-4" /></button>
            </div>
          ))}
          <div className="flex flex-wrap items-center gap-3">
            <button onClick={() => setSpec({ ...spec, sections: [...spec.sections, { title: `السؤال ${spec.sections.length + 1}`, kind: "مقالي", count: 1, score_each: 1, instructions: "" }] })} className="inline-flex items-center gap-1 rounded-xl bg-muted px-3 py-2 text-xs font-bold"><Plus className="h-4 w-4" /> قسم</button>
            <button onClick={storeSpec} className="inline-flex items-center gap-1 rounded-xl bg-muted px-3 py-2 text-xs font-bold"><FolderPlus className="h-4 w-4" /> حفظ المواصفات للصف</button>
            <span className={`text-xs font-black ${specSum === Number(spec.total_score) ? "text-emerald-600" : "text-destructive"}`}>مجموع الأقسام: {specSum} / {spec.total_score}</span>
            <button disabled={busy} onClick={generate} className="ms-auto inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-black text-primary-foreground">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScrollText className="h-4 w-4" />} توليد الامتحان
            </button>
          </div>
        </div>
      )}

      {/* Step 3: editor */}
      {spec && sections && (
        <div className="mt-4 space-y-4 rounded-2xl border p-4">
          <div className={`flex items-center gap-2 rounded-xl p-3 text-sm font-black ${examSum === Number(spec.total_score) && !countIssues.length ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
            {examSum === Number(spec.total_score) && !countIssues.length ? <CheckCircle2 className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
            مجموع الدرجات: {examSum} / {spec.total_score}{countIssues.length ? ` — عدد البنود لا يطابق المواصفات في: ${countIssues.join("، ")}` : " — مطابق للمواصفات"}
          </div>
          {sections.map((s, si) => (
            <div key={si} className="space-y-2">
              <div className="font-black">{s.title} — {s.instructions || s.kind}</div>
              {s.questions.map((q, qi) => (
                <div key={qi} className="grid gap-2 rounded-xl border p-3 sm:grid-cols-12">
                  <span className="pt-2 text-sm font-black sm:col-span-1">{qi + 1}-</span>
                  <textarea className={inputCls + " sm:col-span-8"} rows={2} value={q.prompt} onChange={(e) => updQ(si, qi, { prompt: e.target.value })} />
                  <input className={inputCls + " sm:col-span-1"} type="number" step="0.5" value={q.score} onChange={(e) => updQ(si, qi, { score: Number(e.target.value) })} title="الدرجة" />
                  <input className={inputCls + " sm:col-span-1"} type="number" min={0} value={q.lines} onChange={(e) => updQ(si, qi, { lines: Number(e.target.value) })} title="أسطر الإجابة" />
                  <button onClick={() => setSections(sections.map((x, n) => n !== si ? x : { ...x, questions: x.questions.filter((_, m) => m !== qi) }))} className="text-destructive sm:col-span-1"><Trash2 className="mx-auto h-4 w-4" /></button>
                  <input className={inputCls + " sm:col-span-6 sm:col-start-2"} placeholder="الاختيارات مفصولة بـ |" value={q.options.join(" | ")} onChange={(e) => updQ(si, qi, { options: e.target.value.split("|").map((x) => x.trim()).filter(Boolean) })} />
                  <input className={inputCls + " sm:col-span-5"} placeholder="الإجابة النموذجية" value={q.answer} onChange={(e) => updQ(si, qi, { answer: e.target.value })} />
                </div>
              ))}
              <button onClick={() => setSections(sections.map((x, n) => n !== si ? x : { ...x, questions: [...x.questions, { prompt: "", options: [], answer: "", score: x.score_each, lines: 2 }] }))} className="inline-flex items-center gap-1 rounded-xl bg-muted px-3 py-1.5 text-xs font-bold"><Plus className="h-3 w-3" /> بند</button>
            </div>
          ))}
          <div className="flex flex-wrap gap-2 border-t pt-4">
            <button onClick={() => exportDocx(spec, sections, info, false).catch((e) => toast.error(e.message))} className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-black text-primary-foreground"><FileDown className="h-4 w-4" /> تصدير Word</button>
            <button onClick={() => exportDocx(spec, sections, info, true).catch((e) => toast.error(e.message))} className="inline-flex items-center gap-2 rounded-xl bg-muted px-4 py-2.5 text-sm font-black"><FileDown className="h-4 w-4" /> نموذج الإجابة Word</button>
            <button onClick={() => printPreview(spec, sections, info)} className="inline-flex items-center gap-2 rounded-xl bg-muted px-4 py-2.5 text-sm font-black"><Printer className="h-4 w-4" /> معاينة الطباعة</button>
          </div>
        </div>
      )}
    </Modal>
  );
}

export function SourcePicker({ grade, term, value, onChange }: { grade: string; term?: string; value: string[]; onChange: (v: string[]) => void }) {
  const listFn = useServerFn(listSources);
  const [rows, setRows] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  useEffect(() => { listFn({ data: { grade, term } }).then((r: any) => setRows(Array.isArray(r) ? r.filter((x: any) => x.status === "indexed") : [])).catch(() => setRows([])); }, [grade, term]);
  return (
    <div className="mt-6 rounded-2xl border bg-card p-4" dir="rtl">
      <button type="button" onClick={() => setOpen(!open)} className="inline-flex items-center gap-2 rounded-xl border-2 border-primary/30 px-4 py-2 text-sm font-black text-primary">
        <FolderPlus className="h-4 w-4" /> اختيار المصدر ({value.length})
      </button>
      {open && (
        <div className="mt-3 flex flex-wrap gap-2">
          {rows.length === 0 && <span className="text-xs font-bold text-muted-foreground">لا توجد مصادر محفوظة لهذا الصف — أضفها من زر «إضافة مصدر».</span>}
          {rows.map((s) => (
            <button type="button" key={s.id} onClick={() => onChange(value.includes(s.id) ? value.filter((x) => x !== s.id) : [...value, s.id])}
              className={`rounded-full border px-3 py-1 text-xs font-bold ${value.includes(s.id) ? "border-primary bg-primary/10 text-primary" : ""}`}>
              {s.title}{s.lesson ? ` • ${s.lesson}` : ""}{s.subject ? ` • ${s.subject}` : ""}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function PaperExamButtons() {
  const [open, setOpen] = useState<"sources" | "paper" | null>(null);
  return (
    <>
      <button onClick={() => setOpen("sources")} className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 rounded-xl border-2 border-primary/30 bg-card px-4 py-2.5 text-sm font-bold text-primary transition-all hover:scale-105"><FolderPlus className="h-5 w-5" /> إضافة مصدر</button>
      <button onClick={() => setOpen("paper")} className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 rounded-xl border-2 border-primary/30 bg-card px-4 py-2.5 text-sm font-bold text-primary transition-all hover:scale-105"><ScrollText className="h-5 w-5" /> امتحان ورقي</button>
      {open === "sources" && <SourcesManager onClose={() => setOpen(null)} />}
      {open === "paper" && <PaperExamBuilder onClose={() => setOpen(null)} />}
    </>
  );
}

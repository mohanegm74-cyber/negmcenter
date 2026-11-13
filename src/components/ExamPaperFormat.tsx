import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, FileDown, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { GRADES } from "@/lib/exam-constants";
import { defaultFormat, gradeFamily, orderedSections, formatWarnings, type FormatExam, type FormatSettings } from "@/lib/exam-format";
import { createFormatDocx, createFormatPdf, downloadFormat } from "@/lib/exam-format-export";

const field = "mt-1 w-full rounded-lg border border-input bg-background p-2 text-sm font-normal";
export function ExamPaperFormat({ exam }: { exam: FormatExam | null }) {
  const [settings, setSettings] = useState(defaultFormat);
  const [grade, setGrade] = useState(exam?.grade || GRADES[0]);
  const [answers, setAnswers] = useState(false);
  const [pdfUrl, setPdfUrl] = useState("");
  const [previewBusy, setPreviewBusy] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [owner, setOwner] = useState("");
  useEffect(() => { supabase.auth.getUser().then(({ data }) => setOwner(data.user?.id || "")); }, []);
  useEffect(() => { if (exam?.grade) setGrade(exam.grade); }, [exam?.grade]);
  useEffect(() => {
    if (!owner) return;
    try { const stored = localStorage.getItem(`exam-format:${owner}:${gradeFamily(grade)}`); setSettings(stored ? { ...defaultFormat(), ...JSON.parse(stored), order: [] } : defaultFormat()); }
    catch { setSettings(defaultFormat()); }
  }, [owner, gradeFamily(grade)]);
  const current = exam ? { ...exam, grade } : null;
  useEffect(() => {
    if (!current) return;
    let cancelled = false; let url = "";
    setPreviewBusy(true); setError("");
    const timer = setTimeout(() => {
      createFormatPdf(current, settings, answers).then(blob => { if (!cancelled) { url = URL.createObjectURL(blob); setPdfUrl(url); } }).catch(e => { if (!cancelled) setError(e.message); }).finally(() => { if (!cancelled) setPreviewBusy(false); });
    }, 350);
    return () => { cancelled = true; clearTimeout(timer); if (url) URL.revokeObjectURL(url); };
  }, [exam, grade, settings, answers]);
  const update = <K extends keyof FormatSettings>(key: K, value: FormatSettings[K]) => setSettings(s => ({ ...s, [key]: value }));
  async function save() {
    if (!owner) return toast.error("تعذر تحديد حساب الأستاذ لحفظ القالب");
    try { localStorage.setItem(`exam-format:${owner}:${gradeFamily(grade)}`, JSON.stringify({ ...settings, order: [] })); toast.success("تم حفظ القالب لهذا الصف على هذا الجهاز"); } catch { toast.error("تعذر حفظ القالب على الجهاز"); }
  }
  async function exportFile(extension: "pdf" | "docx", model: boolean) {
    if (!current) return;
    setBusy(true);
    try { const blob = extension === "pdf" ? await createFormatPdf(current, settings, model) : await createFormatDocx(current, settings, model); downloadFormat(blob, current.title, model, extension); }
    catch (e) { toast.error(e instanceof Error ? e.message : "تعذر تصدير الملف"); }
    finally { setBusy(false); }
  }
  function move(position: number, direction: number) {
    if (!current) return;
    const order = orderedSections(current, settings).map(s => s.originalIndex);
    const target = position + direction; if (target < 0 || target >= order.length) return;
    [order[position], order[target]] = [order[target], order[position]]; update("order", order);
  }
  return <section className="space-y-4" dir="rtl">
    <div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 text-xs font-bold">
          <label>قالب الامتحان<select className={field} value={settings.template} onChange={e => update("template", e.target.value as FormatSettings["template"])}><option value="school">مدرسي ملون</option><option value="mono">مدرسي أسود وأبيض</option></select></label>
          <label>الصف الدراسي<select className={field} value={grade} onChange={e => setGrade(e.target.value)}>{GRADES.map(g => <option key={g}>{g}</option>)}</select></label>
          <label className="col-span-2">نمط الورقة<select className={field} value={settings.mode} onChange={e => update("mode", e.target.value as FormatSettings["mode"])}><option value="compact">امتحان مضغوط</option><option value="answers">امتحان بمساحات للإجابة</option></select></label>
          <label>نوع الخط<select className={field} value={settings.font} onChange={e => update("font", e.target.value as FormatSettings["font"])}><option>Arial</option><option>Noto Naskh Arabic</option></select></label>
          <label>حجم الخط<input type="number" min={10} max={20} className={field} value={settings.size} onChange={e => update("size", Math.min(20, Math.max(10, +e.target.value)))} /></label>
          <label>الهوامش (مم)<input type="number" min={8} max={25} className={field} value={settings.margin} onChange={e => update("margin", Math.min(25, Math.max(8, +e.target.value)))} /></label>
          <label>المسافات (مم)<input type="number" min={1} max={8} className={field} value={settings.spacing} onChange={e => update("spacing", Math.min(8, Math.max(1, +e.target.value)))} /></label>
          <label>مساحة الإجابة<select className={field} value={settings.answerScale} onChange={e => update("answerScale", +e.target.value)}><option value={0.75}>صغيرة</option><option value={1}>متوسطة</option><option value={1.5}>واسعة</option></select></label>
          <label>ألوان العناوين<select className={field} value={settings.heading} onChange={e => update("heading", e.target.value as FormatSettings["heading"])}><option value="blue">أزرق وأحمر</option><option value="red">أحمر مدرسي</option></select></label>
          <label className="col-span-2 flex items-center gap-2"><input type="checkbox" checked={settings.border} onChange={e => update("border", e.target.checked)} /> الإطار الخارجي</label>
          <label className="col-span-2">رأس الصفحة<input className={field} value={settings.header} onChange={e => update("header", e.target.value)} /></label>
          <label className="col-span-2">تذييل الصفحة<input className={field} value={settings.footer} onChange={e => update("footer", e.target.value)} /></label>
          <label className="col-span-2">تعليمات التنسيق<textarea rows={2} className={field} value={settings.instructions} onChange={e => update("instructions", e.target.value)} /></label>
        </div>
        {current && <div className="space-y-2 border-t pt-3"><h3 className="text-sm font-bold">ترتيب الأقسام</h3>{orderedSections(current, settings).map((s, i, all) => <div key={s.originalIndex} className="flex items-center gap-2 text-sm"><span className="min-w-0 flex-1 break-words">{s.title}</span><Button size="icon" variant="ghost" aria-label={`رفع ${s.title}`} disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp className="h-4 w-4" /></Button><Button size="icon" variant="ghost" aria-label={`خفض ${s.title}`} disabled={i === all.length - 1} onClick={() => move(i, 1)}><ArrowDown className="h-4 w-4" /></Button></div>)}</div>}
        <Button variant="outline" className="w-full" onClick={save}><Save className="h-4 w-4" /> حفظ التنسيق كقالب افتراضي</Button>
      </div>
      <div className="min-w-0 space-y-3">
        <div className="flex items-center justify-between gap-2"><h3 className="font-bold">معاينة الامتحان — A4</h3><select aria-label="نوع المعاينة" className="rounded-lg border bg-background p-2 text-sm" value={answers ? "answers" : "exam"} onChange={e => setAnswers(e.target.value === "answers")}><option value="exam">ورقة الامتحان</option><option value="answers">نموذج الإجابة</option></select></div>
        {current && formatWarnings(current).map(w => <p key={w} className="text-sm text-destructive">{w}</p>)}
        {!current ? <div className="flex min-h-80 items-center justify-center border border-dashed p-6 text-center text-sm text-muted-foreground">اختر امتحانًا محفوظًا، أو أكمل إنشاء الامتحان الحالي لعرضه هنا.</div> : <div className="relative">
          {previewBusy && <div className="absolute end-3 top-3 z-10 rounded-lg bg-background p-2"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>}
          {error ? <p role="alert" className="p-6 text-destructive">{error}</p> : pdfUrl && <iframe title="معاينة ورقة الامتحان" src={pdfUrl} className="h-[780px] w-full rounded-lg border bg-muted" />}
        </div>}
        <div className="grid grid-cols-2 gap-2">{([false, true] as const).flatMap(model => (["docx", "pdf"] as const).map(ext => <Button key={`${model}-${ext}`} variant={model ? "outline" : "default"} disabled={!current || busy} className="h-auto whitespace-normal py-3" onClick={() => exportFile(ext, model)}><FileDown className="h-4 w-4 shrink-0" /> {model ? "نموذج الإجابة" : "الامتحان"} {ext === "docx" ? "Word" : "PDF"}</Button>))}</div>
      </div>
    </div>
  </section>;
}
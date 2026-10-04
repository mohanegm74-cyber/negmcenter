import { GradeGroupFilter, filterByGradeGroup } from "@/components/GradeGroupFilter";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, X, Loader2, Calendar, UploadCloud, Users, GraduationCap, Send, Sparkles, FileText } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { getLessonsAdmin, createLessonUploadUrlAdmin, saveLessonAdmin, publishLessonAdmin, deleteLessonAdmin, generateLessonDraftAdmin } from "@/lib/admin.functions";
import { GRADES } from "@/lib/exam-constants";

export const Route = createFileRoute("/_authenticated/lessons")({
  head: () => ({
    meta: [
      { title: "شرح الدروس — لوحة الأستاذ" },
      { name: "description", content: "إنشاء شرح الدروس ورفع ملفات PDF أو صور وتحرير الشرح والأسئلة ونشرها للطلاب." },
      { property: "og:title", content: "شرح الدروس — لوحة الأستاذ" },
      { property: "og:description", content: "إنشاء شرح الدروس ورفع ملفات PDF أو صور وتحرير الشرح والأسئلة ونشرها للطلاب." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LessonsPage,
});

type Group = { id: string; name: string; grade: string | null };
type LessonFile = { path: string; url: string };
type Lesson = {
  id: string; group_id: string | null; grade: string | null; subject: string | null; title: string;
  date: string; published: boolean; paths: string[]; files: LessonFile[];
  explanation: string | null; vocabulary: string | null; qa: string | null; beauty: string | null;
  rhetoric: string | null; grammar: string | null; exercises: string | null;
};

const SECTIONS: { key: keyof Lesson; label: string; ph: string }[] = [
  { key: "explanation", label: "الشرح", ph: "اكتب شرح الدرس هنا..." },
  { key: "vocabulary", label: "معاني الكلمات", ph: "الكلمة : المعنى" },
  { key: "qa", label: "أسئلة وإجابات", ph: "س: ...\nج: ..." },
  { key: "beauty", label: "مواطن الجمال", ph: "موطن الجمال وسببه..." },
  { key: "rhetoric", label: "البلاغة", ph: "الصور البلاغية..." },
  { key: "grammar", label: "النحو والإعراب", ph: "القواعد والإعراب..." },
  { key: "exercises", label: "التدريبات", ph: "تدريبات على الدرس..." },
];

/** استخراج نص الملف على جهاز المستخدم (PDF / PowerPoint PPTX). */
async function extractLessonText(path: string, buf: ArrayBuffer): Promise<string> {
  if (path.endsWith(".pdf")) {
    const { extractText, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(new Uint8Array(buf));
    const res = await extractText(pdf, { mergePages: true });
    return String(res.text || "");
  }
  if (path.endsWith(".pptx")) {
    const JSZip = (await import("jszip")).default;
    const zip = await JSZip.loadAsync(buf);
    const slides = Object.keys(zip.files)
      .filter(n => /^ppt\/slides\/slide\d+\.xml$/.test(n))
      .sort((a, b) => Number(a.match(/\d+/g)!.pop()) - Number(b.match(/\d+/g)!.pop()));
    const out: string[] = [];
    for (const s of slides) {
      const xml = await zip.files[s].async("string");
      const parts = Array.from(xml.matchAll(/<a:t>([^<]*)<\/a:t>/g)).map(m => m[1]);
      out.push(parts.join(" ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"'));
    }
    return out.join("\n");
  }
  return "";
}


function LessonsPage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [gf, setGf] = useState({ grade: "", group: "" });
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [editing, setEditing] = useState<Lesson | null>(null);

  const loadFn = useServerFn(getLessonsAdmin);
  const urlFn = useServerFn(createLessonUploadUrlAdmin);
  const saveFn = useServerFn(saveLessonAdmin);
  const pubFn = useServerFn(publishLessonAdmin);
  const delFn = useServerFn(deleteLessonAdmin);
  const aiFn = useServerFn(generateLessonDraftAdmin);

  async function load() {
    setLoading(true);
    try {
      const res = await loadFn({});
      setGroups(res.groups as Group[]);
      setLessons(res.lessons as Lesson[]);
    } catch { toast.error("فشل تحميل الدروس"); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  function openNew() { setEditing(null); setFiles([]); setOpen(true); }
  function openEdit(l: Lesson) { setEditing(l); setFiles([]); setOpen(true); }

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const fd = new FormData(e.currentTarget);
    try {
      const paths: string[] = editing ? [...(editing.paths || [])] : [];
      for (const f of files) {
        const { path, token } = await urlFn({ data: { filename: f.name } });
        const { error } = await supabase.storage.from("lesson-files").uploadToSignedUrl(path, token, f);
        if (error) throw new Error(error.message);
        paths.push(path);
      }
      const payload: Record<string, any> = {
        group_id: String(fd.get("group_id") || "") || null,
        grade: String(fd.get("grade") || "") || null,
        subject: String(fd.get("subject") || "").trim() || null,
        title: String(fd.get("title") || "").trim(),
        date: String(fd.get("date") || new Date().toISOString().slice(0, 10)),
        paths,
      };
      for (const s of SECTIONS) payload[s.key as string] = String(fd.get(s.key as string) || "").trim() || null;
      await saveFn({ data: { id: editing?.id, payload } });
      toast.success("تم حفظ الدرس");
      setOpen(false); setFiles([]); setEditing(null); load();
    } catch (err: any) { toast.error(err.message || "فشل الحفظ"); }
    finally { setBusy(false); }
  }

  async function togglePublish(l: Lesson) {
    try { await pubFn({ data: { id: l.id, published: !l.published } }); toast.success(l.published ? "تم إلغاء النشر" : "تم نشر الدرس للطلاب"); load(); }
    catch (e: any) { toast.error(e.message); }
  }

  async function remove(id: string) {
    if (!confirm("حذف هذا الدرس؟")) return;
    try { await delFn({ data: { id } }); toast.success("تم الحذف"); load(); }
    catch (e: any) { toast.error(e.message); }
  }

  const [aiBusy, setAiBusy] = useState<string | null>(null);
  async function aiDraft(l: Lesson) {
    const hasContent = SECTIONS.some(s => (l[s.key] as string)?.trim());
    if (hasContent && !confirm("سيتم استبدال الشرح والأسئلة الحالية بمسودة AI. متابعة؟")) return;
    setAiBusy(l.id);
    const t = toast.loading("جاري قراءة الملفات وإنشاء المسودة...");
    try {
      let text = "";
      for (let i = 0; i < (l.files || []).length; i++) {
        const path = (l.paths?.[i] || l.files[i].path || "").toLowerCase();
        try {
          const buf = await (await fetch(l.files[i].url)).arrayBuffer();
          text += "\n\n" + (await extractLessonText(path, buf));
        } catch (e) { console.error("extract failed", e); }
        if (text.length > 60000) break;
      }
      const res: any = await aiFn({ data: { id: l.id, text: text.trim() } });
      toast.success(res?.message || "تم إنشاء المسودة", { id: t });
      load();
    } catch (e: any) { toast.error(e.message || "فشل إنشاء المسودة", { id: t }); }
    finally { setAiBusy(null); }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-primary flex items-center gap-2"><GraduationCap className="h-6 w-6" /> شرح الدروس</h1>
          <p className="text-xs text-muted-foreground">أنشئ الدرس، ارفع ملفاته، حرّر الشرح والأسئلة ثم انشره للطلاب.</p>
        </div>
        <button onClick={openNew} className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-black text-primary-foreground shadow">
          <Plus className="h-4 w-4" /> درس جديد
        </button>
      </div>

<GradeGroupFilter items={lessons} groups={groups} value={gf} onChange={setGf} />

      {loading ? (
        <div className="flex justify-center p-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : lessons.length === 0 ? (
        <div className="rounded-2xl border border-dashed bg-white p-12 text-center text-sm text-muted-foreground">لا توجد دروس بعد</div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filterByGradeGroup(lessons, gf).map((l) => (
            <div key={l.id} className="rounded-2xl border bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-start justify-between gap-2">
                <div>
                  <div className="font-black">{l.title}</div>
                  <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                    <span className="inline-flex items-center gap-1"><Calendar className="h-3 w-3" /> {new Date(l.date + "T00:00:00").toLocaleDateString("ar-EG")}</span>
                    <span className="inline-flex items-center gap-1"><Users className="h-3 w-3" /> {groups.find(g => g.id === l.group_id)?.name || l.grade || "الجميع"}</span>
                    {l.subject && <span>{l.subject}</span>}
                    <span className={`rounded-full px-2 py-0.5 font-bold ${l.published ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>{l.published ? "منشور" : "مسودة"}</span>
                  </div>
                </div>
                <button onClick={() => remove(l.id)} className="rounded-lg bg-destructive/10 p-2 text-destructive hover:bg-destructive/15"><Trash2 className="h-4 w-4" /></button>
              </div>
              {l.files?.length > 0 && (
                <div className="mb-3 flex flex-wrap gap-2">
                  {l.files.map((f, i) => (
                    <a key={i} href={f.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] hover:bg-accent"><FileText className="h-3 w-3" /> ملف {i + 1}</a>
                  ))}
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <button onClick={() => openEdit(l)} className="rounded-lg border px-3 py-1.5 text-xs font-bold hover:bg-accent">تعديل الشرح والأسئلة</button>
                <button disabled={aiBusy === l.id} onClick={() => aiDraft(l)} className="inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-bold hover:bg-accent disabled:opacity-60">{aiBusy === l.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />} مسودة AI</button>
                <button onClick={() => togglePublish(l)} className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-black ${l.published ? "bg-amber-100 text-amber-700" : "bg-primary text-primary-foreground"}`}>
                  <Send className="h-3.5 w-3.5" /> {l.published ? "إلغاء النشر" : "نشر للطلاب"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <form onSubmit={save} className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-black">{editing ? "تعديل الدرس" : "درس جديد"}</h2>
              <button type="button" onClick={() => setOpen(false)} className="rounded-lg p-1 hover:bg-accent"><X className="h-5 w-5" /></button>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-bold">عنوان الدرس</label>
                  <input name="title" required defaultValue={editing?.title || ""} className="w-full rounded-xl border px-3 py-2 text-sm" placeholder="مثال: درس الأمانة" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold">المادة</label>
                  <input name="subject" defaultValue={editing?.subject || ""} className="w-full rounded-xl border px-3 py-2 text-sm" placeholder="اللغة العربية" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-bold">المجموعة</label>
                  <select name="group_id" defaultValue={editing?.group_id || ""} className="w-full rounded-xl border px-3 py-2 text-sm">
                    <option value="">كل المجموعات</option>
                    {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold">الصف</label>
                  <select name="grade" defaultValue={editing?.grade || ""} className="w-full rounded-xl border px-3 py-2 text-sm">
                    <option value="">كل الصفوف</option>
                    {GRADES.map((g: string) => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold">التاريخ</label>
                  <input type="date" name="date" defaultValue={editing?.date || new Date().toISOString().slice(0, 10)} className="w-full rounded-xl border px-3 py-2 text-sm" />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold">ملفات الدرس (PDF أو صور)</label>
                <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed p-4 text-sm text-muted-foreground hover:bg-accent">
                  <UploadCloud className="h-5 w-5" /> اختر ملفًا أو أكثر
                  <input type="file" accept="application/pdf,image/*" multiple className="hidden" onChange={(e) => { if (e.target.files) setFiles(prev => [...prev, ...Array.from(e.target.files!)]); }} />
                </label>
                {files.length > 0 && (
                  <ul className="mt-2 space-y-1 text-[11px] text-muted-foreground">
                    {files.map((f, i) => (
                      <li key={i} className="flex items-center justify-between rounded-lg border px-2 py-1">
                        <span className="truncate">{f.name}</span>
                        <button type="button" onClick={() => setFiles(files.filter((_, j) => j !== i))} className="text-destructive"><X className="h-3 w-3" /></button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              {SECTIONS.map((s) => (
                <div key={s.key as string}>
                  <label className="mb-1 block text-xs font-bold">{s.label}</label>
                  <textarea name={s.key as string} defaultValue={(editing?.[s.key] as string) || ""} rows={4} placeholder={s.ph} className="w-full whitespace-pre-wrap rounded-xl border px-3 py-2 text-sm" />
                </div>
              ))}
            </div>
            <button disabled={busy} className="mt-5 w-full rounded-xl bg-primary py-2.5 text-sm font-black text-primary-foreground disabled:opacity-60">
              {busy ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : "حفظ الدرس"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

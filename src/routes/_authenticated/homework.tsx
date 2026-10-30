import { GradeGroupFilter, filterByGradeGroup } from "@/components/GradeGroupFilter";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Pencil, X, Printer, BookOpen, Loader2, FileText, ImageIcon, Eye, CheckCircle2, ChevronDown, ChevronUp } from "lucide-react";
import { openPrint, esc } from "@/lib/print";
import { useServerFn } from "@tanstack/react-start";
import { getHomeworkDataAdmin, saveHomeworkAdmin, upsertHomeworkSubmissionAdmin, deleteHomeworkAdmin, getHomeworkSubmissionFileUrl, releaseHomeworkResultsAdmin, createLessonUploadUrlAdmin, getHomeworkAttachmentUrlsAdmin } from "@/lib/admin.functions";
import { supabase } from "@/integrations/supabase/client";
import { GRADES } from "@/lib/exam-constants";

export const Route = createFileRoute("/_authenticated/homework")({
  head: () => ({ meta: [{ title: "الواجبات والتقييم — الأستاذ" }] }),
  component: HomeworkPage,
});

type Group = { id: string; name: string; grade: string | null };
type HW = { id: string; group_id: string | null; title: string; description: string | null; due_date: string | null; max_score: number | null; grade: string | null; model_solution?: string | null; attachment_paths?: string[] | null; results_released?: boolean; created_at?: string };
type Student = { id: string; full_name: string; code: string; group_id: string | null; grade?: string | null };
type Sub = { id: string; homework_id: string; student_id: string; score: number | null; level: string | null; status: string; note: string | null; answer_text: string | null; file_url: string | null; file_urls?: string[] | null };
const EVALUATION_LEVELS = ["ممتاز", "جيد جداً", "جيد", "متوسط", "ضعيف"];
function evaluationLevel(sub?: Pick<Sub, "level" | "score">, maxScore?: number | null) {
  if (sub?.level) return sub.level;
  if (sub?.score == null || !maxScore) return null;
  const percentage = Number(sub.score) / Number(maxScore) * 100;
  return percentage >= 90 ? "ممتاز" : percentage >= 75 ? "جيد جداً" : percentage >= 60 ? "جيد" : percentage >= 50 ? "متوسط" : "ضعيف";
}

function HomeworkPage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [gf, setGf] = useState({ grade: "", group: "" });
  const [items, setItems] = useState<HW[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [subs, setSubs] = useState<Sub[]>([]);
  const [editing, setEditing] = useState<HW | null>(null);
  const [open, setOpen] = useState(false);
  const [activeHW, setActiveHW] = useState<HW | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, { level: string; note: string; checked: boolean }>>({});
  const [savingAll, setSavingAll] = useState(false);
  const [hwSearch, setHwSearch] = useState("");
  const [hwStatus, setHwStatus] = useState<"all" | "done" | "late">("all");

  const loadFn = useServerFn(getHomeworkDataAdmin);
  const saveHWFn = useServerFn(saveHomeworkAdmin);
  const upsertSubFn = useServerFn(upsertHomeworkSubmissionAdmin);
  const deleteHWFn = useServerFn(deleteHomeworkAdmin);
  const releaseFn = useServerFn(releaseHomeworkResultsAdmin);
  const hwUploadFn = useServerFn(createLessonUploadUrlAdmin);
  const [hwFiles, setHwFiles] = useState<File[]>([]);
  const [keepPaths, setKeepPaths] = useState<string[]>([]);
  useEffect(() => { setKeepPaths(editing?.attachment_paths || []); setHwFiles([]); }, [editing, open]);

  async function load(silent = false) {
    if (!silent) setLoading(true);
    try {
      const res = await loadFn({});
      setGroups(res.groups as Group[]);
      setItems(res.items as HW[]);
      setStudents(res.students as Student[]);
      setSubs(res.subs as Sub[]);
    } catch (e: any) { toast.error("فشل تحميل البيانات"); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);
  useEffect(() => {
    if (!activeHW) return;
    const d: Record<string, { level: string; note: string; checked: boolean }> = {};
    for (const st of students) {
      const sb = subs.find(x => x.homework_id === activeHW.id && x.student_id === st.id);
      d[st.id] = { level: evaluationLevel(sb, activeHW.max_score) || "", note: sb?.note || "", checked: sb?.status === "graded" };
    }
    setDrafts(d);
  }, [activeHW?.id]);
  async function saveAllDrafts() {
    if (!activeHW) return;
    const list = students.filter(s => (!activeHW.group_id || s.group_id === activeHW.group_id) && (!activeHW.grade || s.grade === activeHW.grade));
    const targets = list.filter(s => drafts[s.id] && (drafts[s.id].checked || drafts[s.id].level || drafts[s.id].note));
    if (!targets.length) { toast.info("لا توجد تقييمات لحفظها"); return; }
    setSavingAll(true);
    try {
      for (const s of targets) {
        const d = drafts[s.id];
        const sb = subs.find(x => x.homework_id === activeHW.id && x.student_id === s.id);
        await upsertSubFn({ data: { payload: { student_id: s.id, homework_id: activeHW.id, level: d.level || null, note: d.note || null, status: d.checked || d.level ? "graded" : (sb?.status || "submitted") } } });
      }
      toast.success(`تم حفظ تقييم ${targets.length} طالب`);
      load(true);
    } catch (e: any) { toast.error(e.message); }
    finally { setSavingAll(false); }
  }

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const fd = new FormData(e.currentTarget);
    const payload: any = {
      group_id: String(fd.get("group_id") || "") || null,
      grade: String(fd.get("grade") || "") || null,
      title: String(fd.get("title")).trim(),
      description: String(fd.get("description") || "").trim() || null,
      due_date: String(fd.get("due_date") || "") || null,
      max_score: Number(fd.get("max_score") || 100),
      model_solution: String(fd.get("model_solution") || "").trim() || null,
    };
    try {
      const paths = [...keepPaths];
      for (const f of hwFiles) {
        const { path, token } = await hwUploadFn({ data: { filename: f.name } });
        const { error } = await supabase.storage.from("lesson-files").uploadToSignedUrl(path, token, f);
        if (error) throw new Error("تعذر رفع الملف: " + error.message);
        paths.push(path);
      }
      payload.attachment_paths = paths;
      await saveHWFn({ data: { id: editing?.id, payload } });
      toast.success(editing ? "تم التحديث" : "تم إنشاء الواجب");
      setOpen(false); setEditing(null); load();
    } catch (err: any) { toast.error(err.message); }
    finally { setBusy(false); }
  }

  async function remove(id: string) {
    if (!confirm("حذف هذا الواجب؟")) return;
    try { await deleteHWFn({ data: { id } }); toast.success("تم الحذف"); load(); }
    catch (err: any) { toast.error(err.message); }
  }

  async function toggleRelease(h: HW) {
    try {
      await releaseFn({ data: { id: h.id, released: !h.results_released } });
      toast.success(h.results_released ? "تم إخفاء الحل والدرجات عن الطلاب" : "تم إرسال الحل والدرجات لصفحات الطلاب");
      load();
    } catch (err: any) { toast.error(err.message); }
  }

  const groupMap = useMemo(() => Object.fromEntries(groups.map(g => [g.id, g])), [groups]);

  if (loading) return <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-black flex items-center gap-2"><BookOpen className="h-6 w-6 text-primary" /> الواجبات والتقييم</h1>
        <button onClick={() => { setEditing(null); setOpen(true); }} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"><Plus className="h-4 w-4" /> واجب جديد</button>
      </div>

      {open && (
        <form key={editing?.id || "new"} onSubmit={save} className="mb-6 rounded-2xl bg-white p-6 shadow-sm border border-slate-100 animate-in slide-in-from-top-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-black text-slate-800">{editing ? "تعديل بيانات الواجب" : "إضافة واجب جديد للطلاب"}</h2>
            <button type="button" onClick={() => { setOpen(false); setEditing(null); }} className="rounded p-1 hover:bg-slate-100"><X className="h-4 w-4" /></button>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-black text-muted-foreground uppercase">الصف الدراسي المستهدف</label>
              <select name="grade" defaultValue={editing?.grade || ""} className="w-full rounded-xl border border-input bg-white px-4 py-2.5 text-sm font-bold outline-none focus:ring-2 focus:ring-primary/20">
                <option value="">— اختر الصف (لإرساله للكل) —</option>
                {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-black text-muted-foreground uppercase">المجموعة (اختياري)</label>
              <select name="group_id" defaultValue={editing?.group_id || ""} className="w-full rounded-xl border border-input bg-white px-4 py-2.5 text-sm font-bold outline-none focus:ring-2 focus:ring-primary/20">
                <option value="">— كل مجموعات الصف —</option>
                {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </div>
            <F name="title" label="عنوان الواجب أو الموضوع *" required defaultValue={editing?.title} />
            <F name="due_date" label="آخر موعد للتسليم" type="date" defaultValue={editing?.due_date ?? ""} />
            <F name="max_score" label="الدرجة القصوى" type="number" defaultValue={editing ? String(editing.max_score) : "100"} />
            <div className="md:col-span-2">
              <label className="mb-1.5 block text-xs font-black text-muted-foreground uppercase">المطلوب من الطالب (وصف الواجب)</label>
              <textarea name="description" defaultValue={editing?.description ?? ""} rows={3} className="w-full rounded-xl border border-input px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/20" placeholder="مثال: حل صفحة 40 في الكتاب الوزاري..." />
              <div className="mt-2 rounded-xl border-2 border-dashed border-primary/30 p-3">
                <label className="block text-xs font-black text-primary mb-1.5">إرفاق الواجب صورة أو PDF (اختياري)</label>
                <input type="file" multiple accept="image/*,application/pdf" onChange={(e) => setHwFiles(Array.from(e.target.files || []))} className="text-xs" />
                {keepPaths.length > 0 && <div className="mt-2 flex flex-wrap gap-1.5">{keepPaths.map(p => <span key={p} className="inline-flex items-center gap-1 rounded-lg bg-primary/10 px-2 py-1 text-[10px] font-bold text-primary">{p.split("-").slice(2).join("-") || "ملف"}<button type="button" onClick={() => setKeepPaths(keepPaths.filter(x => x !== p))}><X className="h-3 w-3" /></button></span>)}</div>}
                {hwFiles.length > 0 && <div className="mt-1 text-[10px] font-bold text-muted-foreground">سيتم رفع {hwFiles.length} ملف عند الحفظ</div>}
              </div>
            </div>
            <div className="md:col-span-2">
              <label className="mb-1.5 block text-xs font-black text-primary uppercase">نموذج الحل الصحيح (يظهر للطالب بعد التقييم)</label>
              <textarea name="model_solution" defaultValue={editing?.model_solution ?? ""} rows={3} className="w-full rounded-xl border-primary/20 border-2 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/20" placeholder="اكتب الحل النموذجي هنا ليراه الطالب ويقارنه بحله..." />
            </div>
          </div>
          <button type="submit" disabled={busy} className="mt-6 w-full md:w-auto rounded-xl bg-secondary px-10 py-3 text-sm font-black text-white shadow-lg shadow-secondary/20 hover:opacity-90 disabled:opacity-50 transition-all flex items-center justify-center gap-2">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : editing ? "تحديث الواجب" : "نشر الواجب للطلاب"}
          </button>
        </form>
      )}

      <GradeGroupFilter items={items} groups={groups} value={gf} onChange={setGf} />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filterByGradeGroup(items, gf).map(h => (
          <div key={h.id} className="rounded-[2rem] bg-white p-6 shadow-sm border border-slate-100 hover:border-primary/20 transition-all group">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                   <span className="px-2 py-0.5 rounded-lg bg-primary/5 text-primary text-[9px] font-black uppercase border border-primary/10">{h.grade || "عام"}</span>
                   <span className="px-2 py-0.5 rounded-lg bg-secondary/5 text-secondary text-[9px] font-black uppercase border border-secondary/10">{groupMap[h.group_id || ""]?.name || "الكل"}</span>
                </div>
                <h3 className="text-lg font-black text-slate-800 group-hover:text-primary transition-colors">{h.title}</h3>
                <div className="text-[10px] font-bold text-muted-foreground mt-1">{h.due_date ? `⏰ موعد التسليم: ${h.due_date}` : "مفتوح"}</div>
              </div>
              <div className="flex gap-1">
                <button onClick={() => { setEditing(h); setOpen(true); window.scrollTo({top:0, behavior:'smooth'}); }} className="p-2 text-primary hover:bg-primary/5 rounded-xl transition-all"><Pencil className="h-4 w-4" /></button>
                <button onClick={() => remove(h.id)} className="p-2 text-destructive hover:bg-rose-50 rounded-xl transition-all"><Trash2 className="h-4 w-4" /></button>
              </div>
            </div>
            {h.description && <p className="mt-3 text-xs text-slate-600 line-clamp-2 italic leading-relaxed">"{h.description}"</p>}
            {(h.attachment_paths?.length ?? 0) > 0 && <HWAttachments paths={h.attachment_paths!} />}

            <details className="mt-4 rounded-2xl bg-slate-50 border border-slate-100 p-3">
              <summary className="cursor-pointer text-[10px] font-black text-slate-500 uppercase select-none">نسخة الواجب المُرسل (تفاصيل ما تم إرساله)</summary>
              <div className="mt-3 space-y-1.5 text-[11px] font-bold text-slate-600">
                <div>العنوان: {h.title}</div>
                <div>الصف: {h.grade || "كل الصفوف"} — المجموعة: {groupMap[h.group_id || ""]?.name || "الكل"}</div>
                <div>الدرجة القصوى: {h.max_score ?? "—"} — التسليم: {h.due_date || "مفتوح"}</div>
                <div>تاريخ الإرسال: {h.created_at ? new Date(h.created_at).toLocaleString("ar-EG") : "—"}</div>
                <div>عدد الطلاب المستهدفين: {students.filter(s => (!h.group_id || s.group_id === h.group_id) && (!h.grade || s.grade === h.grade)).length}</div>
                <div>عدد من سلّم: {subs.filter(x => x.homework_id === h.id && (x.answer_text || x.file_url)).length}</div>
                <div className="pt-1.5 border-t border-dashed">المطلوب: {h.description || "—"}</div>
                <div>نموذج الحل: {h.model_solution || "لم يُضف بعد"}</div>
              </div>
            </details>
            <div className="mt-4">
              <button onClick={() => toggleRelease(h)} className={`w-full rounded-2xl px-4 py-2.5 text-xs font-black transition-all ${h.results_released ? "bg-emerald-600 text-white shadow-lg shadow-emerald-600/20" : "bg-amber-50 text-amber-700 border-2 border-amber-200 hover:bg-amber-100"}`}>
                {h.results_released ? "✓ تم إرسال الحل والدرجات للطلاب (اضغط للإخفاء)" : "إرسال الحل والدرجات للطلاب"}
              </button>
            </div>
            <div className="mt-3 flex gap-2">
              <button onClick={() => setActiveHW(h)} className="flex-1 rounded-2xl bg-primary px-4 py-2.5 text-xs font-black text-white shadow-lg shadow-primary/20 hover:scale-[1.02] transition-all">تقييم حلول الطلاب</button>
              <button onClick={() => {
                const list = students.filter(s => (!h.group_id || s.group_id === h.group_id) && (!h.grade || s.grade === h.grade));
                const rowsHtml = list.map((s, i) => {
                  const sub = subs.find(x => x.homework_id === h.id && x.student_id === s.id);
                  return `<tr><td>${i + 1}</td><td>${esc(s.full_name)}</td><td>${esc(s.code)}</td><td>${esc(sub?.status === 'submitted' ? 'تم الحل' : sub?.status === 'graded' ? 'تم التقييم' : 'لم يحل')}</td><td>${esc(evaluationLevel(sub, h.max_score) || "—")}</td></tr>`;
                }).join("");
                 openPrint(`واجب: ${h.title}`, `<h2>${esc(h.title)} — ${esc(h.grade || "")} — ${esc(groupMap[h.group_id || ""]?.name || "كل المجموعات")}</h2><table><thead><tr><th>#</th><th>الطالب</th><th>الكود</th><th>الحالة</th><th>المستوى</th></tr></thead><tbody>${rowsHtml}</tbody></table>`);
              }} className="inline-flex items-center gap-1.5 rounded-2xl bg-slate-100 px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-200 transition-all"><Printer className="h-4 w-4" /> طباعة</button>
            </div>
          </div>
        ))}
        {items.length === 0 && <div className="col-span-full py-20 text-center text-muted-foreground font-bold border-2 border-dashed rounded-[2.5rem] bg-white">لا توجد واجبات منشورة حالياً. ابدأ بإضافة واجب جديد.</div>}
      </div>

      {activeHW && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={() => setActiveHW(null)}>
          <div className="w-full max-w-5xl max-h-[90vh] bg-white rounded-[2.5rem] shadow-2xl flex flex-col animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b flex justify-between items-center bg-slate-50 rounded-t-[2.5rem]">
              <div>
                <h2 className="text-xl font-black text-slate-800 flex items-center gap-2"><CheckCircle2 className="h-6 w-6 text-emerald-500" /> تقييم إجابات: {activeHW.title}</h2>
                <p className="text-[10px] text-muted-foreground font-bold mt-1 uppercase">إجمالي الطلاب المتاحين: {students.filter(s => (!activeHW.group_id || s.group_id === activeHW.group_id) && (!activeHW.grade || s.grade === activeHW.grade)).length}</p>
              </div>
              <button onClick={() => setActiveHW(null)} className="p-2 hover:bg-white rounded-full transition-all text-slate-400"><X className="h-7 w-7" /></button>
            </div>
            
            <div className="flex flex-wrap items-center gap-2 border-b px-6 py-3">
              <input value={hwSearch} onChange={e => setHwSearch(e.target.value)} placeholder="بحث باسم الطالب أو الكود" className="flex-1 min-w-[180px] rounded-lg border bg-white px-3 py-2 text-sm font-bold" />
              {([["all", "الكل"], ["done", "قام بالواجب"], ["late", "متأخر / لم يسلّم"]] as const).map(([k, l]) => {
                const base = students.filter(s => (!activeHW.group_id || s.group_id === activeHW.group_id) && (!activeHW.grade || s.grade === activeHW.grade));
                const isDone = (id: string) => { const x = subs.find(y => y.homework_id === activeHW.id && y.student_id === id); return !!(x && (x.answer_text || x.file_url)); };
                const n = k === "all" ? base.length : base.filter(s => k === "done" ? isDone(s.id) : !isDone(s.id)).length;
                return <button key={k} onClick={() => setHwStatus(k)} className={`rounded-full border px-3 py-1.5 text-xs font-black ${hwStatus === k ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-muted"}`}>{l} ({n})</button>;
              })}
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {students.filter(s => (!activeHW.group_id || s.group_id === activeHW.group_id) && (!activeHW.grade || s.grade === activeHW.grade))
                .filter(s => !hwSearch || `${s.full_name} ${(s as any).code || ""}`.toLocaleLowerCase().includes(hwSearch.toLocaleLowerCase()))
                .filter(s => { if (hwStatus === "all") return true; const x = subs.find(y => y.homework_id === activeHW.id && y.student_id === s.id); const d = !!(x && (x.answer_text || x.file_url)); return hwStatus === "done" ? d : !d; })
                .map(s => (
                <StudentSubmissionRow key={s.id} student={s} hw={activeHW} sub={subs.find(x => x.homework_id === activeHW.id && x.student_id === s.id)} onUpdate={() => load(true)}
                  draft={drafts[s.id] || { level: "", note: "", checked: false }}
                  setDraft={(patch) => setDrafts(prev => ({ ...prev, [s.id]: { ...(prev[s.id] || { level: "", note: "", checked: false }), ...patch } }))} />
              ))}
            </div>
            <div className="p-4 border-t bg-slate-50 rounded-b-[2.5rem] flex flex-wrap items-center justify-between gap-3">
              <span className="text-xs font-bold text-slate-500">المُعلَّم بعلامة ✓: {Object.values(drafts).filter(d => d.checked).length}</span>
              <div className="flex gap-2">
                <button onClick={saveAllDrafts} disabled={savingAll} className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-5 py-2.5 text-xs font-black text-white shadow-lg disabled:opacity-60">{savingAll ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} حفظ الصفحة كلها</button>
                <button onClick={() => setActiveHW(null)} className="rounded-2xl bg-slate-200 px-5 py-2.5 text-xs font-black text-slate-700">إغلاق</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

type Draft = { level: string; note: string; checked: boolean };
function StudentSubmissionRow({ student, hw, sub, onUpdate, draft, setDraft }: { student: Student; hw: HW; sub?: Sub; onUpdate: () => void; draft: Draft; setDraft: (p: Partial<Draft>) => void }) {
  const [isGrading, setIsGrading] = useState(false);
  const [imgUrls, setImgUrls] = useState<string[]>([]);
  const [showImg, setShowImg] = useState<string | null>(null);
  const upsertFn = useServerFn(upsertHomeworkSubmissionAdmin);
  const getUrl = useServerFn(getHomeworkSubmissionFileUrl);

  useEffect(() => {
    const paths = Array.isArray(sub?.file_urls) && sub.file_urls.length ? sub.file_urls : sub?.file_url ? [sub.file_url] : [];
    Promise.all(paths.map(path => getUrl({ data: { path } }).then(res => res.url))).then(setImgUrls);
  }, [sub?.file_url, sub?.file_urls]);

  async function update(patch: any) {
    setIsGrading(true);
    try {
      await upsertFn({ data: { payload: { student_id: student.id, homework_id: hw.id, ...patch } } });
      onUpdate();
    } catch (err: any) { toast.error(err.message); }
    finally { setIsGrading(false); }
  }

  const hasSubmission = !!(sub?.answer_text || sub?.file_url || sub?.file_urls?.length);
  const level = evaluationLevel(sub, hw.max_score);

  return (
    <div className={`p-5 rounded-[2rem] border-2 transition-all ${hasSubmission ? "border-primary/20 bg-primary/[0.01]" : "border-slate-100 bg-white"}`}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center text-primary font-black shadow-inner">{student.full_name[0]}</div>
          <div>
            <div className="font-black text-slate-800">{student.full_name}</div>
            <div className="text-[10px] font-bold text-muted-foreground font-mono">{student.code}</div>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {hasSubmission ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-100 text-emerald-700 text-[10px] font-black uppercase"><CheckCircle2 className="h-3.5 w-3.5" /> تم الحل</span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 text-slate-500 text-[10px] font-black uppercase">لم يسلم</span>
          )}
          
          <select value={sub?.status || "pending"} onChange={e => update({ status: e.target.value })} className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold outline-none focus:ring-2 focus:ring-primary/10">
            <option value="pending">في الانتظار</option>
            <option value="submitted">بانتظار التقييم</option>
            <option value="graded">تم التقييم والاعتماد</option>
            <option value="missing">لم يتم الحل</option>
          </select>
        </div>
      </div>

      {hasSubmission && (
        <div className="mt-5 grid grid-cols-1 lg:grid-cols-2 gap-4 animate-in fade-in">
          <div className="space-y-2">
            <div className="text-[10px] font-black text-primary uppercase flex items-center gap-1 ms-2"><FileText className="h-3 w-3" /> حل الطالب المكتوب:</div>
            <div className="bg-white p-4 rounded-2xl border-2 border-primary/5 text-sm text-slate-700 leading-relaxed font-bold italic min-h-[100px] shadow-inner">
              {sub?.answer_text || "لا توجد إجابة نصية"}
            </div>
          </div>
          <div className="space-y-2">
            <div className="text-[10px] font-black text-secondary uppercase flex items-center gap-1 ms-2"><ImageIcon className="h-3 w-3" /> صورة من الكراسة:</div>
             {imgUrls.length ? (
               <div className="grid grid-cols-2 gap-2">
                 {imgUrls.map((url, index) => <button type="button" key={url} className="relative group cursor-zoom-in" onClick={() => setShowImg(url)}>
                   <img src={url} className="h-28 w-full object-cover rounded-2xl border-2 border-secondary/5 hover:opacity-80 transition-opacity shadow-md" alt={`homework ${index + 1}`} />
                   <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20 rounded-2xl">
                     <Eye className="text-white h-7 w-7 drop-shadow-lg" />
                   </div>
                 </button>)}
               </div>
            ) : (
              <div className="h-28 w-full rounded-2xl bg-slate-50 border-2 border-dashed border-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-400 italic">لا توجد صور مرفوعة من الطالب</div>
            )}
          </div>
        </div>
      )}

      <div className="mt-5 pt-5 border-t border-dashed flex flex-wrap items-center gap-3">
        <label className="inline-flex items-center gap-2 cursor-pointer select-none rounded-xl border-2 border-emerald-100 px-3 py-2">
          <input type="checkbox" checked={draft.checked} onChange={e => setDraft({ checked: e.target.checked })} className="h-5 w-5 accent-emerald-600" />
          <span className="text-xs font-black text-emerald-700">تم التقييم</span>
        </label>
        <div className="flex flex-wrap items-center gap-1.5">
          {EVALUATION_LEVELS.map(item => (
            <label key={item} className={`inline-flex items-center gap-1 cursor-pointer rounded-xl border-2 px-2.5 py-1.5 text-xs font-black ${draft.level === item ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-slate-100 text-slate-500"}`}>
              <input type="checkbox" checked={draft.level === item} onChange={e => setDraft({ level: e.target.checked ? item : "", checked: e.target.checked ? true : draft.checked })} className="h-4 w-4 accent-emerald-600" />
              {item}
            </label>
          ))}
        </div>
        <input value={draft.note} onChange={e => setDraft({ note: e.target.value })} placeholder="اكتب ملاحظة أو توجيه للطالب هنا..."
          className="flex-1 min-w-[200px] rounded-xl border-2 border-slate-100 bg-white px-4 py-2.5 text-xs font-bold outline-none focus:border-primary shadow-sm" />
        <button type="button" disabled={isGrading} onClick={async () => { await update({ level: draft.level || null, note: draft.note || null, status: draft.checked || draft.level ? "graded" : (sub?.status || "submitted") }); toast.success("تم حفظ تقييم " + student.full_name); }} className="rounded-xl bg-primary px-4 py-2.5 text-xs font-black text-white">حفظ</button>
        <button type="button" disabled={isGrading || !sub} onClick={async () => { if (!confirm("حذف التقييم والملاحظة لهذا الطالب؟")) return; await update({ level: null, score: null, note: null, status: hasSubmission ? "submitted" : "pending" }); setDraft({ level: "", note: "", checked: false }); toast.success("تم حذف التقييم"); }} className="rounded-xl bg-rose-50 px-4 py-2.5 text-xs font-black text-destructive disabled:opacity-40">حذف التقييم</button>
        {isGrading && <Loader2 className="h-5 w-5 animate-spin text-primary shrink-0" />}
      </div>

       {showImg && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 p-6 animate-in fade-in" onClick={() => setShowImg(null)}>
          <button className="absolute top-6 left-6 text-white p-3 bg-white/10 rounded-full hover:bg-white/20 transition-all"><X className="h-10 w-10" /></button>
           <img src={showImg} className="max-w-full max-h-full object-contain rounded-lg shadow-2xl" alt="homework full view" />
        </div>
      )}
    </div>
  );
}

function F({ name, label, type = "text", required = false, defaultValue }: any) {
  return (
    <div className="space-y-1">
      <label className="mb-1.5 block text-[11px] font-black text-muted-foreground uppercase ms-1">{label}</label>
      <input name={name} type={type} required={required} defaultValue={defaultValue} className="w-full rounded-xl border border-input bg-white px-4 py-2.5 text-sm font-bold outline-none focus:ring-2 focus:ring-primary/20 transition-all" />
    </div>
  );
}
function HWAttachments({ paths }: { paths: string[] }) {
  const fn = useServerFn(getHomeworkAttachmentUrlsAdmin);
  const [files, setFiles] = useState<{ path: string; url: string }[]>([]);
  useEffect(() => { fn({ data: { paths } }).then(setFiles).catch(() => setFiles([])); }, [paths.join(",")]);
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {files.map((f, i) => <a key={f.path} href={f.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg bg-primary/10 px-2 py-1 text-[10px] font-black text-primary hover:bg-primary/20">{/\.pdf$/i.test(f.path) ? <FileText className="h-3 w-3" /> : <ImageIcon className="h-3 w-3" />} مرفق {i + 1}</a>)}
    </div>
  );
}

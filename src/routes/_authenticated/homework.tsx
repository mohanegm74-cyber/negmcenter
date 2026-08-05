import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Pencil, X, Printer, BookOpen, Loader2, FileText, ImageIcon, Eye, CheckCircle2, ChevronDown, ChevronUp } from "lucide-react";
import { openPrint, esc } from "@/lib/print";
import { useServerFn } from "@tanstack/react-start";
import { getHomeworkDataAdmin, saveHomeworkAdmin, upsertHomeworkSubmissionAdmin, deleteHomeworkAdmin, getHomeworkSubmissionFileUrl } from "@/lib/admin.functions";
import { GRADES } from "@/lib/exam-constants";

export const Route = createFileRoute("/_authenticated/homework")({
  head: () => ({ meta: [{ title: "الواجبات والتقييم — الأستاذ" }] }),
  component: HomeworkPage,
});

type Group = { id: string; name: string; grade: string | null };
type HW = { id: string; group_id: string | null; title: string; description: string | null; due_date: string | null; max_score: number | null; grade: string | null; model_solution?: string | null };
type Student = { id: string; full_name: string; code: string; group_id: string | null };
type Sub = { id: string; homework_id: string; student_id: string; score: number | null; status: string; note: string | null; answer_text: string | null; file_url: string | null };

function HomeworkPage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [items, setItems] = useState<HW[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [subs, setSubs] = useState<Sub[]>([]);
  const [editing, setEditing] = useState<HW | null>(null);
  const [open, setOpen] = useState(false);
  const [activeHW, setActiveHW] = useState<HW | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const loadFn = useServerFn(getHomeworkDataAdmin);
  const saveHWFn = useServerFn(saveHomeworkAdmin);
  const upsertSubFn = useServerFn(upsertHomeworkSubmissionAdmin);
  const deleteHWFn = useServerFn(deleteHomeworkAdmin);

  async function load() {
    setLoading(true);
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

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {items.map(h => (
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
            <div className="mt-6 flex gap-2">
              <button onClick={() => setActiveHW(h)} className="flex-1 rounded-2xl bg-primary px-4 py-2.5 text-xs font-black text-white shadow-lg shadow-primary/20 hover:scale-[1.02] transition-all">تقييم حلول الطلاب</button>
              <button onClick={() => {
                const list = students.filter(s => (!h.group_id || s.group_id === h.group_id) && (!h.grade || s.grade === h.grade));
                const rowsHtml = list.map((s, i) => {
                  const sub = subs.find(x => x.homework_id === h.id && x.student_id === s.id);
                  return `<tr><td>${i + 1}</td><td>${esc(s.full_name)}</td><td>${esc(s.code)}</td><td>${esc(sub?.status === 'submitted' ? 'تم الحل' : sub?.status === 'graded' ? 'تم التقييم' : 'لم يحل')}</td><td>${sub?.score ?? "—"} / ${h.max_score}</td></tr>`;
                }).join("");
                openPrint(`واجب: ${h.title}`, `<h2>${esc(h.title)} — ${esc(h.grade || "")} — ${esc(groupMap[h.group_id || ""]?.name || "كل المجموعات")}</h2><table><thead><tr><th>#</th><th>الطالب</th><th>الكود</th><th>الحالة</th><th>الدرجة</th></tr></thead><tbody>${rowsHtml}</tbody></table>`);
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
            
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {students.filter(s => (!activeHW.group_id || s.group_id === activeHW.group_id) && (!activeHW.grade || s.grade === activeHW.grade)).map(s => (
                <StudentSubmissionRow key={s.id} student={s} hw={activeHW} sub={subs.find(x => x.homework_id === activeHW.id && x.student_id === s.id)} onUpdate={load} />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StudentSubmissionRow({ student, hw, sub, onUpdate }: { student: Student; hw: HW; sub?: Sub; onUpdate: () => void }) {
  const [isGrading, setIsGrading] = useState(false);
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [showImg, setShowImg] = useState(false);
  const upsertFn = useServerFn(upsertHomeworkSubmissionAdmin);
  const getUrl = useServerFn(getHomeworkSubmissionFileUrl);

  useEffect(() => {
    if (sub?.file_url) getUrl({ data: { path: sub.file_url } }).then(res => setImgUrl(res.url));
    else setImgUrl(null);
  }, [sub?.file_url]);

  async function update(patch: any) {
    setIsGrading(true);
    try {
      await upsertFn({ data: { payload: { student_id: student.id, homework_id: hw.id, ...patch } } });
      onUpdate();
    } catch (err: any) { toast.error(err.message); }
    finally { setIsGrading(false); }
  }

  const hasSubmission = !!(sub?.answer_text || sub?.file_url);

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
            {imgUrl ? (
              <div className="relative group cursor-zoom-in" onClick={() => setShowImg(true)}>
                <img src={imgUrl} className="h-28 w-full object-cover rounded-2xl border-2 border-secondary/5 hover:opacity-80 transition-opacity shadow-md" alt="homework" />
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20 rounded-2xl">
                  <Eye className="text-white h-7 w-7 drop-shadow-lg" />
                </div>
              </div>
            ) : (
              <div className="h-28 w-full rounded-2xl bg-slate-50 border-2 border-dashed border-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-400 italic">لا توجد صور مرفوعة من الطالب</div>
            )}
          </div>
        </div>
      )}

      <div className="mt-5 pt-5 border-t border-dashed flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-black text-slate-500 uppercase ms-1">رصد الدرجة:</span>
          <div className="flex items-center gap-2">
            <input type="number" defaultValue={sub?.score ?? ""} max={hw.max_score ?? undefined} min={0}
              onBlur={e => {
                const val = e.target.value;
                update({ score: val === "" ? null : Number(val), status: val === "" ? (sub?.status || "submitted") : "graded" });
              }}
              className="w-16 rounded-xl border-2 border-emerald-100 bg-emerald-50/20 py-2 text-sm font-black text-center text-emerald-700 outline-none focus:border-emerald-500" />
            <span className="text-xs font-bold text-slate-400">/ {hw.max_score}</span>
          </div>
        </div>
        <div className="flex-1 relative">
          <input defaultValue={sub?.note ?? ""} placeholder="اكتب ملاحظة أو توجيه للطالب هنا (تظهر له فوراً)..."
            onBlur={e => update({ note: e.target.value || null })}
            className="w-full rounded-xl border-2 border-slate-100 bg-white px-5 py-2.5 text-xs font-bold outline-none focus:border-primary shadow-sm" />
        </div>
        {isGrading && <Loader2 className="h-5 w-5 animate-spin text-primary shrink-0" />}
      </div>

      {showImg && imgUrl && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 p-6 animate-in fade-in" onClick={() => setShowImg(false)}>
          <button className="absolute top-6 left-6 text-white p-3 bg-white/10 rounded-full hover:bg-white/20 transition-all"><X className="h-10 w-10" /></button>
          <img src={imgUrl} className="max-w-full max-h-full object-contain rounded-lg shadow-2xl" alt="homework full view" />
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
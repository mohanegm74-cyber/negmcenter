import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Pencil, X, Printer, BookOpen, Loader2, FileText, ImageIcon, Eye, CheckCircle2 } from "lucide-react";
import { openPrint, esc } from "@/lib/print";
import { useServerFn } from "@tanstack/react-start";
import { getHomeworkDataAdmin, saveHomeworkAdmin, upsertHomeworkSubmissionAdmin, deleteHomeworkAdmin, getHomeworkSubmissionFileUrl } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/homework")({
  head: () => ({ meta: [{ title: "الواجبات والتقييم — الأستاذ" }] }),
  component: HomeworkPage,
});

type Group = { id: string; name: string; grade: string | null };
type HW = { id: string; group_id: string | null; title: string; description: string | null; due_date: string | null; max_score: number };
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
      title: String(fd.get("title")).trim(),
      description: String(fd.get("description") || "").trim() || null,
      due_date: String(fd.get("due_date") || "") || null,
      max_score: Number(fd.get("max_score") || 100),
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
        <form key={editing?.id || "new"} onSubmit={save} className="mb-6 rounded-2xl bg-white p-5 shadow-sm border border-slate-100">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-bold">{editing ? "تعديل واجب" : "إضافة واجب جديد"}</h2>
            <button type="button" onClick={() => { setOpen(false); setEditing(null); }} className="rounded p-1 hover:bg-slate-100"><X className="h-4 w-4" /></button>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-semibold">المجموعة</label>
              <select name="group_id" defaultValue={editing?.group_id || ""} className="w-full rounded-lg border border-input bg-white px-3 py-2 text-sm">
                <option value="">— كل المجموعات —</option>
                {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </div>
            <F name="title" label="عنوان الواجب *" required defaultValue={editing?.title} />
            <F name="due_date" label="تاريخ التسليم" type="date" defaultValue={editing?.due_date ?? ""} />
            <F name="max_score" label="الدرجة القصوى" type="number" defaultValue={editing ? String(editing.max_score) : "100"} />
            <div className="md:col-span-2">
              <label className="mb-1.5 block text-sm font-semibold">الوصف / المطلوب</label>
              <textarea name="description" defaultValue={editing?.description ?? ""} rows={3} className="w-full rounded-lg border border-input px-3 py-2 text-sm" />
            </div>
          </div>
          <button type="submit" disabled={busy} className="mt-4 rounded-lg bg-secondary px-6 py-2.5 text-sm font-bold text-white disabled:opacity-50">
            {busy ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : editing ? "تحديث البيانات" : "حفظ الواجب"}
          </button>
        </form>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {items.map(h => (
          <div key={h.id} className="rounded-2xl bg-white p-5 shadow-sm border border-slate-100 hover:border-primary/20 transition-all">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="text-lg font-black text-slate-800">{h.title}</h3>
                <p className="text-[10px] font-bold text-muted-foreground uppercase">{groupMap[h.group_id || ""]?.name || "كل المجموعات"}{h.due_date ? ` · موعد: ${h.due_date}` : ""}</p>
              </div>
              <div className="flex gap-1">
                <button onClick={() => { setEditing(h); setOpen(true); }} className="p-1.5 text-primary hover:bg-primary/5 rounded-lg"><Pencil className="h-4 w-4" /></button>
                <button onClick={() => remove(h.id)} className="p-1.5 text-destructive hover:bg-rose-50 rounded-lg"><Trash2 className="h-4 w-4" /></button>
              </div>
            </div>
            {h.description && <p className="mt-2 text-xs text-muted-foreground line-clamp-2 italic">"{h.description}"</p>}
            <div className="mt-4 flex gap-2">
              <button onClick={() => setActiveHW(h)} className="flex-1 rounded-xl bg-primary px-3 py-2 text-xs font-black text-white shadow-lg shadow-primary/10">تقييم حلول الطلاب</button>
              <button onClick={() => {
                const list = students.filter(s => !h.group_id || s.group_id === h.group_id);
                const rowsHtml = list.map((s, i) => {
                  const sub = subs.find(x => x.homework_id === h.id && x.student_id === s.id);
                  return `<tr><td>${i + 1}</td><td>${esc(s.full_name)}</td><td>${esc(s.code)}</td><td>${esc(sub?.status || "—")}</td><td>${sub?.score ?? "—"} / ${h.max_score}</td></tr>`;
                }).join("");
                openPrint(`واجب: ${h.title}`, `<h2>${esc(h.title)} — ${esc(groupMap[h.group_id || ""]?.name || "كل المجموعات")}</h2><table><thead><tr><th>#</th><th>الطالب</th><th>الكود</th><th>الحالة</th><th>الدرجة</th></tr></thead><tbody>${rowsHtml}</tbody></table>`);
              }} className="inline-flex items-center gap-1 rounded-xl bg-slate-100 px-3 py-2 text-xs font-bold text-slate-600"><Printer className="h-3.5 w-3.5" /> طباعة</button>
            </div>
          </div>
        ))}
        {items.length === 0 && <div className="col-span-full py-20 text-center text-muted-foreground font-bold border-2 border-dashed rounded-[2rem]">لا توجد واجبات مسجلة حالياً.</div>}
      </div>

      {activeHW && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-5xl max-h-[90vh] bg-white rounded-[2.5rem] shadow-2xl flex flex-col animate-in zoom-in-95">
            <div className="p-6 border-b flex justify-between items-center bg-slate-50 rounded-t-[2.5rem]">
              <div>
                <h2 className="text-xl font-black text-slate-800">تقييم الطلاب: {activeHW.title}</h2>
                <p className="text-xs text-muted-foreground font-bold mt-0.5">درجة الواجب القصوى: {activeHW.max_score}</p>
              </div>
              <button onClick={() => setActiveHW(null)} className="p-2 hover:bg-white rounded-full transition-all"><X className="h-6 w-6" /></button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {students.filter(s => !activeHW.group_id || s.group_id === activeHW.group_id).map(s => (
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
    <div className={`p-5 rounded-3xl border-2 transition-all ${hasSubmission ? "border-primary/20 bg-primary/[0.02]" : "border-slate-100 bg-white"}`}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-black">{student.full_name[0]}</div>
          <div>
            <div className="font-black text-slate-800">{student.full_name}</div>
            <div className="text-[10px] font-bold text-muted-foreground font-mono">{student.code}</div>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {hasSubmission ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-black uppercase"><CheckCircle2 className="h-3.5 w-3.5" /> تم التسليم</span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-100 text-slate-500 text-[10px] font-black uppercase">لم يسلم بعد</span>
          )}
          
          <select value={sub?.status || "pending"} onChange={e => update({ status: e.target.value })} className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold outline-none focus:ring-2 focus:ring-primary/10">
            <option value="pending">بانتظار الحل</option>
            <option value="submitted">تم الحل</option>
            <option value="graded">تم التقييم</option>
            <option value="missing">لم يحل</option>
          </select>
        </div>
      </div>

      {hasSubmission && (
        <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="text-[10px] font-black text-primary uppercase flex items-center gap-1"><FileText className="h-3 w-3" /> حل الطالب النصي:</div>
            <div className="bg-white p-4 rounded-2xl border text-sm text-slate-700 leading-relaxed font-medium italic min-h-[80px]">
              {sub?.answer_text || "لا يوجد إجابة نصية"}
            </div>
          </div>
          <div className="space-y-2">
            <div className="text-[10px] font-black text-secondary uppercase flex items-center gap-1"><ImageIcon className="h-3 w-3" /> صورة الكراسة المرفوعة:</div>
            {imgUrl ? (
              <div className="relative group cursor-zoom-in" onClick={() => setShowImg(true)}>
                <img src={imgUrl} className="h-24 w-full object-cover rounded-2xl border hover:opacity-80 transition-opacity" alt="homework" />
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/10 rounded-2xl">
                  <Eye className="text-white h-6 w-6 drop-shadow-lg" />
                </div>
              </div>
            ) : (
              <div className="h-24 w-full rounded-2xl bg-slate-50 border border-dashed flex items-center justify-center text-[10px] font-bold text-slate-400">لا يوجد صور مرفوعة</div>
            )}
          </div>
        </div>
      )}

      <div className="mt-4 pt-4 border-t border-dashed flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-black text-slate-500 uppercase">الدرجة:</span>
          <div className="flex items-center gap-1.5">
            <input type="number" defaultValue={sub?.score ?? ""} max={hw.max_score} min={0}
              onBlur={e => {
                const val = e.target.value;
                update({ score: val === "" ? null : Number(val), status: val === "" ? (sub?.status || "submitted") : "graded" });
              }}
              className="w-16 rounded-xl border border-slate-200 bg-white px-2 py-1 text-sm font-black text-center outline-none focus:border-primary" />
            <span className="text-xs font-bold text-slate-400">/ {hw.max_score}</span>
          </div>
        </div>
        <div className="flex-1">
          <input defaultValue={sub?.note ?? ""} placeholder="أضف رأيك وملاحظاتك للطالب هنا..."
            onBlur={e => update({ note: e.target.value || null })}
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold outline-none focus:border-primary" />
        </div>
        {isGrading && <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />}
      </div>

      {showImg && imgUrl && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-4" onClick={() => setShowImg(false)}>
          <button className="absolute top-6 left-6 text-white p-2 bg-white/10 rounded-full hover:bg-white/20"><X className="h-8 w-8" /></button>
          <img src={imgUrl} className="max-w-full max-h-full object-contain rounded-lg shadow-2xl" alt="homework full" />
        </div>
      )}
    </div>
  );
}

function F({ name, label, type = "text", required = false, defaultValue }: any) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-semibold">{label}</label>
      <input name={name} type={type} required={required} defaultValue={defaultValue} className="w-full rounded-lg border border-input px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20" />
    </div>
  );
}
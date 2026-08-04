import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Search, Trash2, Pencil, Users, X, Loader2, Phone, MapPin, School, Save, MessageSquarePlus, MessageSquareQuote, FilterX, CheckCircle, UserX } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { getAllStudentsAdmin, deleteStudentAdmin, updateStudentAdmin, getGroupsAdmin, getStudentNotesAdmin, addStudentNoteAdmin, deleteStudentNoteAdmin, toggleStudentActive } from "@/lib/admin.functions";
import { GRADES } from "@/lib/exam-constants";

export const Route = createFileRoute("/_authenticated/students")({
  head: () => ({ meta: [{ title: "إدارة الطلاب والاعتماد — الأستاذ" }] }),
  component: StudentsPage,
});

type Student = {
  id: string; code: string; full_name: string; phone: string | null; parent_phone: string | null;
  grade: string | null; group_id: string | null; active: boolean; address: string | null;
  school: string | null; section: string | null; notes: string | null;
};
type Group = { id: string; name: string; grade: string | null };

function StudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [gradeFilter, setGradeFilter] = useState("");
  const [groupFilter, setGroupFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "pending">("all");
  
  const [editing, setEditing] = useState<Student | null>(null);
  const [noting, setNoting] = useState<Student | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  
  const loadStudentsFn = useServerFn(getAllStudentsAdmin);
  const loadGroupsFn = useServerFn(getGroupsAdmin);
  const deleteStudentFn = useServerFn(deleteStudentAdmin);
  const updateStudentFn = useServerFn(updateStudentAdmin);
  const toggleActiveFn = useServerFn(toggleStudentActive);

  async function load() {
    setLoading(true);
    try {
      const [{ students: st }, { groups: g }] = await Promise.all([loadStudentsFn({}), loadGroupsFn({})]);
      setStudents(st as Student[]);
      setGroups((g as Group[]) || []);
    } catch (err: any) { toast.error(err.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  const groupMap = useMemo(() => Object.fromEntries(groups.map(g => [g.id, g.name])), [groups]);

  const filtered = useMemo(() => {
    const t = search.trim().toLowerCase();
    return students.filter(s => {
      const ms = !t || s.full_name.toLowerCase().includes(t) || s.code.toLowerCase().includes(t);
      const mg = !gradeFilter || s.grade === gradeFilter;
      const mgrp = !groupFilter || s.group_id === groupFilter;
      const mst = statusFilter === "all" ? true : statusFilter === "active" ? s.active : !s.active;
      return ms && mg && mgrp && mst;
    });
  }, [search, gradeFilter, groupFilter, statusFilter, students]);

  async function handleStatus(id: string, active: boolean) {
    try {
      await toggleActiveFn({ data: { id, active } });
      toast.success(active ? "تم اعتماد الطالب بنجاح" : "تم إلغاء اعتماد الطالب");
      load();
    } catch (err: any) { toast.error(err.message); }
  }

  async function remove(id: string, name: string) {
    if (!confirm(`حذف الطالب "${name}"؟`)) return;
    try { await deleteStudentFn({ data: { id } }); toast.success("تم الحذف"); load(); }
    catch (err: any) { toast.error(err.message); }
  }

  async function saveEdit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editing) return;
    setIsSaving(true);
    const fd = new FormData(e.currentTarget);
    const payload: any = {};
    fd.forEach((v, k) => { const val = String(v).trim(); payload[k] = val === "" ? null : val; });
    try {
      await updateStudentAdmin({ data: { id: editing.id, payload } });
      toast.success("تم تحديث البيانات"); setEditing(null); load();
    } catch (err: any) { toast.error(err.message); }
    finally { setIsSaving(false); }
  }

  if (loading && students.length === 0) return <div className="p-20 text-center"><Loader2 className="mx-auto h-10 w-10 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="text-2xl font-black flex items-center gap-2"><Users className="h-6 w-6 text-primary" /> إدارة الطلاب والاعتماد</h1>
        <Link to="/student/register" className="rounded-xl bg-primary px-5 py-2.5 text-sm font-black text-primary-foreground shadow-lg hover:opacity-90">إضافة طالب جديد</Link>
      </div>

      {/* الفلاتر */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5 bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
        <div className="relative">
          <Search className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث بالاسم أو الكود..." className="w-full rounded-lg border bg-muted/20 py-2 ps-9 text-sm focus:bg-white transition-all" />
        </div>
        <select value={gradeFilter} onChange={e => setGradeFilter(e.target.value)} className="rounded-lg border bg-muted/20 py-2 px-3 text-sm focus:bg-white">
          <option value="">كل الصفوف</option>
          {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
        </select>
        <select value={groupFilter} onChange={e => setGroupFilter(e.target.value)} className="rounded-lg border bg-muted/20 py-2 px-3 text-sm focus:bg-white">
          <option value="">كل المجموعات</option>
          {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)} className="rounded-lg border bg-muted/20 py-2 px-3 text-sm font-bold focus:bg-white">
          <option value="all">كل الحالات</option>
          <option value="active" className="text-secondary">المعتمدون</option>
          <option value="pending" className="text-destructive">بانتظار الاعتماد</option>
        </select>
        <button onClick={() => {setSearch(""); setGradeFilter(""); setGroupFilter(""); setStatusFilter("all");}} className="flex items-center justify-center gap-2 rounded-lg border border-dashed py-2 text-sm text-muted-foreground hover:bg-muted/50 transition-all"><FilterX className="h-4 w-4" /> مسح الفلاتر</button>
      </div>

      {editing && (
        <form onSubmit={saveEdit} className="rounded-2xl bg-white p-6 shadow-xl border-2 border-primary animate-in zoom-in-95">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-black text-primary">تعديل: {editing.full_name}</h2>
            <button type="button" onClick={() => setEditing(null)} className="p-2 hover:bg-muted rounded-full"><X className="h-5 w-5" /></button>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <F name="full_name" label="الاسم الرباعي" defaultValue={editing.full_name} required />
            <F name="phone" label="هاتف الطالب" defaultValue={editing.phone || ""} />
            <F name="parent_phone" label="هاتف ولي الأمر" defaultValue={editing.parent_phone || ""} />
            <div>
              <label className="mb-1.5 block text-xs font-bold text-muted-foreground uppercase">الصف الدراسي</label>
              <select name="grade" defaultValue={editing.grade || ""} className="w-full rounded-lg border bg-white px-3 py-2 text-sm">
                <option value="">— غير محدد —</option>
                {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-bold text-muted-foreground uppercase">المجموعة</label>
              <select name="group_id" defaultValue={editing.group_id || ""} className="w-full rounded-lg border bg-white px-3 py-2 text-sm">
                <option value="">— غير محدد —</option>
                {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </div>
            <F name="school" label="المدرسة" defaultValue={editing.school || ""} />
            <F name="notes" label="ملاحظات إدارية" defaultValue={editing.notes || ""} />
          </div>
          <div className="mt-6 flex gap-3">
            <button type="submit" disabled={isSaving} className="rounded-xl bg-primary px-8 py-3 text-sm font-black text-white shadow-lg">
              {isSaving ? <Loader2 className="h-5 w-5 animate-spin" /> : "حفظ التغييرات"}
            </button>
          </div>
        </form>
      )}

      {noting && <NotesModal student={noting} onClose={() => setNoting(null)} />}

      {/* عرض الموبايل (كروت) */}
      <div className="grid grid-cols-1 gap-4 md:hidden">
        {filtered.map(s => (
          <div key={s.id} className={`bg-white p-5 rounded-2xl shadow-sm border-r-4 ${s.active ? "border-emerald-500" : "border-rose-500"}`}>
            <div className="flex justify-between items-start mb-3">
              <div>
                <div className="font-black text-slate-800">{s.full_name}</div>
                <div className="text-[10px] bg-slate-100 px-2 py-0.5 rounded-full font-mono mt-1 w-fit">{s.code}</div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setEditing(s)} className="p-2 bg-slate-50 rounded-xl text-primary"><Pencil className="h-4 w-4" /></button>
                <button onClick={() => remove(s.id, s.full_name)} className="p-2 bg-slate-50 rounded-xl text-destructive"><Trash2 className="h-4 w-4" /></button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-y-2 text-xs font-bold border-t pt-3">
              <div className="text-muted-foreground">المجموعة: <span className="text-slate-700">{groupMap[s.group_id!] || "—"}</span></div>
              <div className="text-muted-foreground">الصف: <span className="text-slate-700">{s.grade || "—"}</span></div>
              <div className="text-muted-foreground">الهاتف: <span className="text-slate-700">{s.phone || "—"}</span></div>
              <div className="text-muted-foreground">ولي الأمر: <span className="text-slate-700">{s.parent_phone || "—"}</span></div>
            </div>
            <div className="mt-4 flex gap-2">
              {!s.active ? (
                <button onClick={() => handleStatus(s.id, true)} className="flex-1 py-2 bg-emerald-600 text-white rounded-xl text-[11px] font-black shadow-lg shadow-emerald-100 flex items-center justify-center gap-1"><CheckCircle className="h-3.5 w-3.5" /> اعتماد الطالب</button>
              ) : (
                <button onClick={() => handleStatus(s.id, false)} className="flex-1 py-2 bg-amber-50 text-amber-700 rounded-xl text-[11px] font-black flex items-center justify-center gap-1"><UserX className="h-3.5 w-3.5" /> إلغاء الاعتماد</button>
              )}
              <button onClick={() => setNoting(s)} className="px-4 py-2 bg-secondary/10 text-secondary rounded-xl"><MessageSquarePlus className="h-4 w-4" /></button>
            </div>
          </div>
        ))}
      </div>

      {/* عرض الكمبيوتر (جدول) */}
      <div className="hidden md:block overflow-hidden rounded-2xl border bg-white shadow-sm">
        <table className="w-full text-right text-sm">
          <thead className="bg-primary text-primary-foreground">
            <tr><th className="p-4">الطالب</th><th className="p-4">المجموعة</th><th className="p-4">التواصل</th><th className="p-4 text-center">الحالة / إجراءات</th></tr>
          </thead>
          <tbody className="divide-y divide-muted/20">
            {filtered.map((s) => (
              <tr key={s.id} className={`hover:bg-muted/30 transition-colors ${!s.active ? "bg-destructive/5" : ""}`}>
                <td className="p-4">
                  <div className="font-bold text-base">{s.full_name}</div>
                  <div className="flex gap-2 items-center mt-1"><span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-mono">{s.code}</span> <span className="text-[10px] text-muted-foreground">{s.grade}</span></div>
                </td>
                <td className="p-4"><div className="font-bold">{groupMap[s.group_id!] || "—"}</div></td>
                <td className="p-4 text-xs font-semibold">طالب: {s.phone || "—"}<br/><span className="text-muted-foreground">ولي أمر: {s.parent_phone || "—"}</span></td>
                <td className="p-4">
                  <div className="flex justify-center gap-2">
                    {!s.active ? (
                      <button onClick={() => handleStatus(s.id, true)} className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-[11px] font-black text-white shadow-sm hover:scale-105 transition-transform"><CheckCircle className="h-3.5 w-3.5" /> اعتماد الطالب</button>
                    ) : (
                      <button onClick={() => handleStatus(s.id, false)} className="flex items-center gap-1.5 rounded-lg bg-amber-600/10 px-3 py-1.5 text-[11px] font-black text-amber-700 hover:bg-amber-100 transition-colors"><UserX className="h-3.5 w-3.5" /> إلغاء الاعتماد</button>
                    )}
                    <button onClick={() => setNoting(s)} className="rounded-lg bg-secondary/10 p-2 text-secondary hover:bg-secondary/20 transition-colors" title="ملاحظات ولي الأمر"><MessageSquarePlus className="h-4 w-4" /></button>
                    <button onClick={() => setEditing(s)} className="rounded-lg bg-primary/10 p-2 text-primary hover:bg-primary/20 transition-colors"><Pencil className="h-4 w-4" /></button>
                    <button onClick={() => remove(s.id, s.full_name)} className="rounded-lg bg-destructive/10 p-2 text-destructive hover:bg-destructive/20 transition-colors"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {filtered.length === 0 && (
        <div className="p-20 text-center text-muted-foreground bg-white rounded-2xl border border-dashed">لا يوجد طلاب يطابقون البحث حالياً.</div>
      )}
    </div>
  );
}

function F({ name, label, defaultValue, required = false }: any) {
  return (
    <div className="space-y-1">
      <label className="text-[11px] font-black text-muted-foreground uppercase">{label}</label>
      <input name={name} defaultValue={defaultValue} required={required} className="w-full rounded-xl border bg-white px-4 py-2 text-sm font-bold focus:ring-2 focus:ring-primary/20 outline-none transition-all" />
    </div>
  );
}

function NotesModal({ student, onClose }: { student: any; onClose: () => void }) {
  const [notes, setNotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const getNotes = useServerFn(getStudentNotesAdmin);
  const addNote = useServerFn(addStudentNoteAdmin);
  const deleteNote = useServerFn(deleteStudentNoteAdmin);
  async function load() {
    setLoading(true);
    try { const res = await getNotes({ data: { student_id: student.id } }); setNotes(res.notes); } 
    catch { toast.error("فشل تحميل الملاحظات"); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [student.id]);
  async function handleAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const fd = new FormData(e.currentTarget);
    try {
      await addNote({ data: { student_id: student.id, title: String(fd.get("title")), body: String(fd.get("body")) } });
      toast.success("تم الإرسال"); e.currentTarget.reset(); load();
    } catch { toast.error("فشل الإرسال"); }
    finally { setBusy(false); }
  }
  async function handleDel(id: string) {
    if (!confirm("حذف الملاحظة؟")) return;
    try { await deleteNote({ data: { id } }); toast.success("تم الحذف"); load(); }
    catch { toast.error("فشل الحذف"); }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-3xl bg-white shadow-2xl flex flex-col animate-in slide-in-from-bottom-8">
        <div className="p-5 border-b flex justify-between items-center bg-primary/5">
          <div><h2 className="text-xl font-black text-primary">تواصل مع ولي الأمر</h2><p className="text-xs text-muted-foreground font-bold">{student.full_name}</p></div>
          <button onClick={onClose} className="p-2 hover:bg-white rounded-full transition-all"><X className="h-6 w-6" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          <form onSubmit={handleAdd} className="p-5 bg-secondary/5 rounded-2xl border border-secondary/10 space-y-4">
            <input name="title" placeholder="عنوان الملاحظة (مثال: مستوى الطالب في الحصة)" required className="w-full rounded-xl border p-3 text-sm font-bold outline-none focus:ring-2 focus:ring-secondary/20" />
            <textarea name="body" placeholder="نص الملاحظة الموجهة لولي الأمر..." required rows={3} className="w-full rounded-xl border p-3 text-sm outline-none focus:ring-2 focus:ring-secondary/20" />
            <button type="submit" disabled={busy} className="w-full rounded-xl bg-secondary py-3 text-sm font-black text-white shadow-lg shadow-secondary/10 hover:opacity-90 transition-all flex items-center justify-center gap-2">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquarePlus className="h-4 w-4" />} إرسال الملاحظة لولي الأمر
            </button>
          </form>
          <div className="space-y-3">
            <h3 className="text-xs font-black text-muted-foreground uppercase flex items-center gap-2 px-1"><MessageSquareQuote className="h-3.5 w-3.5" /> السجل السابق</h3>
            {loading ? <Loader2 className="mx-auto h-8 w-8 animate-spin text-muted-foreground/30" /> : notes.length === 0 ? <p className="text-center py-4 text-xs text-muted-foreground">لا يوجد ملاحظات سابقة مرسلة</p> : notes.map(n => (
              <div key={n.id} className="p-4 border rounded-2xl flex justify-between items-start gap-3 bg-white hover:border-secondary/30 transition-all">
                <div className="flex-1"><div className="font-black text-secondary">{n.title}</div><p className="text-sm mt-1 whitespace-pre-wrap leading-relaxed text-slate-600">{n.body}</p></div>
                <button onClick={() => handleDel(n.id)} className="text-rose-400 hover:text-rose-600 p-1 transition-all"><Trash2 className="h-4 w-4" /></button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Search, Trash2, Pencil, Users, X, Loader2, Phone, MapPin, School, Save, Boxes, MessageSquarePlus, MessageSquareQuote } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { getAllStudentsAdmin, deleteStudentAdmin, updateStudentAdmin, getGroupsAdmin, getStudentNotesAdmin, addStudentNoteAdmin, deleteStudentNoteAdmin } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/students")({
  head: () => ({ meta: [{ title: "إدارة الطلاب — الأستاذ محمد نجم" }, { name: "description", content: "إدارة طلاب السنتر وتعديل بياناتهم بشكل شامل." }] }),
  component: StudentsPage,
});

type Student = {
  id: string; code: string; full_name: string; phone: string | null; parent_phone: string | null;
  grade: string | null; group_id: string | null; active: boolean; address: string | null;
  school: string | null; section: string | null; birth_date: string | null; national_id: string | null;
  gender: string | null; governorate: string | null; education_dept: string | null;
  subject: string | null; teacher_name: string | null; notes: string | null;
};
type Group = { id: string; name: string; grade: string | null };

const GOVERNORATES = ["القاهرة","الجيزة","الإسكندرية","القليوبية","الشرقية","الدقهلية","المنوفية","الغربية","كفر الشيخ","دمياط","بورسعيد","الإسماعيلية","السويس","بني سويف","الفيوم","المنيا","أسيوط","سوهاج","قنا","الأقصر","أسوان","البحر الأحمر","الوادي الجديد","مطروح","شمال سيناء","جنوب سيناء","البحيرة"];

function StudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Student | null>(null);
  const [noting, setNoting] = useState<Student | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  
  const loadStudentsFn = useServerFn(getAllStudentsAdmin);
  const loadGroupsFn = useServerFn(getGroupsAdmin);
  const deleteStudentFn = useServerFn(deleteStudentAdmin);
  const updateStudentFn = useServerFn(updateStudentAdmin);

  async function load() {
    setLoading(true);
    try {
      const [{ students: st }, { groups: g }] = await Promise.all([
        loadStudentsFn({}),
        loadGroupsFn({})
      ]);
      setStudents(st as Student[]);
      setGroups((g as Group[]) || []);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  const groupMap = useMemo(() => Object.fromEntries(groups.map(g => [g.id, g.name])), [groups]);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    return students.filter(s => 
      !t || 
      s.full_name.toLowerCase().includes(t) || 
      s.code.toLowerCase().includes(t) ||
      (s.phone && s.phone.includes(t)) ||
      (s.parent_phone && s.parent_phone.includes(t))
    );
  }, [q, students]);

  async function remove(id: string, name: string) {
    if (!confirm(`حذف الطالب "${name}"؟`)) return;
    try {
      await deleteStudentFn({ data: { id } });
      toast.success("تم الحذف");
      load();
    } catch (err: any) { toast.error(err.message); }
  }

  async function saveEdit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editing) return;
    setIsSaving(true);
    const fd = new FormData(e.currentTarget);
    const payload: any = {};
    fd.forEach((v, k) => { const val = String(v).trim(); payload[k] = val === "" ? null : val; });
    try {
      await updateStudentFn({ data: { id: editing.id, payload } });
      toast.success("تم التحديث");
      setEditing(null); load();
    } catch (err: any) { toast.error(err.message); }
    finally { setIsSaving(false); }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="text-2xl font-black flex items-center gap-2"><Users className="h-6 w-6 text-primary" /> إدارة الطلاب</h1>
        <div className="flex gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-80">
            <Search className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="بحث بالاسم أو الكود..." className="w-full rounded-lg border bg-white py-2 pe-3 ps-9 text-sm outline-none" />
          </div>
          <Link to="/student/register" className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground">إضافة طالب</Link>
        </div>
      </div>

      {editing && (
        <form onSubmit={saveEdit} className="rounded-2xl bg-white p-6 shadow-xl border-2 border-primary">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-black text-primary">تعديل: {editing.full_name}</h2>
            <button type="button" onClick={() => setEditing(null)} className="rounded-full p-2 hover:bg-muted"><X className="h-5 w-5" /></button>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <F name="full_name" label="الاسم" defaultValue={editing.full_name} required />
            <F name="phone" label="هاتف الطالب" defaultValue={editing.phone || ""} />
            <F name="parent_phone" label="هاتف ولي الأمر" defaultValue={editing.parent_phone || ""} />
            <F name="grade" label="الصف" defaultValue={editing.grade || ""} />
            <div>
              <label className="mb-1.5 block text-sm font-semibold">المجموعة</label>
              <select name="group_id" defaultValue={editing.group_id || ""} className="w-full rounded-lg border border-input bg-white px-3 py-2 text-sm">
                <option value="">— غير محدد —</option>
                {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </div>
            <div className="lg:col-span-3">
              <F name="notes" label="ملاحظات الأستاذ" defaultValue={editing.notes || ""} />
            </div>
          </div>
          <div className="mt-6 flex gap-3">
            <button type="submit" disabled={isSaving} className="rounded-xl bg-primary px-8 py-3 text-sm font-black text-primary-foreground">
              {isSaving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5 mr-1" />} حفظ التعديلات
            </button>
            <button type="button" onClick={() => setEditing(null)} className="rounded-xl border px-8 py-3 text-sm font-bold">إلغاء</button>
          </div>
        </form>
      )}

      {noting && <NotesModal student={noting} onClose={() => setNoting(null)} />}

      <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
        <table className="w-full text-right text-sm">
          <thead className="bg-primary text-primary-foreground">
            <tr>
              <th className="p-4">الطالب</th>
              <th className="p-4">المجموعة</th>
              <th className="p-4 text-center">إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={3} className="p-20 text-center"><Loader2 className="mx-auto h-10 w-10 animate-spin" /></td></tr>
            ) : filtered.map((s) => (
              <tr key={s.id} className="border-t hover:bg-muted/30">
                <td className="p-4">
                  <div className="font-bold text-primary">{s.full_name}</div>
                  <div className="text-[10px] text-muted-foreground font-mono">كود: {s.code}</div>
                </td>
                <td className="p-4">
                  <span className="text-xs font-bold">{groupMap[s.group_id!] || "—"}</span>
                </td>
                <td className="p-4">
                  <div className="flex justify-center gap-2">
                    <button onClick={() => setNoting(s)} title="ملاحظات لولي الأمر" className="rounded-lg bg-secondary/10 p-2 text-secondary hover:bg-secondary hover:text-white transition-all"><MessageSquarePlus className="h-4 w-4" /></button>
                    <button onClick={() => setEditing(s)} title="تعديل" className="rounded-lg bg-primary/10 p-2 text-primary hover:bg-primary hover:text-white transition-all"><Pencil className="h-4 w-4" /></button>
                    <button onClick={() => remove(s.id, s.full_name)} title="حذف" className="rounded-lg bg-destructive/10 p-2 text-destructive hover:bg-destructive hover:text-white transition-all"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function NotesModal({ student, onClose }: { student: Student; onClose: () => void }) {
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
      toast.success("تم إرسال الملاحظة"); e.currentTarget.reset(); load();
    } catch { toast.error("فشل الحفظ"); }
    finally { setBusy(false); }
  }

  async function handleDel(id: string) {
    if (!confirm("حذف الملاحظة؟")) return;
    try { await deleteNote({ data: { id } }); toast.success("تم الحذف"); load(); }
    catch { toast.error("فشل الحذف"); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-2xl bg-white shadow-2xl flex flex-col">
        <div className="p-4 border-b flex justify-between items-center">
          <h2 className="text-lg font-black flex items-center gap-2"><MessageSquareQuote className="h-5 w-5 text-secondary" /> ملاحظات لولي أمر: {student.full_name}</h2>
          <button onClick={onClose} className="p-2 hover:bg-muted rounded-full"><X className="h-5 w-5" /></button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <form onSubmit={handleAdd} className="p-4 bg-muted/30 rounded-xl space-y-3">
            <input name="title" placeholder="عنوان الملاحظة (مثال: مستوى الحفظ)" required className="w-full rounded-lg border bg-white p-2 text-sm font-bold" />
            <textarea name="body" placeholder="اكتب الملاحظة هنا بالتفصيل لولي الأمر..." required rows={3} className="w-full rounded-lg border bg-white p-2 text-sm" />
            <button type="submit" disabled={busy} className="w-full rounded-lg bg-secondary py-2 text-sm font-bold text-white disabled:opacity-50">
              {busy ? "جارٍ الإرسال..." : "إرسال الملاحظة لصفحة الطالب"}
            </button>
          </form>

          <div className="space-y-2">
            <h3 className="text-xs font-bold text-muted-foreground uppercase">الملاحظات السابقة</h3>
            {loading ? <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" /> : notes.length === 0 ? <p className="text-center text-xs text-muted-foreground py-4">لا توجد ملاحظات مرسلة بعد.</p> : notes.map(n => (
              <div key={n.id} className="p-3 border rounded-xl flex justify-between items-start gap-3 hover:bg-muted/10">
                <div className="flex-1">
                  <div className="font-bold text-sm text-secondary">{n.title}</div>
                  <p className="text-xs mt-1 whitespace-pre-wrap">{n.body}</p>
                  <div className="text-[10px] text-muted-foreground mt-2">{new Date(n.created_at).toLocaleString("ar-EG")}</div>
                </div>
                <button onClick={() => handleDel(n.id)} className="text-destructive p-1 hover:bg-destructive/10 rounded"><Trash2 className="h-4 w-4" /></button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function F({ name, label, defaultValue, required = false }: { name: string; label: string; defaultValue?: string; required?: boolean }) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-bold text-muted-foreground">{label}</label>
      <input name={name} defaultValue={defaultValue} required={required} className="w-full rounded-xl border bg-white px-4 py-2.5 text-sm font-semibold outline-none focus:border-primary" />
    </div>
  );
}
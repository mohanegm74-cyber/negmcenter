import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Search, Trash2, Pencil, Users, X, Loader2, Phone, MapPin, School, Save, MessageSquarePlus, MessageSquareQuote, FilterX } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { getAllStudentsAdmin, deleteStudentAdmin, updateStudentAdmin, getGroupsAdmin, getStudentNotesAdmin, addStudentNoteAdmin, deleteStudentNoteAdmin } from "@/lib/admin.functions";
import { GRADES } from "@/lib/exam-constants";

export const Route = createFileRoute("/_authenticated/students")({
  head: () => ({ meta: [{ title: "إدارة الطلاب التفصيلية — الأستاذ محمد نجم" }, { name: "description", content: "عرض وتعديل كافة بيانات الطلاب وإرسال الملاحظات لأولياء الأمور." }] }),
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

function StudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  
  // حالات البحث والفلترة
  const [search, setSearch] = useState("");
  const [gradeFilter, setGradeFilter] = useState("");
  const [groupFilter, setGroupFilter] = useState("");
  
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
    const t = search.trim().toLowerCase();
    return students.filter(s => {
      const matchesSearch = !t || 
        s.full_name.toLowerCase().includes(t) || 
        s.code.toLowerCase().includes(t) ||
        (s.phone && s.phone.includes(t)) ||
        (s.parent_phone && s.parent_phone.includes(t));
      
      const matchesGrade = !gradeFilter || s.grade === gradeFilter;
      const matchesGroup = !groupFilter || s.group_id === groupFilter;
      
      return matchesSearch && matchesGrade && matchesGroup;
    });
  }, [search, gradeFilter, groupFilter, students]);

  async function remove(id: string, name: string) {
    if (!confirm(`تحذير: هل أنت متأكد من حذف الطالب "${name}"؟ سيتم حذف كافة سجلاته المالية والحضور.`)) return;
    try {
      await deleteStudentFn({ data: { id } });
      toast.success("تم الحذف بنجاح");
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
      toast.success("تم تحديث بيانات الطالب");
      setEditing(null); load();
    } catch (err: any) { toast.error(err.message); }
    finally { setIsSaving(false); }
  }

  function clearFilters() {
    setSearch("");
    setGradeFilter("");
    setGroupFilter("");
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="text-2xl font-black flex items-center gap-2"><Users className="h-6 w-6 text-primary" /> إدارة الطلاب والتواصل</h1>
        <Link to="/student/register" className="rounded-xl bg-primary px-5 py-2.5 text-sm font-black text-primary-foreground shadow-lg hover:opacity-90">
          + إضافة طالب جديد
        </Link>
      </div>

      {/* شريط البحث والفلاتر */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 bg-white p-4 rounded-2xl shadow-sm border border-primary/5">
        <div className="relative">
          <Search className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث بالاسم، الكود، أو الهاتف..." className="w-full rounded-lg border bg-muted/20 py-2 pe-3 ps-9 text-sm outline-none focus:ring-2 focus:ring-primary/20" />
        </div>
        
        <select value={gradeFilter} onChange={e => setGradeFilter(e.target.value)} className="rounded-lg border bg-muted/20 py-2 px-3 text-sm outline-none focus:ring-2 focus:ring-primary/20">
          <option value="">كل الصفوف الدراسية</option>
          {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
        </select>

        <select value={groupFilter} onChange={e => setGroupFilter(e.target.value)} className="rounded-lg border bg-muted/20 py-2 px-3 text-sm outline-none focus:ring-2 focus:ring-primary/20">
          <option value="">كل المجموعات</option>
          {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>

        <button onClick={clearFilters} className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-muted-foreground/30 py-2 px-3 text-sm font-bold text-muted-foreground hover:bg-muted/50">
          <FilterX className="h-4 w-4" /> مسح الفلاتر
        </button>
      </div>

      {editing && (
        <form onSubmit={saveEdit} className="rounded-2xl bg-white p-6 shadow-xl border-2 border-primary animate-in slide-in-from-top-4 duration-300">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-black text-primary flex items-center gap-2"><Pencil className="h-5 w-5" /> تعديل بيانات: {editing.full_name}</h2>
            <button type="button" onClick={() => setEditing(null)} className="rounded-full p-2 hover:bg-muted"><X className="h-5 w-5" /></button>
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
            <F name="address" label="العنوان" defaultValue={editing.address || ""} />
            <F name="national_id" label="الرقم القومي" defaultValue={editing.national_id || ""} />
            <F name="notes" label="ملاحظات إدارية (داخلية)" defaultValue={editing.notes || ""} />
          </div>
          <div className="mt-6 flex gap-3">
            <button type="submit" disabled={isSaving} className="rounded-xl bg-primary px-8 py-3 text-sm font-black text-primary-foreground shadow-lg disabled:opacity-50">
              {isSaving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5 ml-1" />} حفظ التغييرات
            </button>
            <button type="button" onClick={() => setEditing(null)} className="rounded-xl border px-8 py-3 text-sm font-bold">إلغاء</button>
          </div>
        </form>
      )}

      {noting && <NotesModal student={noting} onClose={() => setNoting(null)} />}

      <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead className="bg-primary text-primary-foreground">
              <tr>
                <th className="p-4 whitespace-nowrap">الطالب والصف</th>
                <th className="p-4 whitespace-nowrap">المجموعة</th>
                <th className="p-4 whitespace-nowrap">التواصل</th>
                <th className="p-4 whitespace-nowrap">المدرسة والعنوان</th>
                <th className="p-4 text-center whitespace-nowrap">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-muted/20">
              {loading ? (
                <tr><td colSpan={5} className="p-20 text-center"><Loader2 className="mx-auto h-10 w-10 animate-spin text-primary" /></td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={5} className="p-12 text-center text-muted-foreground">لا يوجد طلاب يطابقون خيارات البحث.</td></tr>
              ) : filtered.map((s) => (
                <tr key={s.id} className="hover:bg-muted/30 transition-colors">
                  <td className="p-4">
                    <div className="font-bold text-primary text-base">{s.full_name}</div>
                    <div className="flex gap-2 items-center mt-1">
                      <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-mono">كود: {s.code}</span>
                      <span className="text-[10px] bg-secondary/10 text-secondary px-1.5 py-0.5 rounded font-bold">{s.grade || "بدون صف"}</span>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="font-bold">{groupMap[s.group_id!] || "—"}</div>
                    {s.section && <div className="text-[10px] text-muted-foreground mt-0.5">{s.section}</div>}
                  </td>
                  <td className="p-4">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-1.5 text-xs font-semibold">
                        <Phone className="h-3 w-3 text-secondary" /> {s.phone || "—"}
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground italic">
                        <Users className="h-3 w-3" /> ولي الأمر: {s.parent_phone || "—"}
                      </div>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex flex-col gap-1 max-w-[200px]">
                      <div className="flex items-center gap-1.5 text-xs line-clamp-1">
                        <School className="h-3 w-3 text-gold-foreground" /> {s.school || "—"}
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground line-clamp-1">
                        <MapPin className="h-3 w-3" /> {s.address || "—"}
                      </div>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex justify-center gap-2">
                      <button onClick={() => setNoting(s)} title="إرسال ملاحظة لولي الأمر" className="rounded-lg bg-secondary/10 p-2.5 text-secondary hover:bg-secondary hover:text-white transition-all shadow-sm">
                        <MessageSquarePlus className="h-4 w-4" />
                      </button>
                      <button onClick={() => setEditing(s)} title="تعديل البيانات" className="rounded-lg bg-primary/10 p-2.5 text-primary hover:bg-primary hover:text-white transition-all shadow-sm">
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button onClick={() => remove(s.id, s.full_name)} title="حذف الطالب" className="rounded-lg bg-destructive/10 p-2.5 text-destructive hover:bg-destructive hover:text-white transition-all shadow-sm">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
      toast.success("تم إرسال الملاحظة بنجاح"); e.currentTarget.reset(); load();
    } catch { toast.error("فشل إرسال الملاحظة"); }
    finally { setBusy(false); }
  }

  async function handleDel(id: string) {
    if (!confirm("هل تريد حذف هذه الملاحظة؟ لن تظهر في صفحة الطالب بعد الحذف.")) return;
    try { await deleteNote({ data: { id } }); toast.success("تم الحذف"); load(); }
    catch { toast.error("فشل الحذف"); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-3xl bg-white shadow-2xl flex flex-col border border-primary/10">
        <div className="p-5 border-b flex justify-between items-center bg-primary/5">
          <div>
            <h2 className="text-xl font-black flex items-center gap-2 text-primary"><MessageSquareQuote className="h-6 w-6 text-secondary" /> تواصل مع ولي أمر الطالب</h2>
            <p className="text-xs text-muted-foreground mt-1 font-bold">{student.full_name} — كود {student.code}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white rounded-full transition-colors"><X className="h-6 w-6" /></button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          <form onSubmit={handleAdd} className="p-5 bg-secondary/5 rounded-2xl border border-secondary/10 space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-black text-secondary">عنوان الملاحظة</label>
              <input name="title" placeholder="مثال: تنبيه بخصوص الواجب، تميز في الحفظ..." required className="w-full rounded-xl border bg-white p-3 text-sm font-bold outline-none focus:border-secondary" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-black text-secondary">نص الملاحظة بالتفصيل</label>
              <textarea name="body" placeholder="اكتب هنا ما تريد إبلاغه لولي الأمر، سيظهر فوراً في بوابته..." required rows={4} className="w-full rounded-xl border bg-white p-3 text-sm outline-none focus:border-secondary" />
            </div>
            <button type="submit" disabled={busy} className="w-full rounded-xl bg-secondary py-3 text-sm font-black text-white shadow-lg shadow-secondary/20 transition hover:opacity-90 disabled:opacity-50">
              {busy ? "جارٍ الإرسال..." : "إرسال الملاحظة لولي الأمر"}
            </button>
          </form>

          <div className="space-y-3">
            <h3 className="text-sm font-black text-muted-foreground flex items-center gap-2">
              <div className="h-1 flex-1 bg-muted/30"></div>
              سجل الملاحظات المرسلة
              <div className="h-1 flex-1 bg-muted/30"></div>
            </h3>
            {loading ? <Loader2 className="mx-auto h-8 w-8 animate-spin text-muted-foreground opacity-20" /> : notes.length === 0 ? <p className="text-center text-sm text-muted-foreground py-10 italic">لا توجد ملاحظات سابقة لهذا الطالب.</p> : notes.map(n => (
              <div key={n.id} className="p-4 border rounded-2xl flex justify-between items-start gap-3 hover:bg-muted/5 transition-all">
                <div className="flex-1">
                  <div className="font-black text-base text-secondary">{n.title}</div>
                  <p className="text-sm mt-2 text-foreground/80 leading-relaxed whitespace-pre-wrap">{n.body}</p>
                  <div className="text-[10px] text-muted-foreground mt-3 font-bold bg-muted/30 inline-block px-2 py-0.5 rounded-full">{new Date(n.created_at).toLocaleString("ar-EG")}</div>
                </div>
                <button onClick={() => handleDel(n.id)} className="text-destructive p-2 hover:bg-destructive/10 rounded-xl transition-colors">
                  <Trash2 className="h-5 w-5" />
                </button>
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
      <label className="text-[11px] font-black text-muted-foreground uppercase">{label}</label>
      <input name={name} defaultValue={defaultValue} required={required} className="w-full rounded-xl border bg-white px-4 py-2.5 text-sm font-bold outline-none focus:border-primary focus:ring-2 focus:ring-primary/5 transition-all" />
    </div>
  );
}
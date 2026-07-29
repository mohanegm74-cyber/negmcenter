import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Search, Trash2, Pencil, Users, X, Loader2, Phone, MapPin, School, GraduationCap, Save, Boxes, Info, Calendar } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { getAllStudentsAdmin, deleteStudentAdmin, updateStudentAdmin } from "@/lib/admin.functions";

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
  const [isSaving, setIsSaving] = useState(false);
  
  const loadStudentsFn = useServerFn(getAllStudentsAdmin);
  const deleteStudentFn = useServerFn(deleteStudentAdmin);
  const updateStudentFn = useServerFn(updateStudentAdmin);

  async function load() {
    setLoading(true);
    try {
      const { students: st } = await loadStudentsFn({});
      const { data: g } = await supabase.from("groups").select("id,name,grade").order("name");
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
      (s.parent_phone && s.parent_phone.includes(t)) ||
      (s.school && s.school.toLowerCase().includes(t))
    );
  }, [q, students]);

  async function remove(id: string, name: string) {
    if (!confirm(`هل أنت متأكد من حذف الطالب "${name}" نهائياً؟ لا يمكن التراجع عن هذا الإجراء.`)) return;
    try {
      await deleteStudentFn({ data: { id } });
      toast.success("تم حذف الطالب بنجاح");
      load();
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  async function saveEdit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editing) return;
    setIsSaving(true);
    const fd = new FormData(e.currentTarget);
    const payload: any = {};
    fd.forEach((v, k) => { 
      const val = String(v).trim();
      payload[k] = val === "" ? null : val; 
    });
    
    try {
      await updateStudentFn({ data: { id: editing.id, payload } });
      toast.success("تم تحديث كافة بيانات الطالب بنجاح");
      setEditing(null);
      load();
    } catch (err: any) {
      toast.error("فشل الحفظ: " + err.message);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="text-2xl font-black flex items-center gap-2"><Users className="h-6 w-6 text-primary" /> إدارة الطلاب</h1>
        <div className="flex gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-80">
            <Search className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="بحث بالاسم، الكود، أو الهاتف..." className="w-full rounded-lg border bg-white py-2 pe-3 ps-9 text-sm outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <Link to="/student/register" className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground shadow-sm hover:opacity-90">إضافة طالب</Link>
        </div>
      </div>

      {editing && (
        <form onSubmit={saveEdit} className="rounded-2xl bg-white p-6 shadow-xl border-2 border-primary animate-in fade-in zoom-in-95 duration-200">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-black text-primary flex items-center gap-2"><Pencil className="h-5 w-5" /> تعديل شامل: {editing.full_name}</h2>
            <button type="button" onClick={() => setEditing(null)} className="rounded-full p-2 hover:bg-muted"><X className="h-5 w-5" /></button>
          </div>
          
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <F name="full_name" label="الاسم الرباعي" defaultValue={editing.full_name} required />
            <F name="phone" label="هاتف الطالب" defaultValue={editing.phone || ""} />
            <F name="parent_phone" label="هاتف ولي الأمر" defaultValue={editing.parent_phone || ""} />
            <F name="national_id" label="الرقم القومي" defaultValue={editing.national_id || ""} />
            <F name="birth_date" label="تاريخ الميلاد" type="date" defaultValue={editing.birth_date || ""} />
            
            <div>
              <label className="mb-1.5 block text-sm font-semibold">المحافظة</label>
              <select name="governorate" defaultValue={editing.governorate || ""} className="w-full rounded-lg border border-input bg-white px-3 py-2 text-sm">
                <option value="">— اختر —</option>
                {GOVERNORATES.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>

            <F name="education_dept" label="الإدارة التعليمية" defaultValue={editing.education_dept || ""} />
            <F name="school" label="المدرسة" defaultValue={editing.school || ""} />
            <F name="grade" label="الصف الدراسي" defaultValue={editing.grade || ""} />
            <F name="section" label="الشعبة" defaultValue={editing.section || ""} />
            <F name="subject" label="المادة" defaultValue={editing.subject || ""} />
            <F name="teacher_name" label="اسم المعلم" defaultValue={editing.teacher_name || ""} />
            
            <div>
              <label className="mb-1.5 block text-sm font-semibold">المجموعة الحالية</label>
              <select name="group_id" defaultValue={editing.group_id || ""} className="w-full rounded-lg border border-input bg-white px-3 py-2 text-sm">
                <option value="">— غير محدد —</option>
                {groups.map(g => <option key={g.id} value={g.id}>{g.name} ({g.grade})</option>)}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-semibold">الحالة</label>
              <select name="active" defaultValue={String(editing.active)} className="w-full rounded-lg border border-input bg-white px-3 py-2 text-sm">
                <option value="true">نشط</option>
                <option value="false">غير نشط (مجمد)</option>
              </select>
            </div>

            <div className="lg:col-span-2">
              <F name="address" label="العنوان بالتفصيل" defaultValue={editing.address || ""} />
            </div>

            <div className="lg:col-span-3">
              <label className="mb-1.5 block text-sm font-semibold">ملاحظات الأستاذ</label>
              <textarea name="notes" defaultValue={editing.notes || ""} rows={3} className="w-full rounded-xl border-2 border-input bg-white px-4 py-2 text-sm outline-none focus:border-primary transition-all" placeholder="أي ملاحظات إضافية عن الطالب..." />
            </div>
          </div>

          <div className="mt-6 flex gap-3">
            <button type="submit" disabled={isSaving} className="inline-flex items-center gap-2 rounded-xl bg-primary px-8 py-3 text-sm font-black text-primary-foreground shadow-lg hover:opacity-90 transition-all active:scale-95 disabled:opacity-50">
              {isSaving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
              حفظ كافة التعديلات
            </button>
            <button type="button" onClick={() => setEditing(null)} className="rounded-xl border-2 bg-white px-8 py-3 text-sm font-bold hover:bg-muted transition-all">إلغاء</button>
          </div>
        </form>
      )}

      <div className="overflow-hidden rounded-2xl border bg-white shadow-md">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead className="bg-primary text-primary-foreground">
              <tr>
                <th className="p-4">بيانات الطالب والكود</th>
                <th className="p-4">أرقام الهواتف</th>
                <th className="p-4">المجموعة والصف</th>
                <th className="p-4">المدرسة والمكان</th>
                <th className="p-4 text-center">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="p-20 text-center text-muted-foreground"><Loader2 className="mx-auto h-10 w-10 animate-spin" /></td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={5} className="p-20 text-center text-muted-foreground">لا توجد نتائج بحث.</td></tr>
              ) : (
                filtered.map((s) => (
                  <tr key={s.id} className="border-t hover:bg-primary/5 transition-colors">
                    <td className="p-4">
                      <div className="font-bold text-primary flex items-center gap-1.5">
                        {s.full_name}
                        {!s.active && <span className="rounded bg-destructive/10 px-1.5 py-0.5 text-[10px] text-destructive">غير نشط</span>}
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-0.5 font-mono">كود: {s.code}</div>
                    </td>
                    <td className="p-4">
                      {s.phone && <div className="flex items-center gap-1 text-xs"><Phone className="h-3 w-3 text-secondary" /> {s.phone}</div>}
                      {s.parent_phone && <div className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground"><Users className="h-3 w-3" /> و.أمر: {s.parent_phone}</div>}
                      {!s.phone && !s.parent_phone && <span className="text-muted-foreground italic">لا يوجد هاتف</span>}
                    </td>
                    <td className="p-4">
                      <div className="text-xs font-bold">{s.grade || "—"}</div>
                      {s.group_id ? (
                        <div className="mt-1 inline-flex items-center gap-1 rounded bg-secondary/10 px-2 py-0.5 text-[10px] font-bold text-secondary">
                          <Boxes className="h-2.5 w-2.5" /> {groupMap[s.group_id] || "—"}
                        </div>
                      ) : <div className="mt-1 text-[10px] text-destructive italic">غير مرتبط بمجموعة</div>}
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-1 text-xs"><School className="h-3 w-3 text-muted-foreground" /> {s.school || "—"}</div>
                      <div className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground truncate max-w-[150px]"><MapPin className="h-3 w-3" /> {s.governorate || s.address || "—"}</div>
                    </td>
                    <td className="p-4">
                      <div className="flex justify-center gap-2">
                        <button onClick={() => setEditing(s)} title="تعديل شامل" className="rounded-lg bg-primary/10 p-2 text-primary hover:bg-primary hover:text-white transition-all"><Pencil className="h-4 w-4" /></button>
                        <button onClick={() => remove(s.id, s.full_name)} title="حذف الطالب" className="rounded-lg bg-destructive/10 p-2 text-destructive hover:bg-destructive hover:text-white transition-all"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function F({ name, label, defaultValue, type = "text", required = false }: { name: string; label: string; defaultValue?: string; type?: string; required?: boolean }) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-bold text-muted-foreground">{label}</label>
      <input name={name} type={type} defaultValue={defaultValue} required={required} className="w-full rounded-xl border-2 border-input bg-white px-4 py-2.5 text-sm font-semibold outline-none focus:border-primary transition-all" />
    </div>
  );
}
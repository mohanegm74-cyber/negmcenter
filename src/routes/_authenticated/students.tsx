import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Search, Trash2, Pencil, Users, X, Loader2, Phone, MapPin, School, GraduationCap, Save, Boxes } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { getAllStudentsAdmin, deleteStudentAdmin, updateStudentAdmin } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/students")({
  head: () => ({ meta: [{ title: "إدارة الطلاب — الأستاذ محمد نجم" }, { name: "description", content: "إدارة طلاب السنتر وتعديل بياناتهم." }] }),
  component: StudentsPage,
});

type Student = {
  id: string; code: string; full_name: string; phone: string | null; parent_phone: string | null;
  grade: string | null; group_id: string | null; active: boolean; address: string | null;
  school: string | null; section: string | null;
};
type Group = { id: string; name: string; grade: string | null };

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
    fd.forEach((v, k) => { payload[k] = String(v).trim() || null; });
    
    try {
      await updateStudentFn({ data: { id: editing.id, payload } });
      toast.success("تم تحديث بيانات الطالب بنجاح");
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
        <form onSubmit={saveEdit} className="rounded-2xl bg-white p-6 shadow-xl border-2 border-primary">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-black text-primary">تعديل: {editing.full_name}</h2>
            <button type="button" onClick={() => setEditing(null)} className="rounded-full p-2 hover:bg-muted"><X className="h-5 w-5" /></button>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <F name="full_name" label="الاسم" defaultValue={editing.full_name} />
            <F name="phone" label="الهاتف" defaultValue={editing.phone || ""} />
            <F name="parent_phone" label="هاتف ولي الأمر" defaultValue={editing.parent_phone || ""} />
            <F name="school" label="المدرسة" defaultValue={editing.school || ""} />
            <F name="grade" label="الصف" defaultValue={editing.grade || ""} />
            <div>
              <label className="mb-1.5 block text-sm font-semibold">المجموعة</label>
              <select name="group_id" defaultValue={editing.group_id || ""} className="w-full rounded-lg border border-input bg-white px-3 py-2 text-sm">
                <option value="">— اختر مجموعة —</option>
                {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </div>
          </div>
          <div className="mt-6 flex gap-3">
            <button type="submit" disabled={isSaving} className="rounded-lg bg-primary px-8 py-2.5 text-sm font-black text-primary-foreground">
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin inline mr-2" /> : null}
              حفظ التغييرات
            </button>
            <button type="button" onClick={() => setEditing(null)} className="rounded-lg border bg-white px-8 py-2.5 text-sm font-bold hover:bg-muted">إلغاء</button>
          </div>
        </form>
      )}

      <div className="overflow-hidden rounded-2xl border bg-white shadow-md">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead className="bg-primary text-primary-foreground">
              <tr>
                <th className="p-4">بيانات الطالب</th>
                <th className="p-4">المجموعة</th>
                <th className="p-4">المدرسة والعنوان</th>
                <th className="p-4 text-center">الإجراءات</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={4} className="p-20 text-center text-muted-foreground"><Loader2 className="mx-auto h-10 w-10 animate-spin" /></td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={4} className="p-20 text-center text-muted-foreground">لا توجد نتائج.</td></tr>
              ) : (
                filtered.map((s) => (
                  <tr key={s.id} className="border-t hover:bg-primary/5">
                    <td className="p-4">
                      <div className="font-bold text-primary">{s.full_name}</div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">كود: {s.code} · {s.grade}</div>
                    </td>
                    <td className="p-4">
                      {s.group_id ? (
                        <div className="inline-flex items-center gap-1.5 rounded-full bg-secondary/10 px-3 py-1 text-xs font-bold text-secondary">
                          <Boxes className="h-3 w-3" /> {groupMap[s.group_id] || "غير متوفر"}
                        </div>
                      ) : <span className="text-xs text-muted-foreground italic">لم يحدد مجموعة</span>}
                    </td>
                    <td className="p-4">
                      <div className="text-xs font-semibold">{s.school || "—"}</div>
                      <div className="text-[11px] text-muted-foreground mt-0.5 truncate max-w-[200px]">{s.address || "—"}</div>
                    </td>
                    <td className="p-4">
                      <div className="flex justify-center gap-2">
                        <button onClick={() => setEditing(s)} className="rounded-lg bg-primary/10 p-2 text-primary hover:bg-primary hover:text-white transition-all"><Pencil className="h-4 w-4" /></button>
                        <button onClick={() => remove(s.id, s.full_name)} className="rounded-lg bg-destructive/10 p-2 text-destructive hover:bg-destructive hover:text-white transition-all"><Trash2 className="h-4 w-4" /></button>
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

function F({ name, label, defaultValue, required = false }: { name: string; label: string; defaultValue?: string; required?: boolean }) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-bold text-muted-foreground">{label}</label>
      <input name={name} defaultValue={defaultValue} required={required} className="w-full rounded-xl border-2 border-input bg-white px-4 py-2.5 text-sm font-semibold outline-none focus:border-primary transition-all" />
    </div>
  );
}
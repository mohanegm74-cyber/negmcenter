import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Search, Trash2, Pencil, Users, X, Loader2, Link as LinkIcon } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { getAllStudentsAdmin } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/students")({
  head: () => ({ meta: [{ title: "الطلاب — الأستاذ" }, { name: "description", content: "إدارة طلاب السنتر." }] }),
  component: StudentsPage,
});

type Student = {
  id: string; code: string; full_name: string; phone: string | null; parent_phone: string | null;
  grade: string | null; group_id: string | null; active: boolean;
};
type Group = { id: string; name: string; grade: string | null };

function StudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Student | null>(null);
  
  const loadStudentsFn = useServerFn(getAllStudentsAdmin);

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

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    return students.filter(s => !t || s.full_name.toLowerCase().includes(t) || s.code.toLowerCase().includes(t));
  }, [q, students]);

  async function assignGroup(id: string, group_id: string) {
    const { error } = await supabase.from("students").update({ group_id: group_id || null }).eq("id", id);
    if (error) toast.error(error.message); else { toast.success("تم ربط الطالب بالمجموعة بنجاح"); load(); }
  }

  async function remove(id: string) {
    if (!confirm("حذف الطالب نهائياً؟")) return;
    const { error } = await supabase.from("students").delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success("تم الحذف"); load(); }
  }

  async function saveEdit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editing) return;
    const fd = new FormData(e.currentTarget);
    const payload: any = {};
    fd.forEach((v, k) => { payload[k] = String(v).trim() || null; });
    const { error } = await supabase.from("students").update(payload).eq("id", editing.id);
    if (error) toast.error(error.message); else { toast.success("تم تحديث البيانات"); setEditing(null); load(); }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="text-2xl font-black flex items-center gap-2"><Users className="h-6 w-6 text-primary" /> إدارة الطلاب</h1>
        <div className="flex gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="بحث بالاسم أو الكود..." className="w-full rounded-lg border bg-white py-2 pe-3 ps-9 text-sm outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <Link to="/student/register" className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground shadow-sm">إضافة طالب</Link>
        </div>
      </div>

      {editing && (
        <form onSubmit={saveEdit} className="rounded-2xl bg-white p-5 shadow-sm border-2 border-primary animate-in fade-in slide-in-from-top-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-bold">تعديل بيانات: {editing.full_name}</h2>
            <button type="button" onClick={() => setEditing(null)} className="rounded p-1 hover:bg-accent"><X className="h-4 w-4" /></button>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <F name="full_name" label="الاسم *" required defaultValue={editing.full_name} />
            <F name="phone" label="رقم الهاتف" defaultValue={editing.phone || ""} />
            <F name="parent_phone" label="هاتف ولي الأمر" defaultValue={editing.parent_phone || ""} />
            <F name="grade" label="الصف الدراسي" defaultValue={editing.grade || ""} />
          </div>
          <div className="mt-4 flex gap-2">
            <button type="submit" className="rounded-lg bg-primary px-5 py-2 text-sm font-bold text-primary-foreground shadow-md">حفظ التعديلات</button>
            <button type="button" onClick={() => setEditing(null)} className="rounded-lg border px-5 py-2 text-sm font-bold">إلغاء</button>
          </div>
        </form>
      )}

      <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead className="bg-primary text-primary-foreground">
              <tr>
                <th className="p-3">الطالب</th>
                <th className="p-3">الكود</th>
                <th className="p-3">المجموعة (الربط الفوري)</th>
                <th className="p-3">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={4} className="p-8 text-center text-muted-foreground"><Loader2 className="mx-auto h-6 w-6 animate-spin mb-2" /> جارٍ التحميل...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={4} className="p-8 text-center text-muted-foreground">لا يوجد طلاب مطابقين للبحث.</td></tr>
              ) : (
                filtered.map((s, i) => (
                  <tr key={s.id} className={`border-t hover:bg-muted/30 ${i % 2 ? 'bg-muted/5' : ''}`}>
                    <td className="p-3">
                      <div className="font-bold">{s.full_name}</div>
                      <div className="text-[10px] text-muted-foreground">{s.grade || 'بدون صف'}</div>
                    </td>
                    <td className="p-3 font-mono text-xs">{s.code}</td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <LinkIcon className="h-3 w-3 text-muted-foreground" />
                        <select value={s.group_id || ""} onChange={e => assignGroup(s.id, e.target.value)} className={`flex-1 rounded-md border px-2 py-1.5 text-xs font-semibold ${!s.group_id ? 'border-amber-400 bg-amber-50 text-amber-700' : 'bg-white'}`}>
                          <option value="">— فك الارتباط / بدون مجموعة —</option>
                          {groups.map(g => <option key={g.id} value={g.id}>{g.name} ({g.grade || '—'})</option>)}
                        </select>
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="flex gap-1">
                        <button onClick={() => setEditing(s)} className="rounded-lg p-2 text-primary hover:bg-primary/10 transition-colors" title="تعديل"><Pencil className="h-4 w-4" /></button>
                        <button onClick={() => remove(s.id)} className="rounded-lg p-2 text-destructive hover:bg-destructive/10 transition-colors" title="حذف"><Trash2 className="h-4 w-4" /></button>
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
    <div>
      <label className="mb-1.5 block text-sm font-semibold">{label}</label>
      <input name={name} defaultValue={defaultValue} required={required} className="w-full rounded-lg border border-input px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" />
    </div>
  );
}
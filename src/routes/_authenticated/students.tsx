import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Search, Trash2, Pencil, Users, X, Loader2, AlertTriangle } from "lucide-react";
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
type Group = { id: string; name: string };

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
      const { data: g } = await supabase.from("groups").select("id,name").order("name");
      setStudents(st as Student[]);
      setGroups(g as Group[]);
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
    if (error) toast.error(error.message); else { toast.success("تم التحديث"); load(); }
  }

  async function remove(id: string) {
    if (!confirm("حذف الطالب نهائياً؟")) return;
    const { error } = await supabase.from("students").delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success("تم الحذف"); load(); }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-black">إدارة الطلاب</h1>
        <div className="flex gap-2">
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="بحث..." className="rounded-lg border px-3 py-2 text-sm" />
          <Link to="/student/register" className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground">إضافة طالب</Link>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
        <table className="w-full text-right text-sm">
          <thead className="bg-muted/50"><tr><th className="p-3">الطالب</th><th className="p-3">الكود</th><th className="p-3">المجموعة</th><th className="p-3">إجراءات</th></tr></thead>
          <tbody>
            {filtered.map(s => (
              <tr key={s.id} className="border-t">
                <td className="p-3 font-bold">{s.full_name}</td>
                <td className="p-3 font-mono text-xs">{s.code}</td>
                <td className="p-3">
                  <select value={s.group_id || ""} onChange={e => assignGroup(s.id, e.target.value)} className="rounded border p-1 text-xs">
                    <option value="">— اختر —</option>
                    {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </select>
                </td>
                <td className="p-3 flex gap-2">
                  <button onClick={() => remove(s.id)} className="text-destructive"><Trash2 className="h-4 w-4" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Search, Trash2, Pencil, Users, X, Printer, StickyNote, Sparkles, Loader2 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { openPrint, esc } from "@/lib/print";
import { generateStudentReport } from "@/lib/ai-report.functions";
import { getAllStudentsAdmin } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/students")({
  head: () => ({ meta: [{ title: "الطلاب — الأستاذ" }, { name: "description", content: "إدارة طلاب السنتر." }] }),
  component: StudentsPage,
});

type Student = {
  id: string; code: string; full_name: string; phone: string | null; parent_phone: string | null;
  grade: string | null; group_id: string | null; subject: string | null; section: string | null;
  school: string | null; gender: string | null; active: boolean;
};
type Group = { id: string; name: string };

function StudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [gradeFilter, setGradeFilter] = useState("");
  const [groupFilter, setGroupFilter] = useState("");
  const [editing, setEditing] = useState<Student | null>(null);
  
  const loadStudentsFn = useServerFn(getAllStudentsAdmin);

  async function load() {
    setLoading(true);
    try {
      const { students: st } = await loadStudentsFn({});
      const { data: g } = await supabase.from("groups").select("id,name").order("name");
      setStudents((st as Student[]) || []);
      setGroups((g as Group[]) || []);
    } catch (err: any) {
      toast.error("تعذر تحميل الطلاب: " + err.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  const grades = useMemo(() => Array.from(new Set(students.map(s => s.grade).filter(Boolean))) as string[], [students]);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    return students.filter(s => {
      if (gradeFilter && s.grade !== gradeFilter) return false;
      if (groupFilter && s.group_id !== groupFilter) return false;
      if (t && ![s.full_name, s.code, s.phone, s.parent_phone, s.grade].filter(Boolean).some(v => String(v).toLowerCase().includes(t))) return false;
      return true;
    });
  }, [q, students, gradeFilter, groupFilter]);

  async function assignGroup(id: string, group_id: string) {
    const { error } = await supabase.from("students").update({ group_id: group_id || null }).eq("id", id);
    if (error) toast.error(error.message); else { toast.success("تم التحديث"); load(); }
  }

  async function toggleActive(s: Student) {
    const { error } = await supabase.from("students").update({ active: !s.active }).eq("id", s.id);
    if (error) toast.error(error.message); else { toast.success(!s.active ? "تم التفعيل" : "تم الإيقاف"); load(); }
  }

  async function remove(id: string) {
    if (!confirm("حذف هذا الطالب نهائياً؟ سيتم حذف الحضور والمدفوعات المرتبطة.")) return;
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
    if (error) toast.error(error.message); else { toast.success("تم التحديث"); setEditing(null); load(); }
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-black">الطلاب <span className="text-sm font-normal text-muted-foreground">({filtered.length}/{students.length})</span></h1>
        <div className="flex flex-wrap items-center gap-2">
          <select value={gradeFilter} onChange={(e) => setGradeFilter(e.target.value)} className="rounded-lg border border-input bg-white px-3 py-2 text-sm">
            <option value="">كل الصفوف</option>
            {grades.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
          <select value={groupFilter} onChange={(e) => setGroupFilter(e.target.value)} className="rounded-lg border border-input bg-white px-3 py-2 text-sm">
            <option value="">كل المجموعات</option>
            {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
          <div className="relative w-full max-w-xs">
            <Search className="pointer-events-none absolute inset-y-0 right-3 my-auto h-4 w-4 text-muted-foreground" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="بحث بالاسم، الكود..." className="w-full rounded-lg border border-input bg-white py-2 pe-9 ps-3 text-sm outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <button onClick={load} className="rounded-lg border p-2 hover:bg-accent"><Loader2 className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /></button>
          <Link to="/student/register" className="rounded-lg bg-secondary px-3 py-2 text-sm font-bold text-secondary-foreground">+ إضافة طالب</Link>
        </div>
      </div>

      {editing && (
        <form onSubmit={saveEdit} className="mb-4 rounded-2xl bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-bold">تعديل: {editing.full_name}</h2>
            <button type="button" onClick={() => setEditing(null)} className="rounded p-1 hover:bg-accent"><X className="h-4 w-4" /></button>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <EF name="full_name" label="الاسم *" required defaultValue={editing.full_name} />
            <EF name="phone" label="الهاتف" defaultValue={editing.phone ?? ""} />
            <EF name="parent_phone" label="هاتف ولي الأمر" defaultValue={editing.parent_phone ?? ""} />
            <EF name="grade" label="الصف" defaultValue={editing.grade ?? ""} />
            <EF name="section" label="الشعبة" defaultValue={editing.section ?? ""} />
          </div>
          <button type="submit" className="mt-4 rounded-lg bg-primary px-5 py-2 text-sm font-bold text-primary-foreground">حفظ التعديلات</button>
        </form>
      )}

      {loading ? (
        <div className="p-12 text-center text-muted-foreground">جارٍ تحميل بيانات الطلاب...</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl bg-white p-12 text-center text-muted-foreground shadow-sm">لا يوجد طلاب.</div>
      ) : (
        <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-primary text-primary-foreground text-right">
                <tr><th className="p-3">الاسم</th><th className="p-3">الكود</th><th className="p-3">الصف</th><th className="p-3">المجموعة</th><th className="p-3">الحالة</th><th className="p-3"></th></tr>
              </thead>
              <tbody>
                {filtered.map((s, i) => (
                  <tr key={s.id} className={`border-t hover:bg-muted/30 ${i % 2 ? "bg-muted/10" : ""}`}>
                    <td className="p-3 font-semibold">{s.full_name}</td>
                    <td className="p-3 font-mono text-xs">{s.code}</td>
                    <td className="p-3">{s.grade || "—"}</td>
                    <td className="p-3">
                      <select value={s.group_id || ""} onChange={(e) => assignGroup(s.id, e.target.value)} className="rounded-md border border-input bg-white px-2 py-1 text-sm">
                        <option value="">— بدون —</option>
                        {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                      </select>
                    </td>
                    <td className="p-3">
                      <button onClick={() => toggleActive(s)} className={`rounded-full px-2 py-0.5 text-xs font-bold ${s.active ? "bg-secondary/15 text-secondary" : "bg-muted text-muted-foreground"}`}>
                        {s.active ? "نشط" : "موقوف"}
                      </button>
                    </td>
                    <td className="p-3 text-left">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => setEditing(s)} className="rounded-lg p-1.5 text-primary hover:bg-primary/10"><Pencil className="h-4 w-4" /></button>
                        <button onClick={() => remove(s.id)} className="rounded-lg p-1.5 text-destructive hover:bg-destructive/10"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function EF({ name, label, defaultValue, required = false }: { name: string; label: string; defaultValue?: string; required?: boolean }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-semibold">{label}</label>
      <input name={name} defaultValue={defaultValue} required={required} className="w-full rounded-lg border border-input px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" />
    </div>
  );
}
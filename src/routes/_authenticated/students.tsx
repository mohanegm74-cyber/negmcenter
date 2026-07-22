import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Search, Trash2, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/students")({
  head: () => ({ meta: [{ title: "الطلاب — الأستاذ" }, { name: "description", content: "إدارة طلاب السنتر." }] }),
  component: StudentsPage,
});

type Student = { id: string; code: string; full_name: string; phone: string | null; grade: string | null; group_id: string | null; subject: string | null; };
type Group = { id: string; name: string };

function StudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [q, setQ] = useState("");

  async function load() {
    const [{ data: s }, { data: g }] = await Promise.all([
      supabase.from("students").select("id,code,full_name,phone,grade,group_id,subject").order("created_at", { ascending: false }),
      supabase.from("groups").select("id,name").order("name"),
    ]);
    setStudents((s as Student[]) || []);
    setGroups((g as Group[]) || []);
  }
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return students;
    return students.filter(s => [s.full_name, s.code, s.phone, s.grade].filter(Boolean).some(v => String(v).toLowerCase().includes(t)));
  }, [q, students]);

  async function assignGroup(id: string, group_id: string) {
    const { error } = await supabase.from("students").update({ group_id: group_id || null }).eq("id", id);
    if (error) toast.error(error.message); else { toast.success("تم التحديث"); load(); }
  }

  async function remove(id: string) {
    if (!confirm("حذف هذا الطالب؟")) return;
    const { error } = await supabase.from("students").delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success("تم الحذف"); load(); }
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-black">الطلاب <span className="text-sm font-normal text-muted-foreground">({students.length})</span></h1>
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute inset-y-0 right-3 my-auto h-4 w-4 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="بحث بالاسم أو الكود..." className="w-full rounded-lg border border-input bg-white py-2 pe-9 ps-3 text-sm outline-none focus:ring-2 focus:ring-ring" />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl bg-white p-12 text-center text-muted-foreground shadow-sm">
          <Users className="mx-auto mb-3 h-10 w-10" /> لا يوجد طلاب مطابقون.
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-right">
                <tr>
                  <th className="p-3">الاسم</th>
                  <th className="p-3">الكود</th>
                  <th className="p-3">الصف</th>
                  <th className="p-3">الهاتف</th>
                  <th className="p-3">المجموعة</th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <tr key={s.id} className="border-t hover:bg-muted/30">
                    <td className="p-3 font-semibold">{s.full_name}</td>
                    <td className="p-3 font-mono text-xs">{s.code}</td>
                    <td className="p-3">{s.grade || "—"}</td>
                    <td className="p-3" dir="ltr">{s.phone || "—"}</td>
                    <td className="p-3">
                      <select value={s.group_id || ""} onChange={(e) => assignGroup(s.id, e.target.value)} className="rounded-md border border-input bg-white px-2 py-1 text-sm">
                        <option value="">— بدون —</option>
                        {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                      </select>
                    </td>
                    <td className="p-3 text-left">
                      <button onClick={() => remove(s.id)} className="rounded-lg p-1.5 text-destructive hover:bg-destructive/10"><Trash2 className="h-4 w-4" /></button>
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

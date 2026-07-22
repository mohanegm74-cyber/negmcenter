import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Check, X, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/attendance")({
  head: () => ({ meta: [{ title: "الحضور — الأستاذ" }, { name: "description", content: "تسجيل حضور الطلاب حسب المجموعة." }] }),
  component: AttendancePage,
});

type Group = { id: string; name: string };
type Student = { id: string; full_name: string; code: string };
type Att = { student_id: string; status: string };

function AttendancePage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [groupId, setGroupId] = useState<string>("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [students, setStudents] = useState<Student[]>([]);
  const [statusMap, setStatusMap] = useState<Record<string, string>>({});

  useEffect(() => { supabase.from("groups").select("id,name").order("name").then(({ data }) => setGroups((data as Group[]) || [])); }, []);

  useEffect(() => {
    if (!groupId) { setStudents([]); return; }
    (async () => {
      const { data: st } = await supabase.from("students").select("id,full_name,code").eq("group_id", groupId).order("full_name");
      setStudents((st as Student[]) || []);
      const { data: at } = await supabase.from("attendance").select("student_id,status").eq("group_id", groupId).eq("date", date);
      const map: Record<string, string> = {};
      (at as Att[] | null)?.forEach(a => { map[a.student_id] = a.status; });
      setStatusMap(map);
    })();
  }, [groupId, date]);

  async function mark(student_id: string, status: "present" | "absent" | "late") {
    const { error } = await supabase.from("attendance").upsert({ student_id, group_id: groupId, date, status }, { onConflict: "student_id,date" });
    if (error) { toast.error(error.message); return; }
    setStatusMap(m => ({ ...m, [student_id]: status }));
  }

  async function markAll(status: "present" | "absent") {
    if (!students.length) return;
    const rows = students.map(s => ({ student_id: s.id, group_id: groupId, date, status }));
    const { error } = await supabase.from("attendance").upsert(rows, { onConflict: "student_id,date" });
    if (error) toast.error(error.message);
    else { toast.success("تم التسجيل"); setStatusMap(Object.fromEntries(students.map(s => [s.id, status]))); }
  }

  return (
    <div>
      <h1 className="mb-4 text-2xl font-black">تسجيل الحضور</h1>
      <div className="mb-4 grid grid-cols-1 gap-3 rounded-2xl bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className="mb-1.5 block text-sm font-semibold">المجموعة</label>
          <select value={groupId} onChange={(e) => setGroupId(e.target.value)} className="w-full rounded-lg border border-input bg-white px-3 py-2 text-sm">
            <option value="">— اختر —</option>
            {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-semibold">التاريخ</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full rounded-lg border border-input bg-white px-3 py-2 text-sm" />
        </div>
        <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-2">
          <button onClick={() => markAll("present")} disabled={!students.length} className="flex-1 rounded-lg bg-secondary px-4 py-2 text-sm font-bold text-secondary-foreground disabled:opacity-50">حضور جماعي</button>
          <button onClick={() => markAll("absent")} disabled={!students.length} className="flex-1 rounded-lg bg-destructive px-4 py-2 text-sm font-bold text-destructive-foreground disabled:opacity-50">غياب جماعي</button>
        </div>
      </div>

      {!groupId ? (
        <div className="rounded-2xl bg-white p-12 text-center text-muted-foreground shadow-sm">اختر مجموعة لعرض طلابها.</div>
      ) : students.length === 0 ? (
        <div className="rounded-2xl bg-white p-12 text-center text-muted-foreground shadow-sm">لا يوجد طلاب في هذه المجموعة.</div>
      ) : (
        <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-right"><tr><th className="p-3">الطالب</th><th className="p-3">الكود</th><th className="p-3 text-center">الحالة</th></tr></thead>
            <tbody>
              {students.map(s => {
                const st = statusMap[s.id];
                return (
                  <tr key={s.id} className="border-t">
                    <td className="p-3 font-semibold">{s.full_name}</td>
                    <td className="p-3 font-mono text-xs text-muted-foreground">{s.code}</td>
                    <td className="p-3">
                      <div className="flex justify-center gap-1.5">
                        <StatusBtn active={st === "present"} tone="secondary" onClick={() => mark(s.id, "present")} icon={<Check className="h-4 w-4" />} label="حاضر" />
                        <StatusBtn active={st === "late"} tone="gold" onClick={() => mark(s.id, "late")} icon={<Clock className="h-4 w-4" />} label="متأخر" />
                        <StatusBtn active={st === "absent"} tone="destructive" onClick={() => mark(s.id, "absent")} icon={<X className="h-4 w-4" />} label="غائب" />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function StatusBtn({ active, tone, onClick, icon, label }: { active: boolean; tone: "secondary" | "destructive" | "gold"; onClick: () => void; icon: React.ReactNode; label: string }) {
  const cls = active
    ? tone === "secondary" ? "bg-secondary text-secondary-foreground"
    : tone === "destructive" ? "bg-destructive text-destructive-foreground"
    : "bg-gold text-gold-foreground"
    : "bg-muted text-muted-foreground hover:bg-accent";
  return <button onClick={onClick} className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-bold transition ${cls}`}>{icon}{label}</button>;
}

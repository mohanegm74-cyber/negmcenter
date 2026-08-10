import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Check, X, Clock, ClipboardCheck, Loader2, Send } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { getAdminDataSummary, markAttendanceAdmin, markAttendanceBulkAdmin } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/attendance")({
  head: () => ({ meta: [{ title: "الحضور — الأستاذ" }, { name: "description", content: "تسجيل حضور الطلاب." }] }),
  component: AttendancePage,
});

type Group = { id: string; name: string };
type Student = { id: string; full_name: string; code: string; group_id: string | null };

function AttendancePage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [groupId, setGroupId] = useState<string>("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [statusMap, setStatusMap] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const loadData = useServerFn(getAdminDataSummary);
  const markFn = useServerFn(markAttendanceAdmin);
  const bulkFn = useServerFn(markAttendanceBulkAdmin);

  async function fetchAll() {
    setLoading(true);
    try {
      const res = await loadData({});
      setGroups(res.groups as Group[]);
      setAllStudents(res.students as Student[]);

      const map: Record<string, string> = {};
      (res.attendance as any[])
        .filter(a => a.date === date)
        .forEach(a => { map[a.student_id] = a.status; });
      setStatusMap(map);
    } catch (err: any) {
      toast.error("فشل تحميل البيانات: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchAll(); }, [date]);
  useEffect(() => { setSelected({}); }, [groupId, date]);

  const displayedStudents = allStudents.filter(s => s.group_id === groupId);
  const selectedIds = displayedStudents.filter(s => selected[s.id]).map(s => s.id);
  const allSelected = displayedStudents.length > 0 && selectedIds.length === displayedStudents.length;

  function toggleAll() {
    if (allSelected) { setSelected({}); return; }
    const next: Record<string, boolean> = {};
    displayedStudents.forEach(s => { next[s.id] = true; });
    setSelected(next);
  }

  async function mark(student_id: string, status: "present" | "absent" | "late") {
    if (!groupId) return;
    try {
      await markFn({ data: { student_id, group_id: groupId, date, status } });
      setStatusMap(m => ({ ...m, [student_id]: status }));
      toast.success("تم الحفظ والإرسال لصفحة الطالب", { duration: 1200 });
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  async function bulkMark(status: "present" | "absent" | "late") {
    if (!groupId || selectedIds.length === 0) { toast.error("حدد طالباً واحداً على الأقل"); return; }
    setBusy(true);
    try {
      await bulkFn({ data: { student_ids: selectedIds, group_id: groupId, date, status } });
      setStatusMap(m => {
        const n = { ...m };
        selectedIds.forEach(id => { n[id] = status; });
        return n;
      });
      toast.success(`تم إرسال حضور ${selectedIds.length} طالب لصفحاتهم`);
    } catch (err: any) {
      toast.error(err.message);
    } finally { setBusy(false); }
  }

  if (loading && groups.length === 0) return <div className="flex h-64 items-center justify-center text-muted-foreground"><Loader2 className="h-8 w-8 animate-spin" /></div>;

  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <ClipboardCheck className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-black">تسجيل الحضور</h1>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-3 rounded-2xl bg-white p-4 shadow-sm sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-sm font-semibold">اختر المجموعة</label>
          <select value={groupId} onChange={(e) => setGroupId(e.target.value)} className="w-full rounded-lg border border-input bg-white px-3 py-2 text-sm">
            <option value="">— اختر مجموعة —</option>
            {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-semibold">التاريخ</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full rounded-lg border border-input bg-white px-3 py-2 text-sm" />
        </div>
      </div>

      {!groupId ? (
        <div className="rounded-2xl bg-white p-12 text-center text-muted-foreground shadow-sm">برجاء اختيار المجموعة لعرض الطلاب.</div>
      ) : displayedStudents.length === 0 ? (
        <div className="rounded-2xl bg-white p-12 text-center text-muted-foreground shadow-sm">لا يوجد طلاب في هذه المجموعة حالياً.</div>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-2 rounded-2xl bg-white p-4 shadow-sm">
            <button onClick={toggleAll} className="rounded-lg bg-primary/10 px-4 py-2 text-xs font-black text-primary hover:bg-primary/20 transition-all">
              {allSelected ? "إلغاء تحديد الكل" : "تحديد الكل"}
            </button>
            <span className="text-xs font-bold text-muted-foreground">المحدد: {selectedIds.length}</span>
            <div className="grow" />
            <button disabled={busy} onClick={() => bulkMark("present")} className="inline-flex items-center gap-1 rounded-lg bg-secondary px-4 py-2 text-xs font-black text-secondary-foreground disabled:opacity-50"><Check className="h-4 w-4" /> حاضر للمحدد</button>
            <button disabled={busy} onClick={() => bulkMark("late")} className="inline-flex items-center gap-1 rounded-lg bg-gold px-4 py-2 text-xs font-black text-gold-foreground disabled:opacity-50"><Clock className="h-4 w-4" /> متأخر للمحدد</button>
            <button disabled={busy} onClick={() => bulkMark("absent")} className="inline-flex items-center gap-1 rounded-lg bg-destructive px-4 py-2 text-xs font-black text-destructive-foreground disabled:opacity-50"><X className="h-4 w-4" /> غائب للمحدد</button>
            {busy && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-muted-foreground"><Send className="h-3 w-3" /> يُرسل تلقائياً لصفحة الطالب باليوم والتاريخ</span>
          </div>

          <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-primary text-primary-foreground text-right">
                <tr>
                  <th className="p-3 w-10"><input type="checkbox" checked={allSelected} onChange={toggleAll} className="h-4 w-4 accent-white" /></th>
                  <th className="p-3">الطالب</th><th className="p-3">الكود</th><th className="p-3 text-center">الحالة</th>
                </tr>
              </thead>
              <tbody>
                {displayedStudents.map(s => {
                  const st = statusMap[s.id];
                  return (
                    <tr key={s.id} className="border-t hover:bg-muted/30">
                      <td className="p-3"><input type="checkbox" checked={!!selected[s.id]} onChange={(e) => setSelected(m => ({ ...m, [s.id]: e.target.checked }))} className="h-4 w-4 accent-primary" /></td>
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
        </>
      )}
    </div>
  );
}

function StatusBtn({ active, tone, onClick, icon, label }: { active: boolean; tone: "secondary" | "destructive" | "gold"; onClick: () => void; icon: React.ReactNode; label: string }) {
  const cls = active
    ? tone === "secondary" ? "bg-secondary text-secondary-foreground"
    : tone === "destructive" ? "bg-destructive text-destructive-foreground"
    : "bg-gold text-gold-foreground shadow-md"
    : "bg-muted text-muted-foreground hover:bg-accent";
  return <button onClick={onClick} className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${cls}`}>{icon}{label}</button>;
}

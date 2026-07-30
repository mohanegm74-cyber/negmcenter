import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Printer, ListChecks, Loader2, Download, Search } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { getFinanceDataAdmin } from "@/lib/admin.functions";
import { openPrint, esc } from "@/lib/print";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/group-lists")({
  head: () => ({ meta: [{ title: "قوائم المجموعات والماليات — الأستاذ" }, { name: "description", content: "استخراج قوائم الطلاب حسب المجموعات مع حالة الدفع." }] }),
  component: GroupListsPage,
});

type Student = { id: string; full_name: string; code: string; grade: string | null; group_id: string | null };
type Group = { id: string; name: string; monthly_fee: number; grade: string | null; subject: string | null };
type Payment = { student_id: string; amount: number; kind: string; month: string | null };

function currentMonth() { return new Date().toISOString().slice(0, 7); }

function GroupListsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [groupId, setGroupId] = useState("");
  const [month, setMonth] = useState(currentMonth());
  
  const loadFn = useServerFn(getFinanceDataAdmin);

  async function fetchAll() {
    setLoading(true);
    try {
      const res = await loadFn({});
      setStudents(res.students as Student[]);
      setGroups(res.groups as Group[]);
      setPayments(res.payments as Payment[]);
    } catch (err: any) {
      toast.error("فشل تحميل البيانات");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchAll(); }, []);

  const activeGroup = useMemo(() => groups.find(g => g.id === groupId), [groups, groupId]);

  const list = useMemo(() => {
    if (!groupId) return [];
    return students
      .filter(s => s.group_id === groupId)
      .map((s, idx) => {
        const studentPayments = payments.filter(p => p.student_id === s.id && p.month === month);
        const paid = studentPayments.filter(p => p.kind === "payment").reduce((a, b) => a + Number(b.amount), 0);
        const dues = studentPayments.filter(p => p.kind === "charge").reduce((a, b) => a + Number(b.amount), 0);
        const fee = activeGroup?.monthly_fee || 0;
        
        const target = dues > 0 ? dues : fee;
        let status = "لم يسدد";
        let statusColor = "#dc2626"; // red

        if (paid >= target && target > 0) {
          status = "تم السداد";
          statusColor = "#059669"; // green
        } else if (paid > 0) {
          status = `سداد جزئي (${paid})`;
          statusColor = "#d97706"; // orange
        }

        return { index: idx + 1, ...s, status, statusColor, paid, target };
      });
  }, [students, groupId, month, payments, activeGroup]);

  function printList() {
    if (!activeGroup) { toast.error("اختر المجموعة أولاً"); return; }
    
    const rowsHtml = list.map(s => `
      <tr>
        <td style="text-align:center">${s.index}</td>
        <td style="font-weight:bold">${esc(s.full_name)}</td>
        <td style="text-align:center">${esc(s.grade)}</td>
        <td style="text-align:center; font-weight:bold; color:${s.statusColor}">${esc(s.status)}</td>
        <td style="width:100px"></td>
      </tr>
    `).join("");

    const title = `قائمة طلاب مجموعة: ${activeGroup.name}`;
    const body = `
      <div style="margin-bottom:20px; border:2px solid #1e3a8a; padding:15px; border-radius:10px; display:flex; justify-content:space-between; align-items:center">
        <div>
          <h2 style="margin:0; color:#1e3a8a">المجموعة: ${esc(activeGroup.name)}</h2>
          <p style="margin:5px 0 0; font-weight:bold">شهر: ${esc(month)} | المادة: ${esc(activeGroup.subject)}</p>
        </div>
        <div style="text-align:left">
          <p style="margin:0">إجمالي الطلاب: <b>${list.length}</b></p>
          <p style="margin:5px 0 0">التاريخ: ${new Date().toLocaleDateString("ar-EG")}</p>
        </div>
      </div>
      <table>
        <thead>
          <tr>
            <th style="width:50px">م</th>
            <th>اسم الطالب</th>
            <th style="width:120px">الصف</th>
            <th style="width:150px">موقف الدفع</th>
            <th style="width:100px">توقيع/ملاحظة</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
      <div style="margin-top:30px; display:flex; justify-content:space-between">
        <p>توقيع الإشراف: ...........................</p>
        <p>ختم السنتر: ...........................</p>
      </div>
    `;

    openPrint(title, body, `table th, table td { font-size: 14px; padding: 12px 8px; }`);
  }

  if (loading) return <div className="flex h-64 items-center justify-center text-muted-foreground"><Loader2 className="h-8 w-8 animate-spin" /></div>;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="text-2xl font-black flex items-center gap-2"><ListChecks className="h-7 w-7 text-primary" /> قوائم المجموعات</h1>
        <button onClick={printList} disabled={!groupId} className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-2.5 text-sm font-black text-primary-foreground shadow-lg hover:opacity-90 disabled:opacity-50 transition-all">
          <Printer className="h-5 w-5" /> طباعة القائمة الحالية
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-white p-5 rounded-2xl shadow-sm border border-primary/5">
        <div>
          <label className="mb-1.5 block text-xs font-black text-muted-foreground uppercase">اختر المجموعة</label>
          <select value={groupId} onChange={e => setGroupId(e.target.value)} className="w-full rounded-xl border bg-muted/20 py-2.5 px-4 text-sm font-bold outline-none focus:ring-2 focus:ring-primary/20">
            <option value="">— اختر مجموعة لعرض الطلاب —</option>
            {groups.map(g => <option key={g.id} value={g.id}>{g.name} ({g.grade || '—'})</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-black text-muted-foreground uppercase">شهر المتابعة</label>
          <input type="month" value={month} onChange={e => setMonth(e.target.value)} className="w-full rounded-xl border bg-muted/20 py-2.5 px-4 text-sm font-bold outline-none focus:ring-2 focus:ring-primary/20" />
        </div>
      </div>

      {!groupId ? (
        <div className="rounded-3xl bg-white p-20 text-center border-2 border-dashed border-muted/50">
          <ListChecks className="mx-auto h-16 w-16 text-muted/30 mb-4" />
          <h2 className="text-xl font-bold text-muted-foreground">برجاء اختيار مجموعة من القائمة أعلاه</h2>
          <p className="text-sm text-muted-foreground/60 mt-2">سيظهر لك جدول الطلاب مع موقفهم المالي وإمكانية طباعته فوراً.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
          <div className="p-4 border-b bg-primary/5 flex justify-between items-center">
            <h3 className="font-black text-primary">قائمة طلاب: {activeGroup?.name}</h3>
            <span className="bg-primary text-primary-foreground px-3 py-1 rounded-full text-xs font-bold">العدد: {list.length} طالب</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr>
                  <th className="p-4 text-center w-16">مسلسل</th>
                  <th className="p-4">اسم الطالب</th>
                  <th className="p-4 text-center">الصف</th>
                  <th className="p-4 text-center">موقف الدفع (${month})</th>
                  <th className="p-4 text-center">الكود</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-muted/20">
                {list.length === 0 ? (
                  <tr><td colSpan={5} className="p-10 text-center text-muted-foreground">لا يوجد طلاب مسجلين في هذه المجموعة.</td></tr>
                ) : list.map((s) => (
                  <tr key={s.id} className="hover:bg-muted/30 transition-colors">
                    <td className="p-4 text-center font-bold text-muted-foreground">{s.index}</td>
                    <td className="p-4 font-bold text-primary">{s.full_name}</td>
                    <td className="p-4 text-center font-semibold">{s.grade || "—"}</td>
                    <td className="p-4 text-center">
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold" style={{ backgroundColor: s.statusColor + '20', color: s.statusColor }}>
                        {s.status}
                      </span>
                    </td>
                    <td className="p-4 text-center font-mono text-xs text-muted-foreground">{s.code}</td>
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
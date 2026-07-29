import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Printer, Wallet, Loader2, X, ArrowDownCircle, ArrowUpCircle } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { getFinanceDataAdmin, addPaymentAdmin, deletePaymentAdmin } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/finance")({
  head: () => ({ meta: [{ title: "الماليات — الأستاذ محمد نجم" }, { name: "description", content: "متابعة رسوم ومدفوعات الطلاب." }] }),
  component: FinancePage,
});

type Student = { id: string; full_name: string; code: string; grade: string | null; group_id: string | null };
type Group = { id: string; name: string; monthly_fee: number };
type Payment = { id: string; student_id: string; group_id: string | null; amount: number; kind: string; method: string | null; note: string | null; paid_at: string; month: string | null };

function currentMonth() { return new Date().toISOString().slice(0, 7); }

function FinancePage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [groupFilter, setGroupFilter] = useState("");
  const [month, setMonth] = useState(currentMonth());
  const [addingFor, setAddingFor] = useState<Student | null>(null);
  const [busy, setBusy] = useState(false);

  const loadFn = useServerFn(getFinanceDataAdmin);
  const addFn = useServerFn(addPaymentAdmin);
  const delFn = useServerFn(deletePaymentAdmin);

  async function fetchAll() {
    setLoading(true);
    try {
      const res = await loadFn({});
      setStudents(res.students as Student[]);
      setGroups(res.groups as Group[]);
      setPayments(res.payments as Payment[]);
    } catch (err: any) {
      toast.error("فشل تحميل البيانات: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchAll(); }, []);

  const groupMap = useMemo(() => Object.fromEntries(groups.map(g => [g.id, g])), [groups]);

  const rows = useMemo(() => {
    return students
      .filter(s => (!groupFilter || s.group_id === groupFilter))
      .map(s => {
        const studentPayments = payments.filter(p => p.student_id === s.id && (!month || p.month === month));
        const paid = studentPayments.filter(p => p.kind === "payment").reduce((a, b) => a + Number(b.amount), 0);
        const dues = studentPayments.filter(p => p.kind === "charge").reduce((a, b) => a + Number(b.amount), 0);
        const fee = s.group_id ? Number(groupMap[s.group_id]?.monthly_fee || 0) : 0;
        
        const totalDue = dues > 0 ? dues : fee; 
        const balance = totalDue - paid;
        
        return { student: s, groupName: s.group_id ? groupMap[s.group_id]?.name : "—", totalDue, paid, balance };
      });
  }, [students, groupMap, payments, month, groupFilter]);

  async function handleAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!addingFor) return;
    setBusy(true);
    const fd = new FormData(e.currentTarget);
    try {
      await addFn({ data: {
        student_id: addingFor.id, 
        group_id: addingFor.group_id, 
        amount: Number(fd.get("amount")),
        kind: String(fd.get("kind")), 
        month: String(fd.get("month") || month),
        paid_at: String(fd.get("paid_at")), 
        note: String(fd.get("note") || "") || null,
      }});
      toast.success("تم تسجيل الحركة المالية بنجاح");
      setAddingFor(null);
      fetchAll();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <div className="flex h-64 items-center justify-center text-muted-foreground"><Loader2 className="h-8 w-8 animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-black flex items-center gap-2"><Wallet className="h-6 w-6 text-primary" /> إدارة المالية المتكاملة</h1>
        <div className="flex flex-wrap items-center gap-2">
          <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="rounded-lg border border-input bg-white px-3 py-2 text-sm font-bold" />
          <select value={groupFilter} onChange={(e) => setGroupFilter(e.target.value)} className="rounded-lg border border-input bg-white px-3 py-2 text-sm font-bold">
            <option value="">كل المجموعات</option>
            {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </div>
      </div>

      {addingFor && (
        <form onSubmit={handleAdd} className="rounded-2xl bg-white p-6 shadow-xl border-2 border-primary animate-in zoom-in-95 duration-200">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-black text-primary">تسجيل حركة لـ: {addingFor.full_name}</h3>
            <button type="button" onClick={() => setAddingFor(null)} className="rounded-full p-2 hover:bg-muted"><X className="h-5 w-5" /></button>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <div>
              <label className="mb-1 block text-xs font-bold text-muted-foreground">نوع الحركة</label>
              <select name="kind" className="w-full rounded-lg border border-input p-2.5 text-sm font-bold">
                <option value="payment">سداد (طالب دفع مبلغ)</option>
                <option value="charge">مستحق (رسم شهر/ملزمة)</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-muted-foreground">المبلغ</label>
              <input name="amount" type="number" required placeholder="0.00" className="w-full rounded-lg border border-input p-2.5 text-sm font-mono font-bold" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-muted-foreground">الشهر</label>
              <input name="month" defaultValue={month} className="w-full rounded-lg border border-input p-2.5 text-sm font-bold" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-muted-foreground">التاريخ</label>
              <input name="paid_at" type="date" defaultValue={new Date().toISOString().slice(0, 10)} className="w-full rounded-lg border border-input p-2.5 text-sm font-bold" />
            </div>
            <div className="flex items-end">
              <button type="submit" disabled={busy} className="w-full rounded-lg bg-primary py-2.5 text-sm font-black text-primary-foreground shadow-lg hover:opacity-90 disabled:opacity-50">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "حفظ الحركة"}
              </button>
            </div>
          </div>
        </form>
      )}

      <div className="overflow-hidden rounded-2xl border bg-white shadow-md">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead className="bg-primary text-primary-foreground">
              <tr>
                <th className="p-4">اسم الطالب</th>
                <th className="p-4">المجموعة</th>
                <th className="p-4 text-center">المستحق للشهر</th>
                <th className="p-4 text-center">المدفوع فعلياً</th>
                <th className="p-4 text-center">الرصيد المتبقي</th>
                <th className="p-4 text-center">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={6} className="p-20 text-center text-muted-foreground">لا يوجد بيانات لعرضها.</td></tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.student.id} className="border-t hover:bg-muted/30 transition-colors">
                    <td className="p-4">
                      <div className="font-bold text-base">{r.student.full_name}</div>
                      <div className="text-[10px] text-muted-foreground font-mono">{r.student.code}</div>
                    </td>
                    <td className="p-4">
                      <span className="rounded-lg bg-muted px-2 py-1 text-xs font-bold">{r.groupName}</span>
                    </td>
                    <td className="p-4 text-center font-mono font-bold text-lg">{r.totalDue.toLocaleString("ar-EG")}</td>
                    <td className="p-4 text-center font-mono font-bold text-lg text-secondary">{r.paid.toLocaleString("ar-EG")}</td>
                    <td className={`p-4 text-center font-mono font-black text-xl ${r.balance > 0 ? "text-destructive" : "text-secondary"}`}>
                      {r.balance.toLocaleString("ar-EG")}
                    </td>
                    <td className="p-4">
                      <div className="flex justify-center gap-2">
                        <button onClick={() => setAddingFor(r.student)} className="inline-flex items-center gap-1 rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary hover:bg-primary hover:text-white transition-all">
                          <Plus className="h-3.5 w-3.5" /> تسجيل مبلغ
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      <p className="text-center text-xs text-muted-foreground py-2 italic">يتم حساب الرصيد بناءً على رسوم المجموعة المحددة أو أي رسوم مخصصة أخرى تم تسجيلها.</p>
    </div>
  );
}
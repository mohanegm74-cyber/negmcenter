import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Pencil, Wallet, Loader2, X, ArrowDownCircle, ArrowUpCircle, TrendingUp, AlertCircle, Save } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { getFinanceDataAdmin, addPaymentAdmin, deletePaymentAdmin, updatePaymentAdmin } from "@/lib/admin.functions";

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
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const [viewingHistory, setViewingHistory] = useState<Student | null>(null);
  const [busy, setBusy] = useState(false);

  const loadFn = useServerFn(getFinanceDataAdmin);
  const addFn = useServerFn(addPaymentAdmin);
  const delFn = useServerFn(deletePaymentAdmin);
  const updateFn = useServerFn(updatePaymentAdmin);

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

  // حسابات الملخص العام للمالية
  const totals = useMemo(() => {
    const pFiltered = payments.filter(p => !month || p.month === month);
    const paid = pFiltered.filter(p => p.kind === "payment").reduce((a, b) => a + Number(b.amount), 0);
    const charged = pFiltered.filter(p => p.kind === "charge").reduce((a, b) => a + Number(b.amount), 0);
    
    // إذا لم تكن هناك رسوم مسجلة يدوياً، نعتمد على رسوم المجموعات لجميع الطلاب
    let estimatedTotal = charged;
    if (charged === 0) {
      students.forEach(s => {
        if (s.group_id) estimatedTotal += Number(groupMap[s.group_id]?.monthly_fee || 0);
      });
    }

    return { paid, dues: estimatedTotal, outstanding: Math.max(0, estimatedTotal - paid) };
  }, [payments, month, students, groupMap]);

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
      toast.success("تم الحفظ"); setAddingFor(null); fetchAll();
    } catch (err: any) { toast.error(err.message); }
    finally { setBusy(false); }
  }

  async function handleUpdate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editingPayment) return;
    setBusy(true);
    const fd = new FormData(e.currentTarget);
    try {
      await updateFn({ data: {
        id: editingPayment.id,
        payload: {
          amount: Number(fd.get("amount")),
          kind: String(fd.get("kind")),
          month: String(fd.get("month")),
          paid_at: String(fd.get("paid_at")),
          note: String(fd.get("note") || "") || null,
        }
      }});
      toast.success("تم التعديل بنجاح"); setEditingPayment(null); fetchAll();
    } catch (err: any) { toast.error(err.message); }
    finally { setBusy(false); }
  }

  async function handleDelete(id: string) {
    if (!confirm("هل أنت متأكد من حذف هذا السجل المالي نهائياً؟")) return;
    try { await delFn({ data: { id } }); toast.success("تم الحذف"); fetchAll(); }
    catch (err: any) { toast.error(err.message); }
  }

  if (loading) return <div className="flex h-64 items-center justify-center text-muted-foreground"><Loader2 className="h-8 w-8 animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-black flex items-center gap-2"><Wallet className="h-6 w-6 text-primary" /> إدارة المالية</h1>
        <div className="flex flex-wrap items-center gap-2">
          <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="rounded-lg border bg-white px-3 py-2 text-sm font-bold" />
          <select value={groupFilter} onChange={(e) => setGroupFilter(e.target.value)} className="rounded-lg border bg-white px-3 py-2 text-sm font-bold">
            <option value="">كل المجموعات</option>
            {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <FinanceCard icon={<TrendingUp className="h-5 w-5" />} label="المستحق (الرسوم)" value={totals.dues} tone="primary" />
        <FinanceCard icon={<ArrowDownCircle className="h-5 w-5" />} label="المحصل فعلياً" value={totals.paid} tone="secondary" />
        <FinanceCard icon={<AlertCircle className="h-5 w-5" />} label="إجمالي المتأخرات" value={totals.outstanding} tone="destructive" />
      </div>

      {addingFor && (
        <form onSubmit={handleAdd} className="rounded-2xl bg-white p-6 shadow-xl border-2 border-primary">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-black text-primary">تسجيل حركة لـ: {addingFor.full_name}</h3>
            <button type="button" onClick={() => setAddingFor(null)} className="p-2 hover:bg-muted rounded-full"><X className="h-5 w-5" /></button>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <FinF name="kind" label="النوع" type="select" options={[{v:"payment",l:"سداد"},{v:"charge",l:"مستحق"}]} />
            <FinF name="amount" label="المبلغ" type="number" required />
            <FinF name="month" label="الشهر" defaultValue={month} />
            <FinF name="paid_at" label="التاريخ" type="date" defaultValue={new Date().toISOString().slice(0, 10)} />
            <div className="flex items-end">
              <button type="submit" disabled={busy} className="w-full rounded-lg bg-primary py-2.5 text-sm font-black text-white">{busy ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : "حفظ الحركة"}</button>
            </div>
          </div>
        </form>
      )}

      {editingPayment && (
        <form onSubmit={handleUpdate} className="rounded-2xl bg-white p-6 shadow-xl border-2 border-secondary animate-in zoom-in-95">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-black text-secondary">تعديل حركة مالية</h3>
            <button type="button" onClick={() => setEditingPayment(null)} className="p-2 hover:bg-muted rounded-full"><X className="h-5 w-5" /></button>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <FinF name="kind" label="النوع" type="select" defaultValue={editingPayment.kind} options={[{v:"payment",l:"سداد"},{v:"charge",l:"مستحق"}]} />
            <FinF name="amount" label="المبلغ" type="number" defaultValue={String(editingPayment.amount)} required />
            <FinF name="month" label="الشهر" defaultValue={editingPayment.month || month} />
            <FinF name="paid_at" label="التاريخ" type="date" defaultValue={editingPayment.paid_at} />
            <div className="flex items-end">
              <button type="submit" disabled={busy} className="w-full rounded-lg bg-secondary py-2.5 text-sm font-black text-white">{busy ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : "تحديث السجل"}</button>
            </div>
          </div>
        </form>
      )}

      {viewingHistory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-4xl max-h-[85vh] overflow-hidden rounded-2xl bg-white shadow-2xl flex flex-col">
            <div className="p-4 border-b flex justify-between items-center bg-muted/20">
              <h3 className="font-black text-primary">سجل مدفوعات الطالب: {viewingHistory.full_name}</h3>
              <button onClick={() => setViewingHistory(null)} className="p-2 hover:bg-muted rounded-full"><X className="h-5 w-5" /></button>
            </div>
            <div className="overflow-y-auto p-4">
              <table className="w-full text-sm">
                <thead><tr className="bg-muted text-right"><th className="p-2">التاريخ</th><th className="p-2">النوع</th><th className="p-2 text-center">المبلغ</th><th className="p-2">إجراءات</th></tr></thead>
                <tbody>
                  {payments.filter(p => p.student_id === viewingHistory.id).map(p => (
                    <tr key={p.id} className="border-t">
                      <td className="p-2">{p.paid_at}</td>
                      <td className="p-2"><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${p.kind === "payment" ? "bg-secondary/10 text-secondary" : "bg-gold/20 text-gold-foreground"}`}>{p.kind === "payment" ? "سداد" : "مستحق"}</span></td>
                      <td className="p-2 text-center font-bold font-mono">{Number(p.amount).toLocaleString("ar-EG")}</td>
                      <td className="p-2">
                        <div className="flex justify-center gap-2">
                          <button onClick={() => { setEditingPayment(p); setViewingHistory(null); }} className="text-primary hover:bg-primary/10 p-1 rounded"><Pencil className="h-4 w-4" /></button>
                          <button onClick={() => handleDelete(p.id)} className="text-destructive hover:bg-destructive/10 p-1 rounded"><Trash2 className="h-4 w-4" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead className="bg-primary text-primary-foreground">
              <tr>
                <th className="p-4">الطالب</th>
                <th className="p-4">المجموعة</th>
                <th className="p-4 text-center">المستحق</th>
                <th className="p-4 text-center">المدفوع</th>
                <th className="p-4 text-center">الرصيد</th>
                <th className="p-4 text-center">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.student.id} className="border-t hover:bg-muted/30">
                  <td className="p-4">
                    <div className="font-bold">{r.student.full_name}</div>
                    <div className="text-[10px] text-muted-foreground font-mono">{r.student.code}</div>
                  </td>
                  <td className="p-4"><span className="rounded bg-muted px-2 py-1 text-[10px] font-bold">{r.groupName}</span></td>
                  <td className="p-4 text-center font-mono font-bold">{r.totalDue.toLocaleString("ar-EG")}</td>
                  <td className="p-4 text-center font-mono font-bold text-secondary">{r.paid.toLocaleString("ar-EG")}</td>
                  <td className={`p-4 text-center font-mono font-black ${r.balance > 0 ? "text-destructive" : "text-secondary"}`}>{r.balance.toLocaleString("ar-EG")}</td>
                  <td className="p-4">
                    <div className="flex justify-center gap-2">
                      <button onClick={() => setAddingFor(r.student)} className="rounded-lg bg-primary/10 px-3 py-1.5 text-[10px] font-bold text-primary">تسجيل مبلغ</button>
                      <button onClick={() => setViewingHistory(r.student)} className="rounded-lg bg-muted px-3 py-1.5 text-[10px] font-bold">السجل</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function FinanceCard({ icon, label, value, tone }: { icon: any; label: string; value: number; tone: "primary" | "secondary" | "destructive" }) {
  const bg = tone === "primary" ? "bg-primary text-primary-foreground" : tone === "secondary" ? "bg-secondary text-secondary-foreground" : "bg-destructive text-white";
  return (
    <div className={`rounded-2xl p-5 shadow-sm flex items-center gap-4 ${bg}`}>
      <div className="bg-white/20 p-3 rounded-xl">{icon}</div>
      <div>
        <div className="text-2xl font-black">{value.toLocaleString("ar-EG")} <span className="text-xs font-normal">ج.م</span></div>
        <div className="text-xs opacity-90 font-bold">{label}</div>
      </div>
    </div>
  );
}

function FinF({ name, label, type = "text", defaultValue = "", required = false, options = [] }: { name: string; label: string; type?: string; defaultValue?: string; required?: boolean; options?: {v:string;l:string}[] }) {
  return (
    <div>
      <label className="mb-1 block text-[10px] font-bold text-muted-foreground">{label}</label>
      {type === "select" ? (
        <select name={name} defaultValue={defaultValue} className="w-full rounded-lg border bg-white p-2.5 text-sm font-bold">
          {options.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
        </select>
      ) : (
        <input name={name} type={type} defaultValue={defaultValue} required={required} className="w-full rounded-lg border bg-white p-2.5 text-sm font-bold" />
      )}
    </div>
  );
}
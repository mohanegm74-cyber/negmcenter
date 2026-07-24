import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Printer, Wallet, Wand2, Pencil, Save, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { openPrint, esc } from "@/lib/print";

export const Route = createFileRoute("/_authenticated/finance")({
  head: () => ({ meta: [{ title: "الماليات — الأستاذ" }, { name: "description", content: "متابعة رسوم ومدفوعات الطلاب." }] }),
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
  const [gradeFilter, setGradeFilter] = useState("");
  const [groupFilter, setGroupFilter] = useState("");
  const [month, setMonth] = useState(currentMonth());
  const [addingFor, setAddingFor] = useState<Student | null>(null);
  const [editing, setEditing] = useState<Payment | null>(null);

  async function saveEdit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editing) return;
    const fd = new FormData(e.currentTarget);
    const payload: any = {
      amount: Number(fd.get("amount")),
      kind: String(fd.get("kind")),
      method: String(fd.get("method") || "") || null,
      note: String(fd.get("note") || "") || null,
      month: String(fd.get("month") || "") || null,
      paid_at: String(fd.get("paid_at")),
    };
    const { error } = await supabase.from("payments").update(payload).eq("id", editing.id);
    if (error) toast.error(error.message);
    else { toast.success("تم التحديث"); setEditing(null); load(); }
  }

  async function load() {
    const [s, g, p] = await Promise.all([
      supabase.from("students").select("id,full_name,code,grade,group_id").eq("active", true).order("full_name"),
      supabase.from("groups").select("id,name,monthly_fee").order("name"),
      supabase.from("payments").select("*").order("paid_at", { ascending: false }),
    ]);
    setStudents((s.data as Student[]) || []);
    setGroups((g.data as Group[]) || []);
    setPayments((p.data as Payment[]) || []);
  }
  useEffect(() => { load(); }, []);

  const groupMap = useMemo(() => Object.fromEntries(groups.map(g => [g.id, g])), [groups]);
  const grades = useMemo(() => Array.from(new Set(students.map(s => s.grade).filter(Boolean))) as string[], [students]);

  const rows = useMemo(() => {
    return students
      .filter(s => (!gradeFilter || s.grade === gradeFilter) && (!groupFilter || s.group_id === groupFilter))
      .map(s => {
        const fee = s.group_id ? Number(groupMap[s.group_id]?.monthly_fee || 0) : 0;
        const paid = payments.filter(p => p.student_id === s.id && p.kind === "payment" && (!month || p.month === month))
          .reduce((a, b) => a + Number(b.amount), 0);
        const extraDues = payments.filter(p => p.student_id === s.id && p.kind === "charge" && (!month || p.month === month))
          .reduce((a, b) => a + Number(b.amount), 0);
        const totalDue = fee + extraDues;
        const balance = totalDue - paid;
        return { student: s, group: s.group_id ? groupMap[s.group_id] : null, fee, paid, totalDue, balance };
      });
  }, [students, groupMap, payments, month, gradeFilter, groupFilter]);

  const totals = useMemo(() => rows.reduce((acc, r) => ({ due: acc.due + r.totalDue, paid: acc.paid + r.paid, bal: acc.bal + r.balance }), { due: 0, paid: 0, bal: 0 }), [rows]);

  async function addPayment(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!addingFor) return;
    const fd = new FormData(e.currentTarget);
    const payload: any = {
      student_id: addingFor.id,
      group_id: addingFor.group_id,
      amount: Number(fd.get("amount")),
      kind: String(fd.get("kind")) || "payment",
      method: String(fd.get("method") || "") || null,
      note: String(fd.get("note") || "") || null,
      month: String(fd.get("month") || month),
      paid_at: String(fd.get("paid_at") || new Date().toISOString().slice(0, 10)),
    };
    const { error } = await supabase.from("payments").insert(payload);
    if (error) toast.error(error.message);
    else { toast.success("تم التسجيل"); setAddingFor(null); load(); }
  }

  async function autoChargeMonth() {
    if (!confirm(`إنشاء رسوم شهر ${month} تلقائياً لكل الطلاب في مجموعات لها رسوم؟`)) return;
    const targets = students.filter(s => s.group_id && Number(groupMap[s.group_id]?.monthly_fee || 0) > 0);
    // Skip students who already have any payment (charge or payment) for this month
    const has = new Set(payments.filter(p => p.month === month).map(p => p.student_id));
    const toInsert = targets.filter(s => !has.has(s.id)).map(s => ({
      student_id: s.id, group_id: s.group_id, kind: "charge",
      amount: Number(groupMap[s.group_id!].monthly_fee), month,
      paid_at: new Date().toISOString().slice(0, 10), note: `رسوم شهر ${month}`,
    }));
    if (toInsert.length === 0) { toast.info("لا توجد رسوم جديدة لإنشائها"); return; }
    const { error } = await supabase.from("payments").insert(toInsert);
    if (error) toast.error(error.message); else { toast.success(`تم إنشاء ${toInsert.length} رسم`); load(); }
  }

  async function remove(id: string) {
    if (!confirm("حذف هذه العملية؟")) return;
    const { error } = await supabase.from("payments").delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success("تم الحذف"); load(); }
  }

  function printFinance() {
    const html = `
      <h2>كشف مالي — شهر ${esc(month)}${gradeFilter ? ` — الصف ${esc(gradeFilter)}` : ""}${groupFilter ? ` — المجموعة ${esc(groupMap[groupFilter]?.name)}` : ""}</h2>
      <table><thead><tr><th>#</th><th>الطالب</th><th>الكود</th><th>الصف</th><th>المجموعة</th>
      <th>المستحق</th><th>المدفوع</th><th>الرصيد</th></tr></thead><tbody>
      ${rows.map((r, i) => `<tr>
        <td>${i + 1}</td><td>${esc(r.student.full_name)}</td><td>${esc(r.student.code)}</td>
        <td>${esc(r.student.grade)}</td><td>${esc(r.group?.name)}</td>
        <td>${r.totalDue.toLocaleString("ar-EG")}</td>
        <td>${r.paid.toLocaleString("ar-EG")}</td>
        <td style="color:${r.balance > 0 ? "#dc2626" : "#15803d"};font-weight:700">${r.balance.toLocaleString("ar-EG")}</td>
      </tr>`).join("")}
      <tr style="background:#fef3c7;font-weight:800"><td colspan="5">الإجمالي</td>
      <td>${totals.due.toLocaleString("ar-EG")}</td>
      <td>${totals.paid.toLocaleString("ar-EG")}</td>
      <td>${totals.bal.toLocaleString("ar-EG")}</td></tr>
      </tbody></table>`;
    openPrint("الكشف المالي", html);
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-black flex items-center gap-2"><Wallet className="h-6 w-6 text-primary" /> الماليات</h1>
        <div className="flex flex-wrap items-center gap-2">
          <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="rounded-lg border border-input bg-white px-3 py-2 text-sm" />
          <select value={gradeFilter} onChange={(e) => setGradeFilter(e.target.value)} className="rounded-lg border border-input bg-white px-3 py-2 text-sm">
            <option value="">كل الصفوف</option>
            {grades.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
          <select value={groupFilter} onChange={(e) => setGroupFilter(e.target.value)} className="rounded-lg border border-input bg-white px-3 py-2 text-sm">
            <option value="">كل المجموعات</option>
            {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
          <button onClick={autoChargeMonth} className="inline-flex items-center gap-1 rounded-lg bg-gold px-3 py-2 text-sm font-bold text-gold-foreground"><Wand2 className="h-4 w-4" /> رسوم تلقائية للشهر</button>
          <button onClick={printFinance} className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-2 text-sm font-bold text-primary-foreground"><Printer className="h-4 w-4" /> طباعة</button>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-3 gap-3">
        <Kpi label="المستحق" value={totals.due} tone="primary" />
        <Kpi label="المدفوع" value={totals.paid} tone="secondary" />
        <Kpi label="المتأخرات" value={totals.bal} tone={totals.bal > 0 ? "destructive" : "secondary"} />
      </div>

      {addingFor && (
        <form onSubmit={addPayment} className="mb-4 rounded-2xl bg-white p-5 shadow-sm">
          <div className="mb-2 text-sm text-muted-foreground">تسجيل حركة لـ <b className="text-foreground">{addingFor.full_name}</b></div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
            <select name="kind" defaultValue="payment" className="rounded-lg border border-input bg-white px-3 py-2 text-sm">
              <option value="payment">مدفوع</option>
              <option value="charge">رسم / مستحق</option>
            </select>
            <input name="amount" type="number" step="0.01" required placeholder="المبلغ" className="rounded-lg border border-input px-3 py-2 text-sm" />
            <input name="method" placeholder="طريقة الدفع" className="rounded-lg border border-input px-3 py-2 text-sm" />
            <input name="month" defaultValue={month} placeholder="الشهر" className="rounded-lg border border-input px-3 py-2 text-sm" />
            <input name="paid_at" type="date" defaultValue={new Date().toISOString().slice(0, 10)} className="rounded-lg border border-input px-3 py-2 text-sm" />
            <input name="note" placeholder="ملاحظة" className="rounded-lg border border-input px-3 py-2 text-sm" />
          </div>
          <div className="mt-3 flex gap-2">
            <button type="submit" className="rounded-lg bg-primary px-5 py-2 text-sm font-bold text-primary-foreground">حفظ</button>
            <button type="button" onClick={() => setAddingFor(null)} className="rounded-lg border border-input px-4 py-2 text-sm">إلغاء</button>
          </div>
        </form>
      )}

      <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-primary text-primary-foreground text-right">
              <tr><th className="p-3">الطالب</th><th className="p-3">المجموعة</th><th className="p-3">الصف</th>
                <th className="p-3">المستحق</th><th className="p-3">المدفوع</th><th className="p-3">الرصيد</th><th className="p-3"></th></tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.student.id} className={`border-t ${i % 2 ? "bg-muted/10" : ""}`}>
                  <td className="p-3 font-semibold">{r.student.full_name} <span className="ms-1 font-mono text-[10px] text-muted-foreground">{r.student.code}</span></td>
                  <td className="p-3">{r.group?.name || "—"}</td>
                  <td className="p-3">{r.student.grade || "—"}</td>
                  <td className="p-3">{r.totalDue.toLocaleString("ar-EG")}</td>
                  <td className="p-3 text-secondary">{r.paid.toLocaleString("ar-EG")}</td>
                  <td className={`p-3 font-bold ${r.balance > 0 ? "text-destructive" : "text-secondary"}`}>{r.balance.toLocaleString("ar-EG")}</td>
                  <td className="p-3 text-left">
                    <button onClick={() => setAddingFor(r.student)} className="inline-flex items-center gap-1 rounded-lg bg-secondary/10 px-2.5 py-1 text-xs font-bold text-secondary hover:bg-secondary/20"><Plus className="h-3 w-3" /> حركة</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-6 rounded-2xl bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-lg font-bold">آخر الحركات</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-right"><tr><th className="p-2">التاريخ</th><th className="p-2">الطالب</th><th className="p-2">النوع</th><th className="p-2">المبلغ</th><th className="p-2">الشهر</th><th className="p-2">ملاحظة</th><th className="p-2"></th></tr></thead>
            <tbody>
              {payments.slice(0, 30).map(p => {
                const s = students.find(x => x.id === p.student_id);
                return (
                  <tr key={p.id} className="border-t">
                    <td className="p-2">{p.paid_at}</td>
                    <td className="p-2">{s?.full_name || "—"}</td>
                    <td className="p-2"><span className={`rounded px-1.5 py-0.5 text-xs font-bold ${p.kind === "payment" ? "bg-secondary/15 text-secondary" : "bg-destructive/15 text-destructive"}`}>{p.kind === "payment" ? "مدفوع" : "مستحق"}</span></td>
                    <td className="p-2 font-bold">{Number(p.amount).toLocaleString("ar-EG")}</td>
                    <td className="p-2">{p.month || "—"}</td>
                    <td className="p-2">{p.note || "—"}</td>
                    <td className="p-2 text-left"><button onClick={() => remove(p.id)} className="rounded p-1 text-destructive hover:bg-destructive/10"><Trash2 className="h-3.5 w-3.5" /></button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, value, tone }: { label: string; value: number; tone: "primary" | "secondary" | "destructive" }) {
  const cls = tone === "primary" ? "bg-primary/10 text-primary" : tone === "secondary" ? "bg-secondary/10 text-secondary" : "bg-destructive/10 text-destructive";
  return (
    <div className={`rounded-2xl p-4 shadow-sm ${cls}`}>
      <div className="text-xs font-semibold opacity-80">{label}</div>
      <div className="text-2xl font-black">{value.toLocaleString("ar-EG")} <span className="text-sm font-bold">ج.م</span></div>
    </div>
  );
}

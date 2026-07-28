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

  // تكامل الربط: ربط الطالب بالمجموعة وبسجل مدفوعاته ومستحقاته
  const rows = useMemo(() => {
    return students
      .filter(s => (!gradeFilter || s.grade === gradeFilter) && (!groupFilter || s.group_id === groupFilter))
      .map(s => {
        const studentPayments = payments.filter(p => p.student_id === s.id && (!month || p.month === month));
        const paid = studentPayments.filter(p => p.kind === "payment").reduce((a, b) => a + Number(b.amount), 0);
        const dues = studentPayments.filter(p => p.kind === "charge").reduce((a, b) => a + Number(b.amount), 0);
        const fee = s.group_id ? Number(groupMap[s.group_id]?.monthly_fee || 0) : 0;
        
        // إذا لم يكن هناك رسوم مخصصة (charges)، نعتبر رسم المجموعة هو المستحق
        const totalDue = dues > 0 ? dues : fee; 
        const balance = totalDue - paid;
        
        return { student: s, groupName: s.group_id ? groupMap[s.group_id]?.name : "—", totalDue, paid, balance };
      });
  }, [students, groupMap, payments, month, gradeFilter, groupFilter]);

  async function addPayment(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!addingFor) return;
    const fd = new FormData(e.currentTarget);
    const { error } = await supabase.from("payments").insert({
      student_id: addingFor.id, group_id: addingFor.group_id, amount: Number(fd.get("amount")),
      kind: String(fd.get("kind")), month: String(fd.get("month") || month),
      paid_at: String(fd.get("paid_at")), note: String(fd.get("note") || "") || null,
    });
    if (error) toast.error(error.message); else { toast.success("تم التسجيل"); setAddingFor(null); load(); }
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-black flex items-center gap-2"><Wallet className="h-6 w-6 text-primary" /> الماليات المتكاملة</h1>
        <div className="flex flex-wrap items-center gap-2">
          <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="rounded-lg border border-input bg-white px-3 py-2 text-sm" />
          <select value={groupFilter} onChange={(e) => setGroupFilter(e.target.value)} className="rounded-lg border border-input bg-white px-3 py-2 text-sm">
            <option value="">كل المجموعات</option>
            {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </div>
      </div>

      {addingFor && (
        <form onSubmit={addPayment} className="mb-4 rounded-2xl bg-white p-5 shadow-sm border-2 border-primary">
          <h3 className="mb-3 font-bold">تسجيل حركة ماليّة لـ: {addingFor.full_name}</h3>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            <select name="kind" className="rounded-lg border border-input p-2 text-sm">
              <option value="payment">مدفوع (طالب سدد)</option>
              <option value="charge">مستحق (رسم شهر)</option>
            </select>
            <input name="amount" type="number" required placeholder="المبلغ" className="rounded-lg border border-input p-2 text-sm" />
            <input name="month" defaultValue={month} className="rounded-lg border border-input p-2 text-sm" />
            <input name="paid_at" type="date" defaultValue={new Date().toISOString().slice(0, 10)} className="rounded-lg border border-input p-2 text-sm" />
            <button type="submit" className="rounded-lg bg-primary text-white font-bold text-sm">حفظ</button>
          </div>
        </form>
      )}

      <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-primary text-primary-foreground text-right">
            <tr><th className="p-3">الطالب</th><th className="p-3">المجموعة</th><th className="p-3 text-center">المستحق</th><th className="p-3 text-center">المدفوع</th><th className="p-3 text-center">الرصيد</th><th className="p-3"></th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.student.id} className="border-t hover:bg-muted/30">
                <td className="p-3 font-semibold">{r.student.full_name}</td>
                <td className="p-3 text-xs text-muted-foreground">{r.groupName}</td>
                <td className="p-3 text-center font-bold">{r.totalDue}</td>
                <td className="p-3 text-center text-secondary font-bold">{r.paid}</td>
                <td className={`p-3 text-center font-black ${r.balance > 0 ? "text-destructive" : "text-secondary"}`}>{r.balance}</td>
                <td className="p-3 text-left">
                  <button onClick={() => setAddingFor(r.student)} className="rounded-lg bg-secondary/10 px-3 py-1 text-xs font-bold text-secondary">إضافة حركة</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
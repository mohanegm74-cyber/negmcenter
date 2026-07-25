import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Users, Boxes, ClipboardCheck, CalendarX, Wallet, TrendingUp, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "لوحة التحكم — الأستاذ" }, { name: "description", content: "إحصائيات السنتر." }] }),
  component: Dashboard,
});

function Dashboard() {
  const [s, setS] = useState({ students: 0, groups: 0, present: 0, absent: 0, income: 0, dues: 0, outstanding: 0 });

  useEffect(() => {
    (async () => {
      const today = new Date().toISOString().slice(0, 10);
      const currentMonth = today.slice(0, 7); // YYYY-MM
      const [st, gr, ap, aa, pay] = await Promise.all([
        supabase.from("students").select("id,group_id,registration_date", { count: "exact" }).eq("active", true),
        supabase.from("groups").select("id,monthly_fee"),
        supabase.from("attendance").select("id", { count: "exact", head: true }).eq("date", today).eq("status", "present"),
        supabase.from("attendance").select("id", { count: "exact", head: true }).eq("date", today).eq("status", "absent"),
        supabase.from("payments").select("student_id,amount,kind,month"),
      ]);
      const payments = (pay.data as any[]) || [];
      const income = payments.filter(p => p.kind === "payment").reduce((a, b) => a + Number(b.amount || 0), 0);
      const feeMap = Object.fromEntries(((gr.data as any[]) || []).map(g => [g.id, Number(g.monthly_fee || 0)]));

      // Compute realistic dues per active student = months since registration × monthly_fee + explicit charges
      const activeStudents = (st.data as any[]) || [];
      let expectedDues = 0;
      for (const s of activeStudents) {
        const fee = s.group_id ? feeMap[s.group_id] || 0 : 0;
        if (fee > 0) {
          const reg = s.registration_date ? new Date(s.registration_date) : new Date();
          const now = new Date();
          const months = Math.max(1, (now.getFullYear() - reg.getFullYear()) * 12 + (now.getMonth() - reg.getMonth()) + 1);
          const upto = new Date(now.getFullYear(), now.getMonth() + 1, 0) >= reg ? months : 1;
          expectedDues += fee * upto;
        }
      }
      const explicitCharges = payments.filter(p => p.kind === "charge").reduce((a, b) => a + Number(b.amount || 0), 0);
      const dues = Math.max(expectedDues, explicitCharges);
      const outstanding = Math.max(0, dues - income);

      setS({
        students: st.count || 0,
        groups: (gr.data || []).length,
        present: ap.count || 0,
        absent: aa.count || 0,
        income, dues, outstanding,
      });
      // keep currentMonth referenced to avoid lint
      void currentMonth;
    })();
  }, []);


  const cards = [
    { icon: Users, label: "إجمالي الطلاب", value: s.students, tone: "primary" },
    { icon: Boxes, label: "المجموعات", value: s.groups, tone: "secondary" },
    { icon: ClipboardCheck, label: "حضور اليوم", value: s.present, tone: "gold" },
    { icon: CalendarX, label: "غياب اليوم", value: s.absent, tone: "destructive" },
    { icon: Wallet, label: "إجمالي المدفوع", value: `${s.income.toLocaleString("ar-EG")} ج.م`, tone: "secondary" },
    { icon: TrendingUp, label: "إجمالي الرسوم", value: `${s.dues.toLocaleString("ar-EG")} ج.م`, tone: "primary" },
    { icon: AlertCircle, label: "المتأخرات", value: `${s.outstanding.toLocaleString("ar-EG")} ج.م`, tone: "destructive" },
  ] as const;

  return (
    <div>
      <h1 className="mb-6 text-2xl font-black">أهلاً بك في لوحة التحكم</h1>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-2xl bg-white p-5 shadow-sm">
            <div className={`mb-3 inline-flex h-11 w-11 items-center justify-center rounded-xl text-white ${c.tone === "primary" ? "bg-primary" : c.tone === "secondary" ? "bg-secondary" : c.tone === "gold" ? "bg-gold text-gold-foreground" : "bg-destructive"}`}>
              <c.icon className="h-5 w-5" />
            </div>
            <div className="text-2xl font-black">{c.value}</div>
            <div className="mt-1 text-sm text-muted-foreground">{c.label}</div>
          </div>
        ))}
      </div>

      <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        <QuickCard title="سجل الحضور" desc="افتح شاشة مسح QR أو سجّل الحضور يدوياً." to="/scan" />
        <QuickCard title="أضف مدفوعة" desc="سجّل مدفوعات الطلاب وتابع المتأخرات." to="/finance" />
        <QuickCard title="التقارير" desc="تقارير مصنفة حسب الصف والمجموعة." to="/reports" />
      </div>
    </div>
  );
}

function QuickCard({ title, desc, to }: { title: string; desc: string; to: "/scan" | "/finance" | "/reports" }) {
  return (
    <Link to={to} className="block rounded-2xl bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <h3 className="text-lg font-bold text-primary">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
    </Link>
  );
}

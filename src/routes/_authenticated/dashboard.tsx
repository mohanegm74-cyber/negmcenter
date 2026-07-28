import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Users, Boxes, ClipboardCheck, CalendarX, Wallet, TrendingUp, AlertCircle, Loader2 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { getDashboardStatsAdmin } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "لوحة التحكم — الأستاذ" }, { name: "description", content: "إحصائيات السنتر العامة." }] }),
  component: Dashboard,
});

function Dashboard() {
  const [s, setS] = useState({ students: 0, groups: 0, present: 0, absent: 0, income: 0, dues: 0, outstanding: 0 });
  const [loading, setLoading] = useState(true);
  const getStats = useServerFn(getDashboardStatsAdmin);

  async function load() {
    setLoading(true);
    try {
      const stats = await getStats({});
      setS(stats);
    } catch (e) {
      console.error("Failed to load stats:", e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const cards = [
    { icon: Users, label: "إجمالي الطلاب", value: s.students, tone: "primary" },
    { icon: Boxes, label: "المجموعات", value: s.groups, tone: "secondary" },
    { icon: ClipboardCheck, label: "حضور اليوم", value: s.present, tone: "gold" },
    { icon: CalendarX, label: "غياب اليوم", value: s.absent, tone: "destructive" },
    { icon: Wallet, label: "إجمالي المدفوع", value: `${s.income.toLocaleString("ar-EG")} ج.م`, tone: "secondary" },
    { icon: TrendingUp, label: "إجمالي الرسوم", value: `${s.dues.toLocaleString("ar-EG")} ج.م`, tone: "primary" },
    { icon: AlertCircle, label: "المتأخرات", value: `${s.outstanding.toLocaleString("ar-EG")} ج.م`, tone: "destructive" },
  ] as const;

  if (loading) return <div className="flex h-64 items-center justify-center text-muted-foreground"><Loader2 className="h-8 w-8 animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-black">إحصائيات السنتر العامة</h1>
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

      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Link to="/scan" className="block rounded-2xl bg-white p-6 shadow-sm transition hover:-translate-y-0.5">
          <h3 className="text-lg font-bold text-primary">سجل الحضور</h3>
          <p className="mt-1 text-sm text-muted-foreground">افتح شاشة مسح QR أو سجل الحضور.</p>
        </Link>
        <Link to="/finance" className="block rounded-2xl bg-white p-6 shadow-sm transition hover:-translate-y-0.5">
          <h3 className="text-lg font-bold text-secondary">الماليات</h3>
          <p className="mt-1 text-sm text-muted-foreground">تابع مدفوعات الطلاب والمتأخرات.</p>
        </Link>
        <Link to="/reports" className="block rounded-2xl bg-white p-6 shadow-sm transition hover:-translate-y-0.5">
          <h3 className="text-lg font-bold text-gold-foreground">التقارير</h3>
          <p className="mt-1 text-sm text-muted-foreground">تقارير شاملة عن أداء السنتر.</p>
        </Link>
      </div>
    </div>
  );
}
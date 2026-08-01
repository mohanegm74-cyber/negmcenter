import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Users, Boxes, ClipboardCheck, CalendarX, Wallet, TrendingUp, AlertCircle, Loader2, Sparkles, ArrowUpRight } from "lucide-react";
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

  if (loading) return <div className="flex h-64 items-center justify-center text-muted-foreground"><Loader2 className="h-8 w-8 animate-spin" /></div>;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-slate-800">مرحباً بك يا أستاذ 👋</h1>
          <p className="text-muted-foreground font-medium mt-1">إليك ملخص سريع لما يحدث في السنتر اليوم.</p>
        </div>
        <button onClick={load} className="h-12 w-12 rounded-2xl bg-white shadow-sm border border-slate-100 flex items-center justify-center hover:bg-primary/5 transition-all text-primary"><TrendingUp className="h-5 w-5" /></button>
      </div>
      
      {/* القسم الأول: إحصائيات عامة */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={Users} label="الطلاب المعتمدون" value={s.students} tone="primary" />
        <StatCard icon={Boxes} label="إجمالي المجموعات" value={s.groups} tone="secondary" />
        <StatCard icon={ClipboardCheck} label="حضور اليوم" value={s.present} tone="gold" />
        <StatCard icon={CalendarX} label="غياب اليوم" value={s.absent} tone="destructive" />
      </div>

      {/* القسم الثاني: ملخص المالية (مظهر جديد) */}
      <section className="rounded-[2.5rem] bg-slate-900 p-8 text-white shadow-2xl relative overflow-hidden">
        <Sparkles className="absolute -right-10 -top-10 h-64 w-64 text-white/5 rotate-12" />
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-xl font-black flex items-center gap-2"><Wallet className="h-6 w-6 text-emerald-400" /> المركز المالي للسنتر</h2>
            <Link to="/finance" className="text-xs font-bold text-white/60 hover:text-white flex items-center gap-1 transition-colors underline underline-offset-4">إدارة المالية بالتفصيل <ArrowUpRight className="h-3 w-3" /></Link>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div>
              <div className="text-[10px] font-black text-white/40 uppercase mb-2 tracking-widest">إجمالي الرسوم المستحقة</div>
              <div className="text-4xl font-black">{s.dues.toLocaleString("ar-EG")} <span className="text-sm font-normal opacity-60">ج.م</span></div>
            </div>
            <div>
              <div className="text-[10px] font-black text-emerald-400/60 uppercase mb-2 tracking-widest">المحصل فعلياً</div>
              <div className="text-4xl font-black text-emerald-400">{s.income.toLocaleString("ar-EG")} <span className="text-sm font-normal opacity-60">ج.م</span></div>
              <div className="mt-2 h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-400" style={{ width: `${s.dues > 0 ? (s.income / s.dues) * 100 : 0}%` }}></div>
              </div>
            </div>
            <div>
              <div className="text-[10px] font-black text-rose-400/60 uppercase mb-2 tracking-widest">إجمالي المتأخرات</div>
              <div className="text-4xl font-black text-rose-400">{s.outstanding.toLocaleString("ar-EG")} <span className="text-sm font-normal opacity-60">ج.م</span></div>
            </div>
          </div>
        </div>
      </section>

      {/* روابط سريعة */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <QuickLink to="/scan" icon={ClipboardCheck} title="سجل الحضور اليومي" desc="ابدأ بمسح أكواد الطلاب أو التسجيل اليدوي" tone="primary" />
        <QuickLink to="/exams" icon={Sparkles} title="الاختبارات الذكية" desc="قم بإنشاء اختبار جديد بالذكاء الاصطناعي الآن" tone="gold" />
        <QuickLink to="/reports" icon={TrendingUp} title="التقارير التحليلية" desc="شاهد أداء الطلاب والمجموعات بالتفصيل" tone="secondary" />
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, tone }: any) {
  const bg = tone === "primary" ? "bg-primary text-primary-foreground" : tone === "secondary" ? "bg-secondary text-secondary-foreground" : tone === "gold" ? "bg-gold text-gold-foreground" : "bg-destructive text-white";
  return (
    <div className="rounded-3xl bg-white p-6 shadow-sm border border-slate-50 hover:border-primary/20 transition-all group">
      <div className={`mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl ${bg} shadow-lg shadow-current/10 group-hover:scale-110 transition-transform`}>
        <Icon className="h-6 w-6" />
      </div>
      <div className="text-2xl font-black text-slate-800">{value}</div>
      <div className="mt-1 text-xs font-bold text-muted-foreground uppercase">{label}</div>
    </div>
  );
}

function QuickLink({ to, icon: Icon, title, desc, tone }: any) {
  const tColor = tone === "primary" ? "text-primary" : tone === "secondary" ? "text-secondary" : "text-gold-foreground";
  const bColor = tone === "primary" ? "border-primary/10" : tone === "secondary" ? "border-secondary/10" : "border-gold/20";
  return (
    <Link to={to} className={`block rounded-[2rem] bg-white p-6 shadow-sm border ${bColor} transition-all hover:-translate-y-1 hover:shadow-md`}>
      <div className={`mb-3 flex items-center gap-2 font-black ${tColor}`}>
        <Icon className="h-5 w-5" /> {title}
      </div>
      <p className="text-xs text-muted-foreground font-medium leading-relaxed">{desc}</p>
    </Link>
  );
}
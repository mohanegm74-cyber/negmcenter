import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Users, Boxes, ClipboardCheck, CalendarX, TrendingUp, Loader2, Sparkles, RefreshCw, BookOpen, Flame, BarChart3 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { getDashboardStatsAdmin, getDashboardInsightsAdmin } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "لوحة التحكم — الأستاذ" }, { name: "description", content: "إحصائيات السنتر العامة والموقف المالي." }] }),
  component: Dashboard,
});

type Insights = {
  levels: Record<string, number>;
  submitters: { id: string; student: string; grade: string; homework: string; level: string | null; status: string; submitted_at: string }[];
  topActive: { id: string; name: string; grade: string; present: number; subs: number; questions: number; total: number }[];
  submittedCount: number;
  totalStudents: number;
};

const LEVEL_TONE: Record<string, string> = {
  "ممتاز": "bg-emerald-500",
  "جيد جدا": "bg-primary",
  "جيد جداً": "bg-primary",
  "جيد": "bg-sky-500",
  "متوسط": "bg-amber-500",
  "ضعيف": "bg-rose-500",
};

function Dashboard() {
  const [s, setS] = useState({ students: 0, groups: 0, present: 0, absent: 0 });
  const [ins, setIns] = useState<Insights | null>(null);
  const [loading, setLoading] = useState(true);
  const getStats = useServerFn(getDashboardStatsAdmin);
  const getInsights = useServerFn(getDashboardInsightsAdmin);

  async function load() {
    setLoading(true);
    try {
      const [stats, insights] = await Promise.all([getStats({}), getInsights({})]);
      setS(stats);
      setIns(insights as Insights);
    } catch (e) {
      console.error("Failed to load stats:", e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  if (loading) return <div className="flex h-64 items-center justify-center text-muted-foreground"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  const levelEntries = Object.entries(ins?.levels || {}).sort((a, b) => b[1] - a[1]);
  const levelTotal = levelEntries.reduce((a, b) => a + b[1], 0);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-800">مرحباً بك يا أستاذ 👋</h1>
          <p className="text-muted-foreground font-medium mt-1">إليك ملخص سريع لأهم مؤشرات السنتر اليوم.</p>
        </div>
        <button onClick={load} className="h-12 px-5 rounded-2xl bg-white shadow-sm border border-slate-100 flex items-center justify-center gap-2 hover:bg-primary/5 transition-all text-primary font-bold text-sm"><RefreshCw className="h-4 w-4" /> تحديث البيانات</button>
      </div>

      {/* إحصائيات عامة */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={Users} label="الطلاب المعتمدون" value={s.students} tone="primary" />
        <StatCard icon={Boxes} label="إجمالي المجموعات" value={s.groups} tone="secondary" />
        <StatCard icon={ClipboardCheck} label="حضور اليوم" value={s.present} tone="gold" />
        <StatCard icon={CalendarX} label="غياب اليوم" value={s.absent} tone="destructive" />
      </div>

      {/* مستويات الطلاب */}
      <section className="rounded-[2.5rem] bg-white p-8 shadow-sm border border-slate-100">
        <h2 className="mb-6 flex items-center gap-2 text-lg font-black text-slate-800"><BarChart3 className="h-5 w-5 text-primary" /> مستويات الطلاب (آخر ٣٠ يوم)</h2>
        {levelEntries.length === 0 ? (
          <p className="text-sm font-bold text-muted-foreground">لا توجد تقييمات مسجلة بعد.</p>
        ) : (
          <div className="space-y-4">
            {levelEntries.map(([level, count]) => (
              <div key={level}>
                <div className="mb-1.5 flex items-center justify-between text-xs font-black">
                  <span className="text-slate-700">{level}</span>
                  <span className="text-muted-foreground">{count} تقييم</span>
                </div>
                <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100">
                  <div className={`h-full rounded-full transition-all duration-700 ${LEVEL_TONE[level] || "bg-slate-400"}`} style={{ width: `${levelTotal ? Math.max(4, (count / levelTotal) * 100) : 0}%` }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* من عرضوا الواجب */}
        <section className="rounded-[2.5rem] bg-white p-8 shadow-sm border border-slate-100">
          <h2 className="mb-1 flex items-center gap-2 text-lg font-black text-slate-800"><BookOpen className="h-5 w-5 text-secondary" /> من سلّموا الواجب</h2>
          <p className="mb-5 text-xs font-bold text-muted-foreground">{ins?.submittedCount || 0} طالب من {ins?.totalStudents || 0} قاموا بتسليم واجباتهم.</p>
          {(!ins?.submitters.length) ? (
            <p className="text-sm font-bold text-muted-foreground">لا توجد تسليمات حتى الآن.</p>
          ) : (
            <ul className="space-y-2 max-h-80 overflow-y-auto pe-1">
              {ins.submitters.map(sb => (
                <li key={sb.id} className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 px-4 py-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-black text-slate-800">{sb.student}</div>
                    <div className="truncate text-[11px] font-bold text-muted-foreground">{sb.homework}{sb.grade ? ` — ${sb.grade}` : ""}</div>
                  </div>
                  <span className={`shrink-0 rounded-full px-3 py-1 text-[10px] font-black text-white ${sb.level ? (LEVEL_TONE[sb.level] || "bg-slate-400") : "bg-slate-300"}`}>{sb.level || "بانتظار التقييم"}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* الأكثر تفاعلاً */}
        <section className="rounded-[2.5rem] bg-white p-8 shadow-sm border border-slate-100">
          <h2 className="mb-5 flex items-center gap-2 text-lg font-black text-slate-800"><Flame className="h-5 w-5 text-gold-foreground" /> الأكثر تفاعلاً</h2>
          {(!ins?.topActive.length) ? (
            <p className="text-sm font-bold text-muted-foreground">لا يوجد نشاط مسجل في آخر ٣٠ يوم.</p>
          ) : (
            <ol className="space-y-2 max-h-80 overflow-y-auto pe-1">
              {ins.topActive.map((t, i) => (
                <li key={t.id} className="flex items-center gap-3 rounded-2xl bg-slate-50 px-4 py-3">
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-xs font-black ${i === 0 ? "bg-gold text-gold-foreground" : "bg-white text-slate-500 border border-slate-100"}`}>{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-black text-slate-800">{t.name}</div>
                    <div className="truncate text-[11px] font-bold text-muted-foreground">حضور {t.present} • واجبات {t.subs} • أسئلة {t.questions}</div>
                  </div>
                  <span className="shrink-0 text-sm font-black text-primary">{t.total}</span>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>

      {/* روابط سريعة */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <QuickLink to="/scan" icon={ClipboardCheck} title="سجل الحضور اليومي" desc="ابدأ بمسح أكواد الطلاب أو التسجيل اليدوي السريع" tone="primary" />
        <QuickLink to="/exams" icon={Sparkles} title="الاختبارات الذكية" desc="قم بإنشاء اختبار جديد بالذكاء الاصطناعي الآن وتابِع النتائج" tone="gold" />
        <QuickLink to="/reports" icon={TrendingUp} title="التقارير التحليلية" desc="شاهد أداء الطلاب والمجموعات والنسب المئوية بالتفصيل" tone="secondary" />
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, tone, suffix = "" }: any) {
  const bg = tone === "primary" ? "bg-primary text-primary-foreground" : tone === "secondary" ? "bg-secondary text-secondary-foreground" : tone === "gold" ? "bg-gold text-gold-foreground" : "bg-destructive text-white";
  const shadow = tone === "primary" ? "shadow-primary/10" : tone === "secondary" ? "shadow-secondary/10" : tone === "gold" ? "shadow-gold/10" : "shadow-destructive/10";
  
  return (
    <div className="rounded-3xl bg-white p-6 shadow-sm border border-slate-50 hover:border-primary/20 hover:shadow-md transition-all group cursor-default">
      <div className={`mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl ${bg} shadow-lg ${shadow} group-hover:scale-110 group-hover:rotate-3 transition-transform`}>
        <Icon className="h-6 w-6" />
      </div>
      <div className="text-2xl font-black text-slate-800">{value.toLocaleString("ar-EG")} <span className="text-xs font-normal opacity-60">{suffix}</span></div>
      <div className="mt-1 text-xs font-bold text-muted-foreground uppercase tracking-tight">{label}</div>
    </div>
  );
}

function QuickLink({ to, icon: Icon, title, desc, tone }: any) {
  const tColor = tone === "primary" ? "text-primary" : tone === "secondary" ? "text-secondary" : "text-gold-foreground";
  const bColor = tone === "primary" ? "border-primary/10" : tone === "secondary" ? "border-secondary/10" : "border-gold/20";
  return (
    <Link to={to} className={`block rounded-[2rem] bg-white p-6 shadow-sm border ${bColor} transition-all hover:-translate-y-1 hover:shadow-md group`}>
      <div className={`mb-3 flex items-center gap-2 font-black ${tColor} group-hover:scale-105 transition-transform origin-right`}>
        <Icon className="h-5 w-5" /> {title}
      </div>
      <p className="text-xs text-muted-foreground font-medium leading-relaxed">{desc}</p>
    </Link>
  );
}
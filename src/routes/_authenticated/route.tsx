import { createFileRoute, Outlet, Link, redirect, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { LayoutDashboard, Users, Boxes, ClipboardCheck, LogOut, Home, Wallet, BookOpen, FileBarChart, IdCard, Award, MessageCircleQuestion, FileQuestion, DatabaseBackup, ListChecks, Settings } from "lucide-react";
import { Toaster } from "sonner";
import { BrandLogo } from "@/components/BrandLogo";
import { useServerFn } from "@tanstack/react-start";
import { getDashboardStatsAdmin } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw redirect({ to: "/auth" });
    }
    
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", session.user.id)
      .maybeSingle();

    if (!roleData || (roleData.role !== "teacher" && roleData.role !== "admin")) {
      await supabase.auth.signOut();
      throw redirect({ to: "/auth" });
    }
  },
  component: TeacherShell,
});

function TeacherShell() {
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [stats, setStats] = useState<any>(null);
  const getStatsFn = useServerFn(getDashboardStatsAdmin);

  async function loadStats() {
    try {
      const res = await getStatsFn({});
      setStats(res);
    } catch {}
  }

  useEffect(() => { loadStats(); const t = setInterval(loadStats, 60000); return () => clearInterval(t); }, []);

  async function signOut() { 
    await supabase.auth.signOut(); 
    navigate({ to: "/auth" }); 
  }

  const NAV = [
    { to: "/dashboard", label: "الرئيسية", icon: LayoutDashboard },
    { to: "/students", label: "الطلاب", icon: Users },
    { to: "/groups", label: "المجموعات", icon: Boxes },
    { to: "/group-lists", label: "قوائم المجموعات", icon: ListChecks },
    { to: "/attendance", label: "الحضور", icon: ClipboardCheck },
    { to: "/finance", label: "الماليات", icon: Wallet },
    { to: "/homework", label: "الواجبات", icon: BookOpen },
    { to: "/exams", label: "الاختبارات الذكية", icon: FileQuestion },
    { to: "/questions", label: "أسئلة الطلاب", icon: MessageCircleQuestion, badge: stats?.newQuestions > 0 ? stats.newQuestions : null },
    { to: "/reports", label: "التقارير", icon: FileBarChart },
    { to: "/cards", label: "كروت الطلاب", icon: IdCard },
    { to: "/certificates", label: "شهادات التقدير", icon: Award },
    { to: "/backup", label: "النسخ الاحتياطي", icon: DatabaseBackup },
    { to: "/settings", label: "الإعدادات", icon: Settings },
  ] as const;

  return (
    <div className="min-h-screen bg-muted/30">
      <Toaster position="top-center" richColors />
      <header className="sticky top-0 z-30 border-b bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <BrandLogo size={44} className="!shadow-none" />
            <div>
              <div className="text-sm font-black text-primary">سنتر الأستاذ محمد نجم</div>
              <div className="text-[10px] text-muted-foreground">لوحة تحكم الأستاذ</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/" className="inline-flex items-center gap-1 rounded-lg border border-input px-3 py-1.5 text-xs hover:bg-accent"><Home className="h-3.5 w-3.5" /> الموقع</Link>
            <button onClick={signOut} className="inline-flex items-center gap-1 rounded-lg bg-destructive/10 px-3 py-1.5 text-xs font-semibold text-destructive hover:bg-destructive/15"><LogOut className="h-3.5 w-3.5" /> خروج</button>
          </div>
        </div>
        <nav className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 pb-2 no-scrollbar">
          {NAV.map(({ to, label, icon: Icon, badge }: any) => (
            <Link key={to} to={to} className={`relative inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition ${path === to ? "bg-primary text-primary-foreground shadow" : "text-foreground hover:bg-accent"}`}>
              <Icon className="h-4 w-4" /> 
              {label}
              {badge && <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[8px] font-black text-white shadow-sm animate-bounce">{badge}</span>}
            </Link>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
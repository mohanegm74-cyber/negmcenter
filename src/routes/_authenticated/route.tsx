import { createFileRoute, Outlet, Link, redirect, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { LayoutDashboard, Users, Boxes, ClipboardCheck, ScanLine, LogOut, Home, Wallet, BookOpen, FileBarChart, IdCard, Award, MessageCircleQuestion, FileQuestion, DatabaseBackup } from "lucide-react";
import { Toaster } from "sonner";
import { BrandLogo } from "@/components/BrandLogo";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/auth" });
  },
  component: TeacherShell,
});

const NAV = [
  { to: "/dashboard", label: "الرئيسية", icon: LayoutDashboard },
  { to: "/students", label: "الطلاب", icon: Users },
  { to: "/groups", label: "المجموعات", icon: Boxes },
  { to: "/attendance", label: "الحضور", icon: ClipboardCheck },
  { to: "/scan", label: "مسح QR", icon: ScanLine },
  { to: "/finance", label: "الماليات", icon: Wallet },
  { to: "/homework", label: "الواجبات", icon: BookOpen },
  { to: "/exams", label: "الاختبارات الذكية", icon: FileQuestion },
  { to: "/questions", label: "أسئلة الطلاب", icon: MessageCircleQuestion },
  { to: "/reports", label: "التقارير", icon: FileBarChart },
  { to: "/cards", label: "كروت الطلاب", icon: IdCard },
  { to: "/certificates", label: "شهادات التقدير", icon: Award },
  { to: "/backup", label: "النسخ الاحتياطي", icon: DatabaseBackup },
] as const;

function TeacherShell() {
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") navigate({ to: "/auth" });
    });
    return () => data.subscription.unsubscribe();
  }, [navigate]);

  useEffect(() => {
    let alive = true;
    async function load() {
      const { count } = await supabase.from("questions").select("id", { count: "exact", head: true }).eq("is_read", false);
      if (alive) setUnread(count || 0);
    }
    load();
    const ch = supabase.channel("q-unread").on("postgres_changes", { event: "*", schema: "public", table: "questions" }, load).subscribe();
    const t = setInterval(load, 30000);
    return () => { alive = false; supabase.removeChannel(ch); clearInterval(t); };
  }, []);

  async function signOut() { await supabase.auth.signOut(); navigate({ to: "/auth" }); }

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
        <nav className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 pb-2">
          {NAV.map(({ to, label, icon: Icon }) => {
            const active = path === to;
            const badge = to === "/questions" && unread > 0;
            return (
              <Link key={to} to={to} className={`relative inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition ${active ? "bg-primary text-primary-foreground shadow" : "text-foreground hover:bg-accent"}`}>
                <Icon className="h-4 w-4" /> {label}
                {badge && <span className="absolute -top-1 -left-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">{unread}</span>}
              </Link>
            );
          })}
        </nav>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}

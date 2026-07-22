import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Users, Boxes, ClipboardCheck, CalendarX } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "لوحة التحكم — الأستاذ" }, { name: "description", content: "إحصائيات السنتر." }] }),
  component: Dashboard,
});

function Dashboard() {
  const [stats, setStats] = useState({ students: 0, groups: 0, present: 0, absent: 0 });

  useEffect(() => {
    (async () => {
      const today = new Date().toISOString().slice(0, 10);
      const [s, g, ap, aa] = await Promise.all([
        supabase.from("students").select("id", { count: "exact", head: true }),
        supabase.from("groups").select("id", { count: "exact", head: true }),
        supabase.from("attendance").select("id", { count: "exact", head: true }).eq("date", today).eq("status", "present"),
        supabase.from("attendance").select("id", { count: "exact", head: true }).eq("date", today).eq("status", "absent"),
      ]);
      setStats({ students: s.count || 0, groups: g.count || 0, present: ap.count || 0, absent: aa.count || 0 });
    })();
  }, []);

  const cards = [
    { icon: Users, label: "إجمالي الطلاب", value: stats.students, tone: "primary" as const },
    { icon: Boxes, label: "المجموعات", value: stats.groups, tone: "secondary" as const },
    { icon: ClipboardCheck, label: "حضور اليوم", value: stats.present, tone: "gold" as const },
    { icon: CalendarX, label: "غياب اليوم", value: stats.absent, tone: "destructive" as const },
  ];

  return (
    <div>
      <h1 className="mb-6 text-2xl font-black">أهلاً بك في لوحة التحكم</h1>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-2xl bg-white p-5 shadow-sm">
            <div className={`mb-3 inline-flex h-11 w-11 items-center justify-center rounded-xl text-white ${c.tone === "primary" ? "bg-primary" : c.tone === "secondary" ? "bg-secondary" : c.tone === "gold" ? "bg-gold text-gold-foreground" : "bg-destructive"}`}>
              <c.icon className="h-5 w-5" />
            </div>
            <div className="text-3xl font-black">{c.value}</div>
            <div className="mt-1 text-sm text-muted-foreground">{c.label}</div>
          </div>
        ))}
      </div>

      <div className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <QuickCard title="ابدأ بإنشاء مجموعة" desc="أنشئ مجموعاتك الدراسية أولاً ثم قم بإضافة الطلاب إليها." to="/groups" />
        <QuickCard title="سجّل الحضور بسرعة" desc="افتح شاشة مسح QR أو سجّل الحضور يدوياً لكل مجموعة." to="/scan" />
      </div>
    </div>
  );
}

import { Link } from "@tanstack/react-router";
function QuickCard({ title, desc, to }: { title: string; desc: string; to: "/groups" | "/scan" }) {
  return (
    <Link to={to} className="block rounded-2xl bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <h3 className="text-lg font-bold text-primary">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
    </Link>
  );
}

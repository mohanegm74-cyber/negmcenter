import { createFileRoute, Link } from "@tanstack/react-router";
import { GraduationCap, UserRoundCog, Sparkles } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "سنتر الأستاذ محمد نجم — الرئيسية" },
      { name: "description", content: "منصة سنتر الأستاذ محمد نجم لإدارة الطلاب والمجموعات والحضور." },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <main className="relative min-h-screen overflow-hidden" style={{ background: "var(--gradient-hero)" }}>
      <div className="absolute inset-0 opacity-20 pointer-events-none"
           style={{ backgroundImage: "radial-gradient(circle at 20% 20%, white 1px, transparent 1px), radial-gradient(circle at 80% 60%, white 1px, transparent 1px)", backgroundSize: "40px 40px" }} />
      <div className="relative mx-auto flex min-h-screen max-w-5xl flex-col items-center justify-center px-6 py-16 text-center">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-1.5 text-sm font-semibold text-white backdrop-blur-sm">
          <Sparkles className="h-4 w-4" style={{ color: "var(--color-gold)" }} />
          <span>منصة إدارة السنتر التعليمي</span>
        </div>
        <h1 className="text-4xl font-black leading-tight text-white sm:text-6xl">
          سنتر الأستاذ<br />
          <span style={{ color: "var(--color-gold)" }}>محمد نجم</span>
        </h1>
        <p className="mt-4 max-w-xl text-lg text-white/90">
          نظام متكامل لإدارة الطلاب، المجموعات، الحصص، والحضور بأحدث التقنيات.
        </p>

        <div className="mt-12 grid w-full max-w-3xl grid-cols-1 gap-5 sm:grid-cols-2">
          <Link to="/student/register" className="group rounded-2xl bg-white p-8 text-right shadow-2xl transition-all hover:-translate-y-1 hover:shadow-[0_25px_60px_-15px_rgba(0,0,0,0.4)]">
            <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl" style={{ background: "var(--gradient-emerald)" }}>
              <GraduationCap className="h-7 w-7 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-foreground">دخول الطالب</h2>
            <p className="mt-2 text-sm text-muted-foreground">تسجيل طالب جديد أو الدخول بكودك لعرض جدولك وحضورك.</p>
            <span className="mt-4 inline-flex text-sm font-bold text-secondary group-hover:underline">ابدأ الآن ←</span>
          </Link>

          <Link to="/auth" className="group rounded-2xl bg-white p-8 text-right shadow-2xl transition-all hover:-translate-y-1 hover:shadow-[0_25px_60px_-15px_rgba(0,0,0,0.4)]">
            <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl" style={{ background: "var(--gradient-primary)" }}>
              <UserRoundCog className="h-7 w-7 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-foreground">دخول الأستاذ</h2>
            <p className="mt-2 text-sm text-muted-foreground">لوحة تحكم إدارية كاملة للطلاب والمجموعات والحضور.</p>
            <span className="mt-4 inline-flex text-sm font-bold text-primary group-hover:underline">تسجيل الدخول ←</span>
          </Link>
        </div>

        <p className="mt-16 text-xs text-white/70">© {new Date().getFullYear()} سنتر الأستاذ محمد نجم • جميع الحقوق محفوظة</p>
      </div>
    </main>
  );
}

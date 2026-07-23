import { createFileRoute, Link } from "@tanstack/react-router";
import { GraduationCap, UserRoundCog, Sparkles } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";

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
        <BrandLogo size={140} className="mb-6 !bg-transparent !shadow-2xl" />
        <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-1.5 text-sm font-semibold text-white backdrop-blur-sm">
          <Sparkles className="h-4 w-4" style={{ color: "var(--color-gold)" }} />
          <span>منصة إدارة السنتر التعليمي</span>
        </div>
        <h1 className="text-4xl font-black leading-tight text-white sm:text-6xl">
          سنتر الأستاذ<br />
          <span style={{ color: "var(--color-gold)" }}>محمد نجم</span>
        </h1>
        <p className="mt-4 max-w-xl text-lg text-white/90">
          نظام متكامل لإدارة الطلاب، المجموعات، الحصص، الحضور، الماليات، الواجبات والتقارير.
        </p>
        <div className="mt-10 grid w-full max-w-2xl grid-cols-1 gap-4 sm:grid-cols-2">
          <Link to="/student/portal" className="group rounded-2xl bg-white p-6 text-right shadow-xl transition hover:-translate-y-1">
            <GraduationCap className="mb-3 h-9 w-9 text-primary" />
            <div className="text-xl font-black text-primary">دخول الطالب</div>
            <p className="mt-1 text-sm text-muted-foreground">بدون كلمة مرور — أدخل كودك لمشاهدة بياناتك.</p>
          </Link>
          <Link to="/auth" className="group rounded-2xl bg-white p-6 text-right shadow-xl transition hover:-translate-y-1">
            <UserRoundCog className="mb-3 h-9 w-9 text-secondary" />
            <div className="text-xl font-black text-secondary">دخول الأستاذ</div>
            <p className="mt-1 text-sm text-muted-foreground">لوحة تحكم شاملة لإدارة السنتر.</p>
          </Link>
        </div>
        <Link to="/student/register" className="mt-6 text-sm font-semibold text-white/90 underline underline-offset-4 hover:text-white">
          طالب جديد؟ سجّل هنا
        </Link>
      </div>
    </main>
  );
}

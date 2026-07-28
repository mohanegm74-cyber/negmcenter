import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast, Toaster } from "sonner";
import { ArrowRight, LogIn, UserPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { BrandLogo } from "@/components/BrandLogo";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "دخول الأستاذ — سنتر الأستاذ محمد نجم" }, { name: "description", content: "تسجيل دخول الأستاذ إلى لوحة التحكم." }] }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { if (data.session) navigate({ to: "/dashboard" }); });
  }, [navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin + "/dashboard" } });
        if (error) throw error;
        // محاولة منح رتبة معلم فوراً
        await supabase.rpc("claim_teacher_role");
        toast.success("تم إنشاء الحساب بنجاح.");
        navigate({ to: "/dashboard" });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        // التأكد من وجود الرتبة في كل دخول
        await supabase.rpc("claim_teacher_role");
        toast.success("مرحباً بعودتك يا أستاذ");
        navigate({ to: "/dashboard" });
      }
    } catch (err: any) {
      toast.error(err.message || "فشل تسجيل الدخول");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--gradient-hero)" }}>
      <Toaster position="top-center" richColors />
      <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-10">
        <Link to="/" className="mb-6 inline-flex items-center gap-2 self-start text-sm font-semibold text-white/90 hover:text-white"><ArrowRight className="h-4 w-4" /> الرئيسية</Link>
        <div className="rounded-2xl bg-white p-8 shadow-2xl">
          <div className="flex justify-center"><BrandLogo size={88} className="!shadow-md" /></div>
          <h1 className="mt-4 text-center text-2xl font-black text-primary">لوحة الأستاذ</h1>
          <p className="mt-1 text-center text-sm text-muted-foreground">سنتر الأستاذ محمد نجم</p>

          <div className="mt-6 grid grid-cols-2 rounded-lg bg-muted p-1 text-sm font-bold">
            <button onClick={() => setMode("signin")} className={`rounded-md py-2 ${mode === "signin" ? "bg-white shadow" : "text-muted-foreground"}`}>دخول</button>
            <button onClick={() => setMode("signup")} className={`rounded-md py-2 ${mode === "signup" ? "bg-white shadow" : "text-muted-foreground"}`}>إنشاء حساب</button>
          </div>

          <form onSubmit={submit} className="mt-6 space-y-3">
            <div>
              <label className="mb-1.5 block text-sm font-semibold">البريد الإلكتروني</label>
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-lg border border-input px-3 py-2.5 outline-none focus:ring-2 focus:ring-ring" dir="ltr" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold">كلمة المرور</label>
              <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} className="w-full rounded-lg border border-input px-3 py-2.5 outline-none focus:ring-2 focus:ring-ring" dir="ltr" />
            </div>
            <button type="submit" disabled={loading} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-2.5 font-bold text-primary-foreground disabled:opacity-60">
              {mode === "signup" ? <UserPlus className="h-4 w-4" /> : <LogIn className="h-4 w-4" />}
              {loading ? "جارٍ التحقق..." : mode === "signup" ? "إنشاء الحساب" : "تسجيل الدخول"}
            </button>
          </form>
          <p className="mt-4 text-center text-xs text-muted-foreground leading-relaxed">
            ملاحظة: إذا كنت قد سجلت مسبقاً، استخدم نفس البريد لاستعادة صلاحياتك.
          </p>
        </div>
      </div>
    </div>
  );
}
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast, Toaster } from "sonner";
import { LogIn, ShieldCheck, Lock, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { BrandLogo } from "@/components/BrandLogo";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "دخول الإدارة — سنتر الأستاذ محمد نجم" }] }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  // البريد الداخلي الموحد للمسئول
  const ADMIN_EMAIL = "admin@negm-center.local";

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { 
      if (data.session && data.session.user.email === ADMIN_EMAIL) {
        navigate({ to: "/dashboard" }); 
      }
    });
  }, [navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (username.toLowerCase() !== "admin") {
      toast.error("اسم المستخدم غير صحيح، استخدم 'admin'");
      return;
    }

    setLoading(true);
    try {
      // 1. تنظيف أي جلسة سابقة عالقة
      await supabase.auth.signOut();

      // 2. محاولة تسجيل الدخول مباشرة
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({ 
        email: ADMIN_EMAIL, 
        password 
      });
      
      if (!signInError) {
        await supabase.rpc("claim_teacher_role");
        toast.success("مرحباً بك يا أستاذ محمد");
        navigate({ to: "/dashboard" });
        return;
      }

      // 3. إذا فشل الدخول، ربما الحساب غير موجود (أول مرة)
      // سنحاول إنشاء الحساب فقط إذا كانت كلمة المرور هي الافتراضية
      if (signInError.message.includes("Invalid login credentials") && password === "Admin@123456") {
        const { error: signUpError } = await supabase.auth.signUp({ 
          email: ADMIN_EMAIL, 
          password: "Admin@123456" 
        });

        if (signUpError) {
          if (signUpError.message.includes("already registered")) {
            // الحساب موجود فعلاً ولكن كلمة المرور المدخلة خاطئة
            toast.error("كلمة المرور غير صحيحة لهذا المستخدم.");
          } else {
            toast.error("خطأ في تهيئة النظام: " + signUpError.message);
          }
          return;
        }

        // الحساب أُنشئ الآن، نمنحه الصلاحيات وندخل
        await supabase.rpc("claim_teacher_role");
        toast.success("تم تهيئة نظام الإدارة بنجاح. مرحباً بك!");
        navigate({ to: "/dashboard" });
      } else {
        // خطأ عادي في البيانات
        toast.error("بيانات الدخول غير صحيحة. تأكد من كلمة المرور.");
      }
    } catch (err: any) {
      toast.error(err.message || "حدث خطأ غير متوقع");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50" style={{ background: "var(--gradient-hero)" }}>
      <Toaster position="top-center" richColors />
      <div className="w-full max-w-md px-6">
        <div className="rounded-3xl bg-white p-8 shadow-2xl border border-white/20">
          <div className="flex justify-center mb-6">
            <BrandLogo size={100} className="!shadow-md" />
          </div>
          
          <h1 className="text-center text-2xl font-black text-primary">دخول المسئول</h1>
          <p className="mt-1 text-center text-sm text-muted-foreground mb-8">يرجى إدخال بيانات الاعتماد للوصول للوحة التحكم</p>

          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 flex items-center gap-1.5 ms-1">
                <ShieldCheck className="h-3.5 w-3.5" /> اسم المستخدم
              </label>
              <input 
                type="text" 
                required 
                value={username} 
                onChange={(e) => setUsername(e.target.value)} 
                placeholder="admin"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-bold" 
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 flex items-center gap-1.5 ms-1">
                <Lock className="h-3.5 w-3.5" /> كلمة المرور
              </label>
              <input 
                type="password" 
                required 
                value={password} 
                onChange={(e) => setPassword(e.target.value)} 
                placeholder="••••••••"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-mono" 
              />
            </div>

            <button 
              type="submit" 
              disabled={loading} 
              className="group relative w-full overflow-hidden rounded-xl bg-primary py-3.5 font-black text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:opacity-95 active:scale-[0.98] disabled:opacity-70"
            >
              <span className="flex items-center justify-center gap-2">
                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : (
                  <>
                    <LogIn className="h-5 w-5" />
                    دخول النظام
                  </>
                )}
              </span>
            </button>
          </form>
          
          <div className="mt-4 p-4 bg-blue-50 rounded-xl border border-blue-100">
             <p className="text-[10px] text-blue-800 font-bold leading-relaxed">
               * إذا كنت تدخل لأول مرة أو بعد تحديث النظام، استخدم كلمة المرور <span className="underline font-black">Admin@123456</span> ليتم إنشاء حسابك تلقائياً.
             </p>
          </div>

          <div className="mt-6 text-center">
            <Link to="/" className="text-sm font-bold text-primary hover:underline">العودة للموقع الرئيسي</Link>
          </div>
        </div>
        <p className="mt-6 text-center text-xs text-white/60 font-medium">نظام إدارة سنتر الأستاذ محمد نجم — جميع الحقوق محفوظة</p>
      </div>
    </div>
  );
}
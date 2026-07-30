import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast, Toaster } from "sonner";
import { LogIn, ShieldCheck, Lock } from "lucide-react";
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
      toast.error("اسم المستخدم غير صحيح");
      return;
    }

    setLoading(true);
    try {
      // محاولة تسجيل الدخول
      const { error } = await supabase.auth.signInWithPassword({ 
        email: ADMIN_EMAIL, 
        password 
      });
      
      if (error) {
        // إذا لم يكن الحساب موجوداً (أول مرة)، نقوم بإنشائه تلقائياً بكلمة مرور مقبولة أمنياً
        if (error.message.includes("Invalid login credentials") && password === "Admin@123456") {
           const { error: signUpError } = await supabase.auth.signUp({ 
             email: ADMIN_EMAIL, 
             password: "Admin@123456" 
           });
           
           if (signUpError) {
             if (signUpError.message.includes("weak")) {
                toast.error("كلمة المرور ضعيفة جداً. يرجى استخدام كلمة مرور تحتوي على حروف وأرقام (مثل Admin@123456)");
                return;
             }
             throw signUpError;
           }
           
           await supabase.rpc("claim_teacher_role");
           toast.success("تم تهيئة نظام الإدارة بنجاح بكلمة المرور الافتراضية");
           navigate({ to: "/dashboard" });
           return;
        }
        
        if (error.message.includes("weak")) {
          toast.error("كلمة المرور المدخلة ضعيفة. جرب كلمة مرور أقوى.");
        } else {
          toast.error("بيانات الدخول غير صحيحة. للدخول لأول مرة استخدم Admin@123456");
        }
        return;
      }

      await supabase.rpc("claim_teacher_role");
      toast.success("مرحباً بك يا أستاذ محمد");
      navigate({ to: "/dashboard" });
    } catch (err: any) {
      toast.error(err.message || "فشل تسجيل الدخول");
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
                placeholder="مثال: admin"
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
                placeholder="Admin@123456"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-mono" 
              />
            </div>

            <button 
              type="submit" 
              disabled={loading} 
              className="group relative w-full overflow-hidden rounded-xl bg-primary py-3.5 font-black text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:opacity-95 active:scale-[0.98] disabled:opacity-70"
            >
              <span className="flex items-center justify-center gap-2">
                {loading ? "جاري التحقق..." : (
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
               * للدخول أول مرة، استخدم اسم المستخدم <span className="underline">admin</span> وكلمة المرور <span className="underline">Admin@123456</span>.
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
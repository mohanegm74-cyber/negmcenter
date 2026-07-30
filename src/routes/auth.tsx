import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast, Toaster } from "sonner";
import { LogIn, UserPlus, Mail, Lock, Loader2, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { BrandLogo } from "@/components/BrandLogo";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "دخول الإدارة — سنتر الأستاذ محمد نجم" }] }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"login" | "register">("login");

  useEffect(() => {
    // التحقق مما إذا كان المستخدم مسجلاً وله رتبة معلم فعلاً
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session) {
        const { data: isTeacher } = await supabase.rpc("is_teacher");
        if (isTeacher) navigate({ to: "/dashboard" });
      }
    });
  }, [navigate]);

  async function handleAuth(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      if (mode === "register") {
        // 1. محاولة إنشاء حساب جديد
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        
        // 2. محاولة حجز رتبة "الأستاذ" (ستنجح فقط لأول مستخدم في النظام)
        const { data: claimed, error: rpcError } = await supabase.rpc("claim_teacher_role");
        
        if (claimed) {
          toast.success("تم تسجيلك كمسئول أول للنظام بنجاح");
          navigate({ to: "/dashboard" });
        } else {
          // إذا فشل حجز الرتبة، يعني هناك مسئول آخر مسبقاً
          await supabase.auth.signOut();
          throw new Error("عذراً، هذا النظام محجوز لمسئول آخر بالفعل. لا يمكن تسجيل حسابات إضافية.");
        }
      } else {
        // تسجيل الدخول العادي
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;

        // التحقق من الصلاحية
        const { data: isTeacher } = await supabase.rpc("is_teacher");
        if (isTeacher) {
          toast.success("مرحباً بك يا أستاذ محمد");
          navigate({ to: "/dashboard" });
        } else {
          await supabase.auth.signOut();
          throw new Error("عذراً، هذا الحساب لا يملك صلاحيات الإدارة.");
        }
      }
    } catch (err: any) {
      toast.error(err.message || "حدث خطأ في عملية الدخول");
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
          
          <h1 className="text-center text-2xl font-black text-primary">لوحة تحكم الأستاذ</h1>
          <p className="mt-1 text-center text-sm text-muted-foreground mb-8">
            {mode === "login" ? "سجل دخولك بإيميلك الشخصي" : "سجل كمسئول أول (للمرة الأولى فقط)"}
          </p>

          <form onSubmit={handleAuth} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 flex items-center gap-1.5 ms-1">
                <Mail className="h-3.5 w-3.5" /> البريد الإلكتروني الشخصي
              </label>
              <input 
                type="email" 
                required 
                value={email} 
                onChange={(e) => setEmail(e.target.value)} 
                placeholder="example@gmail.com"
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
                    {mode === "login" ? <LogIn className="h-5 w-5" /> : <UserPlus className="h-5 w-5" />}
                    {mode === "login" ? "دخول النظام" : "إنشاء حساب مسئول أول"}
                  </>
                )}
              </span>
            </button>
          </form>
          
          <div className="mt-6 flex flex-col gap-3">
             <button 
               onClick={() => setMode(mode === "login" ? "register" : "login")}
               className="text-xs font-bold text-slate-500 hover:text-primary transition-colors text-center"
             >
               {mode === "login" ? "هل هذه أول مرة تدخل فيها؟ سجل هنا كمسئول أول" : "لديك حساب بالفعل؟ سجل دخولك من هنا"}
             </button>
             <div className="h-px bg-slate-100 my-2"></div>
             <Link to="/" className="text-center text-sm font-bold text-primary hover:underline">العودة للموقع الرئيسي</Link>
          </div>
        </div>

        <div className="mt-6 p-4 bg-white/10 backdrop-blur-sm rounded-2xl border border-white/10">
           <div className="flex gap-3">
             <ShieldCheck className="h-5 w-5 text-white shrink-0" />
             <p className="text-[11px] text-white leading-relaxed">
               <b className="block mb-1">نظام حماية المسئول:</b>
               بناءً على طلبك، النظام مبرمج لقبول مسئول واحد فقط (أول من يسجل). أي محاولة تسجيل أخرى بإيميل مختلف سيتم رفضها قسرياً لحماية بيانات السنتر.
             </p>
           </div>
        </div>
      </div>
    </div>
  );
}
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast, Toaster } from "sonner";
import { LogIn, UserPlus, Mail, Lock, Loader2, ShieldCheck, Copy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { BrandLogo } from "@/components/BrandLogo";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "دخول الأستاذ محمد نجم" }] }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("mohanegm74@gmail.com");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"login" | "register">("login");

  const SUGGESTED_PASS = "Negm74!Center#Secure$2024";

  useEffect(() => {
    // 1. عمل خروج إجباري لكل الجلسات القديمة فور فتح الصفحة
    supabase.auth.signOut();
    localStorage.clear();
  }, []);

  async function handleAuth(e: React.FormEvent) {
    e.preventDefault();
    
    // تأكيد حماية الإيميل برمجياً
    if (email.trim().toLowerCase() !== "mohanegm74@gmail.com") {
      toast.error("عذراً، هذا النظام مخصص للأستاذ محمد نجم فقط (mohanegm74@gmail.com)");
      return;
    }

    setLoading(true);
    try {
      if (mode === "register") {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        
        // منح رتبة الأستاذ حصرياً
        const { data: claimed, error: rpcError } = await supabase.rpc("claim_teacher_role");
        
        if (claimed) {
          toast.success("تم إنشاء حسابك كمسئول وحيد للنظام");
          navigate({ to: "/dashboard" });
        } else {
          await supabase.auth.signOut();
          throw new Error("حدث خطأ أثناء حجز الرتبة. قد يكون الحساب موجوداً بالفعل.");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;

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

  const copyPass = () => {
    navigator.clipboard.writeText(SUGGESTED_PASS);
    setPassword(SUGGESTED_PASS);
    toast.success("تم نسخ ووضع كلمة المرور المقترحة");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50" style={{ background: "var(--gradient-hero)" }}>
      <Toaster position="top-center" richColors />
      <div className="w-full max-w-md px-6">
        <div className="rounded-3xl bg-white p-8 shadow-2xl border border-white/20">
          <div className="flex justify-center mb-6">
            <BrandLogo size={100} className="!shadow-md" />
          </div>
          
          <h1 className="text-center text-2xl font-black text-primary">دخول الأستاذ محمد نجم</h1>
          <p className="mt-1 text-center text-sm text-muted-foreground mb-8">
            {mode === "login" ? "سجل دخولك بحسابك الرسمي" : "إنشاء حساب المسئول الرئيسي"}
          </p>

          <form onSubmit={handleAuth} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 flex items-center gap-1.5 ms-1">
                <Mail className="h-3.5 w-3.5" /> البريد الإلكتروني الرسمي
              </label>
              <input 
                type="email" 
                readOnly
                value={email} 
                className="w-full rounded-xl border border-slate-200 bg-slate-100 px-4 py-3 outline-none text-slate-500 font-bold cursor-not-allowed" 
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

            {mode === "register" && (
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-100 mb-2">
                <p className="text-[10px] font-black text-amber-800 mb-2 flex items-center gap-1">
                  <ShieldCheck className="h-3 w-3" /> كلمة مرور قوية مقترحة لتخطي قيود النظام:
                </p>
                <div className="flex items-center justify-between gap-2 bg-white p-2 rounded-lg border border-amber-200">
                  <code className="text-xs font-bold text-primary">{SUGGESTED_PASS}</code>
                  <button type="button" onClick={copyPass} className="p-1.5 hover:bg-slate-100 rounded text-primary transition-colors">
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )}

            <button 
              type="submit" 
              disabled={loading} 
              className="group relative w-full overflow-hidden rounded-xl bg-primary py-3.5 font-black text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:opacity-95 active:scale-[0.98] disabled:opacity-70"
            >
              <span className="flex items-center justify-center gap-2">
                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : (
                  <>
                    {mode === "login" ? <LogIn className="h-5 w-5" /> : <UserPlus className="h-5 w-5" />}
                    {mode === "login" ? "دخول النظام" : "تفعيل حساب الأستاذ"}
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
               {mode === "login" ? "هل هذه أول مرة؟ اضغط هنا لتفعيل الحساب الرئيسي" : "لديك حساب بالفعل؟ سجل دخولك من هنا"}
             </button>
             <div className="h-px bg-slate-100 my-2"></div>
             <Link to="/" className="text-center text-sm font-bold text-primary hover:underline">العودة للموقع الرئيسي</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
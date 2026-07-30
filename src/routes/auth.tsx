import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast, Toaster } from "sonner";
import { LogIn, UserPlus, Mail, Lock, Loader2, ShieldCheck, Copy, Wand2, ShieldAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { forceSetupAdminMaster } from "@/lib/admin.functions";
import { BrandLogo } from "@/components/BrandLogo";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "دخول الأستاذ محمد نجم" }] }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("mohanegm74@gmail.com");
  const [password, setPassword] = useState("");
  const [masterKey, setMasterKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [forceMode, setForceMode] = useState(false);
  const [mode, setMode] = useState<"login" | "register">("login");

  const SUGGESTED_PASS = "Negm74!Center#Secure$2024";
  const forceSetup = useServerFn(forceSetupAdminMaster);

  // نقوم بتسجيل الخروج فقط إذا طلب المستخدم ذلك أو إذا كان هناك خطأ في الجلسة
  // أزلنا localStorage.clear() لأنه يمسح بيانات الطلاب أيضاً

  async function handleForceSetup() {
    if (!masterKey.trim()) {
      toast.error("يرجى إدخال المفتاح الرئيسي");
      return;
    }
    setLoading(true);
    const t = toast.loading("جاري إعادة ضبط صلاحيات الأستاذ...");
    try {
      await forceSetup({ data: { email, secret: masterKey.trim() } });
      toast.success("تم بنجاح! جرب الدخول الآن بكلمة المرور: " + SUGGESTED_PASS, { id: t, duration: 6000 });
      setForceMode(false);
      setMode("login");
      setPassword(SUGGESTED_PASS);
    } catch (err: any) {
      toast.error(err.message, { id: t });
    } finally {
      setLoading(false);
    }
  }

  async function handleAuth(e: React.FormEvent) {
    e.preventDefault();
    if (email.trim().toLowerCase() !== "mohanegm74@gmail.com") {
      toast.error("هذا النظام مخصص للأستاذ محمد نجم فقط");
      return;
    }

    setLoading(true);
    try {
      if (mode === "register") {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        toast.success("تم إنشاء الحساب، بانتظار تفعيل رتبة المعلم...");
        setForceMode(true); // نطلب منه فرض السيطرة لتفعيل الرتبة
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;

        // فحص الرتبة مباشرة من الجدول لضمان الدقة
        const { data: roleData } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", data.user.id)
          .maybeSingle();

        if (roleData?.role === "teacher" || roleData?.role === "admin") {
          toast.success("مرحباً بك يا أستاذ محمد");
          navigate({ to: "/dashboard" });
        } else {
          // إذا نجح الباسورد ولكن الرتبة مفقودة
          setForceMode(true);
          await supabase.auth.signOut();
          throw new Error("تم تسجيل الدخول ولكن حسابك يفتقد لصلاحية الأستاذ. استخدم زر 'فرض السيطرة' بالأسفل.");
        }
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }

  const copyPass = () => {
    navigator.clipboard.writeText(SUGGESTED_PASS);
    setPassword(SUGGESTED_PASS);
    toast.success("تم وضع كلمة المرور المقترحة");
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
          
          {forceMode ? (
            <div className="mt-4 space-y-4 animate-in zoom-in-95">
              <div className="p-4 bg-destructive/10 rounded-2xl border border-destructive/20 text-center">
                <ShieldAlert className="mx-auto h-8 w-8 text-destructive mb-2" />
                <h2 className="text-sm font-black text-destructive">تفعيل رتبة الأستاذ (إجباري)</h2>
                <p className="text-[11px] text-slate-600 mt-1">أدخل المفتاح الرئيسي لربط حسابك برتبة "معلم" فوراً.</p>
              </div>
              <div className="space-y-2">
                <input 
                  type="password" 
                  value={masterKey}
                  onChange={e => setMasterKey(e.target.value)}
                  placeholder="أدخل المفتاح الرئيسي (N@031274)"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-center text-sm font-black outline-none focus:ring-2 focus:ring-primary/20"
                />
                <button 
                  onClick={handleForceSetup}
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-destructive py-3.5 text-sm font-black text-white shadow-lg hover:opacity-90"
                >
                  {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Wand2 className="h-5 w-5" />}
                  تفعيل رتبة الأستاذ وإعادة الضبط
                </button>
                <button onClick={() => setForceMode(false)} className="w-full text-xs font-bold text-slate-400">إلغاء والعودة</button>
              </div>
            </div>
          ) : (
            <>
              <p className="mt-1 text-center text-sm text-muted-foreground mb-8">
                {mode === "login" ? "سجل دخولك بصلاحيات الإدارة" : "إنشاء حساب المسئول الرئيسي"}
              </p>

              <form onSubmit={handleAuth} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 flex items-center gap-1.5 ms-1">
                    <Mail className="h-3.5 w-3.5" /> البريد الإلكتروني الرسمي
                  </label>
                  <input type="email" readOnly value={email} className="w-full rounded-xl border border-slate-200 bg-slate-100 px-4 py-3 text-slate-500 font-bold" />
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
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:ring-2 focus:ring-primary/20 font-mono" 
                  />
                </div>

                <button type="submit" disabled={loading} className="w-full rounded-xl bg-primary py-3.5 font-black text-primary-foreground shadow-lg shadow-primary/20">
                  <span className="flex items-center justify-center gap-2">
                    {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : (mode === "login" ? "دخول النظام" : "تفعيل الحساب")}
                  </span>
                </button>
              </form>
              
              <div className="mt-6 flex flex-col gap-3">
                 <button onClick={() => setForceMode(true)} className="text-xs font-bold text-destructive hover:underline text-center">
                   مشكلة في الدخول؟ استخدم "فرض السيطرة"
                 </button>
                 <div className="h-px bg-slate-100 my-2"></div>
                 <Link to="/" className="text-center text-sm font-bold text-primary hover:underline">العودة للموقع الرئيسي</Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
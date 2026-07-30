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

  useEffect(() => {
    supabase.auth.signOut();
    localStorage.clear();
  }, []);

  async function handleForceSetup() {
    if (!masterKey.trim()) {
      toast.error("يرجى إدخال المفتاح الرئيسي للتنظيف");
      return;
    }
    setLoading(true);
    const t = toast.loading("جاري تنظيف النظام وفرض سيطرتك...");
    try {
      await forceSetup({ data: { email, secret: masterKey.trim() } });
      toast.success("تم بنجاح! يمكنك الآن تسجيل الدخول مباشرة.", { id: t });
      setForceMode(false);
      setMode("login");
    } catch (err: any) {
      toast.error(err.message, { id: t });
    } finally {
      setLoading(false);
    }
  }

  async function handleAuth(e: React.FormEvent) {
    e.preventDefault();
    if (email.trim().toLowerCase() !== "mohanegm74@gmail.com") {
      toast.error("عذراً، هذا النظام مخصص للأستاذ محمد نجم فقط");
      return;
    }

    setLoading(true);
    try {
      if (mode === "register") {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        
        const { data: claimed } = await supabase.rpc("claim_teacher_role");
        if (claimed) {
          toast.success("تم إنشاء حسابك كمسئول وحيد");
          navigate({ to: "/dashboard" });
        } else {
          setForceMode(true);
          throw new Error("النظام محجوز. يرجى استخدام زر 'فرض السيطرة' بالأسفل.");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;

        const { data: isTeacher } = await supabase.rpc("is_teacher");
        if (isTeacher) {
          toast.success("مرحباً بك يا أستاذ محمد");
          navigate({ to: "/dashboard" });
        } else {
          setForceMode(true);
          await supabase.auth.signOut();
          throw new Error("حسابك لا يملك صلاحية. استخدم زر 'فرض السيطرة' بالأسفل.");
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
    toast.success("تم نسخ ووضع كلمة المرور");
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
                <h2 className="text-sm font-black text-destructive">تنبيه: فرض السيطرة على النظام</h2>
                <p className="text-[11px] text-slate-600 mt-1">سيتم مسح أي رتب قديمة ومنحك الصلاحية فوراً.</p>
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
                  تنظيف النظام وفرض سيطرتي
                </button>
                <button onClick={() => setForceMode(false)} className="w-full text-xs font-bold text-slate-400">إلغاء والعودة</button>
              </div>
            </div>
          ) : (
            <>
              <p className="mt-1 text-center text-sm text-muted-foreground mb-8">
                {mode === "login" ? "سجل دخولك بحسابك الرسمي" : "إنشاء حساب المسئول الرئيسي"}
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

                {mode === "register" && (
                  <div className="p-3 bg-amber-50 rounded-xl border border-amber-100">
                    <p className="text-[10px] font-black text-amber-800 mb-2 flex items-center gap-1"><ShieldCheck className="h-3 w-3" /> كلمة مرور مقترحة:</p>
                    <div className="flex items-center justify-between gap-2 bg-white p-2 rounded-lg border border-amber-200">
                      <code className="text-xs font-bold text-primary">{SUGGESTED_PASS}</code>
                      <button type="button" onClick={copyPass} className="p-1.5 hover:bg-slate-100 rounded text-primary"><Copy className="h-3.5 w-3.5" /></button>
                    </div>
                  </div>
                )}

                <button type="submit" disabled={loading} className="w-full rounded-xl bg-primary py-3.5 font-black text-primary-foreground shadow-lg shadow-primary/20">
                  <span className="flex items-center justify-center gap-2">
                    {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : (mode === "login" ? "دخول النظام" : "تفعيل حساب الأستاذ")}
                  </span>
                </button>
              </form>
              
              <div className="mt-6 flex flex-col gap-3">
                 <button onClick={() => setMode(mode === "login" ? "register" : "login")} className="text-xs font-bold text-slate-500 hover:text-primary transition-colors text-center">
                   {mode === "login" ? "تفعيل حساب المسئول لأول مرة" : "العودة لصفحة الدخول"}
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
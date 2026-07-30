import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast, Toaster } from "sonner";
import { LogIn, ShieldCheck, Lock, Loader2, Sparkles, Wand2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { getAdminMagicLink } from "@/lib/admin.functions";
import { BrandLogo } from "@/components/BrandLogo";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "دخول الإدارة — سنتر الأستاذ محمد نجم" }] }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [masterKey, setMasterKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [magicLoading, setMagicLoading] = useState(false);

  const getMagicFn = useServerFn(getAdminMagicLink);
  const ADMIN_EMAIL = "admin@negm-center.local";

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { 
      if (data.session && data.session.user.email === ADMIN_EMAIL) {
        navigate({ to: "/dashboard" }); 
      }
    });
  }, [navigate]);

  async function handleMagicLogin() {
    if (!masterKey.trim()) {
      toast.error("يرجى إدخال المفتاح الرئيسي");
      return;
    }
    setMagicLoading(true);
    const t = toast.loading("جاري توليد رابط الدخول الآمن...");
    try {
      const res = await getMagicFn({ data: { secret: masterKey.trim() } });
      toast.success("تم التحقق بنجاح. جاري توجيهك...", { id: t });
      // التوجيه إلى الرابط السحري الذي يسجل الدخول تلقائياً
      window.location.href = res.loginUrl;
    } catch (err: any) {
      toast.error("خطأ: " + err.message, { id: t });
    } finally {
      setMagicLoading(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (username.toLowerCase() !== "admin") {
      toast.error("اسم المستخدم غير صحيح");
      return;
    }

    setLoading(true);
    try {
      await supabase.auth.signOut();
      const { error } = await supabase.auth.signInWithPassword({ 
        email: ADMIN_EMAIL, 
        password 
      });
      
      if (!error) {
        toast.success("مرحباً بك يا أستاذ محمد");
        navigate({ to: "/dashboard" });
      } else {
        toast.error("كلمة المرور غير صحيحة. استخدم 'الدخول السحري' بالأسفل لتخطي القيود.");
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
          
          <h1 className="text-center text-2xl font-black text-primary">دخول الأستاذ</h1>
          <p className="mt-1 text-center text-sm text-muted-foreground mb-8">اختر طريقة الدخول المناسبة لك</p>

          <div className="space-y-6">
            {/* خيار الدخول السحري - الحل النهائي */}
            <div className="rounded-2xl border-2 border-dashed border-gold/40 bg-gold/5 p-5">
              <h2 className="mb-3 text-center text-sm font-black text-gold-foreground flex items-center justify-center gap-2">
                <Sparkles className="h-4 w-4" /> الدخول السحري (بدون كلمة مرور)
              </h2>
              <div className="space-y-3">
                <input 
                  type="password" 
                  value={masterKey}
                  onChange={(e) => setMasterKey(e.target.value)}
                  placeholder="أدخل المفتاح الرئيسي (N@031274)"
                  className="w-full rounded-xl border border-gold/20 bg-white px-4 py-2.5 text-center text-sm font-black outline-none focus:ring-2 focus:ring-gold/30"
                />
                <button 
                  onClick={handleMagicLogin}
                  disabled={magicLoading || loading}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-gold py-3 text-sm font-black text-gold-foreground shadow-lg shadow-gold/20 hover:opacity-90 disabled:opacity-50"
                >
                  {magicLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                  توليد رابط الدخول والدخول فوراً
                </button>
              </div>
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-slate-200"></span></div>
              <div className="relative flex justify-center text-xs uppercase"><span className="bg-white px-2 text-muted-foreground font-bold">أو الدخول التقليدي</span></div>
            </div>

            <form onSubmit={submit} className="space-y-4 opacity-60 hover:opacity-100 transition-opacity">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 flex items-center gap-1.5 ms-1">
                  <ShieldCheck className="h-3.5 w-3.5" /> اسم المستخدم
                </label>
                <input 
                  type="text" 
                  value={username} 
                  onChange={(e) => setUsername(e.target.value)} 
                  placeholder="admin"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-bold outline-none" 
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 flex items-center gap-1.5 ms-1">
                  <Lock className="h-3.5 w-3.5" /> كلمة المرور
                </label>
                <input 
                  type="password" 
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)} 
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-mono outline-none" 
                />
              </div>
              <button 
                type="submit" 
                disabled={loading || magicLoading} 
                className="w-full rounded-xl bg-slate-800 py-2.5 text-sm font-bold text-white transition-all hover:bg-slate-900 disabled:opacity-50"
              >
                {loading ? "جاري التحقق..." : "دخول بالكلمة"}
              </button>
            </form>
          </div>
          
          <div className="mt-6 text-center">
            <Link to="/" className="text-xs font-bold text-primary hover:underline">العودة للموقع الرئيسي</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
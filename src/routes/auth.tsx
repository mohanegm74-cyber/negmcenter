import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast, Toaster } from "sonner";
import { LogIn, UserPlus, Mail, Lock, Loader2, ShieldCheck, Eye, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { checkAdminSetup, setupFirstAdmin } from "@/lib/admin.functions";
import { BrandLogo } from "@/components/BrandLogo";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "دخول الأستاذ محمد نجم" }] }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<"loading" | "first-time" | "login">("loading");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  const checkSetup = useServerFn(checkAdminSetup);
  const firstAdmin = useServerFn(setupFirstAdmin);

  useEffect(() => {
    checkSetup({})
      .then(({ hasAdmin }) => setStatus(hasAdmin ? "login" : "first-time"))
      .catch(() => setStatus("login")); // في حالة الخطأ نعرض Login كافتراضي
  }, []);

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password) return;
    if (password !== confirmPassword) {
      toast.error("كلمة المرور وتأكيدها غير متطابقتين");
      return;
    }
    if (password.length < 6) {
      toast.error("كلمة المرور يجب أن تكون 6 أحرف على الأقل");
      return;
    }
    setLoading(true);
    try {
      await firstAdmin({ data: { email: email.trim(), password } });
      toast.success("تم إنشاء الحساب بنجاح! سجّل دخولك الآن.");
      setStatus("login");
      setPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) throw error;

      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", data.user.id)
        .maybeSingle();

      if (roleData?.role === "teacher" || roleData?.role === "admin") {
        toast.success("مرحباً بك يا أستاذ 👋");
        navigate({ to: "/dashboard" });
      } else {
        await supabase.auth.signOut();
        throw new Error("هذا الحساب لا يملك صلاحية الدخول.");
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--gradient-hero)" }}>
      <Toaster position="top-center" richColors />
      <div className="w-full max-w-md px-6">
        <div className="rounded-3xl bg-white p-8 shadow-2xl border border-white/20">
          {/* شعار */}
          <div className="flex justify-center mb-6">
            <BrandLogo size={80} className="!bg-transparent" />
          </div>

          {status === "loading" && (
            <div className="flex flex-col items-center gap-3 py-8 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="text-sm">جاري التحقق...</span>
            </div>
          )}

          {status === "first-time" && (
            <>
              <div className="text-center mb-6">
                <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-sm font-bold text-primary mb-2">
                  <ShieldCheck className="h-4 w-4" />
                  إعداد النظام — أول مرة
                </div>
                <h2 className="text-xl font-black text-slate-800">تسجيل المسئول الرئيسي</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  سيكون هذا الحساب هو المسئول الوحيد عن النظام.
                  <br />
                  <span className="text-destructive font-bold">لن يُسمح بإنشاء حسابات أخرى بعد ذلك.</span>
                </p>
              </div>

              <form onSubmit={handleRegister} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 flex items-center gap-1.5 ms-1">
                    <Mail className="h-3.5 w-3.5" /> البريد الإلكتروني
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="example@gmail.com"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:ring-2 focus:ring-primary/20 text-left"
                    dir="ltr"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 flex items-center gap-1.5 ms-1">
                    <Lock className="h-3.5 w-3.5" /> كلمة المرور
                  </label>
                  <div className="relative">
                    <input
                      type={showPass ? "text" : "password"}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="6 أحرف على الأقل"
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 pe-11 outline-none focus:ring-2 focus:ring-primary/20 font-mono"
                    />
                    <button type="button" onClick={() => setShowPass(v => !v)}
                      className="absolute inset-y-0 end-3 flex items-center text-slate-400 hover:text-slate-600">
                      {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 flex items-center gap-1.5 ms-1">
                    <Lock className="h-3.5 w-3.5" /> تأكيد كلمة المرور
                  </label>
                  <input
                    type={showPass ? "text" : "password"}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="أعد إدخال كلمة المرور"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:ring-2 focus:ring-primary/20 font-mono"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-xl bg-primary py-3.5 font-black text-primary-foreground shadow-lg shadow-primary/20 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <><UserPlus className="h-5 w-5" /> تفعيل الحساب</>
                  )}
                </button>
              </form>
            </>
          )}

          {status === "login" && (
            <>
              <div className="text-center mb-6">
                <h2 className="text-xl font-black text-slate-800">دخول المسئول</h2>
                <p className="mt-1 text-sm text-muted-foreground">سجّل دخولك بصلاحيات الإدارة</p>
              </div>

              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 flex items-center gap-1.5 ms-1">
                    <Mail className="h-3.5 w-3.5" /> البريد الإلكتروني
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="example@gmail.com"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:ring-2 focus:ring-primary/20 text-left"
                    dir="ltr"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 flex items-center gap-1.5 ms-1">
                    <Lock className="h-3.5 w-3.5" /> كلمة المرور
                  </label>
                  <div className="relative">
                    <input
                      type={showPass ? "text" : "password"}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 pe-11 outline-none focus:ring-2 focus:ring-primary/20 font-mono"
                    />
                    <button type="button" onClick={() => setShowPass(v => !v)}
                      className="absolute inset-y-0 end-3 flex items-center text-slate-400 hover:text-slate-600">
                      {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-xl bg-primary py-3.5 font-black text-primary-foreground shadow-lg shadow-primary/20 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <><LogIn className="h-5 w-5" /> دخول النظام</>
                  )}
                </button>
              </form>
            </>
          )}

          {status !== "loading" && (
            <div className="mt-6 text-center">
              <Link to="/" className="text-sm font-bold text-primary hover:underline">
                ← العودة للموقع الرئيسي
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

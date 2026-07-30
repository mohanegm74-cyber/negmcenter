import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast, Toaster } from "sonner";
import {
  LogIn, UserPlus, Mail, Lock, Loader2,
  ShieldCheck, Eye, EyeOff, KeyRound, CheckCircle2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { checkAdminSetup, assignFirstAdminRole } from "@/lib/admin.functions";
import { BrandLogo } from "@/components/BrandLogo";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "دخول الأستاذ محمد نجم" }] }),
  component: AuthPage,
});

// ترجمة رسائل خطأ Supabase إلى العربية
function translateError(msg: string): string {
  if (!msg) return "حدث خطأ غير متوقع";
  const m = msg.toLowerCase();
  if (m.includes("invalid login credentials"))   return "البريد الإلكتروني أو كلمة المرور غير صحيحة";
  if (m.includes("email not confirmed"))          return "لم يتم تأكيد البريد الإلكتروني بعد. تحقق من صندوق الوارد.";
  if (m.includes("user already registered"))      return "هذا البريد الإلكتروني مسجّل بالفعل";
  if (m.includes("password should be at least"))  return "كلمة المرور يجب أن تكون 6 أحرف على الأقل";
  if (m.includes("unable to validate"))           return "تعذّر التحقق من المستخدم";
  if (m.includes("email rate limit"))             return "تم الوصول للحد الأقصى من المحاولات، انتظر قليلاً";
  if (m.includes("network"))                      return "تعذّر الاتصال بالخادم، تحقق من الإنترنت";
  return msg;
}

type Mode = "loading" | "first-time" | "email-sent" | "login" | "forgot" | "reset-password";

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("loading");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  const checkSetup = useServerFn(checkAdminSetup);
  const assignRole = useServerFn(assignFirstAdminRole);

  // كشف حالة إعادة تعيين كلمة المرور من رابط الإيميل
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setMode("reset-password");
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  // تحديد الوضع الأولي
  useEffect(() => {
    // لا نغير الوضع إذا كنا بالفعل في reset-password
    if (mode === "reset-password") return;
    checkSetup({})
      .then(({ hasAdmin }) => setMode(hasAdmin ? "login" : "first-time"))
      .catch(() => setMode("login"));
  }, []);

  // ── تسجيل أول مسئول ──────────────────────────────────────────────
  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirmPassword) { toast.error("كلمة المرور وتأكيدها غير متطابقتين"); return; }
    if (password.length < 6) { toast.error("كلمة المرور يجب أن تكون 6 أحرف على الأقل"); return; }
    setLoading(true);
    try {
      // signUp من الـ client يُرسل إيميل تأكيد لـ Gmail تلقائياً
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
      });
      if (error) throw error;
      if (!data.user) throw new Error("فشل إنشاء الحساب، حاول مجدداً.");

      // تعيين صلاحية المسئول من الـ server (مع فحص مزدوج)
      await assignRole({ data: { userId: data.user.id } });
      setMode("email-sent");
    } catch (err: any) {
      toast.error(translateError(err.message));
    } finally {
      setLoading(false);
    }
  }

  // ── تسجيل الدخول ─────────────────────────────────────────────────
  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
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
      toast.error(translateError(err.message));
    } finally {
      setLoading(false);
    }
  }

  // ── إرسال رابط استعادة كلمة المرور ──────────────────────────────
  async function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) { toast.error("يرجى إدخال البريد الإلكتروني"); return; }
    setLoading(true);
    try {
      const redirectTo = `${window.location.origin}/auth`;
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo });
      if (error) throw error;
      toast.success("تم إرسال رابط الاسترداد على بريدك الإلكتروني");
      setMode("email-sent");
    } catch (err: any) {
      toast.error(translateError(err.message));
    } finally {
      setLoading(false);
    }
  }

  // ── تعيين كلمة مرور جديدة ────────────────────────────────────────
  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== newPasswordConfirm) { toast.error("كلمتا المرور غير متطابقتين"); return; }
    if (newPassword.length < 6) { toast.error("كلمة المرور يجب أن تكون 6 أحرف على الأقل"); return; }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast.success("تم تغيير كلمة المرور بنجاح، جارٍ الدخول...");
      await supabase.auth.signOut();
      setMode("login");
      setNewPassword("");
      setNewPasswordConfirm("");
    } catch (err: any) {
      toast.error(translateError(err.message));
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

          {/* ── تحميل ── */}
          {mode === "loading" && (
            <div className="flex flex-col items-center gap-3 py-8 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="text-sm">جاري التحقق...</span>
            </div>
          )}

          {/* ── أول مرة: تسجيل المسئول ── */}
          {mode === "first-time" && (
            <>
              <div className="text-center mb-6">
                <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-sm font-bold text-primary mb-2">
                  <ShieldCheck className="h-4 w-4" />
                  إعداد النظام — أول مرة
                </div>
                <h2 className="text-xl font-black text-slate-800">تسجيل المسئول الرئيسي</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  سيصلك بريد تأكيد على إيميلك.{" "}
                  <span className="text-destructive font-bold">لن يُسمح بإنشاء حسابات أخرى بعد ذلك.</span>
                </p>
              </div>

              <form onSubmit={handleRegister} className="space-y-4">
                <Field label="البريد الإلكتروني" icon={<Mail className="h-3.5 w-3.5" />}>
                  <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
                    placeholder="example@gmail.com" dir="ltr"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:ring-2 focus:ring-primary/20 text-left" />
                </Field>

                <Field label="كلمة المرور" icon={<Lock className="h-3.5 w-3.5" />}>
                  <PasswordInput value={password} onChange={setPassword} show={showPass} onToggle={() => setShowPass(v => !v)} placeholder="6 أحرف على الأقل" />
                </Field>

                <Field label="تأكيد كلمة المرور" icon={<Lock className="h-3.5 w-3.5" />}>
                  <input type={showPass ? "text" : "password"} required value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)} placeholder="أعد إدخال كلمة المرور"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:ring-2 focus:ring-primary/20 font-mono" />
                </Field>

                <SubmitButton loading={loading} icon={<UserPlus className="h-5 w-5" />} label="تفعيل الحساب وإرسال التأكيد" />
              </form>
            </>
          )}

          {/* ── تم إرسال الإيميل ── */}
          {mode === "email-sent" && (
            <div className="text-center py-4 space-y-4">
              <CheckCircle2 className="h-16 w-16 text-emerald-500 mx-auto" />
              <h2 className="text-xl font-black text-slate-800">تحقق من بريدك الإلكتروني</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                تم إرسال رسالة على <span className="font-bold text-slate-700">{email || "بريدك الإلكتروني"}</span>.
                <br />افتح الرسالة واضغط على الرابط لتأكيد حسابك.
              </p>
              <button onClick={() => setMode("login")}
                className="text-sm font-bold text-primary hover:underline">
                انتهيت من التأكيد؟ سجّل دخولك
              </button>
            </div>
          )}

          {/* ── تسجيل الدخول ── */}
          {mode === "login" && (
            <>
              <div className="text-center mb-6">
                <h2 className="text-xl font-black text-slate-800">دخول المسئول</h2>
                <p className="mt-1 text-sm text-muted-foreground">سجّل دخولك بصلاحيات الإدارة</p>
              </div>

              <form onSubmit={handleLogin} className="space-y-4">
                <Field label="البريد الإلكتروني" icon={<Mail className="h-3.5 w-3.5" />}>
                  <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
                    placeholder="example@gmail.com" dir="ltr"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:ring-2 focus:ring-primary/20 text-left" />
                </Field>

                <Field label="كلمة المرور" icon={<Lock className="h-3.5 w-3.5" />}>
                  <PasswordInput value={password} onChange={setPassword} show={showPass} onToggle={() => setShowPass(v => !v)} placeholder="••••••••" />
                </Field>

                <SubmitButton loading={loading} icon={<LogIn className="h-5 w-5" />} label="دخول النظام" />
              </form>

              <button onClick={() => { setMode("forgot"); setPassword(""); }}
                className="mt-4 w-full text-sm font-bold text-slate-400 hover:text-primary transition-colors text-center">
                نسيت كلمة المرور؟
              </button>
            </>
          )}

          {/* ── نسيت كلمة المرور ── */}
          {mode === "forgot" && (
            <>
              <div className="text-center mb-6">
                <div className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-4 py-1.5 text-sm font-bold text-amber-700 mb-2">
                  <KeyRound className="h-4 w-4" />
                  استعادة كلمة المرور
                </div>
                <h2 className="text-xl font-black text-slate-800">إعادة تعيين كلمة المرور</h2>
                <p className="mt-1 text-sm text-muted-foreground">أدخل بريدك وسنرسل لك رابط الاسترداد.</p>
              </div>

              <form onSubmit={handleForgotPassword} className="space-y-4">
                <Field label="البريد الإلكتروني" icon={<Mail className="h-3.5 w-3.5" />}>
                  <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
                    placeholder="example@gmail.com" dir="ltr"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:ring-2 focus:ring-primary/20 text-left" />
                </Field>

                <SubmitButton loading={loading} icon={<Mail className="h-5 w-5" />} label="إرسال رابط الاسترداد" />
              </form>

              <button onClick={() => setMode("login")}
                className="mt-4 w-full text-sm font-bold text-slate-400 hover:text-primary transition-colors text-center">
                ← رجوع لتسجيل الدخول
              </button>
            </>
          )}

          {/* ── تعيين كلمة مرور جديدة (من رابط الإيميل) ── */}
          {mode === "reset-password" && (
            <>
              <div className="text-center mb-6">
                <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-sm font-bold text-primary mb-2">
                  <KeyRound className="h-4 w-4" />
                  تعيين كلمة مرور جديدة
                </div>
                <h2 className="text-xl font-black text-slate-800">كلمة مرور جديدة</h2>
                <p className="mt-1 text-sm text-muted-foreground">اختر كلمة مرور قوية لحماية حسابك.</p>
              </div>

              <form onSubmit={handleResetPassword} className="space-y-4">
                <Field label="كلمة المرور الجديدة" icon={<Lock className="h-3.5 w-3.5" />}>
                  <PasswordInput value={newPassword} onChange={setNewPassword} show={showPass} onToggle={() => setShowPass(v => !v)} placeholder="6 أحرف على الأقل" />
                </Field>

                <Field label="تأكيد كلمة المرور" icon={<Lock className="h-3.5 w-3.5" />}>
                  <input type={showPass ? "text" : "password"} required value={newPasswordConfirm}
                    onChange={e => setNewPasswordConfirm(e.target.value)} placeholder="أعد إدخال كلمة المرور الجديدة"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:ring-2 focus:ring-primary/20 font-mono" />
                </Field>

                <SubmitButton loading={loading} icon={<ShieldCheck className="h-5 w-5" />} label="حفظ كلمة المرور الجديدة" />
              </form>
            </>
          )}

          {/* رابط الرجوع للرئيسية */}
          {(mode === "login" || mode === "first-time") && (
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

// ── مكوّنات مساعدة صغيرة ──────────────────────────────────────────

function Field({ label, icon, children }: { label: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-bold text-slate-500 flex items-center gap-1.5 ms-1">
        {icon} {label}
      </label>
      {children}
    </div>
  );
}

function PasswordInput({ value, onChange, show, onToggle, placeholder }: {
  value: string; onChange: (v: string) => void; show: boolean; onToggle: () => void; placeholder?: string;
}) {
  return (
    <div className="relative">
      <input type={show ? "text" : "password"} required value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder ?? "••••••••"}
        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 pe-11 outline-none focus:ring-2 focus:ring-primary/20 font-mono" />
      <button type="button" onClick={onToggle}
        className="absolute inset-y-0 end-3 flex items-center text-slate-400 hover:text-slate-600">
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

function SubmitButton({ loading, icon, label }: { loading: boolean; icon: React.ReactNode; label: string }) {
  return (
    <button type="submit" disabled={loading}
      className="w-full rounded-xl bg-primary py-3.5 font-black text-primary-foreground shadow-lg shadow-primary/20 flex items-center justify-center gap-2 disabled:opacity-60 transition-opacity">
      {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <>{icon} {label}</>}
    </button>
  );
}

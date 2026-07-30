import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Lock, Save, ShieldAlert, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "إعدادات الأمان — الأستاذ محمد نجم" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleUpdatePassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword.length < 6) {
      toast.error("كلمة المرور يجب أن لا تقل عن 6 رموز");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("كلمات المرور غير متطابقة");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast.success("تم تغيير كلمة المرور بنجاح");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      toast.error(err.message || "فشل تحديث كلمة المرور");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-2 mb-2">
        <Settings className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-black">إعدادات النظام</h1>
      </div>

      <div className="rounded-3xl bg-white p-8 shadow-sm border border-slate-100">
        <div className="flex items-center gap-3 mb-6">
          <div className="bg-primary/10 p-3 rounded-2xl text-primary">
            <Lock className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-lg font-black">تغيير كلمة مرور الإدارة</h2>
            <p className="text-sm text-muted-foreground font-medium">اسم المستخدم الحالي هو دائماً admin</p>
          </div>
        </div>

        <form onSubmit={handleUpdatePassword} className="space-y-5">
          <div className="space-y-2">
            <label className="text-sm font-black text-slate-700">كلمة المرور الجديدة</label>
            <input 
              type="password" 
              required 
              value={newPassword} 
              onChange={e => setNewPassword(e.target.value)}
              placeholder="أدخل كلمة المرور الجديدة..."
              className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary transition-all font-mono"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-black text-slate-700">تأكيد كلمة المرور</label>
            <input 
              type="password" 
              required 
              value={confirmPassword} 
              onChange={e => setConfirmPassword(e.target.value)}
              placeholder="أعد كتابة كلمة المرور..."
              className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary transition-all font-mono"
            />
          </div>

          <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 flex gap-3 items-start">
            <ShieldAlert className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800 font-bold leading-relaxed">
              تنبيه: بعد تغيير كلمة المرور، ستحتاج لاستخدام الكلمة الجديدة في المرة القادمة التي تقوم فيها بتسجيل الدخول. يرجى حفظها في مكان آمن.
            </p>
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="flex items-center justify-center gap-2 w-full sm:w-auto rounded-xl bg-primary px-8 py-3 text-sm font-black text-primary-foreground shadow-lg shadow-primary/20 hover:opacity-90 disabled:opacity-50 transition-all"
          >
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
            حفظ كلمة المرور الجديدة
          </button>
        </form>
      </div>

      <div className="rounded-3xl bg-slate-900 p-8 text-white shadow-xl">
        <h3 className="font-black text-lg mb-2">معلومات تقنية</h3>
        <p className="text-slate-400 text-sm leading-relaxed mb-4">
          تم إلغاء كافة طرق الدخول السابقة عبر البريد الإلكتروني الشخصي. النظام الآن يعمل ببريد إداري مشفر وموحد لضمان أعلى درجات الخصوصية.
        </p>
        <div className="flex items-center gap-2 text-xs font-bold bg-white/5 border border-white/10 rounded-lg p-3 w-fit">
          <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></div>
          حالة النظام: مؤمن بالكامل
        </div>
      </div>
    </div>
  );
}
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast, Toaster } from "sonner";
import { ArrowRight, Save, Loader2, Info, CheckCircle2 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { registerStudent, getAvailableGroups } from "@/lib/student.functions";

export const Route = createFileRoute("/student/register")({
  head: () => ({ meta: [{ title: "تسجيل طالب جديد — سنتر الأستاذ محمد نجم" }, { name: "description", content: "استمارة تسجيل طالب جديد في السنتر." }] }),
  component: RegisterStudent,
});

const GOVERNORATES = ["القاهرة","الجيزة","الإسكندرية","القليوبية","الشرقية","الدقهلية","المنوفية","الغربية","كفر الشيخ","دمياط","بورسعيد","الإسماعيلية","السويس","بني سويف","الفيوم","المنيا","أسيوط","سوهاج","قنا","الأقصر","أسوان","البحر الأحمر","الوادي الجديد","مطروح","شمال سيناء","جنوب سيناء","البحيرة"];
const GRADES = ["الصف الأول الابتدائي","الثاني الابتدائي","الثالث الابتدائي","الرابع الابتدائي","الخامس الابتدائي","السادس الابتدائي","الأول الإعدادي","الثاني الإعدادي","الثالث الإعدادي","الأول الثانوي","الثاني الثانوي","الثالث الثانوي"];
const SECTIONS = ["عام", "خاص فردي", "خاص بالاشتراك"];

function RegisterStudent() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [groups, setGroups] = useState<any[]>([]);
  const [registeredCode, setRegisteredCode] = useState<string | null>(null);
  
  const registerFn = useServerFn(registerStudent);
  const loadGroupsFn = useServerFn(getAvailableGroups);

  useEffect(() => {
    loadGroupsFn({}).then(res => setGroups(res.groups)).catch(() => toast.error("تعذر تحميل المجموعات"));
  }, []);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const payload: Record<string, string> = {};
    fd.forEach((v, k) => { const s = String(v).trim(); if (s) payload[k] = s; });
    
    try {
      // تصحيح: تمرير البيانات داخل كائن يحتوي على مفتاح data
      const res = await registerFn({ data: payload });
      setRegisteredCode(res.code);
      localStorage.setItem("najm_student_code", res.code);
      toast.success("تم إرسال طلب التسجيل بنجاح");
    } catch (err: any) {
      toast.error(err?.message || "تعذر الحفظ");
    } finally {
      setLoading(false);
    }
  }

  if (registeredCode) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-[2.5rem] shadow-2xl p-10 text-center border-t-8 border-primary">
          <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="h-10 w-10" />
          </div>
          <h2 className="text-2xl font-black text-slate-800 mb-2">تم التسجيل بنجاح!</h2>
          <p className="text-slate-500 font-bold mb-6">يرجى قراءة التعليمات التالية بعناية:</p>
          
          <div className="bg-primary/5 border border-primary/10 rounded-2xl p-6 mb-8">
            <div className="text-xs font-black text-primary uppercase mb-2">كود الدخول الخاص بك (هام جداً):</div>
            <div className="text-3xl font-mono font-black text-primary tracking-widest bg-white py-3 rounded-xl border-2 border-primary/20 shadow-inner">
              {registeredCode}
            </div>
            <p className="text-[10px] font-bold text-rose-500 mt-4 leading-relaxed flex items-center justify-center gap-1">
              <Info className="h-3 w-3 shrink-0" />
              قم بتصوير الشاشة أو الاحتفاظ بالكود، لن تستطيع الدخول بدونه.
            </p>
          </div>

          <div className="bg-amber-50 border border-amber-100 rounded-2xl p-5 mb-8">
            <p className="text-sm font-black text-amber-800 leading-relaxed">
              ⚠️ انتظر لحين اعتماد الأستاذ لبياناتك. 
              سيتم تفعيل حسابك قريباً لتتمكن من دخول البوابة.
            </p>
          </div>

          <button 
            onClick={() => navigate({ to: "/student/portal" })}
            className="w-full rounded-2xl bg-primary py-4 font-black text-white shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 transition-all"
          >
            الذهاب لصفحة الدخول
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <Toaster position="top-center" richColors />
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <Link to="/" className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline">
            <ArrowRight className="h-4 w-4" /> الرئيسية
          </Link>
          <div className="text-left">
            <h1 className="text-lg font-bold">تسجيل طالب جديد</h1>
            <p className="text-xs text-muted-foreground">سنتر الأستاذ محمد نجم</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-8">
        <form onSubmit={onSubmit} className="rounded-2xl bg-white p-6 shadow-sm sm:p-8">
          <div className="mb-6 p-4 bg-primary/5 rounded-xl border border-primary/10 flex gap-3 items-start">
            <Info className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <p className="text-xs font-bold text-primary leading-relaxed">
              تنبيه: بعد ملء هذه الاستمارة، سيظهر لك "كود الطالب". يرجى الاحتفاظ به للدخول للبوابة لاحقاً. لن يتم تفعيل حسابك إلا بعد اعتماد الأستاذ لطلبك.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field name="full_name" label="الاسم رباعي *" required />
            <Field name="phone" label="رقم الهاتف" type="tel" />
            <Field name="parent_phone" label="رقم ولي الأمر" type="tel" />
            
            <div>
              <label className="mb-1.5 block text-sm font-semibold">المجموعة (الربط التلقائي) *</label>
              <select name="group_id" required className="w-full rounded-lg border border-input bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring">
                <option value="">— اختر المجموعة —</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>{g.name} ({g.grade || 'بدون صف'})</option>
                ))}
              </select>
            </div>

            <Select name="gender" label="الجنس" options={["ذكر","أنثى"]} />
            <Field name="birth_date" label="تاريخ الميلاد" type="date" />
            <Field name="national_id" label="الرقم القومي" />
            <Field name="address" label="العنوان" />
            <Select name="governorate" label="المحافظة" options={GOVERNORATES} />
            <Field name="education_dept" label="الإدارة التعليمية" />
            <Field name="school" label="المدرسة" />
            <Select name="grade" label="الصف الدراسي" options={GRADES} />
            <Select name="section" label="الشعبة" options={SECTIONS} />
            <Field name="subject" label="المادة" />
            <Field name="teacher_name" label="اسم المعلم" />
            
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-sm font-semibold">ملاحظات</label>
              <textarea name="notes" rows={3} className="w-full rounded-lg border border-input bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" />
            </div>
          </div>

          <button type="submit" disabled={loading} className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-6 py-3 text-base font-bold text-primary-foreground shadow-lg transition hover:opacity-90 disabled:opacity-60 sm:w-auto">
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
            {loading ? "جارٍ الحفظ..." : "إرسال طلب التسجيل"}
          </button>
        </form>
      </main>
    </div>
  );
}

function Field({ name, label, type = "text", required = false }: { name: string; label: string; type?: string; required?: boolean }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-semibold">{label}</label>
      <input name={name} type={type} required={required} className="w-full rounded-lg border border-input bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" />
    </div>
  );
}

function Select({ name, label, options }: { name: string; label: string; options: string[] }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-semibold">{label}</label>
      <select name={name} defaultValue="" className="w-full rounded-lg border border-input bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring">
        <option value="">—</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}
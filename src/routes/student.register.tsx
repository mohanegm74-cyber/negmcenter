import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast, Toaster } from "sonner";
import { ArrowRight, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/student/register")({
  head: () => ({ meta: [{ title: "تسجيل طالب جديد — سنتر الأستاذ محمد نجم" }, { name: "description", content: "استمارة تسجيل طالب جديد في السنتر." }] }),
  component: RegisterStudent,
});

const GOVERNORATES = ["القاهرة","الجيزة","الإسكندرية","القليوبية","الشرقية","الدقهلية","المنوفية","الغربية","كفر الشيخ","دمياط","بورسعيد","الإسماعيلية","السويس","بني سويف","الفيوم","المنيا","أسيوط","سوهاج","قنا","الأقصر","أسوان","البحر الأحمر","الوادي الجديد","مطروح","شمال سيناء","جنوب سيناء","البحيرة"];
const GRADES = ["الصف الأول الابتدائي","الثاني الابتدائي","الثالث الابتدائي","الرابع الابتدائي","الخامس الابتدائي","السادس الابتدائي","الأول الإعدادي","الثاني الإعدادي","الثالث الإعدادي","الأول الثانوي","الثاني الثانوي","الثالث الثانوي"];

function RegisterStudent() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const payload: Record<string, any> = {};
    fd.forEach((v, k) => { const s = String(v).trim(); if (s) payload[k] = s; });
    if (!payload.full_name) { toast.error("الاسم مطلوب"); setLoading(false); return; }

    const { data, error } = await supabase.from("students").insert(payload).select("id, code, full_name").single();
    setLoading(false);
    if (error) { toast.error("تعذر الحفظ: " + error.message); return; }
    localStorage.setItem("najm_student_id", data.id);
    localStorage.setItem("najm_student_code", data.code);
    toast.success("تم تسجيل الطالب بنجاح");
    setTimeout(() => navigate({ to: "/student/portal" }), 800);
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
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field name="full_name" label="الاسم رباعي *" required />
            <Field name="phone" label="رقم الهاتف" type="tel" />
            <Field name="parent_phone" label="رقم ولي الأمر" type="tel" />
            <Select name="gender" label="الجنس" options={["ذكر","أنثى"]} />
            <Field name="birth_date" label="تاريخ الميلاد" type="date" />
            <Field name="national_id" label="الرقم القومي" />
            <Field name="address" label="العنوان" />
            <Select name="governorate" label="المحافظة" options={GOVERNORATES} />
            <Field name="education_dept" label="الإدارة التعليمية" />
            <Field name="school" label="المدرسة" />
            <Select name="grade" label="الصف الدراسي" options={GRADES} />
            <Field name="section" label="الشعبة" />
            <Field name="subject" label="المادة" />
            <Field name="teacher_name" label="اسم المعلم" />
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-sm font-semibold">ملاحظات</label>
              <textarea name="notes" rows={3} className="w-full rounded-lg border border-input bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" />
            </div>
          </div>

          <button type="submit" disabled={loading} className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-6 py-3 text-base font-bold text-primary-foreground shadow-lg transition hover:opacity-90 disabled:opacity-60 sm:w-auto">
            <Save className="h-5 w-5" />
            {loading ? "جارٍ الحفظ..." : "حفظ التسجيل"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          مسجَّل بالفعل؟{" "}
          <Link to="/student/portal" className="font-bold text-primary hover:underline">ادخل إلى صفحتك</Link>
        </p>
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

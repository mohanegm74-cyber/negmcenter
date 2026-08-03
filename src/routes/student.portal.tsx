"use client";

import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { 
  User, BookOpen, Wallet, MessageCircleQuestion, Sparkles, 
  Save, Loader2, Award, Calendar, Home, ClipboardList, 
  MessageSquare, UserCircle, CreditCard, ChevronLeft,
  LogOut, XCircle, CheckCircle2, Send, ImageIcon, FileText, UploadCloud, Trash2, ExternalLink, Code, Phone, ShieldAlert, Info
} from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { ExamsTab } from "@/components/ExamsTab";
import { getStudentPortal, updateStudentProfile, askTeacher, deleteStudentQuestionPortal, submitHomeworkText, createHomeworkUploadUrl, finalizeHomeworkUpload, getSubmissionUrl, markNotesAsRead, deleteCertificatePortal } from "@/lib/student.functions";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { TEACHER_WHATSAPP_DISPLAY } from "@/lib/contact";

export const Route = createFileRoute("/student/portal")({
  head: () => ({ meta: [{ title: "بوابة الطالب — سنتر الأستاذ محمد نجم" }] }),
  component: Portal,
});

type Tab = "info" | "schedule" | "homework" | "ask" | "notes" | "finance" | "exams";

function Portal() {
  const [data, setData] = useState<any>(null);
  const [tab, setTab] = useState<Tab>("info");
  const [loading, setLoading] = useState(true);
  const [codeInput, setCodeInput] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  
  const loadPortal = useServerFn(getStudentPortal);
  const updateProfile = useServerFn(updateStudentProfile);
  const askFn = useServerFn(askTeacher);
  const deleteQFn = useServerFn(deleteStudentQuestionPortal);
  const markNotesFn = useServerFn(markNotesAsRead);
  const deleteCertFn = useServerFn(deleteCertificatePortal);

  useEffect(() => {
    const c = localStorage.getItem("najm_student_code");
    if (c) {
      loadData(c).catch(() => {
        localStorage.removeItem("najm_student_code");
        setLoading(false);
      });
    } else {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab === "notes" && data?.student?.code && !data.pending) {
      markNotesFn({ code: data.student.code }).then(() => {
        setData((prev: any) => prev ? { ...prev, counts: { ...prev.counts, unreadNotes: 0 } } : prev);
      });
    }
  }, [tab]);

  async function loadData(c: string) {
    try {
      const res = await loadPortal({ code: c });
      setData(res);
      setLoading(false);
      return res;
    } catch (err: any) {
      setLoading(false);
      toast.error(err.message || "فشل تحميل البيانات");
      throw err;
    }
  }

  async function login(e: React.FormEvent) {
    e.preventDefault();
    const c = codeInput.trim().toUpperCase();
    if (!c) return;
    setLoading(true);
    try {
      const res = await loadData(c);
      localStorage.setItem("najm_student_code", res.student.code);
    } catch (err: any) {} 
  }

  async function handleUpdateProfile(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSaving(true);
    const fd = new FormData(e.currentTarget);
    const fields: any = {};
    fd.forEach((v, k) => { fields[k] = String(v).trim(); });
    try {
      await updateProfile({ code: data.student.code, fields });
      toast.success("تم تحديث بياناتك بنجاح");
      await loadData(data.student.code);
    } catch (err: any) { toast.error(err.message); }
    finally { setIsSaving(false); }
  }

  async function handleAsk(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const body = String(fd.get("body")).trim();
    if (!body) return;
    setIsSaving(true);
    try {
      await askFn({ code: data.student.code, body });
      toast.success("تم إرسال سؤالك بنجاح للأستاذ");
      e.currentTarget.reset();
      await loadData(data.student.code);
    } catch (err: any) { toast.error(err.message); }
    finally { setIsSaving(false); }
  }

  async function handleRemoveQuestion(id: string) {
    if (!confirm("هل تريد حذف سؤالك؟")) return;
    try {
      await deleteQFn({ code: data.student.code, id });
      toast.success("تم حذف السؤال");
      await loadData(data.student.code);
    } catch (err: any) { toast.error(err.message); }
  }

  async function handleRemoveCert(id: string) {
    if (!confirm("هل تريد حذف هذه الشهادة من ملفك؟")) return;
    try {
      await deleteCertFn({ code: data.student.code, id });
      toast.success("تم حذف الشهادة");
      await loadData(data.student.code);
    } catch (err: any) { toast.error(err.message); }
  }

  if (loading) return <div className="flex h-screen items-center justify-center font-bold text-primary"><Loader2 className="h-10 w-10 animate-spin" /></div>;

  const BrandHeader = (
    <div className="w-full text-center py-8 px-4 bg-white/50 backdrop-blur-sm border-b">
      <BrandLogo size={80} className="mx-auto mb-4" />
      <h1 className="text-2xl md:text-3xl font-black text-primary leading-tight">
        منصة الاستاذ محمد نجم - كبير معلمين - اللغة العربية
      </h1>
      <p className="mt-2 text-sm md:text-base font-bold text-slate-500 flex items-center justify-center gap-1.5">
        <Code className="h-4 w-4 text-secondary" />
        المنصة من تصميم وبرمجة الاستاذ / محمد نجم كبير معلمين اللغة العربية
      </p>
      
      <div className="mt-4 flex flex-col items-center gap-3">
        <div className="flex items-center gap-2 text-primary font-black text-sm bg-primary/5 px-4 py-1.5 rounded-full border border-primary/10">
          <Phone className="h-4 w-4" />
          للتواصل والدعم: {TEACHER_WHATSAPP_DISPLAY}
        </div>
      </div>
    </div>
  );

  if (!data?.student) {
    return (
      <div className="min-h-screen bg-muted/30 flex flex-col items-center">
        {BrandHeader}
        <div className="w-full max-w-md bg-white p-10 rounded-[2.5rem] shadow-2xl text-center border border-white/50 my-12">
          <h2 className="text-2xl font-black mb-2 text-slate-800">دخول الطالب</h2>
          <p className="text-sm text-muted-foreground mb-6">أدخل كود الطالب الخاص بك للمتابعة</p>
          <form onSubmit={login} className="space-y-4">
            <input value={codeInput} onChange={e => setCodeInput(e.target.value)} placeholder="STU-XXXXXXXX" className="w-full rounded-2xl border-2 border-muted bg-muted/20 p-4 text-center font-mono font-black text-xl text-primary focus:border-primary outline-none transition-all" />
            <button type="submit" className="w-full rounded-2xl bg-primary py-4 font-black text-white shadow-lg shadow-primary/20 hover:opacity-90 transition-all flex items-center justify-center gap-2">دخول البوابة <ChevronLeft className="h-5 w-5" /></button>
          </form>
          <div className="mt-8 pt-6 border-t flex flex-col gap-3">
            <Link to="/student/register" className="text-sm font-bold text-secondary hover:underline">سجّل كطالب جديد</Link>
            <Link to="/" className="text-sm font-bold text-muted-foreground hover:text-primary transition-colors flex items-center justify-center gap-1"><Home className="h-4 w-4" /> العودة للرئيسية</Link>
          </div>
        </div>
      </div>
    );
  }

  if (data.pending) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex flex-col">
        {BrandHeader}
        <main className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white rounded-[2.5rem] shadow-2xl p-10 text-center border-t-8 border-amber-400">
            <div className="w-20 h-20 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-6"><ShieldAlert className="h-10 w-10" /></div>
            <h2 className="text-2xl font-black text-slate-800 mb-2">بانتظار تفعيل الأستاذ</h2>
            <p className="text-slate-500 font-bold mb-6">أهلاً بك يا {data.student.full_name}</p>
            <div className="bg-primary/5 border border-primary/10 rounded-2xl p-6 mb-8"><p className="text-sm font-black text-primary leading-relaxed">حسابك قيد المراجعة حالياً. بمجرد تفعيله، ستفتح لك كافة خدمات البوابة تلقائياً.</p></div>
            <div className="bg-amber-50 border border-amber-100 rounded-2xl p-5 mb-8"><div className="text-xs font-black text-amber-800 uppercase mb-2">كودك الخاص:</div><div className="text-xl font-mono font-black text-amber-700 bg-white py-2 rounded-lg border">{data.student.code}</div></div>
            <button onClick={() => { localStorage.removeItem("najm_student_code"); setData(null); }} className="w-full rounded-2xl bg-slate-100 py-4 font-black text-slate-600 flex items-center justify-center gap-2"><LogOut className="h-5 w-5" /> خروج</button>
          </div>
        </main>
      </div>
    );
  }

  const { student, group, payments, notes, homework, certificates, questions, subs, counts } = data;
  const totalPaid = (payments || []).filter((p: any) => p.kind === "payment").reduce((acc: number, p: any) => acc + Number(p.amount), 0);
  const totalDues = (payments || []).filter((p: any) => p.kind === "charge").reduce((acc: number, p: any) => acc + Number(p.amount), 0);
  const estimatedDues = totalDues > 0 ? totalDues : (group?.monthly_fee || 0);
  const balance = estimatedDues - totalPaid;

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      {/* رابط تعلم الإعراب - أيقونة ثابتة جهة اليسار */}
      <a 
        href="https://negmaie3rab.lovable.app" 
        target="_blank" 
        rel="noopener noreferrer"
        className="fixed bottom-6 left-6 z-[100] flex items-center justify-center w-14 h-14 bg-gradient-to-tr from-gold to-yellow-500 text-gold-foreground rounded-full shadow-2xl hover:scale-110 active:scale-95 transition-all animate-bounce border-2 border-white group"
        title="تعلم الإعراب والنحو"
      >
        <Sparkles className="w-7 h-7" />
        <span className="absolute right-full mr-3 bg-white text-primary text-[10px] font-black py-1.5 px-3 rounded-xl shadow-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap border">تعلم الإعراب (اضغط هنا)</span>
      </a>

      {BrandHeader}
      <header className="bg-white/80 backdrop-blur-md border-b p-4 sticky top-0 z-30 shadow-sm">
        <div className="max-w-5xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-black uppercase">{student.full_name[0]}</div>
            <div><div className="font-black text-slate-800 leading-tight">{student.full_name}</div><div className="text-[10px] font-bold text-muted-foreground font-mono">{student.code}</div></div>
          </div>
          <button onClick={() => {localStorage.removeItem("najm_student_code"); setData(null);}} className="p-2 rounded-xl bg-destructive/10 text-destructive hover:bg-destructive transition-all"><LogOut className="h-5 w-5" /></button>
        </div>
        <nav className="max-w-5xl mx-auto flex gap-1.5 overflow-x-auto mt-4 no-scrollbar pb-1">
          <TabBtn label="بياناتي" icon={UserCircle} active={tab === "info"} onClick={() => setTab("info")} />
          <TabBtn label="المواعيد" icon={Calendar} active={tab === "schedule"} onClick={() => setTab("schedule")} />
          <TabBtn label="الواجبات والشهادات" icon={BookOpen} active={tab === "homework"} badge={counts?.pendingHw > 0 || counts?.certificates > 0 ? "!" : null} onClick={() => setTab("homework")} />
          <TabBtn label="الاختبارات" icon={Sparkles} active={tab === "exams"} onClick={() => setTab("exams")} />
          <TabBtn label="الموقف المالي" icon={CreditCard} active={tab === "finance"} onClick={() => setTab("finance")} />
          <TabBtn label="اسأل معلمك" icon={MessageCircleQuestion} active={tab === "ask"} onClick={() => setTab("ask")} />
          <TabBtn label="ملاحظات الأستاذ" icon={MessageSquare} active={tab === "notes"} badge={counts?.unreadNotes > 0 ? counts.unreadNotes : null} onClick={() => setTab("notes")} />
        </nav>
      </header>

      <main className="max-w-5xl mx-auto p-4 md:p-6 pb-24">
        {tab === "info" && (
          <div className="animate-in fade-in slide-in-from-bottom-4">
            <section className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100">
              <h2 className="text-xl font-black mb-6 flex items-center gap-2"><UserCircle className="h-6 w-6 text-primary" /> تعديل بياناتي</h2>
              <form onSubmit={handleUpdateProfile} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field name="full_name" label="الاسم بالكامل" defaultValue={student.full_name} required />
                <Field name="phone" label="رقم الهاتف" defaultValue={student.phone || ""} />
                <Field name="parent_phone" label="رقم ولي الأمر" defaultValue={student.parent_phone || ""} />
                <Field name="address" label="العنوان" defaultValue={student.address || ""} />
                <Field name="school" label="المدرسة" defaultValue={student.school || ""} />
                <Field name="section" label="الشعبة" defaultValue={student.section || ""} />
                <div className="md:col-span-2 mt-4"><button type="submit" disabled={isSaving} className="w-full md:w-auto rounded-xl bg-primary px-10 py-3.5 text-sm font-black text-white shadow-lg flex items-center justify-center gap-2">{isSaving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />} حفظ التعديلات</button></div>
              </form>
            </section>
          </div>
        )}

        {tab === "schedule" && (
          <section className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-100 text-center animate-in fade-in slide-in-from-bottom-4">
            <div className="mx-auto w-20 h-20 bg-primary/10 rounded-3xl flex items-center justify-center text-primary mb-4"><Calendar className="h-10 w-10" /></div>
            <h2 className="text-2xl font-black text-slate-800">{group?.name || "لم يتم التوزيع على مجموعة بعد"}</h2>
            <p className="text-muted-foreground font-bold mt-1">{group?.subject || "—"} · {group?.grade || "—"}</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
              <InfoCard label="أيام الدراسة" value={group?.days || "—"} />
              <InfoCard label="ميعاد الحصة" value={group?.time || "—"} />
              <InfoCard label="القاعة" value={group?.room || "—"} />
            </div>
          </section>
        )}

        {tab === "homework" && (
          <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4">
            <section>
              <h2 className="text-2xl font-black mb-6 text-slate-800">الواجبات المدرسية</h2>
              {(!homework || homework.length === 0) ? <EmptyState icon={BookOpen} text="لا توجد واجبات حالياً" /> : (
                <div className="grid gap-6">{homework.map((h: any) => (<HomeworkItem key={h.id} h={h} studentCode={student.code} submission={subs?.find((s: any) => s.homework_id === h.id)} onRefresh={() => loadData(student.code)} />))}</div>
              )}
            </section>
            <section>
              <h2 className="text-2xl font-black mb-6 text-gold-foreground">شهادات التقدير</h2>
              {(!certificates || certificates.length === 0) ? <EmptyState icon={Award} text="اجتهد لتحصل على أول شهادة تقدير!" /> : (
                <div className="grid gap-4 sm:grid-cols-2">{certificates.map((c: any) => (<div key={c.id} className="bg-white p-6 rounded-3xl border-2 border-gold/20 shadow-sm relative overflow-hidden group"><button onClick={() => handleRemoveCert(c.id)} className="absolute top-2 left-2 p-2 text-rose-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all"><Trash2 className="h-4 w-4" /></button><Award className="absolute -right-4 -top-4 h-24 w-24 text-gold/5" /><div className="text-lg font-black text-gold-foreground">{c.title}</div><p className="text-sm mt-2 font-bold text-slate-700 italic">"{c.reason}"</p><div className="mt-4 flex items-center justify-between border-t pt-4"><div className="text-xs font-black text-slate-500">{c.signer}</div><div className="text-[10px] text-muted-foreground">{new Date(c.created_at).toLocaleDateString("ar-EG")}</div></div></div>))}</div>
              )}
            </section>
          </div>
        )}

        {tab === "exams" && <ExamsTab code={student.code} />}

        {tab === "finance" && (
          <section className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-100 animate-in fade-in slide-in-from-bottom-4">
            <h2 className="text-xl font-black mb-6">تقرير الموقف المالي</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
              <div className="bg-slate-50 p-5 rounded-2xl border text-center"><div className="text-[10px] font-black text-muted-foreground">إجمالي المستحق</div><div className="text-2xl font-black">{estimatedDues} ج.م</div></div>
              <div className="bg-emerald-50 p-5 rounded-2xl border border-emerald-100 text-center"><div className="text-[10px] font-black text-emerald-600">إجمالي المسدد</div><div className="text-2xl font-black">{totalPaid} ج.م</div></div>
              <div className={`p-5 rounded-2xl border text-center ${balance > 0 ? "bg-rose-50" : "bg-emerald-50"}`}><div className="text-[10px] font-black">المتبقي</div><div className="text-2xl font-black">{balance} ج.م</div></div>
            </div>
          </section>
        )}

        {tab === "ask" && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
            <section className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100">
              <h2 className="text-xl font-black mb-6">اسأل معلمك</h2>
              {questions.length >= 1 ? (
                <div className="p-6 bg-amber-50 rounded-2xl border text-center"><p className="text-sm font-black">تم إرسال سؤالك بنجاح. احذفه إذا أردت إرسال سؤال جديد.</p></div>
              ) : (
                <form onSubmit={handleAsk} className="space-y-4">
                  <textarea name="body" placeholder="اكتب سؤالك هنا..." required rows={5} className="w-full rounded-2xl border p-4 text-sm font-bold focus:border-primary outline-none" />
                  <button type="submit" disabled={isSaving} className="rounded-xl bg-primary px-8 py-3 text-sm font-black text-white shadow-lg">{isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} إرسال السؤال</button>
                </form>
              )}
            </section>
            <section>
              <h3 className="font-black mb-4">سؤالك الحالي</h3>
              <div className="space-y-3">{questions.map((q: any) => (<div key={q.id} className="bg-white p-4 rounded-2xl border shadow-sm flex justify-between items-start"><div className="flex-1"><div className="text-sm font-bold">{q.body}</div>{q.answer && <div className="mt-3 bg-primary/5 p-3 rounded-xl text-sm"><div className="text-[10px] font-black text-primary">رد المعلم:</div><div className="font-bold">{q.answer}</div></div>}</div><button onClick={() => handleRemoveQuestion(q.id)} className="p-2 text-rose-400"><Trash2 className="h-4 w-4" /></button></div>))}</div>
            </section>
          </div>
        )}

        {tab === "notes" && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
            <h2 className="text-xl font-black mb-4">ملاحظات الأستاذ</h2>
            {notes.length === 0 ? <EmptyState icon={MessageSquare} text="لا توجد ملاحظات مرسلة" /> : (
              <div className="space-y-4">{notes.map((n: any) => (<div key={n.id} className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 flex gap-4"><div className="h-12 w-12 rounded-2xl bg-secondary/10 flex items-center justify-center text-secondary shrink-0"><MessageSquare className="h-6 w-6" /></div><div><div className="font-black">{n.title}</div><p className="text-sm text-slate-600 mt-1 italic">"{n.body}"</p></div></div>))}</div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

function HomeworkItem({ h, studentCode, submission, onRefresh }: any) {
  const [text, setText] = useState(submission?.answer_text || "");
  const [busy, setBusy] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const submitText = useServerFn(submitHomeworkText);
  const getUploadUrl = useServerFn(createHomeworkUploadUrl);
  const finalizeUpload = useServerFn(finalizeHomeworkUpload);
  const getSubUrl = useServerFn(getSubmissionUrl);

  useEffect(() => {
    if (submission?.file_url) {
      getSubUrl({ data: { code: studentCode, path: submission.file_url } }).then(res => setImageUrl(res.url));
    }
  }, [submission, studentCode]);

  async function handleTextSubmit() {
    if (!text.trim()) return;
    setBusy(true);
    try {
      await submitText({ data: { code: studentCode, homework_id: h.id, answer_text: text } });
      toast.success("تم الحفظ");
      onRefresh();
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(false); }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    const t = toast.loading("جاري الرفع...");
    try {
      const { data: { path, token } } = await getUploadUrl({ data: { code: studentCode, homework_id: h.id, filename: file.name } });
      const { error } = await supabase.storage.from("submissions").uploadToSignedUrl(path, token, file);
      if (error) throw error;
      await finalizeUpload({ data: { code: studentCode, homework_id: h.id, path } });
      toast.success("تم الرفع", { id: t });
      onRefresh();
    } catch (err: any) { toast.error(err.message, { id: t }); }
    finally { setBusy(false); }
  }

  return (
    <div className="bg-white rounded-[2rem] border overflow-hidden shadow-sm">
      <div className="p-6 border-b bg-slate-50/50">
        <h3 className="text-xl font-black">{h.title}</h3>
        <p className="text-sm text-slate-500 font-bold">{h.description || "لا يوجد وصف"}</p>
      </div>
      <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div className="text-xs font-black text-primary">الحل النصي:</div>
          <textarea value={text} onChange={e => setText(e.target.value)} rows={4} className="w-full rounded-2xl border p-4 text-sm font-bold outline-none" />
          <button onClick={handleTextSubmit} disabled={busy} className="rounded-xl bg-primary px-6 py-2 text-xs font-black text-white">حفظ الحل</button>
        </div>
        <div className="space-y-4">
          <div className="text-xs font-black text-secondary">رفع صورة الواجب:</div>
          {imageUrl ? (
            <div className="relative rounded-2xl overflow-hidden border aspect-video bg-slate-50 flex items-center justify-center">
              <img src={imageUrl} className="max-h-full object-contain" alt="submission" />
              <label className="absolute inset-0 bg-black/20 opacity-0 hover:opacity-100 flex items-center justify-center cursor-pointer transition-all">
                <span className="bg-white text-primary px-4 py-2 rounded-xl text-xs font-black">تغيير الصورة</span>
                <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
              </label>
            </div>
          ) : (
            <label className="flex flex-col items-center justify-center gap-3 border-2 border-dashed rounded-2xl aspect-video bg-slate-50 cursor-pointer">
              <UploadCloud className="h-10 w-10 text-slate-300" />
              <span className="text-xs font-black text-slate-400">اضغط للرفع</span>
              <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
            </label>
          )}
        </div>
      </div>
    </div>
  );
}

function TabBtn({ label, icon: Icon, active, badge, onClick }: any) {
  return (
    <button onClick={onClick} className={`relative shrink-0 flex items-center gap-1.5 px-5 py-2.5 rounded-2xl text-[13px] font-black transition-all ${active ? "bg-primary text-white shadow-lg" : "bg-white text-slate-500 border border-slate-100"}`}>
      <Icon className="h-4 w-4" /> 
      {label}
      {badge && <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-600 text-[8px] text-white animate-pulse">{badge}</span>}
    </button>
  );
}
function Field({ name, label, defaultValue, required = false }: any) {
  return (<div className="space-y-1.5"><label className="text-xs font-black text-slate-500">{label}</label><input name={name} defaultValue={defaultValue} required={required} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-bold outline-none" /></div>);
}
function InfoCard({ label, value }: { label: string; value: string }) {
  return (<div className="p-4 rounded-2xl bg-slate-50 border"><div className="text-[10px] font-black text-muted-foreground uppercase">{label}</div><div className="font-black">{value}</div></div>);
}
function EmptyState({ icon: Icon, text }: { icon: any; text: string }) {
  return (<div className="bg-white p-12 rounded-[2.5rem] border border-dashed text-center"><Icon className="mx-auto h-12 w-12 text-muted/30 mb-3" /><p className="text-muted-foreground font-bold">{text}</p></div>);
}
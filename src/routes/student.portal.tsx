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
import { GRADES } from "@/lib/exam-constants";
import { TEACHER_WHATSAPP_DISPLAY } from "@/lib/contact";

export const Route = createFileRoute("/student/portal")({
  head: () => ({ meta: [{ title: "بوابة الطالب — سنتر الأستاذ محمد نجم" }] }),
  component: Portal,
});

type Tab = "info" | "schedule" | "attendance" | "homework" | "ask" | "notes" | "finance" | "exams";

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
      markNotesFn({ data: { code: data.student.code } }).then(() => {
        setData((prev: any) => prev ? { ...prev, counts: { ...prev.counts, unreadNotes: 0 } } : prev);
      });
    }
  }, [tab]);

  async function loadData(c: string) {
    try {
      const res = await loadPortal({ data: { code: c } });
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
      toast.success(`أهلاً بك يا ${res.student.full_name.split(' ')[0]}`);
    } catch (err: any) {} 
  }

  async function handleUpdateProfile(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSaving(true);
    const fd = new FormData(e.currentTarget);
    const fields: any = {};
    fd.forEach((v, k) => { fields[k] = String(v).trim(); });
    try {
      await updateProfile({ data: { code: data.student.code, fields } });
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
      await askFn({ data: { code: data.student.code, body } });
      toast.success("تم إرسال سؤالك بنجاح للأستاذ");
      e.currentTarget.reset();
      await loadData(data.student.code);
    } catch (err: any) { toast.error(err.message); }
    finally { setIsSaving(false); }
  }

  async function handleRemoveQuestion(id: string) {
    if (!confirm("هل تريد حذف سؤالك؟")) return;
    try {
      await deleteQFn({ data: { code: data.student.code, id } });
      toast.success("تم حذف السؤال");
      await loadData(data.student.code);
    } catch (err: any) { toast.error(err.message); }
  }

  async function handleRemoveCert(id: string) {
    if (!confirm("هل تريد حذف هذه الشهادة من ملفك؟")) return;
    try {
      await deleteCertFn({ data: { code: data.student.code, id } });
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
      {BrandHeader}
      <header className="bg-white/80 backdrop-blur-md border-b p-4 sticky top-0 z-30 shadow-sm">
        <div className="max-w-5xl mx-auto flex justify-between items-center gap-4">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex-shrink-0 flex items-center justify-center text-primary font-black uppercase">{student.full_name[0]}</div>
            <div className="min-w-0">
              <div className="font-black text-slate-800 leading-tight truncate">{student.full_name}</div>
              <div className="text-[10px] font-bold text-muted-foreground font-mono">{student.code}</div>
            </div>
            <a 
              href="https://negmaie3rab.lovable.app" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gold/15 text-gold-foreground text-[10px] font-black border border-gold/20 hover:bg-gold/20 active:opacity-60 transition-all shrink-0 ms-1"
            >
              <Sparkles className="h-3 w-3" />
              تعلم الإعراب
            </a>
          </div>
          <button onClick={() => {localStorage.removeItem("najm_student_code"); setData(null);}} className="p-2 rounded-xl bg-destructive/10 text-destructive hover:bg-destructive transition-all flex-shrink-0"><LogOut className="h-5 w-5" /></button>
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
                <div>
                  <label className="mb-1.5 block text-xs font-black text-muted-foreground">الصف الدراسي</label>
                  <select name="grade" defaultValue={student.grade || ""} className="w-full rounded-xl border bg-white px-4 py-2.5 text-sm font-bold outline-none focus:border-primary">
                    <option value="">— غير محدد —</option>
                    {GRADES.map((g: string) => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>

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
              <h2 className="text-2xl font-black mb-6 text-slate-800">الواجبات المدرسية والمتابعة</h2>
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
      toast.success("تم حفظ إجابتك النصية بنجاح");
      onRefresh();
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(false); }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    const t = toast.loading("جاري رفع صورة الواجب...");
    try {
      const { path, token } = await getUploadUrl({ data: { code: studentCode, homework_id: h.id, filename: file.name } });
      const { error } = await supabase.storage.from("submissions").uploadToSignedUrl(path, token, file);
      if (error) throw error;
      await finalizeUpload({ data: { code: studentCode, homework_id: h.id, path } });
      toast.success("تم رفع الصورة بنجاح", { id: t });
      onRefresh();
    } catch (err: any) { toast.error(err.message, { id: t }); }
    finally { setBusy(false); }
  }

  const released = h.results_released !== false;
  const isGraded = submission?.status === 'graded' && released;

  return (
    <div className={`bg-white rounded-[2.5rem] border-2 overflow-hidden shadow-sm transition-all ${isGraded ? 'border-emerald-200' : 'border-slate-100'}`}>
      <div className={`p-6 border-b flex justify-between items-center ${isGraded ? 'bg-emerald-50/50' : 'bg-slate-50/50'}`}>
        <div className="flex-1">
          <h3 className="text-xl font-black text-slate-800">{h.title}</h3>
          <p className="text-sm text-slate-500 font-bold mt-1 leading-relaxed">{h.description || "لا يوجد وصف إضافي للواجب."}</p>
        </div>
        {isGraded && (
          <div className="bg-emerald-600 text-white px-5 py-2.5 rounded-2xl text-center shadow-lg animate-in zoom-in-50">
            <div className="text-[10px] font-black uppercase opacity-80">الدرجة النهائية</div>
            <div className="text-xl font-black">{submission.score} / {h.max_score}</div>
          </div>
        )}
      </div>

      {isGraded && submission.note && (
        <div className="p-6 bg-emerald-50/30 border-b border-emerald-100">
          <div className="text-xs font-black text-emerald-700 mb-2 flex items-center gap-1.5 uppercase">
            <MessageSquare className="h-4 w-4" /> ملاحظات وتقييم الأستاذ:
          </div>
          <div className="bg-white p-4 rounded-2xl border-2 border-emerald-100 text-sm font-bold text-slate-700 italic shadow-sm leading-loose">
            "{submission.note}"
          </div>
          {h.model_solution && (
            <div className="mt-4">
              <div className="text-xs font-black text-primary mb-2 flex items-center gap-1.5 uppercase">
                <CheckCircle2 className="h-4 w-4" /> نموذج الإجابة الصحيحة:
              </div>
              <div className="bg-primary/5 p-4 rounded-2xl border-2 border-primary/10 text-sm font-bold text-slate-700 leading-loose">
                {h.model_solution}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-4">
          <div className="text-[11px] font-black text-slate-500 uppercase ms-2 flex items-center gap-1.5"><FileText className="h-3.5 w-3.5" /> حل الواجب (نصي):</div>
          <textarea 
            value={text} 
            onChange={e => setText(e.target.value)} 
            rows={5} 
            disabled={isGraded}
            placeholder="اكتب إجابتك هنا في حال لم تكن تريد رفع صورة..."
            className="w-full rounded-2xl border-2 border-slate-100 p-4 text-sm font-bold outline-none focus:border-primary focus:bg-slate-50 transition-all" 
          />
          {!isGraded && (
            <button onClick={handleTextSubmit} disabled={busy} className="w-full sm:w-auto rounded-xl bg-primary px-8 py-3 text-sm font-black text-white shadow-lg shadow-primary/20 hover:scale-105 transition-all">حفظ الحل المكتوب</button>
          )}
        </div>
        
        <div className="space-y-4">
          <div className="text-[11px] font-black text-slate-500 uppercase ms-2 flex items-center gap-1.5"><ImageIcon className="h-3.5 w-3.5" /> تصوير الكراسة ورفع الصورة:</div>
          {imageUrl ? (
            <div className="relative rounded-2xl overflow-hidden border-2 border-slate-100 aspect-video bg-slate-50 flex items-center justify-center shadow-inner group">
              <img src={imageUrl} className="max-h-full object-contain" alt="submission" />
              {!isGraded && (
                <label className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center cursor-pointer transition-all">
                  <div className="bg-white text-primary px-5 py-2.5 rounded-2xl text-xs font-black shadow-xl">تغيير الصورة المرفوعة</div>
                  <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
                </label>
              )}
            </div>
          ) : (
            <label className={`flex flex-col items-center justify-center gap-4 border-2 border-dashed rounded-3xl aspect-video bg-slate-50 transition-all ${isGraded ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-slate-100 border-slate-300'}`}>
              <UploadCloud className="h-12 w-12 text-slate-300" />
              <div className="text-center">
                <span className="text-xs font-black text-slate-400 block">اضغط لاختيار صورة من هاتفك</span>
                <span className="text-[10px] text-slate-300 font-bold uppercase mt-1">JPG, PNG, PDF</span>
              </div>
              {!isGraded && <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />}
            </label>
          )}
        </div>
      </div>
    </div>
  );
}

function TabBtn({ label, icon: Icon, active, badge, onClick }: any) {
  return (
    <button onClick={onClick} className={`relative shrink-0 flex items-center gap-2 px-5 py-2.5 rounded-2xl text-[13px] font-black transition-all ${active ? "bg-primary text-white shadow-lg" : "bg-white text-slate-500 border border-slate-100 hover:border-primary/30"}`}>
      <Icon className="h-4 w-4" /> 
      {label}
      {badge && <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-600 text-[10px] font-black text-white animate-pulse shadow-md px-1">{badge}</span>}
    </button>
  );
}
function Field({ name, label, defaultValue, required = false }: any) {
  return (<div className="space-y-1.5"><label className="text-xs font-black text-slate-500 ms-1 uppercase">{label}</label><input name={name} defaultValue={defaultValue} required={required} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-bold outline-none focus:bg-white focus:border-primary transition-all" /></div>);
}
function InfoCard({ label, value }: { label: string; value: string }) {
  return (<div className="p-5 rounded-3xl bg-slate-50 border-2 border-slate-100 shadow-sm"><div className="text-[10px] font-black text-muted-foreground uppercase mb-1 tracking-wider">{label}</div><div className="font-black text-slate-800">{value}</div></div>);
}
function EmptyState({ icon: Icon, text }: { icon: any; text: string }) {
  return (<div className="bg-white p-16 rounded-[2.5rem] border-2 border-dashed border-slate-100 text-center"><Icon className="mx-auto h-16 w-16 text-muted/20 mb-4" /><p className="text-slate-400 font-black text-lg">{text}</p></div>);
}
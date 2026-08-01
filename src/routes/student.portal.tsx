import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { 
  User, BookOpen, Wallet, MessageCircleQuestion, Sparkles, 
  Save, Loader2, Award, Calendar, Home, ClipboardList, 
  MessageSquare, UserCircle, CreditCard, ChevronLeft,
  LogOut, XCircle, CheckCircle2, Send, ImageIcon, FileText, UploadCloud
} from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { ExamsTab } from "@/components/ExamsTab";
import { getStudentPortal, updateStudentProfile, askTeacher, submitHomeworkText, createHomeworkUploadUrl, finalizeHomeworkUpload, getSubmissionUrl } from "@/lib/student.functions";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";

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

  useEffect(() => {
    const c = localStorage.getItem("najm_student_code");
    if (c) loadData(c).finally(() => setLoading(false));
    else setLoading(false);
  }, []);

  async function loadData(c: string) {
    try {
      const res = await loadPortal({ data: { code: c } });
      setData(res);
    } catch (err: any) {
      toast.error(err.message || "فشل الدخول");
      if (err.message.includes("مراجعة")) localStorage.removeItem("najm_student_code");
      throw err;
    }
  }

  async function login(e: React.FormEvent) {
    e.preventDefault();
    const c = codeInput.trim().toUpperCase();
    if (!c) return;
    setLoading(true);
    try {
      await loadData(c);
      localStorage.setItem("najm_student_code", c);
    } catch (err: any) {} 
    finally { setLoading(false); }
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
    try {
      await askFn({ data: { code: data.student.code, body } });
      toast.success("تم إرسال سؤالك للأستاذ");
      e.currentTarget.reset();
      await loadData(data.student.code);
    } catch (err: any) { toast.error(err.message); }
  }

  if (loading) return <div className="flex h-screen items-center justify-center font-bold text-primary"><Loader2 className="h-10 w-10 animate-spin" /></div>;

  if (!data?.student) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-white p-10 rounded-[2.5rem] shadow-2xl text-center border border-white/50">
          <BrandLogo size={100} className="mb-6 mx-auto" />
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

  const { student, group, payments, notes, homework, certificates, questions, subs } = data;

  const totalPaid = (payments || []).filter((p: any) => p.kind === "payment").reduce((acc: number, p: any) => acc + Number(p.amount), 0);
  const totalDues = (payments || []).filter((p: any) => p.kind === "charge").reduce((acc: number, p: any) => acc + Number(p.amount), 0);
  const estimatedDues = totalDues > 0 ? totalDues : (group?.monthly_fee || 0);
  const balance = estimatedDues - totalPaid;

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      <header className="bg-white/80 backdrop-blur-md border-b p-4 sticky top-0 z-30 shadow-sm">
        <div className="max-w-5xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-black uppercase">{student.full_name[0]}</div>
            <div>
              <div className="font-black text-slate-800 leading-tight">{student.full_name}</div>
              <div className="text-[10px] font-bold text-muted-foreground font-mono">{student.code}</div>
            </div>
          </div>
          <button onClick={() => {localStorage.removeItem("najm_student_code"); setData(null);}} className="p-2 rounded-xl bg-destructive/10 text-destructive hover:bg-destructive hover:text-white transition-all"><LogOut className="h-5 w-5" /></button>
        </div>
        <nav className="max-w-5xl mx-auto flex gap-1.5 overflow-x-auto mt-4 no-scrollbar pb-1">
          <TabBtn label="بياناتي" icon={UserCircle} active={tab === "info"} onClick={() => setTab("info")} />
          <TabBtn label="المواعيد" icon={Calendar} active={tab === "schedule"} onClick={() => setTab("schedule")} />
          <TabBtn label="الواجبات والشهادات" icon={BookOpen} active={tab === "homework"} onClick={() => setTab("homework")} />
          <TabBtn label="الاختبارات" icon={Sparkles} active={tab === "exams"} onClick={() => setTab("exams")} />
          <TabBtn label="الموقف المالي" icon={CreditCard} active={tab === "finance"} onClick={() => setTab("finance")} />
          <TabBtn label="اسأل معلمك" icon={MessageCircleQuestion} active={tab === "ask"} onClick={() => setTab("ask")} />
          <TabBtn label="ملاحظات الأستاذ" icon={MessageSquare} active={tab === "notes"} onClick={() => setTab("notes")} />
        </nav>
      </header>

      <main className="max-w-5xl mx-auto p-4 md:p-6 pb-24">
        {tab === "info" && (
          <div className="animate-in fade-in slide-in-from-bottom-4">
            <section className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100">
              <h2 className="text-xl font-black mb-6 flex items-center gap-2"><UserCircle className="h-6 w-6 text-primary" /> تعديل بيانات الطالب</h2>
              <form onSubmit={handleUpdateProfile} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field name="full_name" label="الاسم بالكامل" defaultValue={student.full_name} required />
                <Field name="phone" label="رقم الهاتف" defaultValue={student.phone || ""} />
                <Field name="parent_phone" label="رقم ولي الأمر" defaultValue={student.parent_phone || ""} />
                <Field name="address" label="العنوان" defaultValue={student.address || ""} />
                <Field name="school" label="المدرسة" defaultValue={student.school || ""} />
                <Field name="section" label="الشعبة" defaultValue={student.section || ""} />
                <div className="md:col-span-2 mt-4"><button type="submit" disabled={isSaving} className="w-full md:w-auto rounded-xl bg-primary px-10 py-3.5 text-sm font-black text-white shadow-lg shadow-primary/20 hover:opacity-90 disabled:opacity-50 transition-all flex items-center justify-center gap-2">{isSaving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />} حفظ التعديلات</button></div>
              </form>
            </section>
          </div>
        )}

        {tab === "schedule" && (
          <section className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-100 text-center animate-in fade-in slide-in-from-bottom-4">
            <div className="mx-auto w-20 h-20 bg-primary/10 rounded-3xl flex items-center justify-center text-primary mb-4"><Calendar className="h-10 w-10" /></div>
            <h2 className="text-2xl font-black text-slate-800">{group?.name || "لم يتم الربط بمجموعة بعد"}</h2>
            <p className="text-muted-foreground font-bold mt-1">{group?.subject || "—"} · {group?.grade || "—"}</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
              <InfoCard label="أيام الدراسة" value={group?.days || "—"} />
              <InfoCard label="ميعاد الحصة" value={group?.time || "—"} />
              <InfoCard label="القاعة / الغرفة" value={group?.room || "—"} />
            </div>
          </section>
        )}

        {tab === "homework" && (
          <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4">
            <section>
              <h2 className="text-2xl font-black mb-6 flex items-center gap-2 text-slate-800"><BookOpen className="h-7 w-7 text-primary" /> الواجبات المدرسية</h2>
              {(!homework || homework.length === 0) ? <EmptyState icon={BookOpen} text="لا توجد واجبات مسجلة لك حالياً" /> : (
                <div className="grid gap-6">
                  {homework.map((h: any) => (
                    <HomeworkItem key={h.id} h={h} studentCode={student.code} submission={subs?.find((s: any) => s.homework_id === h.id)} onRefresh={() => loadData(student.code)} />
                  ))}
                </div>
              )}
            </section>

            <section>
              <h2 className="text-2xl font-black mb-6 flex items-center gap-2 text-slate-800"><Award className="h-7 w-7 text-gold" /> شهادات التقدير والتميز</h2>
              {(!certificates || certificates.length === 0) ? <EmptyState icon={Award} text="لم تحصل على شهادات بعد، ابذل مجهوداً أكبر!" /> : (
                <div className="grid gap-4 sm:grid-cols-2">
                  {certificates.map((c: any) => (
                    <div key={c.id} className="bg-white p-6 rounded-3xl border-2 border-gold/20 shadow-sm relative overflow-hidden group hover:shadow-lg transition-all">
                      <Award className="absolute -right-4 -top-4 h-24 w-24 text-gold/5 rotate-12 group-hover:scale-110 transition-transform" />
                      <div className="text-lg font-black text-gold-foreground">{c.title}</div>
                      <p className="text-sm mt-2 font-bold text-slate-700 leading-relaxed italic">"{c.reason}"</p>
                      <div className="mt-4 flex items-center justify-between border-t pt-4">
                        <div className="text-xs font-black text-slate-500">بواسطة: {c.signer}</div>
                        <div className="text-[10px] text-muted-foreground font-mono">{new Date(c.created_at).toLocaleDateString("ar-EG")}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}

        {tab === "exams" && <ExamsTab code={student.code} />}

        {tab === "finance" && (
          <section className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-100 animate-in fade-in slide-in-from-bottom-4">
            <h2 className="text-xl font-black mb-6 flex items-center gap-2"><CreditCard className="h-6 w-6 text-primary" /> تقرير الموقف المالي</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
              <div className="bg-slate-50 p-5 rounded-2xl border text-center"><div className="text-[10px] font-black text-muted-foreground mb-1">إجمالي المستحق</div><div className="text-2xl font-black text-slate-800">{estimatedDues} <span className="text-xs">ج.م</span></div></div>
              <div className="bg-emerald-50 p-5 rounded-2xl border border-emerald-100 text-center"><div className="text-[10px] font-black text-emerald-600 mb-1">إجمالي المسدد</div><div className="text-2xl font-black text-emerald-700">{totalPaid} <span className="text-xs">ج.م</span></div></div>
              <div className={`p-5 rounded-2xl border text-center ${balance > 0 ? "bg-rose-50 border-rose-100" : "bg-emerald-50 border-emerald-100"}`}><div className={`text-[10px] font-black mb-1 ${balance > 0 ? "text-rose-600" : "text-emerald-600"}`}>المتبقي / الرصيد</div><div className={`text-2xl font-black ${balance > 0 ? "text-rose-700" : "text-emerald-700"}`}>{balance} <span className="text-xs">ج.م</span></div></div>
            </div>
            <div className="text-center py-4">{balance <= 0 ? <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500 px-6 py-2 text-sm font-black text-white"><CheckCircle2 className="h-5 w-5" /> تم سداد المصاريف بالكامل</div> : <div className="inline-flex items-center gap-2 rounded-full bg-rose-500 px-6 py-2 text-sm font-black text-white shadow-lg shadow-rose-200"><XCircle className="h-5 w-5" /> يرجى سداد المتبقي ( {balance} ج.م )</div>}</div>
            <div className="mt-10"><h3 className="font-black text-slate-800 mb-4">سجل الحركات المالية</h3><div className="overflow-hidden rounded-xl border"><table className="w-full text-right text-sm"><thead className="bg-slate-50"><tr><th className="p-3">التاريخ</th><th className="p-3">النوع</th><th className="p-3">المبلغ</th></tr></thead><tbody className="divide-y">{payments.map((p: any) => (<tr key={p.id}><td className="p-3 font-mono text-xs">{p.paid_at}</td><td className="p-3"><span className={`px-2 py-0.5 rounded text-[10px] font-bold ${p.kind === "payment" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>{p.kind === "payment" ? "سداد" : "مستحق"}</span></td><td className="p-3 font-black">{p.amount} ج.م</td></tr>))}{payments.length === 0 && <tr><td colSpan={3} className="p-4 text-center text-muted-foreground">لا توجد حركات مسجلة</td></tr>}</tbody></table></div></div>
          </section>
        )}

        {tab === "ask" && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
            <section className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100">
              <h2 className="text-xl font-black mb-6 flex items-center gap-2"><MessageCircleQuestion className="h-6 w-6 text-primary" /> اسأل معلمك</h2>
              <form onSubmit={handleAsk} className="space-y-4"><textarea name="body" placeholder="اكتب سؤالك هنا وسيقوم الأستاذ بالرد عليك..." required rows={5} className="w-full rounded-2xl border-2 border-slate-100 p-4 text-sm font-bold focus:border-primary outline-none" /><button type="submit" className="rounded-xl bg-primary px-8 py-3 text-sm font-black text-white shadow-lg">إرسال السؤال للأستاذ</button></form>
            </section>
            <section><h3 className="font-black text-slate-800 mb-4">الأسئلة السابقة والردود</h3><div className="space-y-3">{questions.map((q: any) => (<div key={q.id} className="bg-white p-4 rounded-2xl border shadow-sm"><div className="text-sm font-bold text-slate-700">{q.body}</div>{q.answer ? (<div className="mt-3 bg-primary/5 p-3 rounded-xl border border-primary/10 text-sm"><div className="text-[10px] font-black text-primary mb-1">رد المعلم:</div><div className="font-bold text-slate-800">{q.answer}</div></div>) : (<div className="mt-2 text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded inline-block">بانتظار الرد...</div>)}</div>))}{questions.length === 0 && <p className="text-center py-8 text-muted-foreground font-bold">لم تطرح أي أسئلة بعد</p>}</div></section>
          </div>
        )}

        {tab === "notes" && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
            <h2 className="text-xl font-black mb-4 flex items-center gap-2"><MessageSquare className="h-6 w-6 text-secondary" /> ملاحظات ولي الأمر</h2>
            {notes.length === 0 ? <EmptyState icon={MessageSquare} text="لا توجد ملاحظات مرسلة حالياً" /> : (
              <div className="space-y-4">{notes.map((n: any) => (<div key={n.id} className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 flex gap-4"><div className="h-12 w-12 rounded-2xl bg-secondary/10 flex items-center justify-center text-secondary shrink-0"><MessageSquare className="h-6 w-6" /></div><div><div className="font-black text-slate-800">{n.title}</div><p className="text-sm text-slate-600 mt-1 leading-relaxed font-bold italic">"{n.body}"</p><div className="mt-3 text-[10px] font-bold text-muted-foreground font-mono">{new Date(n.created_at).toLocaleString("ar-EG")}</div></div></div>))}</div>
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
      toast.success("تم حفظ الحل النصي بنجاح");
      onRefresh();
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(false); }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    const t = toast.loading("جاري رفع الصورة الضوئية...");
    try {
      const { path, token } = await getUploadUrl({ data: { code: studentCode, homework_id: h.id, filename: file.name } });
      const { error } = await supabase.storage.from("submissions").uploadToSignedUrl(path, token, file);
      if (error) throw error;
      await finalizeUpload({ data: { code: studentCode, homework_id: h.id, path } });
      toast.success("تم رفع صورة الواجب بنجاح", { id: t });
      onRefresh();
    } catch (err: any) { toast.error(err.message, { id: t }); }
    finally { setBusy(false); }
  }

  const isGraded = submission?.status === "graded";

  return (
    <div className="bg-white rounded-[2rem] border-2 border-slate-100 overflow-hidden shadow-sm hover:border-primary/20 transition-all">
      <div className="p-6 border-b bg-slate-50/50 flex flex-wrap justify-between items-start gap-4">
        <div>
          <h3 className="text-xl font-black text-slate-800">{h.title}</h3>
          <p className="text-sm text-slate-500 font-bold mt-1">{h.description || "لا يوجد وصف إضافي"}</p>
          <div className="flex gap-4 mt-3 text-[10px] font-black text-muted-foreground uppercase">
            <span>⏱️ الموعد: {h.due_date || "مفتوح"}</span>
            <span>🎯 الدرجة القصوى: {h.max_score}</span>
          </div>
        </div>
        {isGraded && (
          <div className="bg-emerald-600 text-white px-6 py-3 rounded-2xl text-center shadow-lg shadow-emerald-100">
            <div className="text-[10px] font-black opacity-80 uppercase mb-1">الدرجة المستحقة</div>
            <div className="text-2xl font-black">{submission.score} / {h.max_score}</div>
          </div>
        )}
      </div>

      <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* منطقة الحل النصي */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-xs font-black text-primary uppercase"><FileText className="h-4 w-4" /> كتابة الحل النصي:</div>
          <textarea value={text} onChange={e => setText(e.target.value)} placeholder="اكتب إجابتك هنا..." rows={6} className="w-full rounded-2xl border-2 border-slate-100 p-4 text-sm font-bold focus:border-primary outline-none transition-all" />
          <button onClick={handleTextSubmit} disabled={busy} className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-2.5 text-xs font-black text-white shadow-lg shadow-primary/10 hover:opacity-90 disabled:opacity-50 transition-all"><Send className="h-3.5 w-3.5" /> حفظ الحل النصي</button>
        </div>

        {/* منطقة رفع الصور */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-xs font-black text-secondary uppercase"><ImageIcon className="h-4 w-4" /> رفع صورة الواجب (تصوير الكشكول):</div>
          <div className="relative group">
            {imageUrl ? (
              <div className="relative rounded-2xl overflow-hidden border-2 border-slate-100 aspect-video bg-slate-50 flex items-center justify-center">
                <img src={imageUrl} className="max-h-full object-contain" alt="submission" />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all">
                  <label className="cursor-pointer bg-white text-slate-800 px-4 py-2 rounded-xl text-xs font-black flex items-center gap-2 shadow-xl"><UploadCloud className="h-4 w-4" /> تغيير الصورة<input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} /></label>
                </div>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center gap-3 border-2 border-dashed border-slate-200 rounded-2xl aspect-video bg-slate-50 cursor-pointer hover:bg-slate-100 hover:border-secondary transition-all">
                <UploadCloud className="h-10 w-10 text-slate-300" />
                <span className="text-xs font-black text-slate-400">اضغط لرفع صورة الحل أو تصويره</span>
                <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
              </label>
            )}
          </div>
        </div>
      </div>

      {submission?.note && (
        <div className="m-6 p-5 rounded-2xl bg-amber-50 border-2 border-amber-100 flex gap-4">
          <div className="h-10 w-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0"><MessageSquare className="h-5 w-5" /></div>
          <div><div className="text-[10px] font-black text-amber-600 uppercase mb-1">رأي الأستاذ وملاحظاته:</div><p className="text-sm font-bold text-slate-800 leading-relaxed italic">"{submission.note}"</p></div>
        </div>
      )}
    </div>
  );
}

function TabBtn({ label, icon: Icon, active, onClick }: any) {
  return (<button onClick={onClick} className={`shrink-0 flex items-center gap-1.5 px-5 py-2.5 rounded-2xl text-[13px] font-black transition-all ${active ? "bg-primary text-white shadow-lg shadow-primary/20 scale-105" : "bg-white text-slate-500 hover:bg-slate-50 border border-slate-100"}`}><Icon className="h-4 w-4" /> {label}</button>);
}
function Field({ name, label, defaultValue, required = false }: any) {
  return (<div className="space-y-1.5"><label className="text-xs font-black text-slate-500 ms-1 uppercase">{label}</label><input name={name} defaultValue={defaultValue} required={required} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-bold focus:bg-white focus:border-primary outline-none transition-all" /></div>);
}
function InfoCard({ label, value }: { label: string; value: string }) {
  return (<div className="p-4 rounded-2xl bg-slate-50 border border-slate-100"><div className="text-[10px] font-black text-muted-foreground mb-1 uppercase">{label}</div><div className="font-black text-slate-800">{value}</div></div>);
}
function EmptyState({ icon: Icon, text }: { icon: any; text: string }) {
  return (<div className="bg-white p-12 rounded-[2.5rem] shadow-sm border border-dashed text-center"><Icon className="mx-auto h-12 w-12 text-muted/30 mb-3" /><p className="text-muted-foreground font-bold">{text}</p></div>);
}
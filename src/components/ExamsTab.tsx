import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Timer, Play, CheckCircle2, Sparkles, FileText, BarChart3, XCircle, ChevronDown, ChevronUp, Check, X, HelpCircle, Trash2, History } from "lucide-react";
import { getStudentExams, startExamAttempt, submitExamAttempt, getAttemptDetails, deleteExamAttemptPortal } from "@/lib/student.functions";

type Exam = {
  id: string; title: string; grade: string | null; term: string | null; group_id: string | null;
  subject: string | null; unit: string | null; lesson: string | null; duration_minutes: number;
  total_score: number; adaptive: boolean; status: string;
};
type Q = {
  id: string; position: number; kind: string; prompt: string; passage: string | null; options: any;
  skill: string | null; difficulty: string; score: number; rationale?: string | null; correct_answer?: any;
};
type Attempt = {
  id: string; exam_id: string; status: string; score: number; max_score: number; percentage: number;
  analysis: string | null; strengths: any; weaknesses: any; remedial_plan: string | null; attempt_no: number;
  submitted_at: string;
};

export function ExamsTab({ code }: { code: string }) {
  const [exams, setExams] = useState<Exam[]>([]);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [active, setActive] = useState<{ exam: Exam; questions: Q[]; attempt: Attempt } | null>(null);
  const [loading, setLoading] = useState(true);
  const listFn = useServerFn(getStudentExams);
  const startFn = useServerFn(startExamAttempt);
  const deleteAttemptFn = useServerFn(deleteExamAttemptPortal);

  async function load() {
    try {
      const d = await listFn({ code });
      setExams((d.exams as Exam[]) || []);
      setAttempts((d.attempts as Attempt[]) || []);
    } catch (e: any) { toast.error(e?.message || "تعذر تحميل الاختبارات"); }
    setLoading(false);
  }
  useEffect(() => { load(); }, [code]);

  async function start(exam: Exam) {
    try {
      const d = await startFn({ code, exam_id: exam.id });
      setActive({ exam: d.exam as Exam, questions: (d.questions as Q[]) || [], attempt: d.attempt as Attempt });
    } catch (e: any) { toast.error(e?.message || "تعذر بدء الاختبار"); }
  }

  async function handleDeleteAttempt(attemptId: string) {
    if (!confirm("هل تريد حذف سجل هذه المحاولة؟ لا يمكن استعادتها.")) return;
    try {
      await deleteAttemptFn({ code, attempt_id: attemptId });
      toast.success("تم حذف المحاولة بنجاح");
      load();
    } catch { toast.error("فشل حذف المحاولة"); }
  }

  if (loading) return <div className="p-12 text-center text-muted-foreground"><Loader2 className="mx-auto h-8 w-8 animate-spin mb-2" /> جاري تحميل الاختبارات...</div>;

  if (active) {
    return <Runner {...active} code={code} onDone={() => { setActive(null); load(); }} />;
  }

  return (
    <div className="space-y-4">
      <div className="bg-primary/5 border border-primary/10 p-4 rounded-2xl mb-6">
        <h3 className="font-black text-primary flex items-center gap-2 mb-1"><Sparkles className="h-5 w-5" /> مركز الاختبارات الذكية</h3>
        <p className="text-xs text-muted-foreground font-bold">هنا تظهر اختباراتك ونتائجك. يرجى العلم أنه غير مسموح بإعادة الاختبار بعد تسليمه.</p>
      </div>

      {exams.length === 0 && <div className="rounded-3xl border border-dashed bg-white p-12 text-center text-muted-foreground font-bold">لا توجد اختبارات منشورة حالياً</div>}
      
      {exams.map((e) => {
        const myAttempts = attempts.filter((a) => a.exam_id === e.id && a.status === "submitted");
        const hasSubmitted = myAttempts.length > 0;
        
        return (
          <div key={e.id} className="rounded-[2rem] border bg-white p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex-1">
                <div className="font-black text-lg text-slate-800">{e.title}</div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-[11px] font-bold text-muted-foreground">
                  <span className="bg-slate-100 px-2 py-0.5 rounded-lg">⏱️ {e.duration_minutes} دقيقة</span>
                  <span className="bg-slate-100 px-2 py-0.5 rounded-lg">🎯 {e.total_score} درجة</span>
                  {e.lesson && <span className="bg-primary/5 text-primary px-2 py-0.5 rounded-lg">📖 {e.lesson}</span>}
                </div>
              </div>
              
              {!hasSubmitted ? (
                <button onClick={() => start(e)} className="inline-flex items-center gap-2 rounded-2xl bg-primary px-8 py-3 text-sm font-black text-white shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 transition-all">
                  <Play className="h-4 w-4" /> ابدأ الاختبار الآن
                </button>
              ) : (
                <div className="inline-flex items-center gap-2 rounded-2xl bg-emerald-50 text-emerald-600 px-6 py-3 text-sm font-black border border-emerald-100">
                  <CheckCircle2 className="h-5 w-5" /> تم تسليم الإجابة
                </div>
              )}
            </div>
            
            {hasSubmitted && (
              <div className="mt-8 pt-6 border-t border-dashed">
                <div className="flex items-center gap-2 mb-4 text-sm font-black text-slate-500"><History className="h-4 w-4" /> نتيجتك النهائية:</div>
                <div className="space-y-6">
                  {myAttempts.map(att => (
                    <div key={att.id} className="relative group">
                      {/* زر الحذف تم إخفاؤه لضمان عدم إعادة المحاولة */}
                      <Result attempt={att} code={code} />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function Result({ attempt, code }: { attempt: Attempt; code: string }) {
  const [details, setDetails] = useState<{ questions: Q[]; answers: any[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const getDetailsFn = useServerFn(getAttemptDetails);

  async function loadReview() {
    if (details) { setShowReview(!showReview); return; }
    setLoading(true);
    try {
      // تصحيح: تمرير البيانات مباشرة دون تغليف إضافي
      const res = await getDetailsFn({ code, attempt_id: attempt.id });
      setDetails(res as any);
      setShowReview(true);
    } catch { toast.error("فشل تحميل مراجعة الأسئلة"); }
    finally { setLoading(false); }
  }

  const level = Number(attempt.percentage) >= 90 ? "ممتاز" : Number(attempt.percentage) >= 75 ? "جيد جداً" : Number(attempt.percentage) >= 50 ? "مقبول" : "ضعيف";
  const levelColor = Number(attempt.percentage) >= 90 ? "text-emerald-600 bg-emerald-50" : Number(attempt.percentage) >= 50 ? "text-primary bg-primary/5" : "text-destructive bg-destructive/5";

  return (
    <div className="space-y-4 animate-in slide-in-from-top-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-slate-50 p-4 rounded-2xl border text-center">
          <div className="text-[9px] font-black text-muted-foreground uppercase mb-1">الدرجة</div>
          <div className="text-lg font-black text-slate-800">{attempt.score} / {attempt.max_score}</div>
        </div>
        <div className="bg-slate-50 p-4 rounded-2xl border text-center">
          <div className="text-[9px] font-black text-muted-foreground uppercase mb-1">النسبة</div>
          <div className="text-lg font-black text-primary">{attempt.percentage}%</div>
        </div>
        <div className={`${levelColor} p-4 rounded-2xl border border-current/10 text-center`}>
          <div className="text-[9px] font-black opacity-60 uppercase mb-1">المستوى</div>
          <div className="text-lg font-black">{level}</div>
        </div>
        <div className="bg-slate-50 p-4 rounded-2xl border text-center">
          <div className="text-[9px] font-black text-muted-foreground uppercase mb-1">التاريخ</div>
          <div className="text-xs font-black text-slate-500 mt-2">{new Date(attempt.submitted_at).toLocaleDateString("ar-EG")}</div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border-2 border-primary/10 overflow-hidden">
        <div className="bg-primary/5 px-4 py-2 border-b flex items-center justify-between">
          <div className="flex items-center gap-2"><BarChart3 className="h-4 w-4 text-primary" /><span className="text-[10px] font-black text-primary">التقرير التحليلي (AI)</span></div>
          <button onClick={loadReview} className="text-[10px] font-black text-primary underline flex items-center gap-1">
            {loading && <Loader2 className="h-3 w-3 animate-spin" />}
            {showReview ? "إخفاء الإجابات" : "مراجعة إجاباتك"}
          </button>
        </div>
        <div className="p-4 space-y-4">
          {attempt.analysis && <p className="text-xs font-bold text-slate-700 leading-relaxed italic">"{attempt.analysis}"</p>}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Array.isArray(attempt.strengths) && (attempt.strengths as string[]).length > 0 && (
              <div className="space-y-1"><div className="text-[10px] font-black text-emerald-600">✅ نقاط القوة:</div><ul className="text-[11px] font-bold text-slate-600 list-disc list-inside">{(attempt.strengths as string[]).map((s, i) => <li key={i}>{s}</li>)}</ul></div>
            )}
            {Array.isArray(attempt.weaknesses) && (attempt.weaknesses as string[]).length > 0 && (
              <div className="space-y-1"><div className="text-[10px] font-black text-rose-600">⚠️ نقاط تحتاج تطوير:</div><ul className="text-[11px] font-bold text-slate-600 list-disc list-inside">{(attempt.weaknesses as string[]).map((w, i) => <li key={i}>{w}</li>)}</ul></div>
            )}
          </div>
        </div>
      </div>

      {showReview && details && (
        <div className="space-y-4 pt-2 animate-in fade-in duration-500">
          {details.questions.map((q) => {
            const studentAns = details.answers.find(a => a.question_id === q.id);
            const isCorrect = !!studentAns?.is_correct;
            return (
              <div key={q.id} className={`p-4 rounded-2xl border-2 ${isCorrect ? "border-emerald-100 bg-emerald-50/20" : "border-rose-100 bg-rose-50/20"}`}>
                <div className="font-bold text-slate-800 text-xs mb-3">{q.position}. {q.prompt}</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="bg-white p-2 rounded-lg border text-[11px]"><b>إجابتك:</b> <span className={isCorrect ? "text-emerald-600" : "text-rose-600"}>{studentAns?.answer || "(لم تجب)"}</span></div>
                  {!isCorrect && <div className="bg-white p-2 rounded-lg border text-[11px] border-emerald-200"><b>الصحيحة:</b> <span className="text-emerald-700">{String(q.correct_answer || "")}</span></div>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Runner({ exam, questions, attempt, code, onDone }:
  { exam: Exam; questions: Q[]; attempt: Attempt; code: string; onDone: () => void }) {
  const storeKey = `najm_exam_${attempt.id}`;
  const [answers, setAnswers] = useState<Record<string, string>>(() => {
    if (typeof window === "undefined") return {};
    try { return JSON.parse(localStorage.getItem(storeKey) || "{}"); } catch { return {}; }
  });
  const [left, setLeft] = useState(exam.duration_minutes * 60);
  const [submitting, setSubmitting] = useState(false);
  const startedAt = useRef(Date.now());
  const submitFn = useServerFn(submitExamAttempt);

  useEffect(() => { localStorage.setItem(storeKey, JSON.stringify(answers)); }, [answers, storeKey]);

  useEffect(() => {
    const t = setInterval(() => setLeft((s) => (s <= 1 ? 0 : s - 1)), 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => { if (left === 0) submit(); }, [left]);

  const visible = useMemo(() => {
    if (!exam.adaptive) return questions;
    const out: Q[] = [];
    for (const q of questions) {
      out.push(q);
      const a = answers[q.id];
      if (a == null || a === "") break;
    }
    return out;
  }, [questions, answers, exam.adaptive]);

  async function submit() {
    if (submitting) return;
    setSubmitting(true);
    const t = toast.loading("جاري تصحيح الاختبار وتحليل النتائج ذكياً...");
    try {
      const spent = Math.round((Date.now() - startedAt.current) / 1000);
      // تصحيح: تمرير البيانات مباشرة
      const res = await submitFn({ code, attempt_id: attempt.id, answers, time_spent_seconds: spent });
      localStorage.removeItem(storeKey);
      toast.success(`تم التصحيح والتحليل بنجاح بنسبة ${res.percentage}%`, { id: t });
      onDone();
    } catch (err: any) {
      toast.error(err?.message || "فشل إرسال الاختبار", { id: t });
      setSubmitting(false);
    } finally { toast.dismiss(t); }
  }

  const mm = String(Math.floor(left / 60)).padStart(2, "0");
  const ss = String(left % 60).padStart(2, "0");

  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      <div className="sticky top-16 z-20 flex items-center justify-between rounded-2xl border-2 border-primary/20 bg-white/90 backdrop-blur p-4 shadow-xl">
        <div className="font-black text-primary">{exam.title}</div>
        <div className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-black ${left < 60 ? "bg-destructive/10 text-destructive animate-pulse" : "bg-primary/10 text-primary"}`}>
          <Timer className="h-5 w-5" /> {mm}:{ss}
        </div>
      </div>

      <div className="space-y-6 pt-4 pb-20">
        {visible.map((q) => (
          <div key={q.id} className="rounded-[2rem] border-2 border-slate-100 bg-white p-6 shadow-sm transition-all hover:border-primary/20">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div className="font-black text-slate-800 leading-relaxed text-lg">{q.position}. {q.prompt}</div>
              <span className="shrink-0 rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black text-slate-500 uppercase">{q.score} درجة</span>
            </div>
            {q.passage && <div className="mb-4 rounded-2xl bg-slate-50 p-5 text-sm font-bold text-slate-600 leading-loose border border-slate-100">{q.passage}</div>}
            
            {Array.isArray(q.options) && q.options.length > 0 ? (
              <div className="grid grid-cols-1 gap-2">
                {q.options.map((o: string, i: number) => (
                  <label key={i} className={`flex cursor-pointer items-center gap-3 rounded-2xl border-2 p-4 text-sm font-bold transition-all ${answers[q.id] === o ? "border-primary bg-primary/5 text-primary shadow-sm" : "border-slate-50 hover:bg-slate-50"}`}>
                    <input type="radio" className="h-5 w-5 accent-primary" name={q.id} checked={answers[q.id] === o} onChange={() => setAnswers((a) => ({ ...a, [q.id]: o }))} />
                    {o}
                  </label>
                ))}
              </div>
            ) : (
              <textarea rows={q.kind.includes("مقال") || q.kind === "تعبير" ? 6 : 3}
                className="w-full rounded-2xl border-2 border-slate-100 bg-slate-50 p-4 text-sm font-bold outline-none focus:border-primary focus:bg-white transition-all"
                placeholder="اكتب إجابتك هنا بوضوح..."
                value={answers[q.id] || ""}
                onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))} />
            )}
            <div className="mt-4 text-[10px] font-black text-slate-400 flex items-center gap-1 uppercase tracking-widest"><FileText className="h-3 w-3" /> {q.kind}{q.skill ? ` · مهارة ${q.skill}` : ""}</div>
          </div>
        ))}
      </div>

      <div className="fixed bottom-6 left-6 right-6 max-w-3xl mx-auto">
        <button onClick={submit} disabled={submitting}
          className="w-full rounded-[1.5rem] bg-emerald-600 py-5 text-base font-black text-white shadow-2xl shadow-emerald-200 transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-60 disabled:scale-100">
          {submitting ? <span className="inline-flex items-center gap-2"><Loader2 className="h-5 w-5 animate-spin" /> جاري إرسال الاختبار...</span> : "إنهاء الاختبار وتسليم الإجابات"}
        </button>
      </div>
    </div>
  );
}
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

  async function load() {
    try {
      const res = await listFn({ data: { code } });
      setExams((res.exams as Exam[]) || []);
      setAttempts((res.attempts as Attempt[]) || []);
    } catch (e: any) { 
      toast.error(e?.message || "تعذر تحميل الاختبارات"); 
    }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [code]);

  async function start(exam: Exam) {
    try {
      const res = await startFn({ data: { code, exam_id: exam.id } });
      setActive({ exam: res.exam as Exam, questions: (res.questions as Q[]) || [], attempt: res.attempt as Attempt });
    } catch (e: any) { 
      toast.error(e?.message || "تعذر بدء الاختبار"); 
    }
  }

  if (loading) return <div className="p-12 text-center text-muted-foreground"><Loader2 className="mx-auto h-8 w-8 animate-spin mb-2" /> جاري تحميل الاختبارات...</div>;
  if (active) return <Runner {...active} code={code} onDone={() => { setActive(null); load(); }} />;

  return (
    <div className="space-y-4">
      {exams.length === 0 && <div className="rounded-3xl border border-dashed bg-white p-12 text-center text-muted-foreground font-bold">لا توجد اختبارات منشورة حالياً لصفك الدراسي</div>}
      {exams.map((e) => {
        const myAttempts = attempts.filter((a) => a.exam_id === e.id && a.status === "submitted");
        const hasSubmitted = myAttempts.length > 0;
        return (
          <div key={e.id} className="rounded-[2rem] border bg-white p-6 shadow-sm border-slate-100">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex-1">
                <div className="font-black text-lg text-slate-800">{e.title}</div>
                <div className="flex gap-3 mt-1 text-[11px] font-bold text-muted-foreground">
                  <span>⏱️ {e.duration_minutes} دقيقة</span>
                  <span>🎯 {e.total_score} درجة</span>
                  {e.subject && <span>📚 {e.subject}</span>}
                </div>
              </div>
              {!hasSubmitted ? (
                <button onClick={() => start(e)} className="rounded-2xl bg-primary px-8 py-3 text-sm font-black text-white shadow-lg shadow-primary/20 hover:scale-105 transition-all">ابدأ الاختبار الآن</button>
              ) : (
                <div className="rounded-2xl bg-emerald-50 text-emerald-600 px-6 py-3 text-sm font-black border border-emerald-100 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" /> تم التسليم
                </div>
              )}
            </div>
            {hasSubmitted && (
              <div className="mt-8 pt-6 border-t border-dashed space-y-6">
                {myAttempts.map(att => (
                  <Result key={att.id} attempt={att} code={code} />
                ))}
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
    if (details) { 
      setShowReview(!showReview); 
      return; 
    }
    setLoading(true);
    try {
      const res = await getDetailsFn({ data: { code, attempt_id: attempt.id } });
      setDetails(res as any);
      setShowReview(true);
    } catch (e: any) { 
      toast.error(e?.message || "فشل تحميل تفاصيل الإجابات"); 
    }
    finally { setLoading(false); }
  }

  return (
    <div className="space-y-4 animate-in fade-in">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-center">
          <div className="text-[9px] font-black text-muted-foreground uppercase mb-1">الدرجة النهائية</div>
          <div className="text-lg font-black text-slate-800">{attempt.score} / {attempt.max_score}</div>
        </div>
        <div className="bg-primary/5 p-4 rounded-2xl border border-primary/10 text-center">
          <div className="text-[9px] font-black text-primary uppercase mb-1">النسبة المئوية</div>
          <div className="text-lg font-black text-primary">{attempt.percentage}%</div>
        </div>
      </div>
      
      <div className="bg-white rounded-2xl border-2 border-slate-100 overflow-hidden">
        <div className="bg-slate-50 px-4 py-3 border-b flex items-center justify-between">
          <div className="flex items-center gap-2 text-[10px] font-black text-slate-600">
            <Sparkles className="h-3.5 w-3.5 text-gold" /> التحليل التعليمي الذكي
          </div>
          <button 
            onClick={loadReview} 
            disabled={loading}
            className="text-[10px] font-black text-primary hover:underline flex items-center gap-1"
          >
            {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : (showReview ? "إغلاق المراجعة" : "عرض الإجابات بالتفصيل")}
          </button>
        </div>
        <div className="p-4">
          <p className="text-xs font-bold leading-relaxed text-slate-700 italic">
            {attempt.analysis || "لا يوجد تحليل متاح لهذه المحاولة."}
          </p>
        </div>
      </div>

      {showReview && details && (
        <div className="space-y-4 pt-2 animate-in slide-in-from-top-2">
          <h4 className="text-xs font-black text-slate-400 px-2 uppercase">مراجعة الأسئلة:</h4>
          {details.questions.map((q) => {
            const studentAns = details.answers.find(a => a.question_id === q.id);
            const isCorrect = !!studentAns?.is_correct;
            return (
              <div key={q.id} className={`p-4 rounded-2xl border-2 transition-all ${isCorrect ? "border-emerald-100 bg-emerald-50/20" : "border-rose-100 bg-rose-50/20"}`}>
                <div className="font-bold text-xs mb-3 text-slate-800 leading-relaxed">{q.position}. {q.prompt}</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px]">
                  <div className="flex flex-wrap gap-1">
                    <b className="text-slate-500">إجابتك:</b> 
                    <span className={isCorrect ? "text-emerald-600 font-black" : "text-rose-600 font-black"}>
                      {studentAns?.answer || "(لم يتم الحل)"}
                    </span>
                  </div>
                  {!isCorrect && (
                    <div className="flex flex-wrap gap-1">
                      <b className="text-slate-500">الإجابة الصحيحة:</b> 
                      <span className="text-emerald-700 font-black">{String(q.correct_answer || "")}</span>
                    </div>
                  )}
                </div>
                {q.rationale && (
                  <div className="mt-3 pt-2 border-t border-slate-100 text-[10px] text-slate-500 font-medium italic">
                    💡 توضيح: {q.rationale}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Runner({ exam, questions, attempt, code, onDone }: { exam: Exam; questions: Q[]; attempt: Attempt; code: string; onDone: () => void }) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [left, setLeft] = useState(exam.duration_minutes * 60);
  const [submitting, setSubmitting] = useState(false);
  const startedAt = useRef(Date.now());
  const submitFn = useServerFn(submitExamAttempt);

  useEffect(() => {
    const t = setInterval(() => setLeft((s) => (s <= 1 ? 0 : s - 1)), 1000);
    return () => clearInterval(t);
  }, []);
  
  useEffect(() => { 
    if (left === 0 && !submitting) submit(); 
  }, [left]);

  async function submit() {
    if (submitting) return;
    setSubmitting(true);
    const t = toast.loading("جاري تصحيح الاختبار وتحليل الإجابات...");
    try {
      const spent = Math.round((Date.now() - startedAt.current) / 1000);
      await submitFn({ data: { code, attempt_id: attempt.id, answers, time_spent_seconds: spent } });
      toast.success("تم تسليم الاختبار بنجاح، شاهد نتيجتك الآن", { id: t });
      onDone();
    } catch (err: any) { 
      toast.error(err?.message || "فشل تسليم الاختبار", { id: t }); 
      setSubmitting(false); 
    }
  }

  const mm = String(Math.floor(left / 60)).padStart(2, "0");
  const ss = String(left % 60).padStart(2, "0");

  return (
    <div className="space-y-4 max-w-3xl mx-auto pb-20 animate-in fade-in">
      <div className="sticky top-16 z-20 flex items-center justify-between rounded-2xl border-2 border-primary/20 bg-white/95 backdrop-blur p-4 shadow-xl">
        <div className="font-black text-primary flex items-center gap-2">
          <FileText className="h-5 w-5" /> {exam.title}
        </div>
        <div className={`font-black text-sm px-4 py-1.5 rounded-full ${left < 60 ? "bg-rose-100 text-rose-600 animate-pulse" : "bg-slate-100 text-slate-700"}`}>
          <Timer className="inline h-4 w-4 mb-0.5 me-1" /> {mm}:{ss}
        </div>
      </div>
      
      <div className="space-y-6 mt-6">
        {questions.map((q) => (
          <div key={q.id} className="rounded-[2rem] border-2 border-slate-100 bg-white p-6 shadow-sm">
            <div className="mb-4 font-black leading-relaxed text-slate-800">{q.position}. {q.prompt}</div>
            
            {q.passage && (
              <div className="mb-4 p-4 bg-slate-50 rounded-2xl border border-slate-100 text-sm font-bold text-slate-600 leading-loose italic">
                {q.passage}
              </div>
            )}

            {Array.isArray(q.options) && q.options.length > 0 ? (
              <div className="grid gap-3">
                {q.options.map((o: string, i: number) => (
                  <label key={i} className={`flex cursor-pointer items-center gap-3 rounded-2xl border-2 p-4 text-sm font-bold transition-all hover:bg-slate-50 ${answers[q.id] === o ? "border-primary bg-primary/5 text-primary shadow-sm" : "border-slate-100"}`}>
                    <input type="radio" className="hidden" name={q.id} checked={answers[q.id] === o} onChange={() => setAnswers((a) => ({ ...a, [q.id]: o }))} />
                    <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center transition-all ${answers[q.id] === o ? "border-primary bg-primary" : "border-slate-300"}`}>
                      {answers[q.id] === o && <div className="h-2 w-2 rounded-full bg-white" />}
                    </div>
                    {o}
                  </label>
                ))}
              </div>
            ) : (
              <textarea 
                className="w-full rounded-2xl border-2 border-slate-100 p-4 text-sm font-bold outline-none focus:border-primary focus:bg-white transition-all bg-slate-50" 
                placeholder="اكتب إجابتك هنا..."
                rows={3}
                value={answers[q.id] || ""} 
                onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))} 
              />
            )}
          </div>
        ))}
      </div>
      
      <div className="fixed bottom-6 left-6 right-6 max-w-3xl mx-auto z-40">
        <button 
          onClick={submit} 
          disabled={submitting} 
          className="w-full rounded-3xl bg-emerald-600 py-4 text-base font-black text-white shadow-2xl shadow-emerald-200 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2"
        >
          {submitting ? <Loader2 className="h-6 w-6 animate-spin" /> : <CheckCircle2 className="h-6 w-6" />}
          إنهاء وتسليم الإجابات للتصحيح
        </button>
      </div>
    </div>
  );
}
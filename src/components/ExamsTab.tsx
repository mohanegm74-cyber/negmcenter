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
      const d = await listFn({ data: { code } });
      setExams((d.exams as Exam[]) || []);
      setAttempts((d.attempts as Attempt[]) || []);
    } catch (e: any) { toast.error(e?.message || "تعذر تحميل الاختبارات"); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [code]);

  async function start(exam: Exam) {
    try {
      const d = await startFn({ data: { code, exam_id: exam.id } });
      setActive({ exam: d.exam as Exam, questions: (d.questions as Q[]) || [], attempt: d.attempt as Attempt });
    } catch (e: any) { toast.error(e?.message || "تعذر بدء الاختبار"); }
  }

  if (loading) return <div className="p-12 text-center text-muted-foreground"><Loader2 className="mx-auto h-8 w-8 animate-spin mb-2" /> جاري تحميل الاختبارات...</div>;
  if (active) return <Runner {...active} code={code} onDone={() => { setActive(null); load(); }} />;

  return (
    <div className="space-y-4">
      {exams.length === 0 && <div className="rounded-3xl border border-dashed bg-white p-12 text-center text-muted-foreground font-bold">لا توجد اختبارات منشورة حالياً</div>}
      {exams.map((e) => {
        const myAttempts = attempts.filter((a) => a.exam_id === e.id && a.status === "submitted");
        const hasSubmitted = myAttempts.length > 0;
        return (
          <div key={e.id} className="rounded-[2rem] border bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex-1">
                <div className="font-black text-lg text-slate-800">{e.title}</div>
                <div className="flex gap-3 mt-1 text-[11px] font-bold text-muted-foreground">
                  <span>⏱️ {e.duration_minutes} دقيقة</span>
                  <span>🎯 {e.total_score} درجة</span>
                </div>
              </div>
              {!hasSubmitted ? (
                <button onClick={() => start(e)} className="rounded-2xl bg-primary px-8 py-3 text-sm font-black text-white shadow-lg">ابدأ الاختبار الآن</button>
              ) : (
                <div className="rounded-2xl bg-emerald-50 text-emerald-600 px-6 py-3 text-sm font-black border">✓ تم التسليم</div>
              )}
            </div>
            {hasSubmitted && <div className="mt-8 pt-6 border-t border-dashed space-y-6">{myAttempts.map(att => (<Result key={att.id} attempt={att} code={code} />))}</div>}
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
      const res = await getDetailsFn({ data: { code, attempt_id: attempt.id } });
      setDetails(res as any);
      setShowReview(true);
    } catch { toast.error("فشل التحميل"); }
    finally { setLoading(false); }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-slate-50 p-4 rounded-2xl border text-center">
          <div className="text-[9px] font-black text-muted-foreground">الدرجة</div>
          <div className="text-lg font-black">{attempt.score} / {attempt.max_score}</div>
        </div>
        <div className="bg-slate-50 p-4 rounded-2xl border text-center">
          <div className="text-[9px] font-black text-muted-foreground">النسبة</div>
          <div className="text-lg font-black text-primary">{attempt.percentage}%</div>
        </div>
      </div>
      <div className="bg-white rounded-2xl border-2 overflow-hidden">
        <div className="bg-primary/5 px-4 py-2 border-b flex items-center justify-between">
          <div className="text-[10px] font-black text-primary">التحليل الذكي</div>
          <button onClick={loadReview} className="text-[10px] font-black underline">{loading ? "جاري..." : (showReview ? "إخفاء" : "مراجعة الإجابات")}</button>
        </div>
        <div className="p-4"><p className="text-xs font-bold leading-relaxed italic">"{attempt.analysis}"</p></div>
      </div>
      {showReview && details && (
        <div className="space-y-4 pt-2">
          {details.questions.map((q) => {
            const studentAns = details.answers.find(a => a.question_id === q.id);
            const isCorrect = !!studentAns?.is_correct;
            return (
              <div key={q.id} className={`p-4 rounded-2xl border-2 ${isCorrect ? "border-emerald-100 bg-emerald-50/20" : "border-rose-100 bg-rose-50/20"}`}>
                <div className="font-bold text-xs mb-3">{q.position}. {q.prompt}</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px]">
                  <div><b>إجابتك:</b> <span className={isCorrect ? "text-emerald-600" : "text-rose-600"}>{studentAns?.answer || "(فارغ)"}</span></div>
                  {!isCorrect && <div><b>الصحيحة:</b> <span className="text-emerald-700">{String(q.correct_answer || "")}</span></div>}
                </div>
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
  useEffect(() => { if (left === 0) submit(); }, [left]);

  async function submit() {
    if (submitting) return;
    setSubmitting(true);
    const t = toast.loading("جاري التصحيح...");
    try {
      const spent = Math.round((Date.now() - startedAt.current) / 1000);
      await submitFn({ data: { code, attempt_id: attempt.id, answers, time_spent_seconds: spent } });
      toast.success("تم بنجاح", { id: t });
      onDone();
    } catch (err: any) { toast.error(err?.message, { id: t }); setSubmitting(false); }
  }

  const mm = String(Math.floor(left / 60)).padStart(2, "0");
  const ss = String(left % 60).padStart(2, "0");

  return (
    <div className="space-y-4 max-w-3xl mx-auto pb-20">
      <div className="sticky top-16 z-20 flex items-center justify-between rounded-2xl border-2 bg-white/90 backdrop-blur p-4 shadow-xl">
        <div className="font-black text-primary">{exam.title}</div>
        <div className="font-black text-sm"><Timer className="inline h-4 w-4 mb-1" /> {mm}:{ss}</div>
      </div>
      <div className="space-y-6">
        {questions.map((q) => (
          <div key={q.id} className="rounded-[2rem] border-2 bg-white p-6 shadow-sm">
            <div className="mb-4 font-black leading-relaxed">{q.position}. {q.prompt}</div>
            {Array.isArray(q.options) && q.options.length > 0 ? (
              <div className="grid gap-2">
                {q.options.map((o: string, i: number) => (
                  <label key={i} className={`flex cursor-pointer items-center gap-3 rounded-2xl border-2 p-4 text-sm font-bold transition-all ${answers[q.id] === o ? "border-primary bg-primary/5 text-primary" : "border-slate-50"}`}>
                    <input type="radio" className="hidden" name={q.id} checked={answers[q.id] === o} onChange={() => setAnswers((a) => ({ ...a, [q.id]: o }))} />
                    {o}
                  </label>
                ))}
              </div>
            ) : (
              <textarea className="w-full rounded-2xl border p-4 text-sm font-bold outline-none" value={answers[q.id] || ""} onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))} />
            )}
          </div>
        ))}
      </div>
      <div className="fixed bottom-6 left-6 right-6 max-w-3xl mx-auto">
        <button onClick={submit} disabled={submitting} className="w-full rounded-3xl bg-emerald-600 py-4 text-base font-black text-white shadow-2xl">إنهاء وتسليم الإجابات</button>
      </div>
    </div>
  );
}
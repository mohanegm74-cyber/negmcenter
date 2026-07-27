import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Timer, Play, CheckCircle2, Sparkles } from "lucide-react";
import { getStudentExams, startExamAttempt, submitExamAttempt } from "@/lib/student.functions";

type Exam = {
  id: string; title: string; grade: string | null; term: string | null; group_id: string | null;
  subject: string | null; unit: string | null; lesson: string | null; duration_minutes: number;
  total_score: number; adaptive: boolean; status: string;
};
type Q = {
  id: string; position: number; kind: string; prompt: string; passage: string | null; options: any;
  skill: string | null; difficulty: string; score: number;
};
type Attempt = {
  id: string; exam_id: string; status: string; score: number; max_score: number; percentage: number;
  analysis: string | null; strengths: any; weaknesses: any; remedial_plan: string | null; attempt_no: number;
};

const DIFF_ORDER = ["easy", "medium", "hard"];

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
    setLoading(false);
  }
  useEffect(() => { load(); }, [code]);

  async function start(exam: Exam) {
    try {
      const d = await startFn({ data: { code, exam_id: exam.id } });
      setActive({ exam: d.exam as Exam, questions: (d.questions as Q[]) || [], attempt: d.attempt as Attempt });
    } catch (e: any) { toast.error(e?.message || "تعذر بدء الاختبار"); }
  }

  if (loading) return <div className="p-6 text-center text-muted-foreground">جاري التحميل…</div>;

  if (active) {
    return <Runner {...active} code={code} onDone={() => { setActive(null); load(); }} />;
  }

  return (
    <div className="space-y-4">
      {exams.length === 0 && <div className="rounded-2xl border bg-white p-6 text-center text-muted-foreground">لا توجد اختبارات متاحة حالياً</div>}
      {exams.map((e) => {
        const mine = attempts.filter((a) => a.exam_id === e.id && a.status === "submitted")
          .sort((a, b) => Number(b.percentage) - Number(a.percentage));
        const best = mine[0];
        return (
          <div key={e.id} className="rounded-2xl border bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="font-black">{e.title}</div>
                <div className="text-xs text-muted-foreground">
                  {e.term || ""} — {e.unit ? `الوحدة: ${e.unit} — ` : ""}الدرس: {e.lesson || "—"} · الزمن {e.duration_minutes} دقيقة · الدرجة {e.total_score}
                </div>
              </div>
              <button onClick={() => start(e)} className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground">
                <Play className="h-4 w-4" /> {best ? "إعادة المحاولة" : "بدء الاختبار"}
              </button>
            </div>
            {best && <Result attempt={best} />}
          </div>
        );
      })}
    </div>
  );
}

function Result({ attempt }: { attempt: Attempt }) {
  return (
    <div className="mt-3 space-y-2 rounded-xl bg-muted/40 p-3 text-sm">
      <div className="flex items-center gap-2 font-bold text-emerald-700">
        <CheckCircle2 className="h-4 w-4" /> نتيجتك: {Number(attempt.score)} من {Number(attempt.max_score)} ({Number(attempt.percentage)}%)
      </div>
      {attempt.analysis && <p className="whitespace-pre-wrap leading-7">{attempt.analysis}</p>}
      {Array.isArray(attempt.strengths) && attempt.strengths.length > 0 && (
        <div><b className="text-emerald-700">نقاط القوة:</b> {(attempt.strengths as string[]).join("، ")}</div>
      )}
      {Array.isArray(attempt.weaknesses) && attempt.weaknesses.length > 0 && (
        <div><b className="text-destructive">نقاط الضعف:</b> {(attempt.weaknesses as string[]).join("، ")}</div>
      )}
      {attempt.remedial_plan && (
        <div className="rounded-lg bg-white p-2"><b className="flex items-center gap-1 text-primary"><Sparkles className="h-3.5 w-3.5" /> الخطة العلاجية:</b>
          <p className="mt-1 whitespace-pre-wrap leading-7">{attempt.remedial_plan}</p></div>
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
  useEffect(() => { if (left === 0) submit(); /* eslint-disable-next-line */ }, [left]);

  // التكيّف الذكي: إظهار الأسئلة تدريجياً حسب تقدّم الطالب
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
    const t = toast.loading("جاري تصحيح الاختبار…");
    try {
      const spent = Math.round((Date.now() - startedAt.current) / 1000);
      const res = await submitFn({ data: { code, attempt_id: attempt.id, answers, time_spent_seconds: spent } });
      localStorage.removeItem(storeKey);
      toast.success(`تم التصحيح: ${res.total} من ${res.max} (${res.percentage}%)`, { id: t });
      onDone();
    } catch (err: any) {
      toast.error(err?.message || "فشل إرسال الاختبار", { id: t });
      setSubmitting(false);
    } finally { toast.dismiss(t); }
  }

  const mm = String(Math.floor(left / 60)).padStart(2, "0");
  const ss = String(left % 60).padStart(2, "0");

  return (
    <div className="space-y-4">
      <div className="sticky top-0 z-10 flex items-center justify-between rounded-xl border bg-white p-3 shadow-sm">
        <div className="font-black">{exam.title}</div>
        <div className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1 text-sm font-black ${left < 60 ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"}`}>
          <Timer className="h-4 w-4" /> {mm}:{ss}
        </div>
      </div>

      {visible.map((q) => (
        <div key={q.id} className="rounded-2xl border bg-white p-4 shadow-sm">
          <div className="mb-2 flex items-start justify-between gap-2">
            <div className="font-bold">{q.position}. {q.prompt}</div>
            <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px]">{q.score} درجة</span>
          </div>
          {q.passage && <div className="mb-2 rounded-lg bg-muted/50 p-3 text-sm leading-7">{q.passage}</div>}
          {Array.isArray(q.options) && (q.options as string[]).length > 0 ? (
            <div className="grid gap-2">
              {(q.options as string[]).map((o, i) => (
                <label key={i} className={`flex cursor-pointer items-center gap-2 rounded-lg border p-2 text-sm ${answers[q.id] === o ? "border-primary bg-primary/5" : ""}`}>
                  <input type="radio" name={q.id} checked={answers[q.id] === o} onChange={() => setAnswers((a) => ({ ...a, [q.id]: o }))} />
                  {o}
                </label>
              ))}
            </div>
          ) : (
            <textarea rows={q.kind.includes("مقال") || q.kind === "تعبير" ? 6 : 3}
              className="w-full rounded-lg border border-input p-2 text-sm"
              placeholder="اكتب إجابتك هنا…"
              value={answers[q.id] || ""}
              onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))} />
          )}
          <div className="mt-1 text-[11px] text-muted-foreground">{q.kind}{q.skill ? ` · ${q.skill}` : ""}</div>
        </div>
      ))}

      <button onClick={submit} disabled={submitting}
        className="w-full rounded-xl bg-emerald-600 py-3 text-sm font-black text-white disabled:opacity-60">
        {submitting ? <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> جاري التصحيح…</span> : "إنهاء الاختبار وإرسال"}
      </button>
      <p className="text-center text-xs text-muted-foreground">يتم حفظ إجاباتك تلقائياً على جهازك حتى لو انقطع الإنترنت.</p>
    </div>
  );
}

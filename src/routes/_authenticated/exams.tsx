import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { Sparkles, Trash2, Send, BarChart3, X, Loader2, FileQuestion, Printer, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { generateExam } from "@/lib/exams.functions";
import { updateExamStatusAdmin, getExamsDataAdmin } from "@/lib/admin.functions";
import { QUESTION_KINDS, DIFFICULTIES, TERMS, GRADES, answerToText } from "@/lib/exam-constants";
import { openPrint, esc } from "@/lib/print";

export const Route = createFileRoute("/_authenticated/exams")({
  head: () => ({
    meta: [
      { title: "الاختبارات الإلكترونية الذكية — الأستاذ" },
      { name: "description", content: "إنشاء اختبارات بالذكاء الاصطناعي وتحليل نتائج الطلاب." },
    ],
  }),
  component: ExamsPage,
});

type Group = { id: string; name: string; grade: string | null; subject: string | null };
type Exam = {
  id: string; title: string; grade: string | null; term: string | null; group_id: string | null;
  subject: string | null; unit: string | null; lesson: string | null; question_count: number;
  duration_minutes: number; total_score: number; difficulty: string; question_types: string[];
  adaptive: boolean; status: string; sources: any; created_at: string;
};
type Q = {
  id: string; exam_id: string; position: number; kind: string; prompt: string; passage: string | null;
  options: any; correct_answer: any; rationale: string | null; distractor_explanations: any;
  skill: string | null; learning_outcome: string | null; difficulty: string; expected_seconds: number; score: number;
};
type Attempt = {
  id: string; exam_id: string; student_id: string; status: string; score: number; max_score: number;
  percentage: number; time_spent_seconds: number; attempt_no: number; submitted_at: string | null; started_at: string;
};
type Answer = { id: string; attempt_id: string; question_id: string; is_correct: boolean | null };
type Student = { id: string; full_name: string; code: string; group_id: string | null; grade: string | null };

function ExamsPage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [allAttempts, setAllAttempts] = useState<Attempt[]>([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<Exam | null>(null);
  
  const gen = useServerFn(generateExam);
  const updateStatusFn = useServerFn(updateExamStatusAdmin);
  const loadFn = useServerFn(getExamsDataAdmin);

  const [form, setForm] = useState({
    grade: GRADES[0], term: TERMS[0], group_id: "", subject: "", lesson: "",
    question_count: 10, duration_minutes: 20, total_score: 100, difficulty: "medium", adaptive: false,
  });
  const [kinds, setKinds] = useState<string[]>(["اختيار من متعدد", "صح أو خطأ", "أكمل"]);

  async function load() {
    setLoading(true);
    try {
      const res = await loadFn({});
      setGroups(res.groups as Group[]);
      setStudents(res.students as Student[]);
      setExams(res.exams as Exam[]);
      setAllAttempts(res.attempts as Attempt[]);
    } catch (e: any) {
      toast.error("فشل تحميل بيانات الاختبارات");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  function toggleKind(k: string) {
    setKinds((prev) => (prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k]));
  }

  async function create() {
    if (!form.grade.trim() || !form.lesson.trim()) { toast.error("أدخل الصف والدرس على الأقل"); return; }
    if (kinds.length === 0) { toast.error("اختر نوع أسئلة واحداً على الأقل"); return; }
    setBusy(true);
    const t = toast.loading("جاري بناء الاختبار بالذكاء الاصطناعي…");
    try {
      const res = await gen({
        data: {
          grade: form.grade, term: form.term, subject: form.subject || "—",
          unit: "—", lesson: form.lesson,
          questionCount: Number(form.question_count), totalScore: Number(form.total_score),
          difficulty: form.difficulty, kinds,
        },
      });
      const title = `${form.subject || "اختبار"} — ${form.lesson} (${form.grade})`;
      const { data: exam, error } = await supabase.from("exams").insert({
        title, grade: form.grade, term: form.term, group_id: form.group_id || null,
        subject: form.subject || null, unit: null, lesson: form.lesson,
        question_count: res.questions.length, duration_minutes: Number(form.duration_minutes),
        total_score: Number(form.total_score), difficulty: form.difficulty,
        question_types: kinds, adaptive: form.adaptive, status: "draft", sources: res.sources,
      }).select().single();
      if (error) throw error;

      const rows = res.questions.map((q, i) => ({
        exam_id: exam.id, position: i + 1, kind: q.kind || "اختيار من متعدد",
        prompt: q.prompt, passage: q.passage || null,
        options: q.options || [], correct_answer: q.correct_answer ?? null,
        rationale: q.rationale || null, distractor_explanations: q.distractor_explanations || [],
        skill: q.skill || null, learning_outcome: q.learning_outcome || null,
        difficulty: q.difficulty || form.difficulty, expected_seconds: q.expected_seconds || 60,
        score: Number(q.score) || Number(form.total_score) / res.questions.length,
      }));
      const { error: qe } = await supabase.from("exam_questions").insert(rows);
      if (qe) throw qe;
      toast.success(`تم إنشاء الاختبار (${rows.length} سؤالاً)`, { id: t });
      load();
    } catch (err: any) {
      toast.error(err?.message || "فشل إنشاء الاختبار", { id: t });
    } finally { setBusy(false); toast.dismiss(t); }
  }

  async function createManual() {
    if (!form.lesson.trim()) { toast.error("أدخل اسم الدرس"); return; }
    const title = `${form.subject || "اختبار"} — ${form.lesson} (${form.grade})`;
    const { data: exam, error } = await supabase.from("exams").insert({
      title, grade: form.grade, term: form.term, group_id: form.group_id || null,
      subject: form.subject || null, unit: null, lesson: form.lesson,
      question_count: 0, duration_minutes: Number(form.duration_minutes),
      total_score: Number(form.total_score), difficulty: form.difficulty,
      question_types: kinds, adaptive: form.adaptive, status: "draft", sources: [],
    }).select().single();
    if (error) return toast.error(error.message);
    toast.success("تم إنشاء اختبار يدوي — أضف الأسئلة من «بنك الأسئلة»");
    await load();
    setDetail(exam as Exam);
  }

  async function setStatus(ex: Exam, status: string) {
    try {
      await updateStatusFn({ data: { id: ex.id, status } });
      toast.success(status === "published" ? "تم نشر الاختبار للطلاب" : status === "closed" ? "تم إغلاق الاختبار" : "تم الحفظ كمسودة");
      load();
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  async function remove(ex: Exam) {
    if (!confirm(`حذف الاختبار «${ex.title}» وكل نتائجه؟`)) return;
    const { error } = await supabase.from("exams").delete().eq("id", ex.id);
    if (error) return toast.error(error.message);
    toast.success("تم الحذف"); load();
  }

  if (loading) return <div className="flex h-64 items-center justify-center text-muted-foreground"><Loader2 className="h-8 w-8 animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <FileQuestion className="h-6 w-6 text-primary" />
        <h1 className="text-xl font-black">الاختبارات الإلكترونية الذكية</h1>
      </div>

      <section className="rounded-2xl border bg-white p-5 shadow-sm">
        <h2 className="mb-4 flex items-center gap-2 text-sm font-black text-primary"><Sparkles className="h-4 w-4" /> إنشاء اختبار جديد بالذكاء الاصطناعي</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="الصف">
            <select className={inp} value={form.grade} onChange={(e) => setForm({ ...form, grade: e.target.value })}>
              {GRADES.map((g) => <option key={g}>{g}</option>)}
            </select>
          </Field>
          <Field label="الفصل الدراسي">
            <select className={inp} value={form.term} onChange={(e) => setForm({ ...form, term: e.target.value })}>
              {TERMS.map((t) => <option key={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="المجموعة">
            <select className={inp} value={form.group_id} onChange={(e) => setForm({ ...form, group_id: e.target.value })}>
              <option value="">كل المجموعات</option>
              {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </Field>
          <Field label="المادة"><input className={inp} value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="اللغة العربية" /></Field>
          <Field label="الدرس"><input className={inp} value={form.lesson} onChange={(e) => setForm({ ...form, lesson: e.target.value })} /></Field>
          <Field label="عدد الأسئلة"><input type="number" min={1} max={40} className={inp} value={form.question_count} onChange={(e) => setForm({ ...form, question_count: +e.target.value })} /></Field>
          <Field label="زمن الاختبار (دقيقة)"><input type="number" min={1} className={inp} value={form.duration_minutes} onChange={(e) => setForm({ ...form, duration_minutes: +e.target.value })} /></Field>
          <Field label="درجة الاختبار"><input type="number" min={1} className={inp} value={form.total_score} onChange={(e) => setForm({ ...form, total_score: +e.target.value })} /></Field>
          <Field label="مستوى الصعوبة">
            <select className={inp} value={form.difficulty} onChange={(e) => setForm({ ...form, difficulty: e.target.value })}>
              {DIFFICULTIES.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
            </select>
          </Field>
          <label className="mt-6 inline-flex items-center gap-2 text-sm font-semibold">
            <input type="checkbox" checked={form.adaptive} onChange={(e) => setForm({ ...form, adaptive: e.target.checked })} className="h-4 w-4" />
            اختبار تكيّفي (تدرّج الصعوبة)
          </label>
        </div>

        <div className="mt-4">
          <div className="mb-2 text-xs font-bold text-muted-foreground">أنواع الأسئلة</div>
          <div className="flex flex-wrap gap-1.5">
            {QUESTION_KINDS.map((k) => (
              <button key={k} type="button" onClick={() => toggleKind(k)}
                className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${kinds.includes(k) ? "border-primary bg-primary text-primary-foreground" : "hover:bg-accent"}`}>
                {k}
              </button>
            ))}
          </div>
        </div>

        <button onClick={create} disabled={busy}
          className="mt-5 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-black text-primary-foreground shadow disabled:opacity-60">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} بناء الاختبار بالذكاء الاصطناعي
        </button>
        <button onClick={createManual} disabled={busy}
          className="mt-5 mr-2 inline-flex items-center gap-2 rounded-xl border border-primary px-5 py-2.5 text-sm font-black text-primary disabled:opacity-60">
          <Plus className="h-4 w-4" /> إنشاء اختبار يدوي
        </button>
      </section>

      <section className="rounded-2xl border bg-white shadow-sm">
        <div className="border-b px-5 py-3 text-sm font-black">الاختبارات ({exams.length})</div>
        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead className="bg-muted/50 text-xs text-muted-foreground">
              <tr>
                <th className="p-3">الاختبار</th><th className="p-3">الصف</th><th className="p-3">المجموعة</th>
                <th className="p-3">الأسئلة</th><th className="p-3">الزمن</th><th className="p-3">الدرجة</th>
                <th className="p-3">الحالة</th><th className="p-3">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {exams.length === 0 && <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">لا توجد اختبارات بعد</td></tr>}
              {exams.map((ex) => (
                <tr key={ex.id} className="border-t">
                  <td className="p-3 font-bold">{ex.title}</td>
                  <td className="p-3">{ex.grade || "—"}</td>
                  <td className="p-3">{groups.find((g) => g.id === ex.group_id)?.name || "الكل"}</td>
                  <td className="p-3">{ex.question_count}</td>
                  <td className="p-3">{ex.duration_minutes} د</td>
                  <td className="p-3">{ex.total_score}</td>
                  <td className="p-3">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${ex.status === "published" ? "bg-emerald-100 text-emerald-700" : ex.status === "closed" ? "bg-slate-200 text-slate-700" : "bg-amber-100 text-amber-700"}`}>
                      {ex.status === "published" ? "منشور" : ex.status === "closed" ? "مغلق" : "مسودة"}
                    </span>
                  </td>
                  <td className="p-3">
                    <div className="flex flex-wrap gap-1.5">
                      {ex.status !== "published" && <button onClick={() => setStatus(ex, "published")} className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-bold text-white"><Send className="h-3 w-3" /> نشر</button>}
                      {ex.status === "published" && <button onClick={() => setStatus(ex, "closed")} className="rounded-lg bg-slate-600 px-2.5 py-1 text-xs font-bold text-white">إغلاق</button>}
                      <button onClick={() => setDetail(ex)} className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-bold"><BarChart3 className="h-3 w-3" /> النتائج والتحليل</button>
                      <button onClick={() => remove(ex)} className="rounded-lg bg-destructive/10 px-2 py-1 text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {detail && <ExamDetail exam={detail} students={students} onClose={() => setDetail(null)} />}
    </div>
  );
}

const inp = "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm";
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1 block text-xs font-bold text-muted-foreground">{label}</span>{children}</label>;
}

function ExamDetail({ exam, students, onClose }: { exam: Exam; students: Student[]; onClose: () => void }) {
  const [questions, setQuestions] = useState<Q[]>([]);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [view, setView] = useState<"students" | "questions" | "bank">("students");

  useEffect(() => {
    (async () => {
      const [q, a] = await Promise.all([
        supabase.from("exam_questions").select("*").eq("exam_id", exam.id).order("position"),
        supabase.from("exam_attempts").select("*").eq("exam_id", exam.id),
      ]);
      setQuestions((q.data as Q[]) || []);
      const at = (a.data as Attempt[]) || [];
      setAttempts(at);
      if (at.length) {
        const { data: ans } = await supabase.from("exam_answers").select("id,attempt_id,question_id,is_correct").in("attempt_id", at.map((x) => x.id));
        setAnswers((ans as Answer[]) || []);
      }
    })();
  }, [exam.id]);

  async function reloadQuestions() {
    const { data } = await supabase.from("exam_questions").select("*").eq("exam_id", exam.id).order("position");
    const list = (data as Q[]) || [];
    setQuestions(list);
    await supabase.from("exams").update({ question_count: list.length }).eq("id", exam.id);
  }
  async function removeQuestion(id: string) {
    if (!confirm("حذف هذا السؤال؟")) return;
    const { error } = await supabase.from("exam_questions").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("تم حذف السؤال");
    reloadQuestions();
  }

  const eligible = useMemo(
    () => students.filter((s) => (exam.group_id ? s.group_id === exam.group_id : exam.grade ? s.grade === exam.grade : true)),
    [students, exam],
  );
  const done = attempts.filter((a) => a.status === "submitted");
  const avg = done.length ? Math.round(done.reduce((s, a) => s + Number(a.percentage), 0) / done.length) : 0;

  const qStats = questions.map((q) => {
    const rel = answers.filter((a) => a.question_id === q.id);
    const correct = rel.filter((a) => a.is_correct).length;
    const p = rel.length ? correct / rel.length : 0;
    // معامل التمييز: فرق نسبة النجاح بين أعلى 27% وأدنى 27% من الطلاب
    const sorted = [...done].sort((a, b) => Number(b.percentage) - Number(a.percentage));
    const n = Math.max(1, Math.round(sorted.length * 0.27));
    const top = sorted.slice(0, n), low = sorted.slice(-n);
    const rate = (grp: Attempt[]) => {
      const ids = grp.map((g) => g.id);
      const rr = answers.filter((a) => a.question_id === q.id && ids.includes(a.attempt_id));
      return rr.length ? rr.filter((a) => a.is_correct).length / rr.length : 0;
    };
    const d = sorted.length >= 2 ? rate(top) - rate(low) : 0;
    return { q, answered: rel.length, correct, ease: Math.round(p * 100), disc: Math.round(d * 100) };
  });
  const hardest = [...qStats].filter((s) => s.answered > 0).sort((a, b) => a.ease - b.ease)[0];

  function printBank() {
    const html = `<h1 style="text-align:center">${esc(exam.title)}</h1>
      <p style="text-align:center">الزمن: ${exam.duration_minutes} دقيقة — الدرجة: ${exam.total_score}</p>
      <ol>${questions.map((q) => `<li style="margin-bottom:10px"><b>${esc(q.prompt)}</b> <span style="color:#666">(${esc(q.kind)} — ${q.score} درجة)</span>
        ${Array.isArray(q.options) && q.options.length ? `<div>${(q.options as string[]).map((o) => `• ${esc(String(o))}`).join(" &nbsp; ")}</div>` : ""}
        <div style="color:#0a7">الإجابة: ${esc(answerToText(q.correct_answer))}</div>
        ${q.rationale ? `<div style="color:#666;font-size:12px">السبب: ${esc(q.rationale)}</div>` : ""}
      </li>`).join("")}</ol>`;
    openPrint(exam.title, html);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4">
      <div className="w-full max-w-5xl rounded-2xl bg-white p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-black">{exam.title}</h3>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-accent"><X className="h-5 w-5" /></button>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Kpi label="لم يدخل" value={eligible.length - attempts.length} />
          <Kpi label="بدأ" value={attempts.filter((a) => a.status === "in_progress").length} />
          <Kpi label="أنهى" value={done.length} />
          <Kpi label="متوسط النتيجة" value={`${avg}%`} />
        </div>

        <div className="mb-3 flex gap-1.5">
          {([["students", "الطلاب والترتيب"], ["questions", "تحليل الأسئلة"], ["bank", "بنك الأسئلة"]] as const).map(([id, lbl]) => (
            <button key={id} onClick={() => setView(id)} className={`rounded-lg px-3 py-1.5 text-xs font-bold ${view === id ? "bg-primary text-primary-foreground" : "border"}`}>{lbl}</button>
          ))}
          <button onClick={printBank} className="mr-auto inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-bold"><Printer className="h-3.5 w-3.5" /> طباعة</button>
        </div>

        {view === "students" && (
          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full text-right text-sm">
              <thead className="bg-muted/50 text-xs text-muted-foreground"><tr>
                <th className="p-2">#</th><th className="p-2">الطالب</th><th className="p-2">الكود</th><th className="p-2">الحالة</th>
                <th className="p-2">الدرجة</th><th className="p-2">النسبة</th><th className="p-2">الزمن</th><th className="p-2">المحاولات</th>
              </tr></thead>
              <tbody>
                {eligible.map((s) => {
                  const mine = attempts.filter((a) => a.student_id === s.id);
                  const best = mine.sort((a, b) => Number(b.percentage) - Number(a.percentage))[0];
                  const rank = best ? done.filter((d) => Number(d.percentage) > Number(best.percentage)).length + 1 : "—";
                  return (
                    <tr key={s.id} className="border-t">
                      <td className="p-2">{rank}</td>
                      <td className="p-2 font-semibold">{s.full_name}</td>
                      <td className="p-2 font-mono text-xs">{s.code}</td>
                      <td className="p-2">{!best ? <span className="text-muted-foreground">لم يدخل</span> : best.status === "submitted" ? <span className="text-emerald-700">أنهى</span> : <span className="text-amber-700">جارٍ الحل</span>}</td>
                      <td className="p-2">{best ? `${Number(best.score)} / ${Number(best.max_score)}` : "—"}</td>
                      <td className="p-2 font-bold">{best ? `${Number(best.percentage)}%` : "—"}</td>
                      <td className="p-2">{best ? `${Math.round(best.time_spent_seconds / 60)} د` : "—"}</td>
                      <td className="p-2">{mine.length}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {view === "questions" && (
          <div className="space-y-3">
            {hardest && <div className="rounded-xl bg-amber-50 p-3 text-sm"><b>أكثر سؤال أخطأ فيه الطلاب:</b> {hardest.q.prompt}</div>}
            <div className="overflow-x-auto rounded-xl border">
              <table className="w-full text-right text-sm">
                <thead className="bg-muted/50 text-xs text-muted-foreground"><tr>
                  <th className="p-2">#</th><th className="p-2">السؤال</th><th className="p-2">النوع</th>
                  <th className="p-2">المهارة</th><th className="p-2">أجاب</th><th className="p-2">نسبة الصواب</th><th className="p-2">معامل التمييز</th>
                </tr></thead>
                <tbody>
                  {qStats.map((s) => (
                    <tr key={s.q.id} className="border-t">
                      <td className="p-2">{s.q.position}</td>
                      <td className="p-2 max-w-md">{s.q.prompt}</td>
                      <td className="p-2 text-xs">{s.q.kind}</td>
                      <td className="p-2 text-xs">{s.q.skill || "—"}</td>
                      <td className="p-2">{s.answered}</td>
                      <td className="p-2 font-bold">{s.answered ? `${s.ease}%` : "—"}</td>
                      <td className="p-2">{s.answered ? `${s.disc}%` : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {view === "bank" && (
          <div className="space-y-3">
            <ManualQuestion examId={exam.id} nextPos={questions.length + 1} onAdded={reloadQuestions} />
            {questions.map((q) => (
              <div key={q.id} className="rounded-xl border p-3 text-sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="font-bold">{q.position}. {q.prompt}</div>
                  <button onClick={() => removeQuestion(q.id)} className="rounded-lg bg-destructive/10 p-1 text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
                {q.passage && <div className="mt-1 rounded bg-muted/50 p-2 text-xs">{q.passage}</div>}
                {Array.isArray(q.options) && (q.options as string[]).length > 0 && (
                  <ul className="mt-1 list-disc pr-5 text-xs text-muted-foreground">{(q.options as string[]).map((o, i) => <li key={i}>{o}</li>)}</ul>
                )}
                <div className="mt-1 text-xs text-emerald-700">الإجابة: {answerToText(q.correct_answer)}</div>
                {q.rationale && <div className="text-xs text-muted-foreground">السبب: {q.rationale}</div>}
                <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                  <span>النوع: {q.kind}</span><span>المهارة: {q.skill || "—"}</span>
                  <span>ناتج التعلم: {q.learning_outcome || "—"}</span><span>الصعوبة: {q.difficulty}</span>
                  <span>الزمن: {q.expected_seconds}ث</span><span>الدرجة: {q.score}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: any }) {
  return (
    <div className="rounded-xl border bg-muted/30 p-3 text-center">
      <div className="text-lg font-black text-primary">{value}</div>
      <div className="text-[11px] text-muted-foreground">{label}</div>
    </div>
  );
}

function ManualQuestion({ examId, nextPos, onAdded }: { examId: string; nextPos: number; onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState({ kind: QUESTION_KINDS[0] as string, prompt: "", options: "", correct: "", rationale: "", skill: "", difficulty: "medium", score: 5 });
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!q.prompt.trim() || !q.correct.trim()) { toast.error("اكتب السؤال والإجابة الصحيحة"); return; }
    setSaving(true);
    const { error } = await supabase.from("exam_questions").insert({
      exam_id: examId, position: nextPos, kind: q.kind, prompt: q.prompt,
      options: q.options.split("\n").map((o) => o.trim()).filter(Boolean),
      correct_answer: q.correct, rationale: q.rationale || null, skill: q.skill || null,
      difficulty: q.difficulty, score: Number(q.score) || 1,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("تمت إضافة السؤال");
    setQ({ ...q, prompt: "", options: "", correct: "", rationale: "" });
    onAdded();
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5 rounded-xl border border-primary px-4 py-2 text-xs font-black text-primary">
        <Plus className="h-4 w-4" /> إضافة سؤال يدوياً
      </button>
    );
  }
  return (
    <div className="space-y-2 rounded-xl border bg-muted/20 p-3">
      <div className="grid gap-2 sm:grid-cols-3">
        <Field label="نوع السؤال">
          <select className={inp} value={q.kind} onChange={(e) => setQ({ ...q, kind: e.target.value })}>
            {QUESTION_KINDS.map((k) => <option key={k}>{k}</option>)}
          </select>
        </Field>
        <Field label="المهارة"><input className={inp} value={q.skill} onChange={(e) => setQ({ ...q, skill: e.target.value })} /></Field>
        <Field label="الدرجة"><input type="number" min={1} className={inp} value={q.score} onChange={(e) => setQ({ ...q, score: +e.target.value })} /></Field>
      </div>
      <Field label="نص السؤال"><textarea rows={2} className={inp} value={q.prompt} onChange={(e) => setQ({ ...q, prompt: e.target.value })} /></Field>
      <Field label="الاختيارات (اختياري — كل اختيار في سطر)"><textarea rows={3} className={inp} value={q.options} onChange={(e) => setQ({ ...q, options: e.target.value })} /></Field>
      <div className="grid gap-2 sm:grid-cols-2">
        <Field label="الإجابة الصحيحة"><input className={inp} value={q.correct} onChange={(e) => setQ({ ...q, correct: e.target.value })} /></Field>
        <Field label="سبب الإجابة (اختياري)"><input className={inp} value={q.rationale} onChange={(e) => setQ({ ...q, rationale: e.target.value })} /></Field>
      </div>
      <div className="flex gap-2">
        <button onClick={save} disabled={saving} className="rounded-lg bg-primary px-4 py-2 text-xs font-black text-primary-foreground disabled:opacity-60">حفظ السؤال</button>
        <button onClick={() => setOpen(false)} className="rounded-lg border px-4 py-2 text-xs font-bold">إغلاق</button>
      </div>
    </div>
  );
}
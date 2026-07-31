import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { Sparkles, Trash2, Send, BarChart3, X, Loader2, FileQuestion, Printer, Plus, Save, Edit3, CheckCircle2, LayoutList, BrainCircuit } from "lucide-react";
import { generateExam } from "@/lib/exams.functions";
import { generateExamClassAnalysis } from "@/lib/ai-report.functions";
import { updateExamStatusAdmin, getExamsDataAdmin, saveExamFullAdmin, deleteExamAdmin, getExamDetailedResultsAdmin } from "@/lib/admin.functions";
import { QUESTION_KINDS, DIFFICULTIES, TERMS, GRADES, answerToText } from "@/lib/exam-constants";
import { openPrint, esc } from "@/lib/print";

export const Route = createFileRoute("/_authenticated/exams")({
  head: () => ({
    meta: [
      { title: "الاختبارات الإلكترونية الذكية — الأستاذ" },
      { name: "description", content: "إنشاء اختبارات يدوياً أو بالذكاء الاصطناعي." },
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
  id?: string; exam_id?: string; position: number; kind: string; prompt: string; passage: string | null;
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
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<Exam | null>(null);
  const [createMode, setCreateMode] = useState<"ai" | "manual" | null>(null);
  
  const [previewExam, setPreviewExam] = useState<{ exam: any; questions: Q[] } | null>(null);
  
  const gen = useServerFn(generateExam);
  const updateStatusFn = useServerFn(updateExamStatusAdmin);
  const loadFn = useServerFn(getExamsDataAdmin);
  const saveFullExamFn = useServerFn(saveExamFullAdmin);
  const deleteExamFn = useServerFn(deleteExamAdmin);

  const [form, setForm] = useState({
    grade: GRADES[0], term: TERMS[0], group_id: "", subject: "", lesson: "",
    question_count: 10, duration_minutes: 20, total_score: 100, difficulty: "medium", adaptive: false,
  });
  const [kinds, setKinds] = useState<string[]>(["اختيار من متعدد", "صح أو خطأ"]);

  async function load() {
    setLoading(true);
    try {
      const res = await loadFn({});
      setGroups(res.groups as Group[]);
      setStudents(res.students as Student[]);
      setExams(res.exams as Exam[]);
    } catch (e: any) { toast.error("فشل تحميل بيانات الاختبارات"); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  function toggleKind(k: string) {
    setKinds((prev) => (prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k]));
  }

  async function startAiBuild() {
    if (!form.grade.trim() || !form.lesson.trim()) { toast.error("أدخل الصف والدرس على الأقل"); return; }
    setBusy(true);
    const t = toast.loading("جاري توليد الأسئلة بالذكاء الاصطناعي...");
    try {
      const res = await gen({
        data: {
          grade: form.grade, term: form.term, subject: form.subject || "—",
          unit: "—", lesson: form.lesson,
          questionCount: Number(form.question_count), totalScore: Number(form.total_score),
          difficulty: form.difficulty, kinds,
        },
      });
      
      const questionsPayload = res.questions.map((q, i) => ({
        position: i + 1, kind: q.kind || "اختيار من متعدد",
        prompt: q.prompt, passage: q.passage || null,
        options: q.options || [], correct_answer: q.correct_answer ?? null,
        rationale: q.rationale || null, distractor_explanations: q.distractor_explanations || [],
        skill: q.skill || null, learning_outcome: q.learning_outcome || null,
        difficulty: q.difficulty || form.difficulty, expected_seconds: q.expected_seconds || 60,
        score: Number(q.score) || Number(form.total_score) / res.questions.length,
      }));

      setPreviewExam({
        exam: {
          title: `${form.subject || "اختبار"} — ${form.lesson} (${form.grade})`,
          grade: form.grade, term: form.term, group_id: form.group_id || null,
          subject: form.subject || null, unit: null, lesson: form.lesson,
          question_count: questionsPayload.length, duration_minutes: Number(form.duration_minutes),
          total_score: Number(form.total_score), difficulty: form.difficulty,
          question_types: kinds, adaptive: form.adaptive, status: "draft", sources: res.sources,
        },
        questions: questionsPayload
      });
      toast.success(`تم جلب ${questionsPayload.length} سؤال بنجاح`, { id: t });
    } catch (err: any) { toast.error(err?.message || "فشل توليد الأسئلة", { id: t }); }
    finally { setBusy(false); }
  }

  function startManualBuild() {
    setPreviewExam({
      exam: {
        title: `اختبار يدوي جديد — ${form.lesson || "بدون عنوان"}`,
        grade: form.grade, term: form.term, group_id: form.group_id || null,
        subject: form.subject || null, unit: null, lesson: form.lesson,
        question_count: 0, duration_minutes: Number(form.duration_minutes),
        total_score: Number(form.total_score), difficulty: form.difficulty,
        question_types: [], adaptive: form.adaptive, status: "draft", sources: [],
      },
      questions: []
    });
  }

  async function finalizeSave() {
    if (!previewExam) return;
    if (previewExam.questions.length === 0) { toast.error("يجب إضافة سؤال واحد على الأقل"); return; }
    setBusy(true);
    try {
      await saveFullExamFn({ data: { exam: previewExam.exam, questions: previewExam.questions } });
      toast.success("تم حفظ الاختبار بنجاح");
      setPreviewExam(null); setCreateMode(null); load();
    } catch (err: any) { toast.error(err.message); }
    finally { setBusy(false); }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileQuestion className="h-6 w-6 text-primary" />
          <h1 className="text-xl font-black">الاختبارات الإلكترونية</h1>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setCreateMode("ai")} className="inline-flex items-center gap-2 rounded-xl bg-gold px-4 py-2 text-sm font-bold text-gold-foreground shadow-sm">
            <BrainCircuit className="h-4 w-4" /> إنشاء بالذكاء الاصطناعي
          </button>
          <button onClick={() => setCreateMode("manual")} className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground shadow-sm">
            <Plus className="h-4 w-4" /> إنشاء يدوياً
          </button>
        </div>
      </div>

      {createMode && (
        <section className="rounded-2xl border-2 border-primary/20 bg-white p-5 shadow-sm animate-in fade-in slide-in-from-top-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-black text-primary flex items-center gap-2">
              {createMode === "ai" ? <BrainCircuit className="h-4 w-4" /> : <LayoutList className="h-4 w-4" />}
              إعدادات {createMode === "ai" ? "البناء الآلي" : "البناء اليدوي"}
            </h2>
            <button onClick={() => setCreateMode(null)} className="p-1 hover:bg-muted rounded"><X className="h-4 w-4" /></button>
          </div>
          
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="الصف"><select className={inp} value={form.grade} onChange={(e) => setForm({ ...form, grade: e.target.value })}>{GRADES.map((g) => <option key={g}>{g}</option>)}</select></Field>
            <Field label="المادة"><input className={inp} value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="اللغة العربية" /></Field>
            <Field label="الدرس"><input className={inp} value={form.lesson} onChange={(e) => setForm({ ...form, lesson: e.target.value })} /></Field>
            <Field label="درجة الاختبار"><input type="number" className={inp} value={form.total_score} onChange={(e) => setForm({ ...form, total_score: +e.target.value })} /></Field>
          </div>

          {createMode === "ai" && (
            <div className="mt-4 animate-in fade-in">
              <div className="mb-2 text-xs font-bold text-muted-foreground">أنواع الأسئلة المطلوبة</div>
              <div className="flex flex-wrap gap-1.5">
                {QUESTION_KINDS.map((k) => (
                  <button key={k} type="button" onClick={() => toggleKind(k)}
                    className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${kinds.includes(k) ? "border-primary bg-primary text-primary-foreground" : "hover:bg-accent"}`}>
                    {k}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="mt-5 flex gap-2">
            {createMode === "ai" ? (
              <button onClick={startAiBuild} disabled={busy} className="inline-flex items-center gap-2 rounded-xl bg-gold px-6 py-2.5 text-sm font-black text-gold-foreground shadow hover:opacity-90 disabled:opacity-60">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} بدء التوليد الذكي
              </button>
            ) : (
              <button onClick={startManualBuild} className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-2.5 text-sm font-black text-primary-foreground shadow hover:opacity-90">
                <Plus className="h-4 w-4" /> البدء بإضافة الأسئلة
              </button>
            )}
          </div>
        </section>
      )}

      {previewExam && (
        <section className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4">
          <div className="w-full max-w-4xl rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between border-b pb-4">
              <div>
                <h2 className="text-xl font-black text-primary">محرر الاختبار</h2>
                <p className="text-xs text-muted-foreground">قم بمراجعة الأسئلة وتعديلها أو إضافة أسئلة جديدة.</p>
              </div>
              <div className="flex gap-2">
                <button onClick={finalizeSave} disabled={busy} className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-black text-white shadow hover:bg-emerald-700">
                  <CheckCircle2 className="h-4 w-4" /> حفظ الاختبار نهائياً
                </button>
                <button onClick={() => setPreviewExam(null)} className="rounded-lg bg-muted px-4 py-2 text-sm font-bold">إلغاء</button>
              </div>
            </div>

            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="عنوان الاختبار">
                  <input className={inp} value={previewExam.exam.title} onChange={e => setPreviewExam({ ...previewExam, exam: { ...previewExam.exam, title: e.target.value } })} />
                </Field>
                <Field label="الدرجة الكلية">
                   <input type="number" className={inp} value={previewExam.exam.total_score} onChange={e => setPreviewExam({ ...previewExam, exam: { ...previewExam.exam, total_score: +e.target.value } })} />
                </Field>
              </div>

              <div className="space-y-4">
                <h3 className="font-black border-r-4 border-primary pr-3 flex items-center justify-between">
                  الأسئلة الحالية ({previewExam.questions.length})
                  <button onClick={() => {
                    const n = [...previewExam.questions];
                    n.push({ position: n.length+1, kind: "اختيار من متعدد", prompt: "اكتب السؤال الجديد هنا...", options: ["","","",""], correct_answer: "", rationale: null, distractor_explanations: [], skill: "تطبيق", learning_outcome: null, difficulty: "medium", expected_seconds: 60, score: 1, passage: null });
                    setPreviewExam({ ...previewExam, questions: n });
                  }} className="text-xs text-primary bg-primary/10 px-2 py-1 rounded-lg">+ إضافة سؤال يدوي</button>
                </h3>
                
                {previewExam.questions.map((q, idx) => (
                  <div key={idx} className="group relative rounded-xl border-2 bg-muted/5 p-4 transition-all hover:border-primary/30">
                    <button onClick={() => {
                      const n = [...previewExam.questions]; n.splice(idx, 1);
                      setPreviewExam({ ...previewExam, questions: n });
                    }} className="absolute -left-2 -top-2 rounded-full bg-destructive p-1.5 text-white shadow-lg">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                    
                    <div className="grid gap-3">
                      <div className="flex items-center gap-2">
                        <select className="rounded border bg-white p-1 text-[10px] font-bold" value={q.kind} onChange={e => {
                          const n = [...previewExam.questions]; n[idx].kind = e.target.value; setPreviewExam({ ...previewExam, questions: n });
                        }}>
                          {QUESTION_KINDS.map(k => <option key={k} value={k}>{k}</option>)}
                        </select>
                        <input className="flex-1 rounded-lg border-0 bg-transparent text-sm font-bold focus:ring-0" 
                               value={q.prompt} 
                               onChange={e => {
                                 const n = [...previewExam.questions]; n[idx].prompt = e.target.value;
                                 setPreviewExam({ ...previewExam, questions: n });
                               }} />
                        <input type="number" className="w-16 rounded-lg border bg-white p-1 text-center text-xs font-bold" 
                               value={q.score}
                               onChange={e => {
                                 const n = [...previewExam.questions]; n[idx].score = Number(e.target.value);
                                 setPreviewExam({ ...previewExam, questions: n });
                               }} />
                      </div>

                      {Array.isArray(q.options) && q.options.length > 0 && (
                        <div className="grid grid-cols-2 gap-2">
                          {q.options.map((opt, oIdx) => (
                            <div key={oIdx} className="flex items-center gap-2">
                              <input type="radio" checked={q.correct_answer === opt} onChange={() => {
                                const n = [...previewExam.questions]; n[idx].correct_answer = opt;
                                setPreviewExam({ ...previewExam, questions: n });
                              }} className="text-primary" />
                              <input className="flex-1 rounded-lg border bg-white p-1.5 text-xs" 
                                     value={opt}
                                     onChange={e => {
                                       const n = [...previewExam.questions];
                                       n[idx].options[oIdx] = e.target.value;
                                       setPreviewExam({ ...previewExam, questions: n });
                                     }} />
                            </div>
                          ))}
                        </div>
                      )}

                      {!Array.isArray(q.options) && (
                        <input className="w-full rounded-lg border bg-white p-2 text-xs text-secondary font-bold" 
                               placeholder="الإجابة الصحيحة..."
                               value={q.correct_answer || ""}
                               onChange={e => {
                                 const n = [...previewExam.questions]; n[idx].correct_answer = e.target.value;
                                 setPreviewExam({ ...previewExam, questions: n });
                               }} />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* عرض الاختبارات المحفوظة بنفس التنسيق السابق */}
      <section className="rounded-2xl border bg-white shadow-sm">
        <div className="border-b px-5 py-3 text-sm font-black">بنك الاختبارات المحفوظة ({exams.length})</div>
        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead className="bg-muted/50 text-xs text-muted-foreground">
              <tr>
                <th className="p-3">الاختبار</th><th className="p-3">الصف</th><th className="p-3">الأسئلة</th><th className="p-3">الدرجة</th><th className="p-3">الحالة</th><th className="p-3 text-center">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {exams.map((ex) => (
                <tr key={ex.id} className="border-t hover:bg-muted/30">
                  <td className="p-3 font-bold text-primary">{ex.title}</td>
                  <td className="p-3 font-semibold">{ex.grade || "—"}</td>
                  <td className="p-3">{ex.question_count}</td>
                  <td className="p-3">{ex.total_score}</td>
                  <td className="p-3">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${ex.status === "published" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                      {ex.status === "published" ? "منشور" : "مسودة"}
                    </span>
                  </td>
                  <td className="p-3 text-center">
                    <div className="flex justify-center gap-1.5">
                       {ex.status !== "published" && <button onClick={() => setStatus(ex, "published")} className="rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-bold text-white">نشر</button>}
                       <button onClick={() => setDetail(ex)} className="rounded-lg border px-2.5 py-1 text-xs font-bold">النتائج</button>
                       <button onClick={() => remove(ex)} className="rounded-lg p-1 text-destructive hover:bg-destructive/10"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* باقي المكونات (ExamDetail) تبقى كما هي */}
      {detail && <ExamDetail exam={detail} students={students} onClose={() => setDetail(null)} />}
    </div>
  );
}

const inp = "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20";
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1 block text-xs font-bold text-muted-foreground uppercase">{label}</span>{children}</label>;
}

// ... باقي كود ExamDetail و Kpi و TabBtn كما في الملف الأصلي
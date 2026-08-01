import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { Trash2, X, Loader2, FileQuestion, Plus, BrainCircuit, Timer, BarChart3, Trophy } from "lucide-react";
import { generateExam } from "@/lib/exams.functions";
import { updateExamStatusAdmin, getExamsDataAdmin, saveExamFullAdmin, deleteExamAdmin } from "@/lib/admin.functions";
import { QUESTION_KINDS, TERMS, GRADES, DIFFICULTIES } from "@/lib/exam-constants";

export const Route = createFileRoute("/_authenticated/exams")({
  head: () => ({
    meta: [
      { title: "الاختبارات الذكية — سنتر الأستاذ محمد نجم" },
      { name: "description", content: "إنشاء اختبارات إلكترونية بالذكاء الاصطناعي من المناهج المصرية وتحليل نتائج الطلاب وترتيبهم ومستوياتهم." },
      { property: "og:title", content: "الاختبارات الذكية — سنتر الأستاذ محمد نجم" },
      { property: "og:description", content: "اختبارات ذكية بأنواع أسئلة متعددة وتحليل فوري لنتائج الطلاب." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ExamsPage,
});

function levelOf(pct: number) {
  if (pct >= 90) return { label: "ممتاز", cls: "bg-emerald-100 text-emerald-700" };
  if (pct >= 75) return { label: "جيد جداً", cls: "bg-sky-100 text-sky-700" };
  if (pct >= 60) return { label: "جيد", cls: "bg-amber-100 text-amber-700" };
  if (pct >= 50) return { label: "مقبول", cls: "bg-orange-100 text-orange-700" };
  return { label: "ضعيف", cls: "bg-rose-100 text-rose-700" };
}

function ExamsPage() {
  const [groups, setGroups] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [attempts, setAttempts] = useState<any[]>([]);
  const [exams, setExams] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [createMode, setCreateMode] = useState<"ai" | "manual" | null>(null);
  const [previewExam, setPreviewExam] = useState<{ id?: string; exam: any; questions: any[] } | null>(null);
  const [analysisExamId, setAnalysisExamId] = useState<string>("");

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
      setGroups(res.groups); setExams(res.exams);
      setStudents(res.students || []); setAttempts(res.attempts || []);
    } catch { toast.error("فشل التحميل"); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  const groupsForGrade = useMemo(
    () => groups.filter((g) => !g.grade || !form.grade || g.grade === form.grade),
    [groups, form.grade],
  );

  const rows = useMemo(() => {
    const list = attempts
      .filter((a) => !analysisExamId || a.exam_id === analysisExamId)
      .map((a) => {
        const st = students.find((s) => s.id === a.student_id);
        const ex = exams.find((e) => e.id === a.exam_id);
        const pct = Number(a.percentage) || 0;
        return {
          id: a.id, name: st?.full_name || "—", code: st?.code || "",
          group: groups.find((g) => g.id === st?.group_id)?.name || "—",
          exam: ex?.title || "—", score: Number(a.score) || 0, max: Number(a.max_score) || 0,
          pct, mins: Math.round((Number(a.time_spent_seconds) || 0) / 60), level: levelOf(pct),
        };
      })
      .sort((a, b) => b.pct - a.pct);
    return list;
  }, [attempts, students, exams, groups, analysisExamId]);

  const avg = rows.length ? Math.round(rows.reduce((s, r) => s + r.pct, 0) / rows.length) : 0;
  const passed = rows.filter((r) => r.pct >= 50).length;

  function toggleKind(k: string) {
    setKinds((prev) => (prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k]));
  }

  async function startAiBuild() {
    if (!kinds.length) return toast.error("اختر نوعاً واحداً على الأقل من أنواع الأسئلة");
    setBusy(true);
    const t = toast.loading("جاري التوليد...");
    try {
      const res = await gen({
        data: { grade: form.grade, term: form.term, subject: form.subject || "—", unit: "—", lesson: form.lesson, questionCount: Number(form.question_count), totalScore: Number(form.total_score), difficulty: form.difficulty, kinds },
      });
      const qs = res.questions.map((q: any, i: number) => ({
        position: i + 1, kind: q.kind || "اختيار من متعدد", prompt: q.prompt, passage: q.passage || null,
        options: q.options || [], correct_answer: q.correct_answer ?? null, rationale: q.rationale || null,
        skill: q.skill || null, difficulty: q.difficulty || form.difficulty, score: Number(q.score) || 1,
        source_ref: q.source_ref || null,
      }));
      setPreviewExam({
        exam: { title: `${form.subject || "اختبار"} — ${form.lesson}`, grade: form.grade, term: form.term, group_id: form.group_id || null, subject: form.subject || null, question_count: qs.length, duration_minutes: Number(form.duration_minutes), total_score: Number(form.total_score), difficulty: form.difficulty, question_types: kinds, adaptive: form.adaptive, status: "draft", sources: res.sources || [] },
        questions: qs,
      });
      toast.success("تم التوليد بنجاح", { id: t });
    } catch { toast.error("فشل التوليد", { id: t }); }
    finally { setBusy(false); }
  }

  function startManual() {
    setPreviewExam({
      exam: { title: `${form.subject || "اختبار"} — ${form.lesson}`, grade: form.grade, term: form.term, group_id: form.group_id || null, subject: form.subject || null, question_count: 0, duration_minutes: Number(form.duration_minutes), total_score: Number(form.total_score), difficulty: form.difficulty, question_types: kinds, adaptive: form.adaptive, status: "draft", sources: [] },
      questions: [],
    });
  }

  function addManualQuestion() {
    if (!previewExam) return;
    const qs = [...previewExam.questions, {
      position: previewExam.questions.length + 1, kind: kinds[0] || "اختيار من متعدد", prompt: "",
      passage: null, options: [], correct_answer: "", rationale: null, skill: null,
      difficulty: form.difficulty, score: 1, source_ref: null,
    }];
    setPreviewExam({ ...previewExam, questions: qs, exam: { ...previewExam.exam, question_count: qs.length } });
  }

  function updateQ(i: number, patch: any) {
    if (!previewExam) return;
    const qs = previewExam.questions.map((q, n) => (n === i ? { ...q, ...patch } : q));
    setPreviewExam({ ...previewExam, questions: qs });
  }

  function removeQ(i: number) {
    if (!previewExam) return;
    const qs = previewExam.questions.filter((_, n) => n !== i).map((q, n) => ({ ...q, position: n + 1 }));
    setPreviewExam({ ...previewExam, questions: qs, exam: { ...previewExam.exam, question_count: qs.length } });
  }

  async function finalizeSave() {
    if (!previewExam) return;
    if (!previewExam.questions.length) return toast.error("أضف سؤالاً واحداً على الأقل");
    setBusy(true);
    try {
      await saveFullExamFn({ data: { id: previewExam.id, exam: { ...previewExam.exam, question_count: previewExam.questions.length }, questions: previewExam.questions } });
      toast.success("تم حفظ الاختبار");
      setPreviewExam(null); setCreateMode(null); load();
    } catch (err: any) { toast.error(err.message); }
    finally { setBusy(false); }
  }

  async function setStatus(ex: any, s: string) {
    try { await updateStatusFn({ data: { id: ex.id, status: s } }); toast.success("تم التحديث"); load(); } catch { toast.error("فشل التحديث"); }
  }

  async function remove(id: string) {
    if (!confirm("حذف الاختبار نهائياً؟")) return;
    try { await deleteExamFn({ data: { id } }); toast.success("تم الحذف"); load(); } catch { toast.error("فشل الحذف"); }
  }

  if (loading) return <div className="p-20 text-center"><Loader2 className="mx-auto h-10 w-10 animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-black flex items-center gap-2"><FileQuestion className="h-6 w-6 text-primary" /> الاختبارات الذكية</h1>
        <div className="flex gap-2">
          <button onClick={() => { setCreateMode("ai"); setPreviewExam(null); }} className="inline-flex items-center gap-2 rounded-xl bg-gold px-4 py-2 text-sm font-bold text-gold-foreground"><BrainCircuit className="h-4 w-4" /> إنشاء بالذكاء الاصطناعي</button>
          <button onClick={() => { setCreateMode("manual"); setPreviewExam(null); }} className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white"><Plus className="h-4 w-4" /> إنشاء يدوياً</button>
        </div>
      </div>

      {(createMode || previewExam) && (
        <section className="rounded-2xl border-2 border-primary/10 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-black text-primary">إعدادات الاختبار الجديد</h2>
            <button onClick={() => { setCreateMode(null); setPreviewExam(null); }} className="p-1 hover:bg-muted rounded"><X className="h-4 w-4" /></button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="block text-xs font-bold">الصف الدراسي
              <select className="w-full rounded-lg border p-2 mt-1" value={form.grade} onChange={e => setForm({ ...form, grade: e.target.value, group_id: "" })}>
                {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </label>
            <label className="block text-xs font-bold">المجموعة
              <select className="w-full rounded-lg border p-2 mt-1" value={form.group_id} onChange={e => setForm({ ...form, group_id: e.target.value })}>
                <option value="">كل المجموعات</option>
                {groupsForGrade.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </label>
            <label className="block text-xs font-bold">الفصل الدراسي
              <select className="w-full rounded-lg border p-2 mt-1" value={form.term} onChange={e => setForm({ ...form, term: e.target.value })}>
                {TERMS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </label>
            <label className="block text-xs font-bold">المادة<input className="w-full rounded-lg border p-2 mt-1" value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} placeholder="مثال: لغة عربية" /></label>
            <label className="block text-xs font-bold">اسم الدرس<input className="w-full rounded-lg border p-2 mt-1" value={form.lesson} onChange={e => setForm({ ...form, lesson: e.target.value })} /></label>
            <label className="block text-xs font-bold">عدد الأسئلة<input type="number" className="w-full rounded-lg border p-2 mt-1" value={form.question_count} onChange={e => setForm({ ...form, question_count: +e.target.value })} /></label>
            <label className="block text-xs font-bold flex items-center gap-2"><Timer className="h-3 w-3 text-primary" /> زمن الاختبار (بالدقائق)
              <input type="number" className="w-full rounded-lg border p-2 mt-1" value={form.duration_minutes} onChange={e => setForm({ ...form, duration_minutes: +e.target.value })} />
            </label>
            <label className="block text-xs font-bold">الدرجة الكلية<input type="number" className="w-full rounded-lg border p-2 mt-1" value={form.total_score} onChange={e => setForm({ ...form, total_score: +e.target.value })} /></label>
            <label className="block text-xs font-bold">مستوى الصعوبة
              <select className="w-full rounded-lg border p-2 mt-1" value={form.difficulty} onChange={e => setForm({ ...form, difficulty: e.target.value })}>
                {DIFFICULTIES.map(d => <option key={d.id} value={d.id}>{d.label}</option>)}
              </select>
            </label>
          </div>

          <div className="mt-4">
            <div className="mb-2 text-xs font-black text-primary">أنواع أسئلة الاختبار ({kinds.length} مختار)</div>
            <div className="flex flex-wrap gap-2">
              {QUESTION_KINDS.map(k => (
                <button key={k} type="button" onClick={() => toggleKind(k)}
                  className={`rounded-full border px-3 py-1 text-[11px] font-bold transition ${kinds.includes(k) ? "border-primary bg-primary text-white" : "border-muted-foreground/20 bg-white text-muted-foreground hover:border-primary/40"}`}>
                  {k}
                </button>
              ))}
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">تُبنى الأسئلة على منصات الوزارة (بنك المعرفة، حصص مصر)، امتحانات المحافظات، والكتب الخارجية (الامتحان، الأضواء، المعاصر، سلاح التلميذ) وأسئلة كبار المعلمين.</p>
          </div>

          {createMode === "ai" && !previewExam && (
            <div className="mt-4 flex gap-2">
              <button onClick={startAiBuild} disabled={busy} className="inline-flex items-center gap-2 rounded-xl bg-gold px-6 py-2.5 text-sm font-black text-gold-foreground">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "بدء التوليد الذكي"}</button>
            </div>
          )}
          {createMode === "manual" && !previewExam && (
            <div className="mt-4 flex gap-2">
              <button onClick={startManual} className="rounded-xl bg-primary px-6 py-2.5 text-sm font-black text-white">بدء كتابة الأسئلة</button>
            </div>
          )}
        </section>
      )}

      {previewExam && (
        <div className="space-y-4 rounded-2xl bg-primary/5 p-5 border">
          <div className="flex flex-wrap justify-between items-center gap-2">
            <h3 className="font-black text-primary">مراجعة الاختبار ({previewExam.questions.length} سؤال)</h3>
            <div className="flex gap-2">
              <button onClick={addManualQuestion} className="rounded-xl bg-primary px-4 py-2 text-xs font-black text-white">+ إضافة سؤال</button>
              <button onClick={finalizeSave} disabled={busy} className="rounded-xl bg-emerald-600 px-6 py-2 text-sm font-black text-white">حفظ الاختبار نهائياً</button>
            </div>
          </div>
          <div className="space-y-3">
            {previewExam.questions.map((q, i) => (
              <div key={i} className="rounded-lg border bg-white p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-black text-primary">سؤال {i + 1}</span>
                  <div className="flex items-center gap-2">
                    <select className="rounded border p-1 text-[11px]" value={q.kind} onChange={e => updateQ(i, { kind: e.target.value })}>
                      {QUESTION_KINDS.map(k => <option key={k} value={k}>{k}</option>)}
                    </select>
                    <input type="number" className="w-16 rounded border p-1 text-[11px]" value={q.score} onChange={e => updateQ(i, { score: +e.target.value })} />
                    <button onClick={() => removeQ(i)} className="text-destructive"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </div>
                <textarea className="w-full rounded border p-2 text-sm font-bold" rows={2} value={q.prompt || ""} onChange={e => updateQ(i, { prompt: e.target.value })} placeholder="نص السؤال" />
                <input className="w-full rounded border p-2 text-xs" value={Array.isArray(q.options) ? q.options.join(" | ") : ""} onChange={e => updateQ(i, { options: e.target.value.split("|").map(s => s.trim()).filter(Boolean) })} placeholder="الاختيارات مفصولة بـ |" />
                <input className="w-full rounded border p-2 text-xs" value={typeof q.correct_answer === "string" ? q.correct_answer : (q.correct_answer ?? "")} onChange={e => updateQ(i, { correct_answer: e.target.value })} placeholder="الإجابة الصحيحة" />
                {q.source_ref && <div className="text-[10px] text-muted-foreground">المصدر: {q.source_ref}</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
        <table className="w-full text-right text-sm">
          <thead className="bg-primary text-white"><tr><th className="p-3">الاختبار</th><th className="p-3 text-center">الصف</th><th className="p-3 text-center">المجموعة</th><th className="p-3 text-center">الزمن</th><th className="p-3 text-center">الأسئلة</th><th className="p-3 text-center">الحالة</th><th className="p-3 text-center">إجراءات</th></tr></thead>
          <tbody>
            {exams.map(ex => (
              <tr key={ex.id} className="border-t hover:bg-muted/30">
                <td className="p-3 font-bold text-primary">{ex.title}</td>
                <td className="p-3 text-center text-xs font-bold">{ex.grade || "—"}</td>
                <td className="p-3 text-center text-xs font-bold">{groups.find(g => g.id === ex.group_id)?.name || "الكل"}</td>
                <td className="p-3 text-center font-bold">{ex.duration_minutes} دقيقة</td>
                <td className="p-3 text-center font-bold">{ex.question_count}</td>
                <td className="p-3 text-center"><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${ex.status === "published" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>{ex.status === "published" ? "منشور" : "مسودة"}</span></td>
                <td className="p-3">
                  <div className="flex justify-center gap-2">
                    {ex.status !== "published" && <button onClick={() => setStatus(ex, "published")} className="rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-bold text-white">نشر</button>}
                    <button onClick={() => setAnalysisExamId(ex.id)} className="rounded-lg bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary">النتائج</button>
                    <button onClick={() => remove(ex.id)} className="text-destructive p-1 hover:bg-destructive/10 rounded"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <section className="rounded-2xl border bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-sm font-black text-primary"><BarChart3 className="h-4 w-4" /> تحليل نتائج الطلاب</h2>
          <select className="rounded-lg border p-2 text-xs font-bold" value={analysisExamId} onChange={e => setAnalysisExamId(e.target.value)}>
            <option value="">كل الاختبارات</option>
            {exams.map(ex => <option key={ex.id} value={ex.id}>{ex.title}</option>)}
          </select>
        </div>

        <div className="mb-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl bg-primary/5 p-3"><div className="text-[11px] font-bold text-muted-foreground">عدد من أجابوا</div><div className="text-xl font-black text-primary">{rows.length}</div></div>
          <div className="rounded-xl bg-emerald-50 p-3"><div className="text-[11px] font-bold text-muted-foreground">متوسط النسبة</div><div className="text-xl font-black text-emerald-700">{avg}%</div></div>
          <div className="rounded-xl bg-amber-50 p-3"><div className="text-[11px] font-bold text-muted-foreground">الناجحون</div><div className="text-xl font-black text-amber-700">{passed} / {rows.length}</div></div>
        </div>

        {rows.length === 0 ? (
          <p className="py-8 text-center text-xs font-bold text-muted-foreground">لا توجد إجابات بعد.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="bg-muted/50"><tr><th className="p-2 text-center">الترتيب</th><th className="p-2">الطالب</th><th className="p-2">المجموعة</th><th className="p-2">الاختبار</th><th className="p-2 text-center">الدرجة</th><th className="p-2 text-center">النسبة</th><th className="p-2 text-center">الزمن</th><th className="p-2 text-center">المستوى</th></tr></thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.id} className="border-t hover:bg-muted/20">
                    <td className="p-2 text-center font-black">{i < 3 ? <span className="inline-flex items-center gap-1 text-gold"><Trophy className="h-3.5 w-3.5" />{i + 1}</span> : i + 1}</td>
                    <td className="p-2 font-bold text-primary">{r.name}<span className="mr-1 text-[10px] text-muted-foreground">{r.code}</span></td>
                    <td className="p-2 text-xs">{r.group}</td>
                    <td className="p-2 text-xs">{r.exam}</td>
                    <td className="p-2 text-center font-bold">{r.score} / {r.max}</td>
                    <td className="p-2 text-center font-black">{r.pct}%</td>
                    <td className="p-2 text-center text-xs">{r.mins} د</td>
                    <td className="p-2 text-center"><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${r.level.cls}`}>{r.level.label}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { Trash2, X, Loader2, FileQuestion, Plus, BrainCircuit, Timer, BarChart3, Trophy, Eye, Pencil, Send, Ban } from "lucide-react";
import { generateExam } from "@/lib/exams.functions";
import { updateExamStatusAdmin, getExamsDataAdmin, saveExamFullAdmin, deleteExamAdmin, setExamAnswersReleasedAdmin } from "@/lib/admin.functions";
import { QUESTION_KINDS, TERMS, GRADES, DIFFICULTIES } from "@/lib/exam-constants";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/exams")({
  head: () => ({
    meta: [
      { title: "الاختبارات الذكية — سنتر الأستاذ محمد نجم" },
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
  const releaseAnswersFn = useServerFn(setExamAnswersReleasedAdmin);
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
    const t = toast.loading("جاري التوليد بالذكاء الاصطناعي...");
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
      toast.success("تم التوليد بنجاح، يرجى مراجعة الأسئلة وحفظها", { id: t });
    } catch { toast.error("فشل التوليد، حاول مرة أخرى بكلمات بحث مختلفة", { id: t }); }
    finally { setBusy(false); }
  }

  function startManual() {
    setPreviewExam({
      exam: { title: `${form.subject || "اختبار"} — ${form.lesson}`, grade: form.grade, term: form.term, group_id: form.group_id || null, subject: form.subject || null, question_count: 0, duration_minutes: Number(form.duration_minutes), total_score: Number(form.total_score), difficulty: form.difficulty, question_types: kinds, adaptive: form.adaptive, status: "draft", sources: [] },
      questions: [],
    });
  }

  async function handleEdit(ex: any) {
    setLoading(true);
    try {
      const { data: qs } = await supabase.from("exam_questions").select("*").eq("exam_id", ex.id).order("position");
      setPreviewExam({ id: ex.id, exam: ex, questions: qs || [] });
      setCreateMode("manual");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch { toast.error("فشل تحميل الأسئلة للتعديل"); }
    finally { setLoading(false); }
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
      toast.success("تم حفظ الاختبار بنجاح");
      setPreviewExam(null); setCreateMode(null); load();
    } catch (err: any) { toast.error(err.message); }
    finally { setBusy(false); }
  }

  async function setStatus(ex: any, s: string) {
    try { 
      await updateStatusFn({ data: { id: ex.id, status: s } }); 
      toast.success(s === "published" ? "تم نشر الاختبار للطلاب" : "تم سحب الاختبار (إخفاء)"); 
      load(); 
    } catch { toast.error("فشل تحديث الحالة"); }
  }

  async function toggleAnswers(ex: any) {
    try {
      await releaseAnswersFn({ data: { id: ex.id, released: !ex.answers_released } });
      toast.success(!ex.answers_released ? "تم إرسال الإجابة الصحيحة للطلاب" : "تم إخفاء الإجابة الصحيحة عن الطلاب");
      load();
    } catch { toast.error("فشل إرسال الإجابة الصحيحة"); }
  }


  async function remove(id: string) {
    if (!confirm("حذف الاختبار نهائياً؟ سيتم حذف جميع إجابات الطلاب المتعلقة به.")) return;
    try { await deleteExamFn({ data: { id } }); toast.success("تم الحذف"); load(); } catch { toast.error("فشل الحذف"); }
  }

  if (loading && exams.length === 0) return <div className="p-20 text-center"><Loader2 className="mx-auto h-10 w-10 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-black flex items-center gap-2"><FileQuestion className="h-7 w-7 text-primary" /> الاختبارات الذكية</h1>
        <div className="flex gap-2 w-full sm:w-auto">
          <button onClick={() => { setCreateMode("ai"); setPreviewExam(null); }} className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 rounded-xl bg-gold px-5 py-2.5 text-sm font-bold text-gold-foreground shadow-lg shadow-gold/20 transition-all hover:scale-105 active:scale-95"><BrainCircuit className="h-5 w-5" /> ذكاء اصطناعي</button>
          <button onClick={() => { setCreateMode("manual"); setPreviewExam(null); }} className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-primary/20 transition-all hover:scale-105 active:scale-95"><Plus className="h-5 w-5" /> إنشاء يدوي</button>
        </div>
      </div>

      {(createMode || previewExam) && (
        <section className="rounded-3xl border-2 border-primary/10 bg-white p-6 shadow-sm animate-in slide-in-from-top-4">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-base font-black text-primary flex items-center gap-2"><Ban className="h-5 w-5" /> إعدادات الاختبار ومحتواه</h2>
            <button onClick={() => { setCreateMode(null); setPreviewExam(null); }} className="p-2 hover:bg-slate-100 rounded-full transition-all text-slate-400"><X className="h-6 w-6" /></button>
          </div>
          
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <label className="block text-xs font-black text-muted-foreground uppercase">الصف الدراسي
              <select className="w-full rounded-xl border-slate-200 p-3 mt-1 font-bold text-sm bg-slate-50 focus:bg-white outline-none focus:ring-2 focus:ring-primary/20 transition-all" value={form.grade} onChange={e => setForm({ ...form, grade: e.target.value, group_id: "" })}>
                {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </label>
            <label className="block text-xs font-black text-muted-foreground uppercase">المجموعة المستهدفة
              <select className="w-full rounded-xl border-slate-200 p-3 mt-1 font-bold text-sm bg-slate-50 focus:bg-white outline-none focus:ring-2 focus:ring-primary/20 transition-all" value={form.group_id} onChange={e => setForm({ ...form, group_id: e.target.value })}>
                <option value="">كل المجموعات (حسب الصف)</option>
                {groupsForGrade.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </label>
            <label className="block text-xs font-black text-muted-foreground uppercase">المادة
              <input className="w-full rounded-xl border-slate-200 p-3 mt-1 font-bold text-sm bg-slate-50 focus:bg-white outline-none focus:ring-2 focus:ring-primary/20 transition-all" value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} placeholder="مثال: اللغة العربية" />
            </label>
            <label className="block text-xs font-black text-muted-foreground uppercase">عنوان الاختبار / الدرس
              <input className="w-full rounded-xl border-slate-200 p-3 mt-1 font-bold text-sm bg-slate-50 focus:bg-white outline-none focus:ring-2 focus:ring-primary/20 transition-all" value={form.lesson} onChange={e => setForm({ ...form, lesson: e.target.value })} placeholder="مثال: الفصل الأول" />
            </label>
            <label className="block text-xs font-black text-muted-foreground uppercase">عدد الأسئلة
              <input type="number" className="w-full rounded-xl border-slate-200 p-3 mt-1 font-bold text-sm bg-slate-50 focus:bg-white outline-none focus:ring-2 focus:ring-primary/20 transition-all" value={form.question_count} onChange={e => setForm({ ...form, question_count: +e.target.value })} />
            </label>
            <label className="block text-xs font-black text-muted-foreground uppercase">الزمن (دقيقة)
              <input type="number" className="w-full rounded-xl border-slate-200 p-3 mt-1 font-bold text-sm bg-slate-50 focus:bg-white outline-none focus:ring-2 focus:ring-primary/20 transition-all" value={form.duration_minutes} onChange={e => setForm({ ...form, duration_minutes: +e.target.value })} />
            </label>
            <label className="block text-xs font-black text-muted-foreground uppercase">الدرجة الكلية
              <input type="number" className="w-full rounded-xl border-slate-200 p-3 mt-1 font-bold text-sm bg-slate-50 focus:bg-white outline-none focus:ring-2 focus:ring-primary/20 transition-all" value={form.total_score} onChange={e => setForm({ ...form, total_score: +e.target.value })} />
            </label>
            <label className="block text-xs font-black text-muted-foreground uppercase">مستوى الصعوبة
              <select className="w-full rounded-xl border-slate-200 p-3 mt-1 font-bold text-sm bg-slate-50 focus:bg-white outline-none focus:ring-2 focus:ring-primary/20 transition-all" value={form.difficulty} onChange={e => setForm({ ...form, difficulty: e.target.value })}>
                {DIFFICULTIES.map(d => <option key={d.id} value={d.id}>{d.label}</option>)}
              </select>
            </label>
          </div>

          <div className="mt-6">
            <div className="mb-3 text-xs font-black text-primary uppercase tracking-wider">أنواع الأسئلة المختارة ({kinds.length})</div>
            <div className="flex flex-wrap gap-2">
              {QUESTION_KINDS.map(k => (
                <button key={k} type="button" onClick={() => toggleKind(k)}
                  className={`rounded-full border-2 px-4 py-1.5 text-[11px] font-black transition-all ${kinds.includes(k) ? "border-primary bg-primary text-white shadow-lg shadow-primary/10" : "border-slate-100 bg-slate-50 text-slate-500 hover:border-primary/30"}`}>
                  {k}
                </button>
              ))}
            </div>
          </div>

          {createMode === "ai" && !previewExam && (
            <button onClick={startAiBuild} disabled={busy} className="mt-8 w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-2xl bg-gold px-10 py-4 text-sm font-black text-gold-foreground shadow-xl shadow-gold/20 hover:scale-[1.02] active:scale-95 transition-all">
              {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <BrainCircuit className="h-5 w-5" />} بدء التوليد الذكي الآن
            </button>
          )}
          {createMode === "manual" && !previewExam && (
            <button onClick={startManual} className="mt-8 w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-10 py-4 text-sm font-black text-white shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all">
              <Plus className="h-5 w-5" /> ابدأ بكتابة الأسئلة يدوياً
            </button>
          )}
        </section>
      )}

      {previewExam && (
        <div className="space-y-4 rounded-3xl bg-slate-50 p-6 border-2 border-dashed border-primary/20">
          <div className="flex flex-wrap justify-between items-center gap-4">
            <div>
              <h3 className="font-black text-primary text-lg">مراجعة الأسئلة ({previewExam.questions.length})</h3>
              <p className="text-xs text-muted-foreground font-bold mt-1">تأكد من صحة الإجابات النموذجية والدرجات قبل الحفظ.</p>
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              <button onClick={addManualQuestion} className="flex-1 sm:flex-initial rounded-xl bg-white border border-primary/20 px-4 py-2.5 text-xs font-black text-primary hover:bg-primary/5 transition-all">+ إضافة سؤال</button>
              <button onClick={finalizeSave} disabled={busy} className="flex-1 sm:flex-initial rounded-xl bg-emerald-600 px-6 py-2.5 text-sm font-black text-white shadow-lg shadow-emerald-200 hover:scale-105 active:scale-95 transition-all">حفظ الاختبار</button>
            </div>
          </div>
          
          <div className="grid gap-4">
            {previewExam.questions.map((q, i) => (
              <div key={i} className="rounded-2xl bg-white p-5 shadow-sm border border-slate-100 animate-in slide-in-from-right-4 transition-all hover:shadow-md">
                <div className="flex items-center justify-between gap-2 mb-4">
                  <span className="text-xs font-black bg-primary/10 text-primary px-3 py-1 rounded-full uppercase">سؤال {i + 1}</span>
                  <div className="flex items-center gap-2">
                    <select className="rounded-lg border-slate-100 p-2 text-[10px] font-black bg-slate-50 outline-none" value={q.kind} onChange={e => updateQ(i, { kind: e.target.value })}>
                      {QUESTION_KINDS.map(k => <option key={k} value={k}>{k}</option>)}
                    </select>
                    <div className="flex items-center gap-1 bg-slate-50 px-2 rounded-lg border">
                      <span className="text-[10px] font-black text-muted-foreground">الدرجة:</span>
                      <input type="number" className="w-10 bg-transparent py-1 text-[10px] font-black outline-none" value={q.score} onChange={e => updateQ(i, { score: +e.target.value })} />
                    </div>
                    <button onClick={() => removeQ(i)} className="text-rose-400 hover:text-rose-600 p-1.5 transition-all"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </div>
                <div className="space-y-3">
                  <textarea className="w-full rounded-xl border-slate-100 p-3 text-sm font-bold bg-slate-50 focus:bg-white outline-none focus:ring-2 focus:ring-primary/10" rows={2} value={q.prompt || ""} onChange={e => updateQ(i, { prompt: e.target.value })} placeholder="اكتب نص السؤال هنا..." />
                  {["اختيار من متعدد", "اختر من القائمة"].includes(q.kind) && (
                    <input className="w-full rounded-xl border-slate-100 p-3 text-xs bg-slate-50 focus:bg-white outline-none" value={Array.isArray(q.options) ? q.options.join(" | ") : ""} onChange={e => updateQ(i, { options: e.target.value.split("|").map(s => s.trim()).filter(Boolean) })} placeholder="الاختيارات (افصل بينها بـ | )" />
                  )}
                  <input className="w-full rounded-xl border-emerald-100 p-3 text-xs font-black bg-emerald-50 focus:bg-white outline-none border-2" value={typeof q.correct_answer === "string" ? q.correct_answer : (q.correct_answer ?? "")} onChange={e => updateQ(i, { correct_answer: e.target.value })} placeholder="الإجابة الصحيحة النموذجية" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* قائمة الاختبارات الحالية - موبايل (كروت) */}
      <div className="grid grid-cols-1 gap-4 md:hidden">
        {exams.map(ex => (
          <div key={ex.id} className="bg-white p-5 rounded-2xl shadow-sm border-r-4 border-primary/30">
            <div className="flex justify-between items-start mb-2">
              <div className="font-black text-slate-800 text-sm">{ex.title}</div>
              <span className={`px-3 py-1 rounded-full text-[10px] font-black ${ex.status === "published" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                {ex.status === "published" ? "منشور" : "مسودة"}
              </span>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] font-bold text-muted-foreground border-b pb-3 mb-4">
              <span>👤 {ex.grade || "عام"}</span>
              <span>🏘️ {groups.find(g => g.id === ex.group_id)?.name || "الكل"}</span>
              <span>⏱️ {ex.duration_minutes} د</span>
              <span>❓ {ex.question_count} س</span>
            </div>
            <div className="flex gap-2">
              {ex.status !== "published" ? (
                <button onClick={() => setStatus(ex, "published")} className="flex-1 py-2 bg-emerald-600 text-white rounded-xl text-[11px] font-black flex items-center justify-center gap-1"><Send className="h-3.5 w-3.5" /> نشر</button>
              ) : (
                <button onClick={() => setStatus(ex, "draft")} className="flex-1 py-2 bg-slate-100 text-slate-600 rounded-xl text-[11px] font-black flex items-center justify-center gap-1"><Ban className="h-3.5 w-3.5" /> إغلاق</button>
              )}
              {ex.status === "published" && (
                <button onClick={() => toggleAnswers(ex)} className={`p-2 rounded-xl ${ex.answers_released ? "bg-amber-100 text-amber-700" : "bg-indigo-50 text-indigo-600"}`} title={ex.answers_released ? "إخفاء الإجابة الصحيحة" : "إرسال الإجابة الصحيحة للطلاب"}><CheckCircle2 className="h-4 w-4" /></button>
              )}
              <button onClick={() => handleEdit(ex)} className="p-2 bg-primary/10 text-primary rounded-xl" title="تعديل"><Pencil className="h-4 w-4" /></button>
              <button onClick={() => { setAnalysisExamId(ex.id); window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" }); }} className="p-2 bg-secondary/10 text-secondary rounded-xl" title="النتائج"><BarChart3 className="h-4 w-4" /></button>
              <button onClick={() => remove(ex.id)} className="p-2 bg-rose-50 text-rose-500 rounded-xl" title="حذف"><Trash2 className="h-4 w-4" /></button>
            </div>
          </div>
        ))}
      </div>

      {/* قائمة الاختبارات الحالية - كمبيوتر (جدول) */}
      <div className="hidden md:block overflow-hidden rounded-[2rem] border bg-white shadow-sm">
        <table className="w-full text-right text-sm">
          <thead className="bg-primary text-white"><tr><th className="p-4">الاختبار</th><th className="p-4 text-center">الصف / المجموعة</th><th className="p-4 text-center">الزمن / الأسئلة</th><th className="p-4 text-center">الحالة</th><th className="p-4 text-center">إجراءات</th></tr></thead>
          <tbody>
            {exams.map(ex => (
              <tr key={ex.id} className="border-t hover:bg-muted/30 transition-colors">
                <td className="p-4"><div className="font-black text-slate-800">{ex.title}</div><div className="text-[10px] text-muted-foreground font-bold mt-0.5">{ex.subject}</div></td>
                <td className="p-4 text-center text-xs font-bold text-slate-600">{ex.grade || "—"}<br/><span className="text-muted-foreground">{groups.find(g => g.id === ex.group_id)?.name || "كل المجموعات"}</span></td>
                <td className="p-4 text-center font-bold text-slate-700">{ex.duration_minutes} دقيقة<br/><span className="text-xs text-muted-foreground">{ex.question_count} سؤال</span></td>
                <td className="p-4 text-center"><span className={`rounded-full px-3 py-1 text-[10px] font-black ${ex.status === "published" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>{ex.status === "published" ? "منشور ومتاح" : "مسودة (مخفي)"}</span></td>
                <td className="p-4">
                  <div className="flex justify-center gap-2">
                    {ex.status !== "published" ? (
                      <button onClick={() => setStatus(ex, "published")} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-[11px] font-black text-white hover:scale-105 transition-all flex items-center gap-1"><Send className="h-3.5 w-3.5" /> نشر</button>
                    ) : (
                      <button onClick={() => setStatus(ex, "draft")} className="rounded-lg bg-slate-100 px-3 py-1.5 text-[11px] font-black text-slate-500 hover:bg-slate-200 transition-all flex items-center gap-1"><Ban className="h-3.5 w-3.5" /> إغلاق</button>
                    )}
                    <button onClick={() => handleEdit(ex)} className="rounded-lg bg-primary/10 p-2 text-primary hover:bg-primary/20 transition-all" title="تعديل الاختبار"><Pencil className="h-4 w-4" /></button>
                    <button onClick={() => { setAnalysisExamId(ex.id); window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" }); }} className="rounded-lg bg-secondary/10 p-2 text-secondary hover:bg-secondary/20 transition-all" title="نتائج الطلاب والتحليل"><BarChart3 className="h-4 w-4" /></button>
                    <button onClick={() => remove(ex.id)} className="rounded-lg bg-rose-50 p-2 text-rose-500 hover:bg-rose-100 transition-all" title="حذف نهائي"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* قسم التحليل والنتائج */}
      <section className="rounded-3xl border bg-white p-6 shadow-sm">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-black text-primary"><BarChart3 className="h-6 w-6" /> تحليل نتائج الطلاب</h2>
            <p className="text-xs text-muted-foreground font-bold mt-1">عرض المتفوقين وترتيب من أجابوا على الاختبارات.</p>
          </div>
          <select className="rounded-xl border-slate-200 p-3 text-xs font-black bg-slate-50 outline-none focus:ring-2 focus:ring-primary/20" value={analysisExamId} onChange={e => setAnalysisExamId(e.target.value)}>
            <option value="">جميع الاختبارات</option>
            {exams.map(ex => <option key={ex.id} value={ex.id}>{ex.title}</option>)}
          </select>
        </div>

        <div className="mb-6 grid gap-4 grid-cols-1 sm:grid-cols-3">
          <div className="rounded-2xl bg-primary/5 p-4 border border-primary/10 text-center"><div className="text-[10px] font-black text-primary uppercase mb-1">من أجابوا</div><div className="text-3xl font-black text-primary">{rows.length}</div></div>
          <div className="rounded-2xl bg-emerald-50 p-4 border border-emerald-100 text-center"><div className="text-[10px] font-black text-emerald-600 uppercase mb-1">متوسط الأداء</div><div className="text-3xl font-black text-emerald-700">{avg}%</div></div>
          <div className="rounded-2xl bg-gold/5 p-4 border border-gold/10 text-center"><div className="text-[10px] font-black text-gold-foreground uppercase mb-1">نسبة النجاح</div><div className="text-3xl font-black text-gold-foreground">{passed} / {rows.length}</div></div>
        </div>

        {rows.length === 0 ? (
          <div className="py-12 text-center text-xs font-bold text-muted-foreground bg-slate-50 rounded-2xl border border-dashed">لم يسجل أي طالب إجابات لهذا الاختبار بعد.</div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border">
            <table className="w-full text-right text-sm">
              <thead className="bg-slate-50 font-black text-muted-foreground tracking-wider uppercase text-[10px]"><tr><th className="p-3 text-center">المركز</th><th className="p-3">الطالب</th><th className="p-3">المجموعة</th><th className="p-3 text-center">الدرجة</th><th className="p-3 text-center">النسبة</th><th className="p-3 text-center">الزمن</th><th className="p-3 text-center">المستوى</th></tr></thead>
              <tbody className="divide-y">
                {rows.map((r, i) => (
                  <tr key={r.id} className="hover:bg-primary/5 transition-colors">
                    <td className="p-3 text-center font-black">{i < 3 ? <span className="inline-flex items-center justify-center h-7 w-7 rounded-full bg-gold text-gold-foreground shadow-sm text-xs"><Trophy className="h-3.5 w-3.5" /></span> : i + 1}</td>
                    <td className="p-3 font-bold text-slate-800">{r.name}<div className="text-[10px] text-muted-foreground font-mono mt-0.5">{r.code}</div></td>
                    <td className="p-3 text-xs font-bold text-slate-500">{r.group}</td>
                    <td className="p-3 text-center font-bold text-slate-700">{r.score} / {r.max}</td>
                    <td className="p-3 text-center font-black text-primary">{r.pct}%</td>
                    <td className="p-3 text-center text-xs font-bold text-slate-400">{r.mins} د</td>
                    <td className="p-3 text-center"><span className={`rounded-full px-3 py-1 text-[10px] font-black shadow-sm ${r.level.cls}`}>{r.level.label}</span></td>
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
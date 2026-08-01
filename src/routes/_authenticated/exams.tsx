import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { Sparkles, Trash2, X, Loader2, FileQuestion, Plus, CheckCircle2, LayoutList, BrainCircuit, Timer, Edit3 } from "lucide-react";
import { generateExam } from "@/lib/exams.functions";
import { updateExamStatusAdmin, getExamsDataAdmin, saveExamFullAdmin, deleteExamAdmin } from "@/lib/admin.functions";
import { QUESTION_KINDS, TERMS, GRADES } from "@/lib/exam-constants";

export const Route = createFileRoute("/_authenticated/exams")({
  head: () => ({ meta: [{ title: "الاختبارات الذكية — الأستاذ" }] }),
  component: ExamsPage,
});

function ExamsPage() {
  const [groups, setGroups] = useState<any[]>([]);
  const [exams, setExams] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [createMode, setCreateMode] = useState<"ai" | "manual" | null>(null);
  const [previewExam, setPreviewExam] = useState<{ id?: string; exam: any; questions: any[] } | null>(null);
  
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
    } catch { toast.error("فشل التحميل"); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function startAiBuild() {
    setBusy(true);
    const t = toast.loading("جاري التوليد...");
    try {
      const res = await gen({
        data: { grade: form.grade, term: form.term, subject: form.subject || "—", unit: "—", lesson: form.lesson, questionCount: Number(form.question_count), totalScore: Number(form.total_score), difficulty: form.difficulty, kinds },
      });
      const qs = res.questions.map((q, i) => ({
        position: i + 1, kind: q.kind || "اختيار من متعدد", prompt: q.prompt, passage: q.passage || null,
        options: q.options || [], correct_answer: q.correct_answer ?? null, rationale: q.rationale || null,
        skill: q.skill || null, difficulty: q.difficulty || form.difficulty, score: Number(q.score) || 1,
      }));
      setPreviewExam({
        exam: { title: `${form.subject || "اختبار"} — ${form.lesson}`, grade: form.grade, term: form.term, group_id: form.group_id || null, subject: form.subject || null, question_count: qs.length, duration_minutes: Number(form.duration_minutes), total_score: Number(form.total_score), difficulty: form.difficulty, question_types: kinds, adaptive: form.adaptive, status: "draft" },
        questions: qs
      });
      toast.success("تم التوليد بنجاح", { id: t });
    } catch { toast.error("فشل التوليد", { id: t }); }
    finally { setBusy(false); }
  }

  async function finalizeSave() {
    if (!previewExam) return;
    setBusy(true);
    try {
      await saveFullExamFn({ data: { id: previewExam.id, exam: previewExam.exam, questions: previewExam.questions } });
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
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-black flex items-center gap-2"><FileQuestion className="h-6 w-6 text-primary" /> الاختبارات الذكية</h1>
        <div className="flex gap-2">
          <button onClick={() => setCreateMode("ai")} className="inline-flex items-center gap-2 rounded-xl bg-gold px-4 py-2 text-sm font-bold text-gold-foreground"><BrainCircuit className="h-4 w-4" /> إنشاء بالذكاء الاصطناعي</button>
          <button onClick={() => setCreateMode("manual")} className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white"><Plus className="h-4 w-4" /> إنشاء يدوياً</button>
        </div>
      </div>

      {(createMode || previewExam) && (
        <section className="rounded-2xl border-2 border-primary/10 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-black text-primary">إعدادات الاختبار الجديد</h2>
            <button onClick={() => {setCreateMode(null); setPreviewExam(null);}} className="p-1 hover:bg-muted rounded"><X className="h-4 w-4" /></button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="block text-xs font-bold">المادة / الدرس<input className="w-full rounded-lg border p-2 mt-1" value={form.subject} onChange={e => setForm({...form, subject: e.target.value})} placeholder="مثال: لغة عربية" /></label>
            <label className="block text-xs font-bold">اسم الدرس<input className="w-full rounded-lg border p-2 mt-1" value={form.lesson} onChange={e => setForm({...form, lesson: e.target.value})} /></label>
            <label className="block text-xs font-bold flex items-center gap-2"><Timer className="h-3 w-3 text-primary" /> زمن الاختبار (بالدقائق)
              <input type="number" className="w-full rounded-lg border p-2 mt-1" value={form.duration_minutes} onChange={e => setForm({...form, duration_minutes: +e.target.value})} />
            </label>
            <label className="block text-xs font-bold">الدرجة الكلية<input type="number" className="w-full rounded-lg border p-2 mt-1" value={form.total_score} onChange={e => setForm({...form, total_score: +e.target.value})} /></label>
          </div>
          {createMode === "ai" && (
            <div className="mt-4 flex gap-2">
              <button onClick={startAiBuild} disabled={busy} className="inline-flex items-center gap-2 rounded-xl bg-gold px-6 py-2.5 text-sm font-black text-gold-foreground">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "بدء التوليد الذكي"}</button>
            </div>
          )}
        </section>
      )}

      {previewExam && (
        <div className="space-y-4 rounded-2xl bg-primary/5 p-5 border">
          <div className="flex justify-between items-center"><h3 className="font-black text-primary">مراجعة الاختبار</h3><button onClick={finalizeSave} className="rounded-xl bg-emerald-600 px-6 py-2 text-sm font-black text-white">حفظ الاختبار نهائياً</button></div>
          <div className="space-y-3">{previewExam.questions.map((q, i) => (<div key={i} className="bg-white p-3 rounded-lg border text-sm font-bold">{i+1}. {q.prompt} ({q.score} درجة)</div>))}</div>
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
        <table className="w-full text-right text-sm">
          <thead className="bg-primary text-white"><tr><th className="p-3">الاختبار</th><th className="p-3 text-center">الزمن</th><th className="p-3 text-center">الأسئلة</th><th className="p-3 text-center">الحالة</th><th className="p-3 text-center">إجراءات</th></tr></thead>
          <tbody>
            {exams.map(ex => (
              <tr key={ex.id} className="border-t hover:bg-muted/30">
                <td className="p-3 font-bold text-primary">{ex.title}</td>
                <td className="p-3 text-center font-bold">{ex.duration_minutes} دقيقة</td>
                <td className="p-3 text-center font-bold">{ex.question_count}</td>
                <td className="p-3 text-center"><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${ex.status === "published" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>{ex.status === "published" ? "منشور" : "مسودة"}</span></td>
                <td className="p-3">
                  <div className="flex justify-center gap-2">
                    {ex.status !== "published" && <button onClick={() => setStatus(ex, "published")} className="rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-bold text-white">نشر</button>}
                    <button onClick={() => remove(ex.id)} className="text-destructive p-1 hover:bg-destructive/10 rounded"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
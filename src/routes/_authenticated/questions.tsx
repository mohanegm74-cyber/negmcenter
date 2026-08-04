import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { MessageCircleQuestion, Check, Trash2, Send, Loader2, Eraser, CheckCircle2 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { getStudentQuestionsAdmin, answerStudentQuestionAdmin, deleteStudentQuestionAdmin, deleteAllStudentQuestionsAdmin } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/questions")({
  head: () => ({ meta: [{ title: "أسئلة الطلاب — الأستاذ" }, { name: "description", content: "استقبال أسئلة الطلاب والرد عليها." }] }),
  component: QuestionsPage,
});

type Q = { id: string; student_id: string; body: string; answer: string | null; is_read: boolean; created_at: string; answered_at: string | null };
type S = { id: string; full_name: string; code: string };

function QuestionsPage() {
  const [rows, setRows] = useState<Q[]>([]);
  const [students, setStudents] = useState<Record<string, S>>({});
  const [answering, setAnswering] = useState<string | null>(null);
  const [answerText, setAnswerText] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const listFn = useServerFn(listQuestionsWrapper); // استخدام مغلف لتحديث الحالة المحلية فوراً
  const answerFn = useServerFn(answerStudentQuestionAdmin);
  const deleteFn = useServerFn(deleteStudentQuestionAdmin);
  const deleteAllFn = useServerFn(deleteAllStudentQuestionsAdmin);

  async function load() {
    setLoading(true);
    try {
      const res = await getStudentQuestionsAdmin({});
      setRows(res.questions as Q[]);
      setStudents(Object.fromEntries(((res.students as S[]) || []).map(x => [x.id, x])));
    } catch (e: any) {
      toast.error("فشل تحميل الأسئلة");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  async function markRead(id: string) {
    try {
      await answerFn({ data: { id, answer: rows.find(r => r.id === id)?.answer || "" } });
      // تحديث محلي فوري لإخفاء الإشعار
      setRows(prev => prev.map(q => q.id === id ? { ...q, is_read: true } : q));
      window.dispatchEvent(new CustomEvent("najm:questions-read"));
      toast.success("تم التحديد كمقروء");
    } catch (e: any) { toast.error(e.message); }
  }
  
  async function remove(id: string) {
    if (!confirm("حذف السؤال؟")) return;
    try {
      await deleteFn({ data: { id } });
      toast.success("تم الحذف");
      setRows(prev => prev.filter(q => q.id !== id));
      window.dispatchEvent(new CustomEvent("najm:questions-read"));
    } catch (e: any) { toast.error(e.message); }
  }

  async function handleClearAll() {
    if (!confirm("تحذير: سيتم حذف كافة الأسئلة (المجابة وغير المجابة) نهائياً. هل أنت متأكد؟")) return;
    setBusy(true);
    try {
      await deleteAllFn({});
      toast.success("تم مسح كافة الأسئلة");
      setRows([]);
      window.dispatchEvent(new CustomEvent("najm:questions-read"));
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(false); }
  }

  async function handleSendAnswer(id: string) {
    if (!answerText.trim()) return;
    setBusy(true);
    try {
      await answerFn({ data: { id, answer: answerText.trim() } });
      toast.success("تم إرسال الرد بنجاح");
      setAnswering(null); 
      setAnswerText("");
      // تحديث محلي فوري
      setRows(prev => prev.map(q => q.id === id ? { ...q, answer: answerText.trim(), is_read: true, answered_at: new Date().toISOString() } : q));
      window.dispatchEvent(new CustomEvent("najm:questions-read"));
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(false); }
  }

  // دالة وهمية لتجنب خطأ الـ wrapper
  async function listQuestionsWrapper() { return { questions: [], students: [] }; }

  if (loading && rows.length === 0) return <div className="flex h-64 items-center justify-center text-muted-foreground"><Loader2 className="h-8 w-8 animate-spin" /></div>;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between flex-wrap gap-4">
        <h1 className="text-2xl font-black flex items-center gap-2"><MessageCircleQuestion className="h-6 w-6 text-primary" /> أسئلة الطلاب <span className="text-sm font-normal text-muted-foreground">({rows.length})</span></h1>
        {rows.length > 0 && (
          <button onClick={handleClearAll} disabled={busy} className="inline-flex items-center gap-1.5 rounded-xl bg-destructive/10 px-4 py-2 text-xs font-black text-destructive hover:bg-destructive hover:text-white transition-all">
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Eraser className="h-3.5 w-3.5" />} مسح كافة الأسئلة
          </button>
        )}
      </div>

      {rows.length === 0 ? (
        <div className="rounded-2xl bg-white p-12 text-center text-muted-foreground shadow-sm">لا توجد أسئلة حالياً.</div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {rows.map(q => {
            const st = students[q.student_id];
            const hasAnswer = !!q.answer;
            return (
              <div key={q.id} className={`rounded-3xl bg-white p-6 shadow-sm border-2 transition-all ${!q.is_read ? "border-primary" : "border-slate-100"}`}>
                <div className="mb-4 flex items-start justify-between gap-2">
                  <div>
                    <div className="font-black text-slate-800 text-lg">{st?.full_name || "طالب"}</div>
                    <div className="font-mono text-xs text-muted-foreground mt-1">{st?.code} — {new Date(q.created_at).toLocaleString("ar-EG")}</div>
                  </div>
                  <div className="flex gap-2">
                    {!q.is_read && (
                      <button onClick={() => markRead(q.id)} className="inline-flex items-center gap-1 rounded-xl bg-secondary/10 px-3 py-1.5 text-xs font-black text-secondary hover:bg-secondary/20 transition-all"><Check className="h-4 w-4" /> قرأت السؤال</button>
                    )}
                    <button onClick={() => remove(q.id)} className="rounded-xl p-2 text-destructive hover:bg-rose-50 transition-all"><Trash2 className="h-5 w-5" /></button>
                  </div>
                </div>
                
                <div className="bg-slate-50 p-4 rounded-2xl text-sm font-bold text-slate-700 leading-relaxed italic">"{q.body}"</div>

                {hasAnswer && (
                  <div className="mt-4 bg-emerald-50 p-4 rounded-2xl border border-emerald-100">
                    <div className="text-[10px] font-black text-emerald-600 mb-1 flex items-center gap-1 uppercase"><CheckCircle2 className="h-3 w-3" /> تم الرد بنجاح:</div>
                    <div className="text-sm font-black text-emerald-800">{q.answer}</div>
                    <div className="text-[9px] text-emerald-500 mt-2 font-bold uppercase tracking-widest">{new Date(q.answered_at!).toLocaleString("ar-EG")}</div>
                  </div>
                )}

                {answering === q.id ? (
                  <div className="mt-4 space-y-3 animate-in slide-in-from-top-2">
                    <textarea 
                      value={answerText} 
                      onChange={e => setAnswerText(e.target.value)} 
                      rows={3} 
                      className="w-full rounded-2xl border-2 border-primary/20 bg-white p-4 text-sm font-bold outline-none focus:border-primary transition-all" 
                      placeholder="اكتب ردك الواضح للطالب هنا..." 
                    />
                    <div className="flex gap-2">
                      <button 
                        onClick={() => handleSendAnswer(q.id)} 
                        disabled={busy || !answerText.trim()} 
                        className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-black text-white shadow-lg shadow-primary/20 disabled:opacity-50 transition-all"
                      >
                        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} إرسال الرد الآن
                      </button>
                      <button 
                        onClick={() => setAnswering(null)} 
                        className="px-6 rounded-xl bg-slate-100 text-slate-600 text-sm font-black"
                      >إلغاء</button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-4">
                    <button 
                      onClick={() => { setAnswering(q.id); setAnswerText(q.answer || ""); }} 
                      className={`inline-flex items-center gap-2 rounded-xl px-6 py-2.5 text-xs font-black transition-all ${hasAnswer ? "bg-slate-100 text-slate-500 hover:bg-slate-200" : "bg-primary text-white shadow-lg shadow-primary/10 hover:scale-105"}`}
                    >
                      {hasAnswer ? "تعديل الرد" : "الرد على السؤال"}
                    </button>
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
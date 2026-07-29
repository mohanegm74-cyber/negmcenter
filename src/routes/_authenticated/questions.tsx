import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { MessageCircleQuestion, Check, Trash2, Send, Loader2 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { getStudentQuestionsAdmin, answerStudentQuestionAdmin, deleteStudentQuestionAdmin } from "@/lib/admin.functions";

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

  const listFn = useServerFn(getStudentQuestionsAdmin);
  const answerFn = useServerFn(answerStudentQuestionAdmin);
  const deleteFn = useServerFn(deleteStudentQuestionAdmin);

  async function load() {
    setLoading(true);
    try {
      const res = await listFn({});
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
      load();
    } catch (e: any) { toast.error(e.message); }
  }
  
  async function remove(id: string) {
    if (!confirm("حذف السؤال؟")) return;
    try {
      await deleteFn({ data: { id } });
      toast.success("تم الحذف");
      load();
    } catch (e: any) { toast.error(e.message); }
  }

  async function sendAnswer(id: string) {
    if (!answerText.trim()) return;
    try {
      await answerFn({ data: { id, answer: answerText.trim() } });
      toast.success("تم الرد");
      setAnswering(null); setAnswerText(""); load();
    } catch (e: any) { toast.error(e.message); }
  }

  if (loading && rows.length === 0) return <div className="flex h-64 items-center justify-center text-muted-foreground"><Loader2 className="h-8 w-8 animate-spin" /></div>;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-black flex items-center gap-2"><MessageCircleQuestion className="h-6 w-6 text-primary" /> أسئلة الطلاب <span className="text-sm font-normal text-muted-foreground">({rows.length})</span></h1>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-2xl bg-white p-12 text-center text-muted-foreground shadow-sm">لا توجد أسئلة بعد.</div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {rows.map(q => {
            const st = students[q.student_id];
            return (
              <div key={q.id} className={`rounded-2xl bg-white p-4 shadow-sm ${!q.is_read ? "border-r-4 border-r-primary" : ""}`}>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div>
                    <div className="font-bold">{st?.full_name || "طالب"}</div>
                    <div className="font-mono text-xs text-muted-foreground">{st?.code} — {new Date(q.created_at).toLocaleString("ar-EG")}</div>
                  </div>
                  <div className="flex gap-1">
                    {!q.is_read && <button onClick={() => markRead(q.id)} className="inline-flex items-center gap-1 rounded-lg bg-secondary/15 px-2 py-1 text-xs font-bold text-secondary"><Check className="h-3.5 w-3.5" /> مقروء</button>}
                    <button onClick={() => remove(q.id)} className="rounded-lg p-1.5 text-destructive hover:bg-destructive/10"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </div>
                <p className="whitespace-pre-wrap text-sm">{q.body}</p>
                {q.answer && <div className="mt-3 rounded-lg bg-secondary/10 p-3 text-sm"><b>ردّك:</b> {q.answer}</div>}
                {answering === q.id ? (
                  <div className="mt-3 flex gap-2">
                    <textarea value={answerText} onChange={e => setAnswerText(e.target.value)} rows={2} className="flex-1 rounded-lg border border-input px-3 py-2 text-sm" placeholder="اكتب ردّك..." />
                    <button onClick={() => sendAnswer(q.id)} className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-2 text-sm font-bold text-primary-foreground self-start"><Send className="h-4 w-4" /> إرسال</button>
                  </div>
                ) : (
                  <button onClick={() => { setAnswering(q.id); setAnswerText(q.answer || ""); }} className="mt-2 text-xs font-bold text-primary hover:underline">{q.answer ? "تعديل الرد" : "الرد"}</button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
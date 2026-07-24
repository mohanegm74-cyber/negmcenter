import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { MessageCircleQuestion, Check, Trash2, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

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

  async function load() {
    const [{ data: q }, { data: s }] = await Promise.all([
      supabase.from("questions").select("*").order("created_at", { ascending: false }),
      supabase.from("students").select("id,full_name,code"),
    ]);
    setRows((q as Q[]) || []);
    setStudents(Object.fromEntries(((s as S[]) || []).map(x => [x.id, x])));
  }
  useEffect(() => { load(); }, []);

  async function markRead(id: string) {
    const { error } = await supabase.from("questions").update({ is_read: true }).eq("id", id);
    if (error) toast.error(error.message); else load();
  }
  async function remove(id: string) {
    if (!confirm("حذف السؤال؟")) return;
    const { error } = await supabase.from("questions").delete().eq("id", id);
    if (error) toast.error(error.message); else load();
  }
  async function sendAnswer(id: string) {
    if (!answerText.trim()) return;
    const { error } = await supabase.from("questions").update({ answer: answerText.trim(), answered_at: new Date().toISOString(), is_read: true }).eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("تم الرد"); setAnswering(null); setAnswerText(""); load(); }
  }

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

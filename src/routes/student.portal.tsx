import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { toast } from "sonner";
import { ArrowRight, LogOut, CalendarCheck, XCircle, Search, User, BookOpen, Wallet, MessageCircleQuestion, Sparkles, Save, Upload, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { BrandLogo } from "@/components/BrandLogo";
import { generateStudentReport } from "@/lib/ai-report.functions";
import { useServerFn } from "@tanstack/react-start";

export const Route = createFileRoute("/student/portal")({
  head: () => ({ meta: [{ title: "صفحة الطالب — سنتر الأستاذ محمد نجم" }, { name: "description", content: "بوابة الطالب: الجدول، الحضور، الواجبات، المالية، وتقرير الذكاء الاصطناعي." }] }),
  component: Portal,
});

type Student = { id: string; code: string; full_name: string; grade: string | null; group_id: string | null; subject: string | null; teacher_name: string | null; phone: string | null; parent_phone: string | null; address: string | null; school: string | null; section: string | null; };
type Group = { id: string; name: string; days: string | null; time: string | null; room: string | null; teacher_name: string | null; color: string | null; monthly_fee: number };
type Att = { id: string; date: string; status: string };
type HW = { id: string; group_id: string | null; title: string; description: string | null; due_date: string | null; max_score: number };
type Sub = { id: string; homework_id: string; student_id: string; score: number | null; status: string; note: string | null; file_url: string | null };
type Payment = { id: string; amount: number; kind: string; method: string | null; note: string | null; month: string | null; paid_at: string };
type Note = { id: string; title: string | null; body: string; created_at: string };
type Q = { id: string; body: string; answer: string | null; created_at: string; answered_at: string | null };

type Tab = "info" | "schedule" | "attendance" | "homework" | "grades" | "finance" | "notes" | "ask" | "ai" | "edit";

function Portal() {
  const [student, setStudent] = useState<Student | null>(null);
  const [group, setGroup] = useState<Group | null>(null);
  const [attendance, setAttendance] = useState<Att[]>([]);
  const [homework, setHomework] = useState<HW[]>([]);
  const [subs, setSubs] = useState<Sub[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [questions, setQuestions] = useState<Q[]>([]);
  const [tab, setTab] = useState<Tab>("info");
  const [codeInput, setCodeInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const qrRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const id = typeof window !== "undefined" ? localStorage.getItem("najm_student_id") : null;
    if (!id) { setLoading(false); return; }
    loadStudent(id).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (student && qrRef.current) QRCode.toCanvas(qrRef.current, student.code, { width: 180, margin: 1, color: { dark: "#1e3a8a", light: "#ffffff" } });
  }, [student, tab]);

  async function loadStudent(id: string) {
    const { data: s, error: e1 } = await supabase.from("students").select("*").eq("id", id).maybeSingle();
    if (e1 || !s) { setError("لم يتم العثور على الطالب"); return; }
    setStudent(s as Student);

    const promises: any[] = [
      supabase.from("attendance").select("id,date,status").eq("student_id", s.id).order("date", { ascending: false }).limit(100),
      supabase.from("homework_submissions").select("*").eq("student_id", s.id),
      supabase.from("payments").select("*").eq("student_id", s.id).order("paid_at", { ascending: false }),
      supabase.from("student_notes").select("*").eq("student_id", s.id).order("created_at", { ascending: false }),
      supabase.from("questions").select("*").eq("student_id", s.id).order("created_at", { ascending: false }),
    ];
    if (s.group_id) {
      promises.push(supabase.from("groups").select("*").eq("id", s.group_id).maybeSingle());
      promises.push(supabase.from("homework").select("*").eq("group_id", s.group_id).order("created_at", { ascending: false }));
    } else {
      promises.push(Promise.resolve({ data: null }));
      promises.push(supabase.from("homework").select("*").is("group_id", null));
    }
    const [a, hs, p, n, q, g, h] = await Promise.all(promises);
    setAttendance((a.data as Att[]) || []);
    setSubs((hs.data as Sub[]) || []);
    setPayments((p.data as Payment[]) || []);
    setNotes((n.data as Note[]) || []);
    setQuestions((q.data as Q[]) || []);
    setGroup((g?.data as Group) || null);
    setHomework((h.data as HW[]) || []);
  }

  async function loginByCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const code = codeInput.trim().toUpperCase();
    if (!code) return;
    const { data, error } = await supabase.from("students").select("id, code").eq("code", code).maybeSingle();
    if (error || !data) { setError("الكود غير صحيح"); return; }
    localStorage.setItem("najm_student_id", data.id);
    setLoading(true);
    await loadStudent(data.id);
    setLoading(false);
  }

  function logout() {
    localStorage.removeItem("najm_student_id");
    setStudent(null); setGroup(null); setAttendance([]); setSubs([]); setPayments([]); setNotes([]); setQuestions([]); setHomework([]);
  }

  if (loading) return <div className="flex min-h-screen items-center justify-center text-muted-foreground">جارٍ التحميل...</div>;

  if (!student) {
    return (
      <div className="min-h-screen bg-muted/30">
        <header className="border-b bg-white">
          <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
            <Link to="/" className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline"><ArrowRight className="h-4 w-4" /> الرئيسية</Link>
            <h1 className="text-lg font-bold">دخول الطالب</h1>
          </div>
        </header>
        <main className="mx-auto max-w-md px-6 py-16">
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <h2 className="mb-2 text-xl font-bold">أدخل كودك</h2>
            <p className="mb-6 text-sm text-muted-foreground">الكود ظهر لك عند التسجيل (مثال: STU-XXXXXXXX).</p>
            <form onSubmit={loginByCode} className="space-y-3">
              <input value={codeInput} onChange={(e) => setCodeInput(e.target.value)} placeholder="STU-XXXXXXXX" className="w-full rounded-lg border border-input px-3 py-2.5 text-center font-mono text-base outline-none focus:ring-2 focus:ring-ring" />
              {error && <p className="text-sm text-destructive">{error}</p>}
              <button type="submit" className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-2.5 font-bold text-primary-foreground"><Search className="h-4 w-4" /> دخول</button>
            </form>
            <p className="mt-4 text-center text-sm">
              لست مسجَّلاً؟ <Link to="/student/register" className="font-bold text-secondary hover:underline">سجّل الآن</Link>
            </p>
          </div>
        </main>
      </div>
    );
  }

  const presentCount = attendance.filter(a => a.status === "present").length;
  const absentCount = attendance.filter(a => a.status === "absent").length;
  const lateCount = attendance.filter(a => a.status === "late").length;

  const fee = Number(group?.monthly_fee || 0);
  const paidTotal = payments.filter(p => p.kind === "payment").reduce((a, b) => a + Number(b.amount), 0);
  const chargeTotal = payments.filter(p => p.kind === "charge").reduce((a, b) => a + Number(b.amount), 0);
  const monthsCovered = new Set(payments.filter(p => p.kind === "charge").map(p => p.month)).size || 1;
  const totalDue = chargeTotal || (fee * monthsCovered);
  const balance = totalDue - paidTotal;

  const TABS: { id: Tab; label: string; icon: any }[] = [
    { id: "info", label: "بياناتي", icon: User },
    { id: "schedule", label: "جدولي", icon: CalendarCheck },
    { id: "attendance", label: "الحضور", icon: CalendarCheck },
    { id: "homework", label: "الواجبات", icon: BookOpen },
    { id: "grades", label: "درجاتي", icon: FileText },
    { id: "finance", label: "الماليات", icon: Wallet },
    { id: "notes", label: "ملاحظات الأستاذ", icon: FileText },
    { id: "ask", label: "اسأل الأستاذ", icon: MessageCircleQuestion },
    { id: "ai", label: "تقرير AI", icon: Sparkles },
    { id: "edit", label: "تعديل بياناتي", icon: Save },
  ];

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-6 py-3">
          <Link to="/" className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline"><ArrowRight className="h-4 w-4" /> الرئيسية</Link>
          <div className="flex items-center gap-3 text-center">
            <BrandLogo size={44} className="!shadow-none" />
            <div>
              <h1 className="text-lg font-bold">{student.full_name}</h1>
              <p className="font-mono text-xs text-muted-foreground">{student.code}</p>
            </div>
          </div>
          <button onClick={logout} className="inline-flex items-center gap-1.5 rounded-lg border border-input px-3 py-1.5 text-sm hover:bg-accent"><LogOut className="h-4 w-4" /> خروج</button>
        </div>
        <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 pb-2">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setTab(id)} className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition ${tab === id ? "bg-primary text-primary-foreground shadow" : "text-foreground hover:bg-accent"}`}>
              <Icon className="h-4 w-4" /> {label}
            </button>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-6">
        {tab === "info" && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <section className="rounded-2xl bg-white p-6 shadow-sm lg:col-span-2">
              <h2 className="mb-4 text-lg font-bold">بياناتك</h2>
              <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
                <Info label="الصف" value={student.grade} />
                <Info label="الشعبة" value={student.section} />
                <Info label="المدرسة" value={student.school} />
                <Info label="المادة" value={student.subject} />
                <Info label="المعلم" value={student.teacher_name} />
                <Info label="الهاتف" value={student.phone} />
                <Info label="ولي الأمر" value={student.parent_phone} />
                <Info label="العنوان" value={student.address} />
              </div>
            </section>
            <aside className="rounded-2xl bg-white p-6 text-center shadow-sm">
              <h2 className="mb-4 text-lg font-bold">كود الحضور (QR)</h2>
              <div className="mx-auto inline-block rounded-xl bg-white p-3 shadow" style={{ boxShadow: "var(--shadow-elegant)" }}>
                <canvas ref={qrRef} />
              </div>
              <p className="mt-4 font-mono text-sm text-muted-foreground">{student.code}</p>
            </aside>
          </div>
        )}

        {tab === "schedule" && (
          <section className="rounded-2xl bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-bold">جدولك الدراسي</h2>
            {group ? (
              <div className="rounded-xl border p-4" style={{ borderInlineStartWidth: 6, borderInlineStartColor: group.color || "var(--color-primary)" }}>
                <div className="text-lg font-bold">{group.name}</div>
                <div className="mt-2 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                  <Info label="الأيام" value={group.days} />
                  <Info label="الميعاد" value={group.time} />
                  <Info label="القاعة" value={group.room} />
                  <Info label="المعلم" value={group.teacher_name} />
                </div>
              </div>
            ) : <p className="text-sm text-muted-foreground">لم يتم تعيينك في مجموعة بعد.</p>}
          </section>
        )}

        {tab === "attendance" && (
          <section className="rounded-2xl bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-bold">سجل الحضور</h2>
            <div className="mb-4 grid grid-cols-3 gap-3">
              <Stat icon={<CalendarCheck className="h-5 w-5" />} label="حضور" value={presentCount} tone="secondary" />
              <Stat icon={<XCircle className="h-5 w-5" />} label="غياب" value={absentCount} tone="destructive" />
              <Stat icon={<CalendarCheck className="h-5 w-5" />} label="متأخر" value={lateCount} tone="gold" />
            </div>
            <div className="max-h-96 overflow-auto rounded-xl border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-right"><tr><th className="p-2">التاريخ</th><th className="p-2">الحالة</th></tr></thead>
                <tbody>
                  {attendance.length === 0 ? <tr><td colSpan={2} className="p-4 text-center text-muted-foreground">لا يوجد سجل بعد</td></tr> :
                    attendance.map(a => (
                      <tr key={a.id} className="border-t">
                        <td className="p-2">{a.date}</td>
                        <td className="p-2"><span className={`rounded-full px-2 py-0.5 text-xs font-bold ${a.status === "present" ? "bg-secondary/15 text-secondary" : a.status === "late" ? "bg-gold/25 text-gold-foreground" : "bg-destructive/15 text-destructive"}`}>{a.status === "present" ? "حاضر" : a.status === "late" ? "متأخر" : "غائب"}</span></td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {tab === "homework" && <HomeworkTab student={student} homework={homework} subs={subs} reload={() => loadStudent(student.id)} />}

        {tab === "grades" && (
          <section className="rounded-2xl bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-bold">درجاتي وتقييماتي</h2>
            {subs.filter(s => s.score !== null).length === 0 ? <p className="text-sm text-muted-foreground">لا توجد درجات بعد.</p> : (
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-right"><tr><th className="p-2">الواجب</th><th className="p-2">الدرجة</th><th className="p-2">النسبة</th><th className="p-2">ملاحظة الأستاذ</th></tr></thead>
                <tbody>
                  {subs.filter(s => s.score !== null).map(s => {
                    const hw = homework.find(h => h.id === s.homework_id);
                    const pct = hw ? Math.round((Number(s.score) / hw.max_score) * 100) : 0;
                    return (
                      <tr key={s.id} className="border-t">
                        <td className="p-2 font-semibold">{hw?.title || "—"}</td>
                        <td className="p-2">{s.score} / {hw?.max_score}</td>
                        <td className="p-2"><span className={`rounded-full px-2 py-0.5 text-xs font-bold ${pct >= 80 ? "bg-secondary/15 text-secondary" : pct >= 50 ? "bg-gold/25 text-gold-foreground" : "bg-destructive/15 text-destructive"}`}>{pct}%</span></td>
                        <td className="p-2 text-muted-foreground">{s.note || "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </section>
        )}

        {tab === "finance" && (
          <section className="rounded-2xl bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-bold">حسابك المالي</h2>
            <div className="mb-4 grid grid-cols-3 gap-3">
              <Kpi label="المستحق" value={totalDue} tone="primary" />
              <Kpi label="المدفوع" value={paidTotal} tone="secondary" />
              <Kpi label="المتأخرات" value={balance} tone={balance > 0 ? "destructive" : "secondary"} />
            </div>
            <div className="overflow-auto rounded-xl border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-right"><tr><th className="p-2">التاريخ</th><th className="p-2">النوع</th><th className="p-2">الشهر</th><th className="p-2">المبلغ</th><th className="p-2">ملاحظة</th></tr></thead>
                <tbody>
                  {payments.length === 0 ? <tr><td colSpan={5} className="p-4 text-center text-muted-foreground">لا توجد حركات</td></tr> :
                    payments.map(p => (
                      <tr key={p.id} className="border-t">
                        <td className="p-2">{p.paid_at}</td>
                        <td className="p-2"><span className={`rounded-full px-2 py-0.5 text-xs font-bold ${p.kind === "payment" ? "bg-secondary/15 text-secondary" : "bg-gold/25 text-gold-foreground"}`}>{p.kind === "payment" ? "مدفوع" : "مستحق"}</span></td>
                        <td className="p-2">{p.month || "—"}</td>
                        <td className="p-2 font-bold">{Number(p.amount).toLocaleString("ar-EG")}</td>
                        <td className="p-2 text-muted-foreground">{p.note || "—"}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {tab === "notes" && (
          <section className="rounded-2xl bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-bold">ملاحظات الأستاذ (لولي الأمر)</h2>
            {notes.length === 0 ? <p className="text-sm text-muted-foreground">لا توجد ملاحظات.</p> : (
              <div className="space-y-3">
                {notes.map(n => (
                  <div key={n.id} className="rounded-xl border-r-4 border-r-primary bg-muted/20 p-4">
                    {n.title && <div className="mb-1 font-bold text-primary">{n.title}</div>}
                    <p className="whitespace-pre-wrap text-sm">{n.body}</p>
                    <div className="mt-2 text-xs text-muted-foreground">{new Date(n.created_at).toLocaleString("ar-EG")}</div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {tab === "ask" && <AskTab studentId={student.id} questions={questions} reload={() => loadStudent(student.id)} />}

        {tab === "ai" && <AiTab student={student} group={group} attendance={attendance} homework={homework} subs={subs} notes={notes} totalDue={totalDue} paidTotal={paidTotal} balance={balance} />}

        {tab === "edit" && <EditTab student={student} reload={() => loadStudent(student.id)} />}
      </main>
    </div>
  );
}

function HomeworkTab({ student, homework, subs, reload }: { student: Student; homework: HW[]; subs: Sub[]; reload: () => void }) {
  const [uploading, setUploading] = useState<string | null>(null);

  async function upload(hw: HW, file: File) {
    setUploading(hw.id);
    try {
      const path = `${student.id}/${hw.id}_${Date.now()}_${file.name}`;
      const { error: e1 } = await supabase.storage.from("submissions").upload(path, file, { upsert: true });
      if (e1) throw e1;
      const existing = subs.find(x => x.homework_id === hw.id && x.student_id === student.id);
      const body: any = { homework_id: hw.id, student_id: student.id, file_url: path, status: "submitted" };
      if (existing) body.id = existing.id;
      const { error: e2 } = await supabase.from("homework_submissions").upsert(body, { onConflict: "homework_id,student_id" });
      if (e2) throw e2;
      toast.success("تم رفع الحل بنجاح");
      reload();
    } catch (err: any) { toast.error(err.message || "فشل الرفع"); }
    finally { setUploading(null); }
  }

  async function viewFile(path: string) {
    const { data } = await supabase.storage.from("submissions").createSignedUrl(path, 3600);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  }

  return (
    <section className="rounded-2xl bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-lg font-bold">واجباتي</h2>
      {homework.length === 0 ? <p className="text-sm text-muted-foreground">لا توجد واجبات لمجموعتك حالياً.</p> : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {homework.map(hw => {
            const sub = subs.find(x => x.homework_id === hw.id);
            return (
              <div key={hw.id} className="rounded-xl border p-4">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-bold">{hw.title}</h3>
                  {sub?.score !== null && sub?.score !== undefined && (
                    <span className="rounded-full bg-secondary/15 px-2 py-0.5 text-xs font-bold text-secondary">{sub.score}/{hw.max_score}</span>
                  )}
                </div>
                {hw.description && <p className="mt-1 text-sm text-muted-foreground">{hw.description}</p>}
                {hw.due_date && <p className="mt-1 text-xs text-muted-foreground">تاريخ التسليم: {hw.due_date}</p>}
                <div className="mt-3 flex items-center gap-2">
                  <label className={`inline-flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground ${uploading === hw.id ? "opacity-50" : ""}`}>
                    <Upload className="h-4 w-4" /> {uploading === hw.id ? "جارٍ الرفع..." : sub?.file_url ? "استبدال الحل" : "رفع حل الواجب"}
                    <input type="file" accept="image/*,application/pdf" className="hidden" disabled={uploading === hw.id} onChange={e => { const f = e.target.files?.[0]; if (f) upload(hw, f); }} />
                  </label>
                  {sub?.file_url && <button onClick={() => viewFile(sub.file_url!)} className="rounded-lg bg-muted px-3 py-2 text-xs font-bold">عرض حلي</button>}
                </div>
                {sub?.note && <div className="mt-2 rounded-lg bg-gold/10 p-2 text-xs"><b>ملاحظة الأستاذ:</b> {sub.note}</div>}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function AskTab({ studentId, questions, reload }: { studentId: string; questions: Q[]; reload: () => void }) {
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setSending(true);
    const { error } = await supabase.from("questions").insert({ student_id: studentId, body: body.trim() });
    setSending(false);
    if (error) toast.error(error.message);
    else { toast.success("تم إرسال السؤال للأستاذ"); setBody(""); reload(); }
  }
  return (
    <section className="rounded-2xl bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-lg font-bold">اسأل الأستاذ</h2>
      <form onSubmit={send} className="mb-6 space-y-2">
        <textarea value={body} onChange={e => setBody(e.target.value)} rows={3} placeholder="اكتب سؤالك هنا..." className="w-full rounded-lg border border-input px-3 py-2 text-sm" />
        <button type="submit" disabled={sending} className="inline-flex items-center gap-1 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground disabled:opacity-50">{sending ? "جارٍ الإرسال..." : "إرسال"}</button>
      </form>
      <h3 className="mb-2 font-bold">أسئلتك السابقة</h3>
      {questions.length === 0 ? <p className="text-sm text-muted-foreground">لم ترسل أسئلة بعد.</p> : (
        <div className="space-y-3">
          {questions.map(q => (
            <div key={q.id} className="rounded-xl border p-3">
              <p className="text-sm"><b>سؤالك:</b> {q.body}</p>
              <div className="text-xs text-muted-foreground">{new Date(q.created_at).toLocaleString("ar-EG")}</div>
              {q.answer ? <div className="mt-2 rounded-lg bg-secondary/10 p-2 text-sm"><b>ردّ الأستاذ:</b> {q.answer}</div> : <div className="mt-2 text-xs text-muted-foreground">بانتظار الرد...</div>}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function AiTab({ student, group, attendance, homework, subs, notes, totalDue, paidTotal, balance }: any) {
  const [text, setText] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const gen = useServerFn(generateStudentReport);

  async function run() {
    setLoading(true);
    try {
      const hwPayload = homework.map((h: HW) => {
        const s = subs.find((x: Sub) => x.homework_id === h.id);
        return { title: h.title, score: s?.score ?? null, max_score: h.max_score, status: s?.status || "لم يُسلَّم" };
      });
      const r = await gen({ data: {
        student: { full_name: student.full_name, grade: student.grade, group: group?.name || null },
        attendance: {
          present: attendance.filter((a: Att) => a.status === "present").length,
          absent: attendance.filter((a: Att) => a.status === "absent").length,
          late: attendance.filter((a: Att) => a.status === "late").length,
        },
        homework: hwPayload,
        finance: { due: totalDue, paid: paidTotal, balance },
        notes: notes.map((n: Note) => n.body),
      }});
      setText(r.text);
    } catch (e: any) { toast.error(e.message || "فشل توليد التقرير"); }
    finally { setLoading(false); }
  }

  function printReport() {
    if (!text) return;
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"/><title>تقرير الطالب</title>
      <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;900&display=swap" rel="stylesheet">
      <style>body{font-family:'Cairo',sans-serif;padding:40px;max-width:800px;margin:auto;line-height:1.9;color:#0f172a}
      h1{color:#1e3a8a;border-bottom:3px double #c9a227;padding-bottom:10px}
      .meta{color:#64748b;font-size:14px;margin-bottom:20px}
      .body{white-space:pre-wrap;font-size:15px}
      button{background:#1e3a8a;color:#fff;border:0;padding:8px 16px;border-radius:8px;font-family:inherit;font-weight:700;cursor:pointer}
      @media print{button{display:none}}
      </style></head><body>
      <button onclick="window.print()">🖨️ طباعة / حفظ PDF</button>
      <h1>تقرير تحليلي للطالب: ${student.full_name}</h1>
      <div class="meta">${student.grade || ""} — ${group?.name || ""} — ${new Date().toLocaleDateString("ar-EG")}</div>
      <div class="body">${text.replace(/</g, "&lt;")}</div>
      </body></html>`);
    w.document.close();
  }

  return (
    <section className="rounded-2xl bg-white p-6 shadow-sm">
      <h2 className="mb-2 flex items-center gap-2 text-lg font-bold"><Sparkles className="h-5 w-5 text-gold" /> تقرير الذكاء الاصطناعي</h2>
      <p className="mb-4 text-sm text-muted-foreground">تقرير تحليلي احترافي لأداء الطالب يمكن لولي الأمر مراجعته وطباعته.</p>
      <div className="mb-4 flex gap-2">
        <button onClick={run} disabled={loading} className="inline-flex items-center gap-1 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground disabled:opacity-50">{loading ? "جارٍ التحليل..." : text ? "إعادة التوليد" : "توليد التقرير"}</button>
        {text && <button onClick={printReport} className="rounded-lg bg-gold px-4 py-2 text-sm font-bold text-gold-foreground">طباعة / PDF</button>}
      </div>
      {text && <div className="rounded-xl border bg-muted/10 p-5 text-sm leading-loose whitespace-pre-wrap">{text}</div>}
    </section>
  );
}

function EditTab({ student, reload }: { student: Student; reload: () => void }) {
  const [saving, setSaving] = useState(false);
  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    const fd = new FormData(e.currentTarget);
    const payload: any = {};
    ["full_name", "phone", "parent_phone", "address", "school", "section"].forEach(k => {
      payload[k] = String(fd.get(k) || "").trim() || null;
    });
    const { error } = await supabase.from("students").update(payload).eq("id", student.id);
    setSaving(false);
    if (error) toast.error(error.message); else { toast.success("تم حفظ التعديلات"); reload(); }
  }
  return (
    <section className="rounded-2xl bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-lg font-bold">تعديل بياناتي</h2>
      <form onSubmit={save} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <F name="full_name" label="الاسم" defaultValue={student.full_name} />
        <F name="phone" label="الهاتف" defaultValue={student.phone ?? ""} />
        <F name="parent_phone" label="هاتف ولي الأمر" defaultValue={student.parent_phone ?? ""} />
        <F name="school" label="المدرسة" defaultValue={student.school ?? ""} />
        <F name="section" label="الشعبة" defaultValue={student.section ?? ""} />
        <F name="address" label="العنوان" defaultValue={student.address ?? ""} />
        <div className="sm:col-span-2">
          <button disabled={saving} type="submit" className="rounded-lg bg-primary px-5 py-2 text-sm font-bold text-primary-foreground disabled:opacity-50">{saving ? "جارٍ الحفظ..." : "حفظ التعديلات"}</button>
        </div>
      </form>
    </section>
  );
}

function F({ name, label, defaultValue }: { name: string; label: string; defaultValue?: string }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-semibold">{label}</label>
      <input name={name} defaultValue={defaultValue} className="w-full rounded-lg border border-input px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" />
    </div>
  );
}

function Info({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-semibold">{value || "—"}</div>
    </div>
  );
}

function Stat({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: number; tone: "secondary" | "destructive" | "gold" }) {
  const bg = tone === "secondary" ? "bg-secondary/15 text-secondary" : tone === "gold" ? "bg-gold/25 text-gold-foreground" : "bg-destructive/15 text-destructive";
  return (
    <div className={`flex items-center gap-2 rounded-xl p-3 ${bg}`}>
      {icon}<div><div className="text-xs">{label}</div><div className="text-xl font-black">{value}</div></div>
    </div>
  );
}

function Kpi({ label, value, tone }: { label: string; value: number; tone: "primary" | "secondary" | "destructive" }) {
  const bg = tone === "primary" ? "bg-primary/10 text-primary" : tone === "secondary" ? "bg-secondary/15 text-secondary" : "bg-destructive/15 text-destructive";
  return (
    <div className={`rounded-xl p-4 ${bg}`}>
      <div className="text-xs">{label}</div>
      <div className="text-2xl font-black">{value.toLocaleString("ar-EG")}</div>
    </div>
  );
}

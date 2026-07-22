import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { ArrowRight, LogOut, CalendarCheck, XCircle, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/student/portal")({
  head: () => ({ meta: [{ title: "صفحة الطالب — سنتر الأستاذ محمد نجم" }, { name: "description", content: "بيانات الطالب، الجدول، الحضور، وكود QR." }] }),
  component: Portal,
});

type Student = { id: string; code: string; full_name: string; grade: string | null; group_id: string | null; subject: string | null; teacher_name: string | null; phone: string | null; };
type Group = { id: string; name: string; days: string | null; time: string | null; room: string | null; teacher_name: string | null; color: string | null; };
type Att = { id: string; date: string; status: string };

function Portal() {
  const navigate = useNavigate();
  const [student, setStudent] = useState<Student | null>(null);
  const [group, setGroup] = useState<Group | null>(null);
  const [attendance, setAttendance] = useState<Att[]>([]);
  const [codeInput, setCodeInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const qrRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const id = typeof window !== "undefined" ? localStorage.getItem("najm_student_id") : null;
    if (!id) { setLoading(false); return; }
    loadStudent(id).finally(() => setLoading(false));
  }, []);

  async function loadStudent(id: string) {
    const { data: s, error: e1 } = await supabase.from("students").select("*").eq("id", id).maybeSingle();
    if (e1 || !s) { setError("لم يتم العثور على الطالب"); return; }
    setStudent(s as Student);
    if (s.group_id) {
      const { data: g } = await supabase.from("groups").select("*").eq("id", s.group_id).maybeSingle();
      if (g) setGroup(g as Group);
    }
    const { data: a } = await supabase.from("attendance").select("id,date,status").eq("student_id", s.id).order("date", { ascending: false }).limit(50);
    setAttendance((a as Att[]) || []);

    if (qrRef.current) await QRCode.toCanvas(qrRef.current, s.code, { width: 200, margin: 1, color: { dark: "#1e3a8a", light: "#ffffff" } });
  }

  async function loginByCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const code = codeInput.trim().toUpperCase();
    if (!code) return;
    const { data, error } = await supabase.from("students").select("id, code").eq("code", code).maybeSingle();
    if (error || !data) { setError("الكود غير صحيح"); return; }
    localStorage.setItem("najm_student_id", data.id);
    localStorage.setItem("najm_student_code", data.code);
    setLoading(true);
    await loadStudent(data.id);
    setLoading(false);
  }

  function logout() {
    localStorage.removeItem("najm_student_id");
    localStorage.removeItem("najm_student_code");
    setStudent(null); setGroup(null); setAttendance([]);
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

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link to="/" className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline"><ArrowRight className="h-4 w-4" /> الرئيسية</Link>
          <div className="text-center">
            <h1 className="text-lg font-bold">{student.full_name}</h1>
            <p className="font-mono text-xs text-muted-foreground">{student.code}</p>
          </div>
          <button onClick={logout} className="inline-flex items-center gap-1.5 rounded-lg border border-input px-3 py-1.5 text-sm hover:bg-accent"><LogOut className="h-4 w-4" /> خروج</button>
        </div>
      </header>

      <main className="mx-auto grid max-w-5xl grid-cols-1 gap-6 px-6 py-8 lg:grid-cols-3">
        <section className="rounded-2xl bg-white p-6 shadow-sm lg:col-span-2">
          <h2 className="mb-4 text-lg font-bold">بياناتك</h2>
          <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
            <Info label="الصف" value={student.grade} />
            <Info label="المادة" value={student.subject} />
            <Info label="المعلم" value={student.teacher_name} />
            <Info label="الهاتف" value={student.phone} />
          </div>

          <h3 className="mb-3 mt-8 text-lg font-bold">مجموعتك</h3>
          {group ? (
            <div className="rounded-xl border p-4" style={{ borderInlineStartWidth: 6, borderInlineStartColor: group.color || "var(--color-primary)" }}>
              <div className="text-lg font-bold">{group.name}</div>
              <div className="mt-2 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                <Info label="الأيام" value={group.days} />
                <Info label="الميعاد" value={group.time} />
                <Info label="القاعة" value={group.room} />
              </div>
            </div>
          ) : <p className="text-sm text-muted-foreground">لم يتم تعيينك في مجموعة بعد.</p>}

          <h3 className="mb-3 mt-8 text-lg font-bold">سجل الحضور</h3>
          <div className="mb-4 grid grid-cols-2 gap-3">
            <Stat icon={<CalendarCheck className="h-5 w-5" />} label="حضور" value={presentCount} tone="secondary" />
            <Stat icon={<XCircle className="h-5 w-5" />} label="غياب" value={absentCount} tone="destructive" />
          </div>
          <div className="max-h-64 overflow-auto rounded-xl border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr><th className="p-2 text-right">التاريخ</th><th className="p-2 text-right">الحالة</th></tr>
              </thead>
              <tbody>
                {attendance.length === 0 ? (
                  <tr><td colSpan={2} className="p-4 text-center text-muted-foreground">لا يوجد سجل بعد</td></tr>
                ) : attendance.map(a => (
                  <tr key={a.id} className="border-t">
                    <td className="p-2">{a.date}</td>
                    <td className="p-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${a.status === "present" ? "bg-secondary/15 text-secondary" : a.status === "late" ? "bg-gold/25 text-gold-foreground" : "bg-destructive/15 text-destructive"}`}>
                        {a.status === "present" ? "حاضر" : a.status === "late" ? "متأخر" : "غائب"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="rounded-2xl bg-white p-6 text-center shadow-sm">
          <h2 className="mb-4 text-lg font-bold">كود الحضور (QR)</h2>
          <div className="mx-auto inline-block rounded-xl bg-white p-3 shadow" style={{ boxShadow: "var(--shadow-elegant)" }}>
            <canvas ref={qrRef} />
          </div>
          <p className="mt-4 font-mono text-sm text-muted-foreground">{student.code}</p>
          <p className="mt-2 text-xs text-muted-foreground">اعرض هذا الكود على الأستاذ لتسجيل الحضور.</p>
        </aside>
      </main>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string | null | undefined }) {
  return <div><div className="text-xs text-muted-foreground">{label}</div><div className="mt-0.5 font-semibold">{value || "—"}</div></div>;
}

function Stat({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: number; tone: "secondary" | "destructive" }) {
  return (
    <div className={`rounded-xl border p-3 ${tone === "secondary" ? "bg-secondary/5" : "bg-destructive/5"}`}>
      <div className={`mb-1 inline-flex h-8 w-8 items-center justify-center rounded-lg text-white ${tone === "secondary" ? "bg-secondary" : "bg-destructive"}`}>{icon}</div>
      <div className="text-2xl font-black">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

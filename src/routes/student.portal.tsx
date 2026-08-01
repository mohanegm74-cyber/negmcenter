import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { toast } from "sonner";
import { ArrowRight, LogOut, CalendarCheck, XCircle, Search, User, BookOpen, Wallet, MessageCircleQuestion, Sparkles, Save, Upload, FileText, Award } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { ExamsTab } from "@/components/ExamsTab";
import { getStudentPortal } from "@/lib/student.functions";
import { useServerFn } from "@tanstack/react-start";

export const Route = createFileRoute("/student/portal")({
  head: () => ({ meta: [{ title: "بوابة الطالب — سنتر الأستاذ محمد نجم" }] }),
  component: Portal,
});

function Portal() {
  const [student, setStudent] = useState<any>(null);
  const [certificates, setCertificates] = useState<any[]>([]);
  const [tab, setTab] = useState<any>("info");
  const [loading, setLoading] = useState(true);
  const [codeInput, setCodeInput] = useState("");
  const loadPortal = useServerFn(getStudentPortal);

  useEffect(() => {
    const c = localStorage.getItem("najm_student_code");
    if (c) loadStudent(c).finally(() => setLoading(false));
    else setLoading(false);
  }, []);

  async function loadStudent(c: string) {
    try {
      const d = await loadPortal({ data: { code: c } });
      setStudent(d.student);
      setCertificates(d.certificates || []);
    } catch (err: any) {
      toast.error(err.message || "حدث خطأ");
      if (err.message.includes("مراجعة")) localStorage.removeItem("najm_student_code");
    }
  }

  async function login(e: React.FormEvent) {
    e.preventDefault();
    const c = codeInput.trim().toUpperCase();
    if (!c) return;
    setLoading(true);
    try {
      await loadStudent(c);
      localStorage.setItem("najm_student_code", c);
    } catch (err: any) { toast.error(err.message); }
    finally { setLoading(false); }
  }

  if (loading) return <div className="p-20 text-center font-bold">جارٍ التحميل...</div>;

  if (!student) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-white p-8 rounded-3xl shadow-xl text-center">
          <BrandLogo size={80} className="mb-4" />
          <h2 className="text-xl font-black mb-4">دخول الطالب</h2>
          <form onSubmit={login} className="space-y-4">
            <input value={codeInput} onChange={e => setCodeInput(e.target.value)} placeholder="STU-XXXXXXXX" className="w-full rounded-xl border p-3 text-center font-mono font-bold" />
            <button type="submit" className="w-full rounded-xl bg-primary py-3 font-black text-white">دخول</button>
          </form>
          <Link to="/student/register" className="block mt-4 text-sm font-bold text-secondary">سجّل كطالب جديد</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="bg-white border-b p-4 sticky top-0 z-20">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <div className="font-black text-primary">{student.full_name}</div>
          <button onClick={() => {localStorage.removeItem("najm_student_code"); setStudent(null);}} className="text-xs font-bold text-destructive">خروج</button>
        </div>
        <nav className="max-w-4xl mx-auto flex gap-2 overflow-x-auto mt-4 pb-2">
          <TabBtn id="info" label="بياناتي" icon={User} active={tab === "info"} onClick={() => setTab("info")} />
          <TabBtn id="exams" label="الاختبارات" icon={Sparkles} active={tab === "exams"} onClick={() => setTab("exams")} />
          <TabBtn id="certs" label="شهاداتي" icon={Award} active={tab === "certs"} onClick={() => setTab("certs")} />
        </nav>
      </header>

      <main className="max-w-4xl mx-auto p-6">
        {tab === "certs" && (
          <section className="space-y-4">
            <h2 className="text-xl font-black flex items-center gap-2"><Award className="h-6 w-6 text-gold" /> شهادات التقدير الممنوحة</h2>
            {certificates.length === 0 ? <p className="text-muted-foreground text-center py-10">لا توجد شهادات ممنوحة لك بعد.</p> : (
              <div className="grid gap-4 sm:grid-cols-2">
                {certificates.map(c => (
                  <div key={c.id} className="bg-white p-6 rounded-2xl border-2 border-gold/20 shadow-sm relative overflow-hidden">
                    <Award className="absolute -right-4 -top-4 h-24 w-24 text-gold/10 rotate-12" />
                    <div className="text-lg font-black text-gold-foreground">{c.title}</div>
                    <p className="text-sm mt-2 font-medium">{c.reason}</p>
                    <div className="mt-4 text-xs font-bold text-muted-foreground">بواسطة: {c.signer}</div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
        {tab === "info" && <div className="bg-white p-6 rounded-2xl shadow-sm">مرحباً بك، يمكنك الآن متابعة دروسك واختباراتك من هنا.</div>}
        {tab === "exams" && <ExamsTab code={student.code} />}
      </main>
    </div>
  );
}

function TabBtn({ label, icon: Icon, active, onClick }: any) {
  return (
    <button onClick={onClick} className={`shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold transition-all ${active ? "bg-primary text-white" : "bg-muted text-muted-foreground"}`}>
      <Icon className="h-4 w-4" /> {label}
    </button>
  );
}
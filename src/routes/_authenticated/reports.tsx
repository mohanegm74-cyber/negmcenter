import { autoFee, autoFeeApplies } from "@/lib/fees";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Printer, FileBarChart, Sparkles, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { openPrint, esc } from "@/lib/print";
import { generateCenterReport } from "@/lib/ai-report.functions";
import { getReportsDataAdmin } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({ meta: [{ title: "التقارير — الأستاذ" }, { name: "description", content: "تقارير شاملة مصنفة حسب الصف والمجموعة." }] }),
  component: ReportsPage,
});

type Student = { id: string; full_name: string; code: string; grade: string | null; group_id: string | null; phone: string | null; active?: boolean };
type Group = { id: string; name: string; grade: string | null; monthly_fee: number };
type Att = { student_id: string; group_id: string | null; date: string; status: string };
type Pay = { student_id: string; amount: number; kind: string; month: string | null };

function ReportsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [att, setAtt] = useState<Att[]>([]);
  const [pay, setPay] = useState<Pay[]>([]);
  const [tab, setTab] = useState<"grade" | "group" | "attendance">("grade");
  const [from, setFrom] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10));
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(true);

  const loadFn = useServerFn(getReportsDataAdmin);
  const genCenter = useServerFn(generateCenterReport);

  async function load() {
    setLoading(true);
    try {
      const res = await loadFn({ data: { from, to } });
      setStudents(res.students as Student[]);
      setGroups(res.groups as Group[]);
      setAtt(res.attendance as Att[]);
      setPay(res.payments as Pay[]);
    } catch (e: any) {
      toast.error("فشل تحميل التقارير");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [from, to]);

  const groupMap = useMemo(() => Object.fromEntries(groups.map(g => [g.id, g])), [groups]);

  // توحيد الحساب مع الماليات: المستحق لكل شهر = حركة المستحق إن وجدت وإلا اشتراك المجموعة
  const monthsInRange = useMemo(() => { const out: string[] = []; let d = new Date(from.slice(0, 7) + "-01"); const end = to.slice(0, 7); while (d.toISOString().slice(0, 7) <= end && out.length < 60) { out.push(d.toISOString().slice(0, 7)); d = new Date(d.getFullYear(), d.getMonth() + 1, 15); } return out; }, [from, to]);
  const finFor = (s: Student, months: string[]) => {
    let dues = 0, income = 0, exempt = 0, late = 0;
    const fee = s.group_id ? Number(groupMap[s.group_id]?.monthly_fee || 0) : 0;
    for (const m of months) {
      const sp = pay.filter(p => p.student_id === s.id && String(p.month || "").slice(0, 7) === m);
      const sum = (k: string) => sp.filter(p => p.kind === k).reduce((a, b) => a + Number(b.amount), 0);
      const c = sum("charge"), due = c > 0 ? c : autoFee(m, fee, s.active !== false), pd = sum("payment"), ex = sum("exempt");
      dues += due; income += pd; exempt += ex; late += Math.max(0, due - pd - ex);
    }
    return { dues, income, exempt, late };
  };
  const fin = useMemo(() => Object.fromEntries(students.map(s => [s.id, finFor(s, monthsInRange)])), [students, pay, monthsInRange, groupMap]);
  const finCur = useMemo(() => { const cur = new Date().toISOString().slice(0, 7); return Object.fromEntries(students.map(s => [s.id, finFor(s, [cur])])); }, [students, pay, groupMap]);

  const byGrade = useMemo(() => {
    const map = new Map<string, { grade: string; students: number; present: number; absent: number; late: number; income: number; dues: number; exempt: number }>();
    for (const s of students) {
      const g = s.grade || "غير محدد";
      if (!map.has(g)) map.set(g, { grade: g, students: 0, present: 0, absent: 0, late: 0, income: 0, dues: 0, exempt: 0 });
      map.get(g)!.students++;
    }
    for (const a of att) {
      const s = students.find(x => x.id === a.student_id); if (!s) continue;
      const row = map.get(s.grade || "غير محدد")!;
      if (a.status === "present") row.present++;
      else if (a.status === "absent") row.absent++;
      else if (a.status === "late") row.late++;
    }
    for (const s of students) {
      const row = map.get(s.grade || "غير محدد")! as any; const f = fin[s.id]; if (!f) continue;
      row.income += f.income; row.exempt += f.exempt; row.dues += f.dues; row.lateAmt = (row.lateAmt || 0) + f.late;
    }
    return Array.from(map.values()).sort((a, b) => a.grade.localeCompare(b.grade)) as any[];
  }, [students, att, fin]);

  const byGroup = useMemo(() => {
    return groups.map(g => {
      const gs = students.filter(s => s.group_id === g.id);
      const gAtt = att.filter(a => a.group_id === g.id);
      const sumF = (k: "dues" | "income" | "exempt" | "late") => gs.reduce((a, s) => a + (fin[s.id]?.[k] || 0), 0);
      return {
        lateAmt: sumF("late"),
        group: g,
        students: gs.length,
        present: gAtt.filter(x => x.status === "present").length,
        absent: gAtt.filter(x => x.status === "absent").length,
        late: gAtt.filter(x => x.status === "late").length,
        income: sumF("income"),
        dues: sumF("dues"),
        exempt: sumF("exempt"),
      };
    });
  }, [groups, students, att, fin]);

  const attReport = useMemo(() => {
    return students.map(s => {
      const rows = att.filter(a => a.student_id === s.id);
      return {
        student: s, group: groupMap[s.group_id || ""],
        present: rows.filter(r => r.status === "present").length,
        absent: rows.filter(r => r.status === "absent").length,
        late: rows.filter(r => r.status === "late").length,
      };
    }).sort((a, b) => b.absent - a.absent);
  }, [students, att, groupMap]);

  function printCurrent() {
    if (tab === "grade") {
      const rows = byGrade.map(r => `<tr><td>${esc(r.grade)}</td><td>${r.students}</td><td>${r.present}</td><td>${r.late}</td><td>${r.absent}</td><td>${r.dues.toLocaleString("ar-EG")}</td><td>${r.income.toLocaleString("ar-EG")}</td><td>${r.exempt.toLocaleString("ar-EG")}</td><td>${r.lateAmt.toLocaleString("ar-EG")}</td></tr>`).join("");
      openPrint("تقرير مصنّف حسب الصف", `<h2>تقرير حسب الصف (المبالغ بالجنيه المصري) — من ${esc(from)} إلى ${esc(to)}</h2>
        <table><thead><tr><th>الصف</th><th>عدد الطلاب</th><th>حضور</th><th>تأخير</th><th>غياب</th><th>المستحق</th><th>المدفوع</th><th>الإعفاء</th><th>المتأخرات</th></tr></thead><tbody>${rows}</tbody></table>`);
    } else if (tab === "group") {
      const rows = byGroup.map(r => `<tr><td>${esc(r.group.name)}</td><td>${esc(r.group.grade)}</td><td>${r.students}</td><td>${r.present}</td><td>${r.late}</td><td>${r.absent}</td><td>${r.dues.toLocaleString("ar-EG")}</td><td>${r.income.toLocaleString("ar-EG")}</td><td>${r.exempt.toLocaleString("ar-EG")}</td><td>${r.lateAmt.toLocaleString("ar-EG")}</td></tr>`).join("");
      openPrint("تقرير مصنّف حسب المجموعة", `<h2>تقرير حسب المجموعة (المبالغ بالجنيه المصري) — من ${esc(from)} إلى ${esc(to)}</h2>
        <table><thead><tr><th>المجموعة</th><th>الصف</th><th>عدد الطلاب</th><th>حضور</th><th>تأخير</th><th>غياب</th><th>المستحق</th><th>المدفوع</th><th>الإعفاء</th><th>المتأخرات</th></tr></thead><tbody>${rows}</tbody></table>`);
    } else {
      const rows = attReport.map((r, i) => `<tr><td>${i + 1}</td><td>${esc(r.student.full_name)}</td><td>${esc(r.student.code)}</td><td>${esc(r.student.grade)}</td><td>${esc(r.group?.name)}</td><td>${r.present}</td><td>${r.late}</td><td style="color:${r.absent > 3 ? "#dc2626" : "inherit"};font-weight:${r.absent > 3 ? 700 : 400}">${r.absent}</td></tr>`).join("");
      openPrint("تقرير الحضور التفصيلي", `<h2>تقرير الحضور — من ${esc(from)} إلى ${esc(to)}</h2>
        <table><thead><tr><th>#</th><th>الطالب</th><th>الكود</th><th>الصف</th><th>المجموعة</th><th>حضور</th><th>تأخير</th><th>غياب</th></tr></thead><tbody>${rows}</tbody></table>`);
    }
  }

  const [aiOpen, setAiOpen] = useState(false);
  const [aiText, setAiText] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  async function runCenterAI() {
    setAiOpen(true); setAiLoading(true); setAiText(null);
    try {
      const vals = Object.values(fin) as any[];
      const income = vals.reduce((a, f) => a + f.income, 0), dues = vals.reduce((a, f) => a + f.dues, 0), exempt = vals.reduce((a, f) => a + f.exempt, 0), lateT = vals.reduce((a, f) => a + f.late, 0);
      const topAbsent = attReport.filter(r => r.absent > 0).slice(0, 10).map(r => ({ name: r.student.full_name, absent: r.absent }));
      const r = await genCenter({ data: {
        totals: { students: students.length, groups: groups.length, income, dues, exempt, outstanding: lateT },
        attendance: {
          present: att.filter(a => a.status === "present").length,
          absent: att.filter(a => a.status === "absent").length,
          late: att.filter(a => a.status === "late").length,
        },
        topAbsent,
        gradeStats: byGrade.map(g => ({ grade: g.grade, students: g.students, present: g.present, absent: g.absent })),
        groupStats: byGroup.map(g => ({ group: g.group.name, students: g.students, income: g.income, dues: g.dues })),
      }});
      setAiText(r.text);
    } catch (e: any) { toast.error(e.message || "فشل التحليل"); setAiOpen(false); }
    finally { setAiLoading(false); }
  }

  if (loading && groups.length === 0) return <div className="flex h-64 items-center justify-center text-muted-foreground"><Loader2 className="h-8 w-8 animate-spin" /></div>;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-black flex items-center gap-2"><FileBarChart className="h-6 w-6 text-primary" /> التقارير</h1>
        <div className="flex flex-wrap items-center gap-2">
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="rounded-lg border border-input bg-white px-3 py-2 text-sm" />
          <span className="text-sm text-muted-foreground">إلى</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="rounded-lg border border-input bg-white px-3 py-2 text-sm" />
          <button onClick={runCenterAI} className="inline-flex items-center gap-1 rounded-lg bg-gold px-3 py-2 text-sm font-bold text-gold-foreground"><Sparkles className="h-4 w-4" /> تقرير AI شامل</button>
          <button onClick={printCurrent} className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-2 text-sm font-bold text-primary-foreground"><Printer className="h-4 w-4" /> طباعة</button>
        </div>
      </div>

      {aiOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setAiOpen(false)}>
          <div className="max-h-[85vh] w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b p-4">
              <h2 className="text-lg font-bold flex items-center gap-2"><Sparkles className="h-5 w-5 text-gold" /> تقرير الذكاء الاصطناعي — السنتر</h2>
              <button onClick={() => setAiOpen(false)} className="rounded p-1 hover:bg-accent"><X className="h-5 w-5" /></button>
            </div>
            <div className="max-h-[70vh] overflow-y-auto p-5">
              {aiLoading ? <p className="text-center text-muted-foreground">جارٍ التحليل والتوليد...</p> :
                aiText ? <div className="whitespace-pre-wrap text-sm leading-loose">{aiText}</div> : null}
              {aiText && (
                <button
                  onClick={() => {
                    const w = window.open("", "_blank"); if (!w) return;
                    w.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"/><title>تقرير السنتر</title>
                      <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;900&display=swap" rel="stylesheet">
                      <style>body{font-family:'Cairo',sans-serif;padding:40px;max-width:800px;margin:auto;line-height:1.9;color:#0f172a}
                      h1{color:#1e3a8a;border-bottom:3px double #c9a227;padding-bottom:10px}
                      .body{white-space:pre-wrap;font-size:15px}
                      button{background:#1e3a8a;color:#fff;border:0;padding:8px 16px;border-radius:8px;font-family:inherit;font-weight:700;cursor:pointer}
                      @media print{button{display:none}}
                      </style></head><body>
                      <button onclick="window.print()">🖨️ طباعة / حفظ PDF</button>
                      <h1>تقرير الذكاء الاصطناعي — سنتر الأستاذ محمد نجم</h1>
                      <div class="body">${aiText.replace(/</g, "<")}</div>
                      </body></html>`);
                    w.document.close();
                  }}
                  className="mt-4 rounded-lg bg-gold px-4 py-2 text-sm font-bold text-gold-foreground"
                >طباعة / PDF</button>
              )}
            </div>
          </div>
        </div>
      )}

      {(() => {
        const tot = (src: Record<string, any>, k: string) => Object.values(src).reduce((a: number, f: any) => a + f[k], 0) as number;
        const items = [["إجمالي المستحق (الفترة)", tot(fin, "dues")], ["المستحق هذا الشهر", tot(finCur, "dues")], ["إجمالي المدفوع (الفترة)", tot(fin, "income")], ["المدفوع هذا الشهر", tot(finCur, "income")], ["إجمالي الإعفاءات (الفترة)", tot(fin, "exempt")], ["الإعفاء هذا الشهر", tot(finCur, "exempt")], ["إجمالي المتأخرات (الفترة)", tot(fin, "late")], ["المتأخرات هذا الشهر", tot(finCur, "late")]] as const;
        return <div className="mb-4 grid grid-cols-2 gap-2 lg:grid-cols-4">{items.map(([l, v]) => <div key={l} className="rounded-2xl bg-white p-3 shadow-sm"><div className="text-xs font-bold text-muted-foreground">{l}</div><div className="text-lg font-black">{Number(v).toLocaleString("ar-EG")} <span className="text-xs font-bold text-muted-foreground">جنيه مصري</span></div></div>)}</div>;
      })()}
      <div className="mb-4 flex gap-2 rounded-2xl bg-white p-1.5 shadow-sm">
        {(["grade", "group", "attendance"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} className={`flex-1 rounded-xl px-4 py-2 text-sm font-bold transition ${tab === t ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}>
            {t === "grade" ? "حسب الصف" : t === "group" ? "حسب المجموعة" : "تفصيلي حضور"}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
        <div className="overflow-x-auto">
          {tab === "grade" && (
            <table className="w-full text-sm">
              <thead className="bg-primary text-primary-foreground text-right"><tr>
                <th className="p-3">الصف</th><th className="p-3">عدد الطلاب</th><th className="p-3">حضور</th><th className="p-3">تأخير</th><th className="p-3">غياب</th>
                <th className="p-3">المستحق</th><th className="p-3">المدفوع</th><th className="p-3">الإعفاء</th><th className="p-3">المتأخرات</th>
              </tr></thead>
              <tbody>
                {byGrade.map((r, i) => (
                  <tr key={r.grade} className={`border-t ${i % 2 ? "bg-muted/10" : ""}`}>
                    <td className="p-3 font-bold">{r.grade}</td>
                    <td className="p-3">{r.students}</td>
                    <td className="p-3 text-secondary">{r.present}</td>
                    <td className="p-3 text-gold-foreground">{r.late}</td>
                    <td className="p-3 text-destructive">{r.absent}</td>
                    <td className="p-3">{r.dues.toLocaleString("ar-EG")}</td>
                    <td className="p-3 text-secondary">{r.income.toLocaleString("ar-EG")}</td>
                    <td className="p-3 text-sky-700">{r.exempt.toLocaleString("ar-EG")}</td>
                    <td className={`p-3 font-bold ${r.lateAmt > 0 ? "text-destructive" : "text-secondary"}`}>{r.lateAmt.toLocaleString("ar-EG")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {tab === "group" && (
            <table className="w-full text-sm">
              <thead className="bg-primary text-primary-foreground text-right"><tr>
                <th className="p-3">المجموعة</th><th className="p-3">الصف</th><th className="p-3">طلاب</th><th className="p-3">حضور</th><th className="p-3">تأخير</th><th className="p-3">غياب</th>
                <th className="p-3">المستحق</th><th className="p-3">المدفوع</th><th className="p-3">الإعفاء</th><th className="p-3">المتأخرات</th>
              </tr></thead>
              <tbody>
                {byGroup.map((r, i) => (
                  <tr key={r.group.id} className={`border-t ${i % 2 ? "bg-muted/10" : ""}`}>
                    <td className="p-3 font-bold">{r.group.name}</td>
                    <td className="p-3">{r.group.grade || "—"}</td>
                    <td className="p-3">{r.students}</td>
                    <td className="p-3 text-secondary">{r.present}</td>
                    <td className="p-3">{r.late}</td>
                    <td className="p-3 text-destructive">{r.absent}</td>
                    <td className="p-3">{r.dues.toLocaleString("ar-EG")}</td>
                    <td className="p-3 text-secondary">{r.income.toLocaleString("ar-EG")}</td>
                    <td className="p-3 text-sky-700">{r.exempt.toLocaleString("ar-EG")}</td>
                    <td className={`p-3 font-bold ${r.lateAmt > 0 ? "text-destructive" : "text-secondary"}`}>{r.lateAmt.toLocaleString("ar-EG")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {tab === "attendance" && (
            <table className="w-full text-sm">
              <thead className="bg-primary text-primary-foreground text-right"><tr>
                <th className="p-3">الطالب</th><th className="p-3">الكود</th><th className="p-3">الصف</th><th className="p-3">المجموعة</th><th className="p-3">حضور</th><th className="p-3">تأخير</th><th className="p-3">غياب</th>
              </tr></thead>
              <tbody>
                {attReport.map((r, i) => (
                  <tr key={r.student.id} className={`border-t ${i % 2 ? "bg-muted/10" : ""}`}>
                    <td className="p-3 font-semibold">{r.student.full_name}</td>
                    <td className="p-3 font-mono text-xs">{r.student.code}</td>
                    <td className="p-3">{r.student.grade || "—"}</td>
                    <td className="p-3">{r.group?.name || "—"}</td>
                    <td className="p-3 text-secondary">{r.present}</td>
                    <td className="p-3">{r.late}</td>
                    <td className={`p-3 font-bold ${r.absent > 3 ? "text-destructive" : ""}`}>{r.absent}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
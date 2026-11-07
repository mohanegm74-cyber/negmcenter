import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Printer, ListChecks, Loader2 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { getFinanceDataAdmin } from "@/lib/admin.functions";
import { openPrint, esc } from "@/lib/print";
import { toast } from "sonner";
import { SEPTEMBER_FEE } from "@/lib/fees";
import { Button } from "@/components/ui/button";
import { groupListStatus, selectGroupList, groupListPrintCss, groupListFitScript, type GroupListFilter } from "@/lib/group-list";

export const Route = createFileRoute("/_authenticated/group-lists")({
  head: () => ({ meta: [
    { title: "قوائم الفصول والسداد — سنتر الأستاذ محمد نجم" },
    { name: "description", content: "قوائم طلاب الفصول مرتبة بالأسماء مع تصفية السداد والإعفاء والطباعة بخانة درجة الاختبار." },
    { property: "og:title", content: "قوائم الفصول والسداد — سنتر الأستاذ محمد نجم" },
    { property: "og:description", content: "قوائم طلاب الفصول مرتبة بالأسماء مع تصفية السداد والإعفاء والطباعة بخانة درجة الاختبار." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: GroupListsPage,
});

type Student = { id: string; full_name: string; code: string; grade: string | null; group_id: string | null };
type Group = { id: string; name: string; monthly_fee: number; grade: string | null; subject: string | null };
type Payment = { student_id: string; amount: number; kind: string; month: string | null };

function currentMonth() { return new Date().toISOString().slice(0, 7); }

function GroupListsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [groupId, setGroupId] = useState("");
  const [month, setMonth] = useState(currentMonth());
  const [statusFilter, setStatusFilter] = useState<GroupListFilter>("all");
  
  const loadFn = useServerFn(getFinanceDataAdmin);

  async function fetchAll() {
    setLoading(true);
    try {
      const res = await loadFn({});
      setStudents(res.students as Student[]);
      setGroups(res.groups as Group[]);
      setPayments(res.payments as Payment[]);
    } catch (err: any) {
      toast.error("فشل تحميل البيانات");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchAll(); }, []);

  const activeGroup = useMemo(() => groups.find(g => g.id === groupId), [groups, groupId]);

  const list = useMemo(() => {
    if (!groupId) return [];
    return students
      .filter(s => s.group_id === groupId)
      .map((s) => {
        const studentPayments = payments.filter(p => p.student_id === s.id && p.month === month);
        const paid = studentPayments.filter(p => p.kind === "payment").reduce((a, b) => a + Number(b.amount), 0);
        const exempt = studentPayments.filter(p => p.kind === "exempt").reduce((a, b) => a + Number(b.amount), 0);
        const dues = studentPayments.filter(p => p.kind === "charge").reduce((a, b) => a + Number(b.amount), 0);
        const fee = Number(activeGroup?.monthly_fee || 0);
        const target = dues > 0 ? dues : (month.endsWith("-09") ? SEPTEMBER_FEE : fee);

        let status = "لم يسدد";
        let statusTone = "unpaid";
        const statusKey = groupListStatus(paid, exempt, target);

        if (exempt > 0 && exempt >= target - paid && paid === 0) {
          status = "تم الإعفاء";
          statusTone = "exempt";
        } else if (paid > 0 && paid + exempt >= target) {
          status = "تم الدفع";
          statusTone = "paid";
        } else if (paid > 0) {
          status = `سداد جزئي (${paid} جنيه مصري)`;
          statusTone = "partial";
        }

        return { ...s, status, statusKey, statusTone, paid, target };
      });
  }, [students, groupId, month, payments, activeGroup]);

  const filters = [
    { key: "all", label: "الكل", count: list.length },
    { key: "paid", label: "سدد", count: list.filter(s => s.statusKey === "paid").length },
    { key: "unpaid", label: "لم يسدد", count: list.filter(s => s.statusKey === "unpaid").length },
    { key: "exempt", label: "تم الإعفاء", count: list.filter(s => s.statusKey === "exempt").length },
  ] as const;
  const shownList = useMemo(() => selectGroupList(list, statusFilter).map((s, idx) => ({ ...s, index: idx + 1 })), [list, statusFilter]);
  const tones: Record<string, string> = {
    paid: "bg-list-paid-soft text-list-paid",
    unpaid: "bg-list-unpaid-soft text-list-unpaid",
    exempt: "bg-list-exempt-soft text-list-exempt",
    partial: "bg-list-partial-soft text-list-partial",
  };

  function printList() {
    if (!activeGroup) { toast.error("اختر المجموعة أولاً"); return; }
    
    if (!shownList.length) { toast.error("لا يوجد طلاب في القائمة الحالية للطباعة"); return; }
    const tokens = getComputedStyle(document.documentElement);
    const printTokens = ["paid", "unpaid", "exempt", "partial"].flatMap(tone => [
      `--list-${tone}: ${tokens.getPropertyValue(`--list-${tone}`)};`,
      `--list-${tone}-soft: ${tokens.getPropertyValue(`--list-${tone}-soft`)};`,
    ]).join("\n");
    const rowsHtml = shownList.map(s => `
      <tr class="status-${s.statusTone}">
        <td>${s.index}</td>
        <td><b>${esc(s.full_name)}</b></td>
        <td>${esc(s.grade)}</td>
        <td><span class="print-badge">${esc(s.status)}</span></td>
        <td></td>
        <td></td>
      </tr>
    `).join("");

    const title = `قائمة طلاب مجموعة: ${activeGroup.name}`;
    const body = `
      <div class="list-summary">
        <div>
          <h2>المجموعة: ${esc(activeGroup.name)}</h2>
          <p>شهر: ${esc(month)} | المادة: ${esc(activeGroup.subject)}</p>
        </div>
        <div style="text-align:left">
          <p>طلاب القائمة: <b>${shownList.length}</b> من ${list.length} | الحالة: ${esc(filters.find(f => f.key === statusFilter)?.label)}</p>
          <p>التاريخ: ${new Date().toLocaleDateString("ar-EG")}</p>
        </div>
      </div>
      <table>
        <colgroup><col style="width:5%"><col style="width:30%"><col style="width:17%"><col style="width:20%"><col style="width:13%"><col style="width:15%"></colgroup>
        <thead>
          <tr>
            <th>م</th>
            <th>اسم الطالب</th>
            <th>الصف</th>
            <th>الحالة</th>
            <th>درجة الاختبار</th>
            <th>توقيع/ملاحظة</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
      <div class="list-signatures">
        <p>توقيع الإشراف: ...........................</p>
        <p>ختم السنتر: ...........................</p>
      </div>
      ${groupListFitScript}
    `;

    openPrint(title, body, `:root { ${printTokens} } ${groupListPrintCss}`);
  }

  if (loading) return <div className="flex h-64 items-center justify-center text-muted-foreground"><Loader2 className="h-8 w-8 animate-spin" /></div>;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="text-2xl font-black flex items-center gap-2"><ListChecks className="h-7 w-7 text-primary" /> قوائم المجموعات</h1>
        <Button onClick={printList} disabled={!groupId || shownList.length === 0} className="px-6 font-black">
          <Printer className="h-5 w-5" /> طباعة القائمة الحالية
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-card p-5 rounded-2xl shadow-sm border border-primary/5">
        <div>
          <label htmlFor="list-group" className="mb-1.5 block text-xs font-black text-muted-foreground uppercase">اختر المجموعة</label>
          <select id="list-group" value={groupId} onChange={e => { setGroupId(e.target.value); setStatusFilter("all"); }} className="w-full rounded-xl border bg-muted/20 py-2.5 px-4 text-sm font-bold outline-none focus:ring-2 focus:ring-primary/20">
            <option value="">— اختر مجموعة لعرض الطلاب —</option>
            {groups.map(g => <option key={g.id} value={g.id}>{g.name} ({g.grade || '—'})</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="list-month" className="mb-1.5 block text-xs font-black text-muted-foreground uppercase">شهر المتابعة</label>
          <input id="list-month" type="month" value={month} onChange={e => { setMonth(e.target.value); setStatusFilter("all"); }} className="w-full rounded-xl border bg-muted/20 py-2.5 px-4 text-sm font-bold outline-none focus:ring-2 focus:ring-primary/20" />
        </div>
      </div>

      {!groupId ? (
        <div className="rounded-3xl bg-card px-6 py-16 text-center border-2 border-dashed border-muted/50">
          <ListChecks className="mx-auto h-16 w-16 text-muted/30 mb-4" />
          <h2 className="text-xl font-bold text-muted-foreground">برجاء اختيار مجموعة من القائمة أعلاه</h2>
          <p className="text-sm text-muted-foreground/60 mt-2">سيظهر لك جدول الطلاب مع موقفهم المالي وإمكانية طباعته فوراً.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
          <div className="p-4 border-b bg-primary/5 flex justify-between items-center">
            <h3 className="font-black text-primary">قائمة طلاب: {activeGroup?.name}</h3>
            <span className="bg-primary text-primary-foreground px-3 py-1 rounded-full text-xs font-bold">العدد: {shownList.length} / {list.length} طالب</span>
          </div>
          <div className="flex flex-wrap gap-2 border-b p-4" role="group" aria-label="تصفية حالة السداد">
            {filters.map(f => (
              <Button key={f.key} size="sm" variant={statusFilter === f.key ? "default" : "outline"} aria-pressed={statusFilter === f.key} onClick={() => setStatusFilter(f.key)} className={`font-black ${statusFilter !== f.key && f.key !== "all" ? tones[f.key] : ""}`}>
                {f.label} ({f.count})
              </Button>
            ))}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="bg-muted/50 text-muted-foreground whitespace-nowrap">
                <tr>
                  <th className="p-4 text-center w-16">مسلسل</th>
                  <th className="p-4">اسم الطالب</th>
                  <th className="p-4 text-center">الصف</th>
                  <th className="p-4 text-center">الحالة ({month})</th>
                  <th className="p-4 text-center">درجة الاختبار</th>
                  <th className="p-4 text-center">الكود</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-muted/20">
                {shownList.length === 0 ? (
                  <tr><td colSpan={6} className="p-10 text-center text-muted-foreground">{list.length === 0 ? "لا يوجد طلاب مسجلين في هذه المجموعة." : "لا يوجد طلاب بهذه الحالة."}</td></tr>
                ) : shownList.map((s) => (
                  <tr key={s.id} className={`hover:brightness-95 transition-colors ${tones[s.statusTone]}`}>
                    <td className="p-4 text-center font-bold text-muted-foreground">{s.index}</td>
                    <td className="p-4 font-bold text-primary">{s.full_name}</td>
                    <td className="p-4 text-center font-semibold">{s.grade || "—"}</td>
                    <td className="p-4 text-center">
                      <span className={`inline-flex items-center border border-current/20 px-3 py-1 rounded-full text-xs font-bold ${tones[s.statusTone]}`}>
                        {s.status}
                      </span>
                    </td>
                    <td className="p-4 text-center"><span className="inline-block w-16 border-b border-border" aria-label="خانة درجة الاختبار فارغة">&nbsp;</span></td>
                    <td className="p-4 text-center font-mono text-xs text-muted-foreground">{s.code}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
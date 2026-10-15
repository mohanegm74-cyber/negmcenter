import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { CalendarDays, ClipboardPenLine, Loader2, MessageSquareQuote, MessageSquareText, Save, Trash2, Trophy, X } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { addBulkStudentNotesAdmin, deleteStudentRecordAdmin, getStudentLevelsAdmin, getStudentRecordsAdmin, saveStudentRecordAdmin } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/records")({
  head: () => ({ meta: [
    { title: "الملاحظات والدرجات — الأستاذ محمد نجم" },
    { name: "description", content: "متابعة ملاحظات الطلاب ودرجات الاختبار والتسميع حسب التاريخ والمجموعة." },
    { property: "og:title", content: "الملاحظات والدرجات — الأستاذ محمد نجم" },
    { property: "og:description", content: "سجل متابعة الطلاب ودرجاتهم وملاحظات الأستاذ." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: RecordsPage,
});

type Row = { id: string; student_id: string; group_id: string | null; date: string; exam_level: string | null; recitation_level: string | null; note: string | null };
type Student = { id: string; full_name: string; code: string; group_id: string | null; grade: string | null };
type Group = { id: string; name: string; grade: string | null };

const LEVELS = ["ممتاز", "جيد جداً", "جيد", "متوسط", "ضعيف"];

function RecordsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [groupFilter, setGroupFilter] = useState("");
  const [studentFilter, setStudentFilter] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [editing, setEditing] = useState<Row | null>(null);
  const [draft, setDraft] = useState({ student_id: "", group_id: "", exam_level: "", recitation_level: "", note: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const loadFn = useServerFn(getStudentRecordsAdmin);
  const saveFn = useServerFn(saveStudentRecordAdmin);
  const deleteFn = useServerFn(deleteStudentRecordAdmin);

  async function load() {
    setLoading(true);
    try {
      const result = await loadFn({});
      setRows(result.records as Row[]); setStudents(result.students as Student[]); setGroups(result.groups as Group[]);
    } catch (error: any) { toast.error(error?.message || "فشل تحميل سجل المتابعة"); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  const visibleStudents = useMemo(() => students.filter((s) => !groupFilter || s.group_id === groupFilter), [students, groupFilter]);
  const visibleRows = useMemo(() => rows.filter((r) => {
    const s = students.find((item) => item.id === r.student_id);
    return (!groupFilter || r.group_id === groupFilter) && (!studentFilter || r.student_id === studentFilter || s?.full_name.includes(studentFilter));
  }), [rows, students, groupFilter, studentFilter]);

  function startNew() {
    setEditing({ id: "", student_id: "", group_id: groupFilter || null, date, exam_level: null, recitation_level: null, note: null });
    setDraft({ student_id: "", group_id: groupFilter, exam_level: "", recitation_level: "", note: "" });
  }
  function startEdit(row: Row) {
    setEditing(row); setDraft({ student_id: row.student_id, group_id: row.group_id || "", exam_level: row.exam_level || "", recitation_level: row.recitation_level || "", note: row.note || "" });
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.student_id) return toast.error("اختر الطالب أولاً");
    setSaving(true);
    try {
      await saveFn({ data: { id: editing?.id || undefined, payload: { student_id: draft.student_id, group_id: draft.group_id || null, date: editing?.id ? editing.date : date, exam_level: draft.exam_level || null, recitation_level: draft.recitation_level || null, note: draft.note.trim() || null } } });
      toast.success("تم حفظ سجل المتابعة"); setEditing(null); await load();
    } catch (error: any) { toast.error(error?.message || "تعذر الحفظ"); }
    finally { setSaving(false); }
  }
  async function remove(id: string) {
    if (!confirm("هل تريد حذف سجل المتابعة؟")) return;
    try { await deleteFn({ data: { id } }); toast.success("تم حذف السجل"); await load(); }
    catch (error: any) { toast.error(error?.message || "تعذر الحذف"); }
  }
  const studentName = (id: string) => students.find((s) => s.id === id)?.full_name || "—";
  const groupName = (id: string | null) => groups.find((g) => g.id === id)?.name || "—";

  if (loading) return <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  return <div className="space-y-5" dir="rtl">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="flex items-center gap-2 text-2xl font-black"><ClipboardPenLine className="h-7 w-7 text-primary" /> الملاحظات والدرجات</h1><p className="mt-1 text-xs font-bold text-muted-foreground">سجل الاختبار والتسميع والملاحظات بالتاريخ لكل مجموعة.</p></div><div className="flex flex-wrap gap-2"><button onClick={() => setBulkOpen(true)} className="inline-flex items-center gap-2 rounded-xl bg-secondary px-5 py-2.5 text-sm font-black text-white shadow-lg hover:opacity-90"><MessageSquareQuote className="h-4 w-4" /> إرسال ملاحظة (للجميع / مجموعة / طالب)</button></div></div>
    {bulkOpen && <BulkNotesModal students={students} groups={groups} rows={rows} date={date} setDate={setDate} onChanged={load} onClose={() => setBulkOpen(false)} />}
    <div className="grid gap-3 rounded-2xl border bg-white p-4 sm:grid-cols-2"><select value={groupFilter} onChange={(e) => { setGroupFilter(e.target.value); setStudentFilter(""); }} className="rounded-xl border bg-background px-3 py-2 text-sm font-bold"><option value="">كل المجموعات</option>{groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</select><select value={studentFilter} onChange={(e) => setStudentFilter(e.target.value)} className="rounded-xl border bg-background px-3 py-2 text-sm font-bold"><option value="">كل الطلاب</option>{visibleStudents.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}</select></div>
    {editing && <form onSubmit={save} className="grid gap-3 rounded-2xl border-2 border-primary bg-white p-5 sm:grid-cols-2 lg:grid-cols-3"><div className="sm:col-span-2 lg:col-span-1"><label className="mb-1 block text-xs font-black text-muted-foreground">الطالب</label><select required value={draft.student_id} onChange={(e) => { const s = students.find((x) => x.id === e.target.value); setDraft({ ...draft, student_id: e.target.value, group_id: s?.group_id || "" }); }} className="w-full rounded-xl border px-3 py-2 text-sm font-bold"><option value="">اختر الطالب</option>{visibleStudents.map((s) => <option key={s.id} value={s.id}>{s.full_name} — {s.grade || ""}</option>)}</select></div><SelectField label="درجة الاختبار" value={draft.exam_level} onChange={(value) => setDraft({ ...draft, exam_level: value })} /><SelectField label="مستوى التسميع" value={draft.recitation_level} onChange={(value) => setDraft({ ...draft, recitation_level: value })} /><div className="sm:col-span-2 lg:col-span-3"><label className="mb-1 block text-xs font-black text-muted-foreground">ملاحظة الأستاذ</label><textarea value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} rows={3} className="w-full rounded-xl border px-3 py-2 text-sm font-bold" placeholder="ملاحظة تظهر للطالب وولي الأمر" /></div><div className="flex gap-2 sm:col-span-2 lg:col-span-3"><button disabled={saving} className="rounded-xl bg-primary px-6 py-2.5 text-sm font-black text-primary-foreground">{saving ? "جارٍ الحفظ..." : "حفظ السجل"}</button><button type="button" onClick={() => setEditing(null)} className="rounded-xl border px-6 py-2.5 text-sm font-bold">إلغاء</button></div></form>}
    <div className="overflow-hidden rounded-2xl border bg-white shadow-sm"><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-right text-sm"><thead className="bg-primary text-primary-foreground"><tr><th className="p-4">التاريخ</th><th className="p-4">الطالب</th><th className="p-4">المجموعة</th><th className="p-4">الاختبار</th><th className="p-4">التسميع</th><th className="p-4">الملاحظة</th><th className="p-4">إجراءات</th></tr></thead><tbody>{visibleRows.map((r) => <tr key={r.id} className="border-t hover:bg-muted/30"><td className="p-4 font-mono text-xs">{new Date(r.date + "T00:00:00").toLocaleDateString("ar-EG")}</td><td className="p-4 font-black">{studentName(r.student_id)}</td><td className="p-4 text-xs font-bold">{groupName(r.group_id)}</td><td className="p-4">{r.exam_level || "—"}</td><td className="p-4">{r.recitation_level || "—"}</td><td className="max-w-[220px] p-4 text-xs font-bold text-muted-foreground">{r.note || "—"}</td><td className="p-4"><div className="flex gap-2"><button onClick={() => startEdit(r)} className="rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary">تعديل</button><button onClick={() => remove(r.id)} className="rounded-lg bg-destructive/10 p-2 text-destructive" aria-label="حذف"><Trash2 className="h-4 w-4" /></button></div></td></tr>)}</tbody></table></div>{visibleRows.length === 0 && <div className="p-12 text-center text-sm font-bold text-muted-foreground">لا توجد سجلات مطابقة.</div>}</div>
  </div>;
}
function SelectField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <div><label className="mb-1 block text-xs font-black text-muted-foreground">{label}</label><select value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-xl border px-3 py-2 text-sm font-bold"><option value="">غير محدد</option>{LEVELS.map((level) => <option key={level} value={level}>{level}</option>)}</select></div>; }

function BulkNotesModal({ students, groups, rows, date, setDate, onChanged, onClose }: { students: Student[]; groups: Group[]; rows: Row[]; date: string; setDate: (d: string) => void; onChanged: () => Promise<void>; onClose: () => void }) {
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [q, setQ] = useState("");
  const [grp, setGrp] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [levels, setLevels] = useState<Record<string, { exam: string | null; recitation: string | null }>>({});
  const send = useServerFn(addBulkStudentNotesAdmin);
  const getLevels = useServerFn(getStudentLevelsAdmin);
  useEffect(() => { getLevels().then((r) => setLevels(r.levels)).catch(() => {}); }, []);
  const list = useMemo(() => students.filter((s) => (!grp || s.group_id === grp) && (!q || s.full_name.includes(q) || s.code.toUpperCase().includes(q.toUpperCase()))), [students, grp, q]);
  const toggle = (ids: string[], on: boolean) => setSel((prev) => { const n = new Set(prev); ids.forEach((i) => (on ? n.add(i) : n.delete(i))); return n; });
  const allOn = students.length > 0 && students.every((s) => sel.has(s.id));
  const listOn = list.length > 0 && list.every((s) => sel.has(s.id));
  async function submit() {
    if (!sel.size) return toast.error("اختر طالبًا واحدًا على الأقل");
    if (!body.trim()) return toast.error("اكتب نص الملاحظة");
    setBusy(true);
    try { const r = await send({ data: { student_ids: [...sel], title, body } }); toast.success(`تم الإرسال إلى ${r.count} طالب`); setBody(""); setTitle(""); setSel(new Set()); }
    catch (e: any) { toast.error(e.message || "فشل الإرسال"); } finally { setBusy(false); }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b bg-primary/5 p-5">
          <div><h2 className="text-xl font-black text-primary">إرسال ملاحظة الأستاذ</h2><p className="text-xs font-bold text-muted-foreground">للجميع أو لمجموعة محددة أو لطلاب محددين — المحدد: {sel.size}</p></div>
          <button onClick={onClose} className="rounded-full p-2 hover:bg-white"><X className="h-6 w-6" /></button>
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="عنوان الملاحظة" className="w-full rounded-xl border p-3 text-sm font-bold" />
          <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="نص الملاحظة..." rows={3} className="w-full rounded-xl border p-3 text-sm" />
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border bg-primary/5 px-3 py-2 text-sm font-black"><input type="checkbox" className="h-4 w-4" checked={allOn} onChange={(e) => toggle(students.map((s) => s.id), e.target.checked)} /> الجميع ({students.length})</label>
            <select value={grp} onChange={(e) => setGrp(e.target.value)} className="rounded-lg border px-3 py-2 text-sm">
              <option value="">كل المجموعات</option>
              {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm font-bold"><input type="checkbox" className="h-4 w-4" checked={listOn} onChange={(e) => toggle(list.map((s) => s.id), e.target.checked)} /> تحديد المعروض ({list.length})</label>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="بحث بالاسم أو الكود" className="min-w-[140px] flex-1 rounded-lg border px-3 py-2 text-sm" />
          </div>
          <div className="flex items-center gap-2 text-xs font-black text-muted-foreground"><CalendarDays className="h-4 w-4" /> تاريخ تسجيل الاختبار والتسميع: <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="rounded-lg border px-2 py-1 text-sm" /></div>
          <div className="max-h-[50vh] divide-y overflow-y-auto rounded-xl border">
            {list.map((s) => { const lv = levels[s.id]; return (
              <div key={s.id} className={`space-y-2 p-3 ${sel.has(s.id) ? "bg-secondary/5" : ""}`}>
                <label className="flex cursor-pointer items-center gap-3">
                  <input type="checkbox" className="h-5 w-5" checked={sel.has(s.id)} onChange={(e) => toggle([s.id], e.target.checked)} />
                  <div className="min-w-0 flex-1"><div className="text-sm font-bold">{s.full_name}</div><div className="text-[11px] text-muted-foreground">{s.code} • {s.grade || "—"} • {groups.find((g) => g.id === s.group_id)?.name || "—"}</div></div>
                  <div className="flex flex-wrap gap-1 text-[11px] font-bold">
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-primary">آخر اختبار: {lv?.exam || "—"}</span>
                    <span className="rounded-full bg-secondary/10 px-2 py-0.5 text-secondary">آخر تسميع: {lv?.recitation || "—"}</span>
                  </div>
                </label>
                <StudentRecordRow student={s} date={date} existing={rows.find((r) => r.student_id === s.id && r.date === date) || null} onChanged={async () => { await onChanged(); getLevels().then((r) => setLevels(r.levels)).catch(() => {}); }} />
              </div>
            ); })}
            {list.length === 0 && <div className="p-6 text-center text-sm text-muted-foreground">لا يوجد طلاب</div>}
          </div>
        </div>
        <div className="flex gap-2 border-t p-4"><button onClick={onClose} className="rounded-xl border px-5 py-3 text-sm font-bold">إنهاء وإغلاق</button><button onClick={submit} disabled={busy} className="flex-1 rounded-xl bg-secondary py-3 text-sm font-black text-white disabled:opacity-60">{busy ? "جارٍ الإرسال..." : `إرسال إلى ${sel.size} طالب`}</button></div>
      </div>
    </div>
  );
}


function StudentRecordRow({ student, date, existing, onChanged }: { student: Student; date: string; existing: Row | null; onChanged: () => Promise<void> }) {
  const [exam, setExam] = useState(existing?.exam_level || "");
  const [rec, setRec] = useState(existing?.recitation_level || "");
  const [note, setNote] = useState(existing?.note || "");
  const [busy, setBusy] = useState(false);
  const saveFn = useServerFn(saveStudentRecordAdmin);
  const deleteFn = useServerFn(deleteStudentRecordAdmin);
  useEffect(() => { setExam(existing?.exam_level || ""); setRec(existing?.recitation_level || ""); setNote(existing?.note || ""); }, [existing?.id, date]);
  async function save() {
    if (!exam && !rec && !note.trim()) return toast.error("أدخل الاختبار أو التسميع أو ملاحظة");
    setBusy(true);
    try { await saveFn({ data: { id: existing?.id || undefined, payload: { student_id: student.id, group_id: student.group_id || null, date, exam_level: exam || null, recitation_level: rec || null, note: note.trim() || null } } }); toast.success(`تم حفظ سجل ${student.full_name}`); await onChanged(); }
    catch (e: any) { toast.error(e?.message || "تعذر الحفظ"); } finally { setBusy(false); }
  }
  async function remove() {
    if (!existing) { setExam(""); setRec(""); setNote(""); return; }
    if (!confirm(`حذف سجل ${student.full_name} لهذا التاريخ؟`)) return;
    setBusy(true);
    try { await deleteFn({ data: { id: existing.id } }); toast.success("تم حذف السجل"); await onChanged(); }
    catch (e: any) { toast.error(e?.message || "تعذر الحذف"); } finally { setBusy(false); }
  }
  const sel = (v: string, on: (v: string) => void, label: string) => <select value={v} onChange={(e) => on(e.target.value)} className="rounded-lg border px-2 py-1.5 text-xs font-bold"><option value="">{label}</option>{LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}</select>;
  return <div className="flex flex-wrap items-center gap-2 pr-8">
    <input value={exam} onChange={(e) => setExam(e.target.value)} placeholder="درجة الاختبار (نص أو رقم)" className="w-[150px] rounded-lg border px-2 py-1.5 text-xs font-bold" />
    {sel(rec, setRec, "التسميع")}
    <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="ملاحظة خاصة بالطالب" className="min-w-[160px] flex-1 rounded-lg border px-2 py-1.5 text-xs" />
    <button type="button" disabled={busy} onClick={save} className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-black text-primary-foreground disabled:opacity-60"><Save className="h-3.5 w-3.5" /> {existing ? "تحديث" : "حفظ"}</button>
    <button type="button" disabled={busy} onClick={remove} className="rounded-lg bg-destructive/10 p-1.5 text-destructive" aria-label="حذف"><Trash2 className="h-4 w-4" /></button>
    {existing && <span className="text-[10px] font-bold text-primary">✔ محفوظ</span>}
  </div>;
}

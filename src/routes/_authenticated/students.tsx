import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Search, Trash2, Pencil, Users, X, Printer, StickyNote, Sparkles } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { openPrint, esc } from "@/lib/print";
import { generateStudentReport } from "@/lib/ai-report.functions";


export const Route = createFileRoute("/_authenticated/students")({
  head: () => ({ meta: [{ title: "الطلاب — الأستاذ" }, { name: "description", content: "إدارة طلاب السنتر." }] }),
  component: StudentsPage,
});

type Student = {
  id: string; code: string; full_name: string; phone: string | null; parent_phone: string | null;
  grade: string | null; group_id: string | null; subject: string | null; section: string | null;
  school: string | null; gender: string | null; active: boolean;
};
type Group = { id: string; name: string };

function StudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [q, setQ] = useState("");
  const [gradeFilter, setGradeFilter] = useState("");
  const [groupFilter, setGroupFilter] = useState("");
  const [editing, setEditing] = useState<Student | null>(null);
  const [notesFor, setNotesFor] = useState<Student | null>(null);
  const [notes, setNotes] = useState<{ id: string; title: string | null; body: string; created_at: string }[]>([]);
  const [aiFor, setAiFor] = useState<Student | null>(null);
  const [aiText, setAiText] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const genReport = useServerFn(generateStudentReport);

  async function runAI(s: Student) {
    setAiFor(s); setAiText(null); setAiLoading(true);
    try {
      const [att, hw, subs, pays, sNotes, grp] = await Promise.all([
        supabase.from("attendance").select("status").eq("student_id", s.id),
        s.group_id ? supabase.from("homework").select("id,title,max_score").eq("group_id", s.group_id) : Promise.resolve({ data: [] as any[] }),
        supabase.from("homework_submissions").select("homework_id,score,status").eq("student_id", s.id),
        supabase.from("payments").select("amount,kind").eq("student_id", s.id),
        supabase.from("student_notes").select("body").eq("student_id", s.id),
        s.group_id ? supabase.from("groups").select("name,monthly_fee").eq("id", s.group_id).maybeSingle() : Promise.resolve({ data: null as any }),
      ]);
      const a = (att.data as any[]) || [];
      const hwList = (hw.data as any[]) || [];
      const subList = (subs.data as any[]) || [];
      const payList = (pays.data as any[]) || [];
      const paid = payList.filter(p => p.kind === "payment").reduce((x, y) => x + Number(y.amount), 0);
      const charges = payList.filter(p => p.kind === "charge").reduce((x, y) => x + Number(y.amount), 0);
      const fee = Number((grp as any)?.data?.monthly_fee || 0);
      const due = Math.max(charges, fee);
      const r = await genReport({ data: {
        student: { full_name: s.full_name, grade: s.grade, group: (grp as any)?.data?.name || null },
        attendance: {
          present: a.filter((x: any) => x.status === "present").length,
          absent: a.filter((x: any) => x.status === "absent").length,
          late: a.filter((x: any) => x.status === "late").length,
        },
        homework: hwList.map((h: any) => {
          const sub = subList.find((x: any) => x.homework_id === h.id);
          return { title: h.title, score: sub?.score ?? null, max_score: h.max_score, status: sub?.status || "لم يُسلَّم" };
        }),
        finance: { due, paid, balance: due - paid },
        notes: ((sNotes.data as any[]) || []).map(n => n.body),
      }});
      setAiText(r.text);
    } catch (e: any) { toast.error(e.message || "فشل التوليد"); }
    finally { setAiLoading(false); }
  }


  async function loadNotes(id: string) {
    const { data } = await supabase.from("student_notes").select("*").eq("student_id", id).order("created_at", { ascending: false });
    setNotes((data as any[]) || []);
  }
  async function addNote(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!notesFor) return;
    const fd = new FormData(e.currentTarget);
    const body = String(fd.get("body") || "").trim();
    if (!body) return;
    const { error } = await supabase.from("student_notes").insert({
      student_id: notesFor.id,
      title: String(fd.get("title") || "").trim() || null,
      body,
    });
    if (error) toast.error(error.message);
    else { toast.success("تم حفظ الملاحظة"); (e.target as HTMLFormElement).reset(); loadNotes(notesFor.id); }
  }
  async function delNote(id: string) {
    if (!confirm("حذف الملاحظة؟")) return;
    const { error } = await supabase.from("student_notes").delete().eq("id", id);
    if (error) toast.error(error.message); else { if (notesFor) loadNotes(notesFor.id); }
  }

  async function load() {
    const [{ data: s }, { data: g }] = await Promise.all([
      supabase.from("students").select("id,code,full_name,phone,parent_phone,grade,group_id,subject,section,school,gender,active").order("created_at", { ascending: false }),
      supabase.from("groups").select("id,name").order("name"),
    ]);
    setStudents((s as Student[]) || []);
    setGroups((g as Group[]) || []);
  }
  useEffect(() => { load(); }, []);

  const grades = useMemo(() => Array.from(new Set(students.map(s => s.grade).filter(Boolean))) as string[], [students]);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    return students.filter(s => {
      if (gradeFilter && s.grade !== gradeFilter) return false;
      if (groupFilter && s.group_id !== groupFilter) return false;
      if (t && ![s.full_name, s.code, s.phone, s.parent_phone, s.grade].filter(Boolean).some(v => String(v).toLowerCase().includes(t))) return false;
      return true;
    });
  }, [q, students, gradeFilter, groupFilter]);

  async function assignGroup(id: string, group_id: string) {
    const { error } = await supabase.from("students").update({ group_id: group_id || null }).eq("id", id);
    if (error) toast.error(error.message); else { toast.success("تم التحديث"); load(); }
  }

  async function toggleActive(s: Student) {
    const { error } = await supabase.from("students").update({ active: !s.active }).eq("id", s.id);
    if (error) toast.error(error.message); else { toast.success(!s.active ? "تم التفعيل" : "تم الإيقاف"); load(); }
  }

  async function remove(id: string) {
    if (!confirm("حذف هذا الطالب نهائياً؟ سيتم حذف الحضور والمدفوعات المرتبطة.")) return;
    const { error } = await supabase.from("students").delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success("تم الحذف"); load(); }
  }

  async function saveEdit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editing) return;
    const fd = new FormData(e.currentTarget);
    const payload: any = {};
    fd.forEach((v, k) => { payload[k] = String(v).trim() || null; });
    const { error } = await supabase.from("students").update(payload).eq("id", editing.id);
    if (error) toast.error(error.message); else { toast.success("تم التحديث"); setEditing(null); load(); }
  }

  function printList() {
    const groupName = (id: string | null) => groups.find(g => g.id === id)?.name || "—";
    const rows = filtered.map((s, i) => `<tr>
      <td>${i + 1}</td><td>${esc(s.full_name)}</td><td>${esc(s.code)}</td>
      <td>${esc(s.grade)}</td><td>${esc(s.section)}</td><td>${esc(groupName(s.group_id))}</td>
      <td dir="ltr">${esc(s.phone)}</td><td dir="ltr">${esc(s.parent_phone)}</td>
    </tr>`).join("");
    const filterInfo = [gradeFilter && `الصف: ${gradeFilter}`, groupFilter && `المجموعة: ${groupName(groupFilter)}`].filter(Boolean).join(" — ") || "الكل";
    openPrint("قائمة الطلاب", `
      <h2>قائمة الطلاب (${filtered.length}) — ${filterInfo}</h2>
      <table><thead><tr><th>#</th><th>الاسم</th><th>الكود</th><th>الصف</th><th>الشعبة</th><th>المجموعة</th><th>الهاتف</th><th>ولي الأمر</th></tr></thead>
      <tbody>${rows}</tbody></table>
    `);
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-black">الطلاب <span className="text-sm font-normal text-muted-foreground">({filtered.length}/{students.length})</span></h1>
        <div className="flex flex-wrap items-center gap-2">
          <select value={gradeFilter} onChange={(e) => setGradeFilter(e.target.value)} className="rounded-lg border border-input bg-white px-3 py-2 text-sm">
            <option value="">كل الصفوف</option>
            {grades.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
          <select value={groupFilter} onChange={(e) => setGroupFilter(e.target.value)} className="rounded-lg border border-input bg-white px-3 py-2 text-sm">
            <option value="">كل المجموعات</option>
            {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
          <div className="relative w-full max-w-xs">
            <Search className="pointer-events-none absolute inset-y-0 right-3 my-auto h-4 w-4 text-muted-foreground" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="بحث بالاسم، الكود، الهاتف..." className="w-full rounded-lg border border-input bg-white py-2 pe-9 ps-3 text-sm outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <button onClick={printList} className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-2 text-sm font-bold text-primary-foreground"><Printer className="h-4 w-4" /> طباعة</button>
          <Link to="/student/register" className="rounded-lg bg-secondary px-3 py-2 text-sm font-bold text-secondary-foreground">+ إضافة طالب</Link>
        </div>
      </div>

      {editing && (
        <form onSubmit={saveEdit} className="mb-4 rounded-2xl bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-bold">تعديل: {editing.full_name}</h2>
            <button type="button" onClick={() => setEditing(null)} className="rounded p-1 hover:bg-accent"><X className="h-4 w-4" /></button>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <EF name="full_name" label="الاسم *" required defaultValue={editing.full_name} />
            <EF name="phone" label="الهاتف" defaultValue={editing.phone ?? ""} />
            <EF name="parent_phone" label="هاتف ولي الأمر" defaultValue={editing.parent_phone ?? ""} />
            <EF name="grade" label="الصف" defaultValue={editing.grade ?? ""} />
            <EF name="section" label="الشعبة" defaultValue={editing.section ?? ""} />
            <EF name="school" label="المدرسة" defaultValue={editing.school ?? ""} />
            <EF name="subject" label="المادة" defaultValue={editing.subject ?? ""} />
          </div>
          <button type="submit" className="mt-4 rounded-lg bg-primary px-5 py-2 text-sm font-bold text-primary-foreground">حفظ التعديلات</button>
        </form>
      )}

      {filtered.length === 0 ? (
        <div className="rounded-2xl bg-white p-12 text-center text-muted-foreground shadow-sm">
          <Users className="mx-auto mb-3 h-10 w-10" /> لا يوجد طلاب مطابقون.
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-primary text-primary-foreground text-right">
                <tr>
                  <th className="p-3">الاسم</th>
                  <th className="p-3">الكود</th>
                  <th className="p-3">الصف</th>
                  <th className="p-3">الشعبة</th>
                  <th className="p-3">الهاتف</th>
                  <th className="p-3">ولي الأمر</th>
                  <th className="p-3">المجموعة</th>
                  <th className="p-3">الحالة</th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s, i) => (
                  <tr key={s.id} className={`border-t hover:bg-muted/30 ${i % 2 ? "bg-muted/10" : ""}`}>
                    <td className="p-3 font-semibold">{s.full_name}</td>
                    <td className="p-3 font-mono text-xs">{s.code}</td>
                    <td className="p-3">{s.grade || "—"}</td>
                    <td className="p-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${s.section ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                        {s.section || "—"}
                      </span>
                    </td>
                    <td className="p-3" dir="ltr">{s.phone || "—"}</td>
                    <td className="p-3" dir="ltr">{s.parent_phone || "—"}</td>
                    <td className="p-3">
                      <select value={s.group_id || ""} onChange={(e) => assignGroup(s.id, e.target.value)} className="rounded-md border border-input bg-white px-2 py-1 text-sm">
                        <option value="">— بدون —</option>
                        {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                      </select>
                    </td>
                    <td className="p-3">
                      <button onClick={() => toggleActive(s)} className={`rounded-full px-2 py-0.5 text-xs font-bold ${s.active ? "bg-secondary/15 text-secondary" : "bg-muted text-muted-foreground"}`}>
                        {s.active ? "نشط" : "موقوف"}
                      </button>
                    </td>
                    <td className="p-3 text-left">
                      <div className="flex justify-end gap-1">
                        <button title="تقرير AI عن الطالب" onClick={() => runAI(s)} className="rounded-lg p-1.5 text-gold hover:bg-gold/10"><Sparkles className="h-4 w-4" /></button>
                        <button title="ملاحظات لولي الأمر" onClick={() => { setNotesFor(s); loadNotes(s.id); }} className="rounded-lg p-1.5 text-secondary hover:bg-secondary/10"><StickyNote className="h-4 w-4" /></button>
                        <button onClick={() => setEditing(s)} className="rounded-lg p-1.5 text-primary hover:bg-primary/10"><Pencil className="h-4 w-4" /></button>
                        <button onClick={() => remove(s.id)} className="rounded-lg p-1.5 text-destructive hover:bg-destructive/10"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    </td>

                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {notesFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setNotesFor(null)}>
          <div className="max-h-[85vh] w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b p-4">
              <h2 className="text-lg font-bold flex items-center gap-2"><StickyNote className="h-5 w-5 text-gold" /> ملاحظات {notesFor.full_name}</h2>
              <button onClick={() => setNotesFor(null)} className="rounded p-1 hover:bg-accent"><X className="h-5 w-5" /></button>
            </div>
            <div className="max-h-[70vh] overflow-y-auto p-4">
              <form onSubmit={addNote} className="mb-4 rounded-xl border bg-muted/10 p-3">
                <div className="text-xs text-muted-foreground mb-2">ستظهر هذه الملاحظة في صفحة الطالب لمتابعة ولي الأمر.</div>
                <input name="title" placeholder="عنوان (اختياري)" className="mb-2 w-full rounded-lg border border-input px-3 py-2 text-sm" />
                <textarea name="body" rows={3} required placeholder="اكتب الملاحظة..." className="w-full rounded-lg border border-input px-3 py-2 text-sm" />
                <button type="submit" className="mt-2 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground">إضافة ملاحظة</button>
              </form>
              {notes.length === 0 ? <p className="text-center text-sm text-muted-foreground">لا توجد ملاحظات.</p> : (
                <div className="space-y-2">
                  {notes.map(n => (
                    <div key={n.id} className="rounded-xl border-r-4 border-r-primary bg-muted/10 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          {n.title && <div className="font-bold text-primary">{n.title}</div>}
                          <p className="whitespace-pre-wrap text-sm">{n.body}</p>
                          <div className="mt-1 text-xs text-muted-foreground">{new Date(n.created_at).toLocaleString("ar-EG")}</div>
                        </div>
                        <button onClick={() => delNote(n.id)} className="rounded p-1 text-destructive hover:bg-destructive/10"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {aiFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setAiFor(null)}>
          <div className="max-h-[85vh] w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b p-4">
              <h2 className="text-lg font-bold flex items-center gap-2"><Sparkles className="h-5 w-5 text-gold" /> تقرير AI — {aiFor.full_name}</h2>
              <button onClick={() => setAiFor(null)} className="rounded p-1 hover:bg-accent"><X className="h-5 w-5" /></button>
            </div>
            <div className="max-h-[70vh] overflow-y-auto p-5">
              {aiLoading ? <p className="text-center text-muted-foreground">جارٍ التحليل...</p> :
                aiText ? <div className="whitespace-pre-wrap text-sm leading-loose">{aiText}</div> : null}
              {aiText && (
                <button
                  onClick={() => {
                    const w = window.open("", "_blank"); if (!w) return;
                    w.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"/><title>تقرير ${aiFor!.full_name}</title>
                      <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;900&display=swap" rel="stylesheet">
                      <style>body{font-family:'Cairo',sans-serif;padding:40px;max-width:800px;margin:auto;line-height:1.9;color:#0f172a}
                      h1{color:#1e3a8a;border-bottom:3px double #c9a227;padding-bottom:10px}.body{white-space:pre-wrap;font-size:15px}
                      button{background:#1e3a8a;color:#fff;border:0;padding:8px 16px;border-radius:8px;font-family:inherit;font-weight:700;cursor:pointer}
                      @media print{button{display:none}}</style></head><body>
                      <button onclick="window.print()">🖨️ طباعة / حفظ PDF</button>
                      <h1>تقرير تحليلي — ${aiFor!.full_name}</h1>
                      <div class="body">${aiText.replace(/</g, "&lt;")}</div></body></html>`);
                    w.document.close();
                  }}
                  className="mt-4 rounded-lg bg-gold px-4 py-2 text-sm font-bold text-gold-foreground">طباعة / PDF</button>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

function EF({ name, label, defaultValue, required = false }: { name: string; label: string; defaultValue?: string; required?: boolean }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-semibold">{label}</label>
      <input name={name} defaultValue={defaultValue} required={required} className="w-full rounded-lg border border-input px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" />
    </div>
  );
}

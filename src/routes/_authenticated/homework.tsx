import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Pencil, X, Printer, BookOpen } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { openPrint, esc } from "@/lib/print";

export const Route = createFileRoute("/_authenticated/homework")({
  head: () => ({ meta: [{ title: "الواجبات — الأستاذ" }, { name: "description", content: "إدارة الواجبات وتقييم الطلاب." }] }),
  component: HomeworkPage,
});

type Group = { id: string; name: string; grade: string | null };
type HW = { id: string; group_id: string | null; title: string; description: string | null; due_date: string | null; max_score: number };
type Student = { id: string; full_name: string; code: string; group_id: string | null };
type Sub = { id: string; homework_id: string; student_id: string; score: number | null; status: string; note: string | null };

function HomeworkPage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [items, setItems] = useState<HW[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [subs, setSubs] = useState<Sub[]>([]);
  const [editing, setEditing] = useState<HW | null>(null);
  const [open, setOpen] = useState(false);
  const [activeHW, setActiveHW] = useState<HW | null>(null);

  async function load() {
    const [g, h, s, sb] = await Promise.all([
      supabase.from("groups").select("id,name,grade").order("name"),
      supabase.from("homework").select("*").order("created_at", { ascending: false }),
      supabase.from("students").select("id,full_name,code,group_id").eq("active", true).order("full_name"),
      supabase.from("homework_submissions").select("*"),
    ]);
    setGroups((g.data as Group[]) || []);
    setItems((h.data as HW[]) || []);
    setStudents((s.data as Student[]) || []);
    setSubs((sb.data as Sub[]) || []);
  }
  useEffect(() => { load(); }, []);

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const payload: any = {
      group_id: String(fd.get("group_id") || "") || null,
      title: String(fd.get("title")).trim(),
      description: String(fd.get("description") || "").trim() || null,
      due_date: String(fd.get("due_date") || "") || null,
      max_score: Number(fd.get("max_score") || 100),
    };
    const q = editing ? supabase.from("homework").update(payload).eq("id", editing.id) : supabase.from("homework").insert(payload);
    const { error } = await q;
    if (error) toast.error(error.message); else { toast.success(editing ? "تم التحديث" : "تم إنشاء الواجب"); setOpen(false); setEditing(null); load(); }
  }

  async function remove(id: string) {
    if (!confirm("حذف هذا الواجب؟")) return;
    const { error } = await supabase.from("homework").delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success("تم الحذف"); load(); }
  }

  async function upsertSub(homework_id: string, student_id: string, patch: Partial<Sub>) {
    const existing = subs.find(x => x.homework_id === homework_id && x.student_id === student_id);
    const body: any = { homework_id, student_id, ...patch };
    if (existing) body.id = existing.id;
    const { error } = await supabase.from("homework_submissions").upsert(body, { onConflict: "homework_id,student_id" });
    if (error) toast.error(error.message); else load();
  }

  const groupMap = useMemo(() => Object.fromEntries(groups.map(g => [g.id, g])), [groups]);

  function printHW(hw: HW) {
    const list = students.filter(s => !hw.group_id || s.group_id === hw.group_id);
    const rows = list.map((s, i) => {
      const sub = subs.find(x => x.homework_id === hw.id && x.student_id === s.id);
      return `<tr><td>${i + 1}</td><td>${esc(s.full_name)}</td><td>${esc(s.code)}</td>
        <td>${esc(sub?.status || "—")}</td><td>${sub?.score ?? "—"} / ${hw.max_score}</td><td>${esc(sub?.note)}</td></tr>`;
    }).join("");
    openPrint(`واجب: ${hw.title}`, `
      <h2>${esc(hw.title)} — ${esc(groupMap[hw.group_id || ""]?.name || "كل المجموعات")}${hw.due_date ? ` — تاريخ التسليم: ${esc(hw.due_date)}` : ""}</h2>
      ${hw.description ? `<p>${esc(hw.description)}</p>` : ""}
      <table><thead><tr><th>#</th><th>الطالب</th><th>الكود</th><th>الحالة</th><th>الدرجة</th><th>ملاحظة</th></tr></thead>
      <tbody>${rows}</tbody></table>
    `);
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-black flex items-center gap-2"><BookOpen className="h-6 w-6 text-primary" /> الواجبات</h1>
        <button onClick={() => { setEditing(null); setOpen(true); }} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"><Plus className="h-4 w-4" /> واجب جديد</button>
      </div>

      {open && (
        <form key={editing?.id || "new"} onSubmit={save} className="mb-6 rounded-2xl bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-bold">{editing ? "تعديل واجب" : "إضافة واجب"}</h2>
            <button type="button" onClick={() => { setOpen(false); setEditing(null); }} className="rounded p-1 hover:bg-accent"><X className="h-4 w-4" /></button>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-semibold">المجموعة</label>
              <select name="group_id" defaultValue={editing?.group_id || ""} className="w-full rounded-lg border border-input bg-white px-3 py-2 text-sm">
                <option value="">— كل المجموعات —</option>
                {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </div>
            <F name="title" label="عنوان الواجب *" required defaultValue={editing?.title} />
            <F name="due_date" label="تاريخ التسليم" type="date" defaultValue={editing?.due_date ?? ""} />
            <F name="max_score" label="الدرجة القصوى" type="number" defaultValue={editing ? String(editing.max_score) : "100"} />
            <div className="md:col-span-2">
              <label className="mb-1.5 block text-sm font-semibold">الوصف</label>
              <textarea name="description" defaultValue={editing?.description ?? ""} rows={3} className="w-full rounded-lg border border-input px-3 py-2 text-sm" />
            </div>
          </div>
          <button type="submit" className="mt-4 rounded-lg bg-secondary px-5 py-2 text-sm font-bold text-secondary-foreground">{editing ? "تحديث" : "حفظ"}</button>
        </form>
      )}

      {items.length === 0 ? (
        <div className="rounded-2xl bg-white p-12 text-center text-muted-foreground shadow-sm">لا توجد واجبات بعد.</div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {items.map(h => (
            <div key={h.id} className="rounded-2xl bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-lg font-bold">{h.title}</h3>
                  <p className="text-xs text-muted-foreground">{groupMap[h.group_id || ""]?.name || "كل المجموعات"}{h.due_date ? ` · تسليم ${h.due_date}` : ""}</p>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => { setEditing(h); setOpen(true); }} className="rounded-lg p-1.5 text-primary hover:bg-primary/10"><Pencil className="h-4 w-4" /></button>
                  <button onClick={() => remove(h.id)} className="rounded-lg p-1.5 text-destructive hover:bg-destructive/10"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
              {h.description && <p className="mt-2 text-sm text-muted-foreground line-clamp-2">{h.description}</p>}
              <div className="mt-4 flex gap-2">
                <button onClick={() => setActiveHW(h)} className="flex-1 rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary">تقييم الطلاب</button>
                <button onClick={() => printHW(h)} className="inline-flex items-center gap-1 rounded-lg bg-muted px-3 py-1.5 text-xs font-bold"><Printer className="h-3.5 w-3.5" /> طباعة</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeHW && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[85vh] w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b p-4">
              <h2 className="text-lg font-bold">تقييم: {activeHW.title}</h2>
              <button onClick={() => setActiveHW(null)} className="rounded p-1 hover:bg-accent"><X className="h-5 w-5" /></button>
            </div>
            <div className="max-h-[70vh] overflow-y-auto p-4">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-right"><tr><th className="p-2">الطالب</th><th className="p-2">الحالة</th><th className="p-2">الدرجة</th><th className="p-2">ملاحظة</th></tr></thead>
                <tbody>
                  {students.filter(s => !activeHW.group_id || s.group_id === activeHW.group_id).map(s => {
                    const sub = subs.find(x => x.homework_id === activeHW.id && x.student_id === s.id);
                    return (
                      <tr key={s.id} className="border-t">
                        <td className="p-2 font-semibold">{s.full_name}</td>
                        <td className="p-2">
                          <select value={sub?.status || "pending"} onChange={(e) => upsertSub(activeHW.id, s.id, { status: e.target.value })} className="rounded border border-input bg-white px-2 py-1 text-xs">
                            <option value="pending">معلق</option>
                            <option value="submitted">مسلَّم</option>
                            <option value="graded">مقيَّم</option>
                            <option value="missing">غائب</option>
                          </select>
                        </td>
                        <td className="p-2">
                          <input type="number" defaultValue={sub?.score ?? ""} max={activeHW.max_score} min={0}
                            onBlur={(e) => upsertSub(activeHW.id, s.id, { score: e.target.value ? Number(e.target.value) : null, status: e.target.value ? "graded" : (sub?.status || "pending") })}
                            className="w-20 rounded border border-input px-2 py-1 text-xs" /> / {activeHW.max_score}
                        </td>
                        <td className="p-2">
                          <input defaultValue={sub?.note ?? ""} onBlur={(e) => upsertSub(activeHW.id, s.id, { note: e.target.value || null })}
                            className="w-full rounded border border-input px-2 py-1 text-xs" />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function F({ name, label, type = "text", required = false, defaultValue }: { name: string; label: string; type?: string; required?: boolean; defaultValue?: string }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-semibold">{label}</label>
      <input name={name} type={type} required={required} defaultValue={defaultValue} className="w-full rounded-lg border border-input px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" />
    </div>
  );
}

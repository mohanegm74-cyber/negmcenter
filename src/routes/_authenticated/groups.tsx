import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Pencil, Boxes, X, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { saveGroup, deleteGroup } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/groups")({
  head: () => ({ meta: [{ title: "المجموعات — الأستاذ" }, { name: "description", content: "إدارة مجموعات السنتر." }] }),
  component: GroupsPage,
});

type Group = {
  id: string; name: string; subject: string | null; grade: string | null; teacher_name: string | null;
  color: string; days: string | null; time: string | null; room: string | null; max_students: number;
  monthly_fee: number;
};

function GroupsPage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [editing, setEditing] = useState<Group | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const saveFn = useServerFn(saveGroup);
  const delFn = useServerFn(deleteGroup);

  async function load() {
    const { data } = await supabase.from("groups").select("*").order("created_at", { ascending: false });
    setGroups((data as Group[]) || []);
  }
  useEffect(() => { load(); }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const fd = new FormData(e.currentTarget);
    const payload: any = { color: "#1e40af" };
    fd.forEach((v, k) => { const s = String(v).trim(); if (s !== "") payload[k] = s; });
    if (payload.max_students) payload.max_students = Number(payload.max_students);
    if (payload.monthly_fee) payload.monthly_fee = Number(payload.monthly_fee);

    try {
      await saveFn({ data: { id: editing?.id, payload } });
      toast.success(editing ? "تم التعديل" : "تم إنشاء المجموعة");
      setOpen(false); setEditing(null); load();
    } catch (err: any) {
      toast.error(err.message || "فشل الحفظ");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("حذف هذه المجموعة؟ سيتم فك ارتباط الطلاب بها.")) return;
    try {
      await delFn({ data: { id } });
      toast.success("تم الحذف"); load();
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-black">المجموعات <span className="text-sm font-normal text-muted-foreground">({groups.length})</span></h1>
        <button onClick={() => { setEditing(null); setOpen(true); }} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"><Plus className="h-4 w-4" /> إنشاء مجموعة</button>
      </div>

      {open && (
        <form key={editing?.id || "new"} onSubmit={handleSubmit} className="mb-6 rounded-2xl bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-bold">{editing ? `تعديل: ${editing.name}` : "مجموعة جديدة"}</h2>
            <button type="button" onClick={() => { setOpen(false); setEditing(null); }} className="rounded p-1 hover:bg-accent"><X className="h-4 w-4" /></button>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <F name="name" label="اسم المجموعة *" required defaultValue={editing?.name} />
            <F name="subject" label="المادة" defaultValue={editing?.subject ?? ""} />
            <F name="grade" label="الصف" defaultValue={editing?.grade ?? ""} />
            <F name="teacher_name" label="المعلم" defaultValue={editing?.teacher_name ?? ""} />
            <F name="days" label="أيام الدراسة" placeholder="السبت، الاثنين" defaultValue={editing?.days ?? ""} />
            <F name="time" label="الميعاد" placeholder="4:00 – 6:00 م" defaultValue={editing?.time ?? ""} />
            <F name="room" label="القاعة" defaultValue={editing?.room ?? ""} />
            <F name="max_students" label="الحد الأقصى" type="number" defaultValue={editing?.max_students ? String(editing.max_students) : ""} />
            <F name="monthly_fee" label="الرسوم الشهرية (ج.م)" type="number" defaultValue={editing?.monthly_fee ? String(editing.monthly_fee) : ""} />
            <div>
              <label className="mb-1.5 block text-sm font-semibold">اللون</label>
              <input type="color" name="color" defaultValue={editing?.color || "#1e40af"} className="h-[42px] w-full rounded-lg border border-input" />
            </div>
          </div>
          <button type="submit" disabled={busy} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-secondary px-5 py-2 text-sm font-bold text-secondary-foreground disabled:opacity-60">
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} {editing ? "تحديث" : "حفظ"}
          </button>
        </form>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {groups.map((g) => (
          <div key={g.id} className="rounded-2xl bg-white p-5 shadow-sm" style={{ borderInlineStartWidth: 6, borderInlineStartColor: g.color }}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="text-lg font-bold">{g.name}</h3>
                <p className="text-xs text-muted-foreground">{g.subject || "—"} · {g.grade || "—"}</p>
              </div>
              <div className="flex gap-1">
                <button onClick={() => { setEditing(g); setOpen(true); }} className="rounded-lg p-1.5 text-primary hover:bg-primary/10"><Pencil className="h-4 w-4" /></button>
                <button onClick={() => remove(g.id)} className="rounded-lg p-1.5 text-destructive hover:bg-destructive/10"><Trash2 className="h-4 w-4" /></button>
              </div>
            </div>
            <dl className="mt-4 space-y-1 text-sm">
              <Row k="المعلم" v={g.teacher_name} />
              <Row k="الأيام" v={g.days} />
              <Row k="الميعاد" v={g.time} />
              <Row k="القاعة" v={g.room} />
              <Row k="الحد الأقصى" v={String(g.max_students ?? "—")} />
              <Row k="الرسوم الشهرية" v={g.monthly_fee ? `${g.monthly_fee} ج.م` : "—"} />
            </dl>
          </div>
        ))}
      </div>
    </div>
  );
}

function F({ name, label, type = "text", required = false, placeholder, defaultValue }: { name: string; label: string; type?: string; required?: boolean; placeholder?: string; defaultValue?: string }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-semibold">{label}</label>
      <input name={name} type={type} required={required} placeholder={placeholder} defaultValue={defaultValue} className="w-full rounded-lg border border-input px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" />
    </div>
  );
}
function Row({ k, v }: { k: string; v: string | null | undefined }) {
  return <div className="flex justify-between gap-2 border-b border-dashed py-1 last:border-0"><dt className="text-muted-foreground">{k}</dt><dd className="font-semibold">{v || "—"}</dd></div>;
}
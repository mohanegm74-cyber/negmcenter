import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Boxes } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/groups")({
  head: () => ({ meta: [{ title: "المجموعات — الأستاذ" }, { name: "description", content: "إدارة مجموعات السنتر." }] }),
  component: GroupsPage,
});

type Group = { id: string; name: string; subject: string | null; grade: string | null; teacher_name: string | null; color: string; days: string | null; time: string | null; room: string | null; max_students: number };

function GroupsPage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [open, setOpen] = useState(false);

  async function load() {
    const { data } = await supabase.from("groups").select("*").order("created_at", { ascending: false });
    setGroups((data as Group[]) || []);
  }
  useEffect(() => { load(); }, []);

  async function createGroup(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const payload: any = {};
    fd.forEach((v, k) => { const s = String(v).trim(); if (s) payload[k] = s; });
    if (payload.max_students) payload.max_students = Number(payload.max_students);
    const { error } = await supabase.from("groups").insert(payload);
    if (error) toast.error(error.message);
    else { toast.success("تم إنشاء المجموعة"); setOpen(false); load(); }
  }

  async function remove(id: string) {
    if (!confirm("حذف هذه المجموعة؟")) return;
    const { error } = await supabase.from("groups").delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success("تم الحذف"); load(); }
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-black">المجموعات</h1>
        <button onClick={() => setOpen(!open)} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"><Plus className="h-4 w-4" /> إنشاء مجموعة</button>
      </div>

      {open && (
        <form onSubmit={createGroup} className="mb-6 rounded-2xl bg-white p-5 shadow-sm">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <F name="name" label="اسم المجموعة *" required />
            <F name="subject" label="المادة" />
            <F name="grade" label="الصف" />
            <F name="teacher_name" label="المعلم" />
            <F name="days" label="أيام الدراسة" placeholder="السبت، الاثنين" />
            <F name="time" label="الميعاد" placeholder="4:00 – 6:00 م" />
            <F name="room" label="القاعة" />
            <F name="max_students" label="الحد الأقصى" type="number" />
            <div>
              <label className="mb-1.5 block text-sm font-semibold">اللون</label>
              <input type="color" name="color" defaultValue="#1e40af" className="h-[42px] w-full rounded-lg border border-input" />
            </div>
          </div>
          <button type="submit" className="mt-4 rounded-lg bg-secondary px-5 py-2 text-sm font-bold text-secondary-foreground">حفظ</button>
        </form>
      )}

      {groups.length === 0 ? (
        <div className="rounded-2xl bg-white p-12 text-center text-muted-foreground shadow-sm">
          <Boxes className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
          لا توجد مجموعات بعد. أنشئ أول مجموعة.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {groups.map((g) => (
            <div key={g.id} className="rounded-2xl bg-white p-5 shadow-sm" style={{ borderInlineStartWidth: 6, borderInlineStartColor: g.color }}>
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-bold">{g.name}</h3>
                  <p className="text-xs text-muted-foreground">{g.subject || "—"} · {g.grade || "—"}</p>
                </div>
                <button onClick={() => remove(g.id)} className="rounded-lg p-1.5 text-destructive hover:bg-destructive/10"><Trash2 className="h-4 w-4" /></button>
              </div>
              <dl className="mt-4 space-y-1 text-sm">
                <Row k="المعلم" v={g.teacher_name} />
                <Row k="الأيام" v={g.days} />
                <Row k="الميعاد" v={g.time} />
                <Row k="القاعة" v={g.room} />
                <Row k="الحد الأقصى" v={String(g.max_students)} />
              </dl>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function F({ name, label, type = "text", required = false, placeholder }: { name: string; label: string; type?: string; required?: boolean; placeholder?: string }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-semibold">{label}</label>
      <input name={name} type={type} required={required} placeholder={placeholder} className="w-full rounded-lg border border-input px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" />
    </div>
  );
}
function Row({ k, v }: { k: string; v: string | null | undefined }) {
  return <div className="flex justify-between gap-2 border-b border-dashed py-1 last:border-0"><dt className="text-muted-foreground">{k}</dt><dd className="font-semibold">{v || "—"}</dd></div>;
}

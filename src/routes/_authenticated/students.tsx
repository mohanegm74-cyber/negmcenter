import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Search, Trash2, Pencil, Users, X, Loader2, Link as LinkIcon, Phone, MapPin, School, GraduationCap, Save } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { getAllStudentsAdmin } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/students")({
  head: () => ({ meta: [{ title: "إدارة الطلاب — الأستاذ محمد نجم" }, { name: "description", content: "إدارة طلاب السنتر وتعديل بياناتهم." }] }),
  component: StudentsPage,
});

type Student = {
  id: string; code: string; full_name: string; phone: string | null; parent_phone: string | null;
  grade: string | null; group_id: string | null; active: boolean; address: string | null;
  school: string | null; section: string | null;
};
type Group = { id: string; name: string; grade: string | null };

function StudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Student | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  
  const loadStudentsFn = useServerFn(getAllStudentsAdmin);

  async function load() {
    setLoading(true);
    try {
      const { students: st } = await loadStudentsFn({});
      const { data: g } = await supabase.from("groups").select("id,name,grade").order("name");
      setStudents(st as Student[]);
      setGroups((g as Group[]) || []);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    return students.filter(s => 
      !t || 
      s.full_name.toLowerCase().includes(t) || 
      s.code.toLowerCase().includes(t) ||
      (s.phone && s.phone.includes(t)) ||
      (s.school && s.school.toLowerCase().includes(t))
    );
  }, [q, students]);

  async function assignGroup(id: string, group_id: string) {
    const { error } = await supabase.from("students").update({ group_id: group_id || null }).eq("id", id);
    if (error) toast.error(error.message); else { toast.success("تم تحديث المجموعة"); load(); }
  }

  async function remove(id: string, name: string) {
    if (!confirm(`هل أنت متأكد من حذف الطالب "${name}" نهائياً؟ لا يمكن التراجع عن هذا الإجراء.`)) return;
    const { error } = await supabase.from("students").delete().eq("id", id);
    if (error) {
      toast.error("فشل الحذف: " + error.message);
    } else {
      toast.success("تم حذف الطالب بنجاح");
      load();
    }
  }

  async function saveEdit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editing) return;
    setIsSaving(true);
    const fd = new FormData(e.currentTarget);
    const payload: any = {};
    fd.forEach((v, k) => { payload[k] = String(v).trim() || null; });
    
    const { error } = await supabase.from("students").update(payload).eq("id", editing.id);
    setIsSaving(false);
    
    if (error) {
      toast.error("فشل الحفظ: " + error.message);
    } else {
      toast.success("تم تحديث بيانات الطالب بنجاح");
      setEditing(null);
      load();
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="text-2xl font-black flex items-center gap-2"><Users className="h-6 w-6 text-primary" /> إدارة الطلاب المتكاملة</h1>
        <div className="flex gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-80">
            <Search className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="بحث بالاسم، الكود، الهاتف أو المدرسة..." className="w-full rounded-lg border bg-white py-2 pe-3 ps-9 text-sm outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <Link to="/student/register" className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground shadow-sm hover:opacity-90">إضافة طالب جديد</Link>
        </div>
      </div>

      {editing && (
        <form onSubmit={saveEdit} className="rounded-2xl bg-white p-6 shadow-xl border-2 border-primary animate-in fade-in slide-in-from-top-4 z-20 relative">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-black text-primary flex items-center gap-2"><Pencil className="h-5 w-5" /> تعديل بيانات: {editing.full_name}</h2>
            <button type="button" onClick={() => setEditing(null)} className="rounded-full p-2 hover:bg-muted transition-colors"><X className="h-5 w-5" /></button>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <F name="full_name" label="الاسم الرباعي *" required defaultValue={editing.full_name} icon={<Users className="h-4 w-4" />} />
            <F name="phone" label="رقم الهاتف" defaultValue={editing.phone || ""} icon={<Phone className="h-4 w-4" />} />
            <F name="parent_phone" label="هاتف ولي الأمر" defaultValue={editing.parent_phone || ""} icon={<Phone className="h-4 w-4" />} />
            <F name="school" label="المدرسة" defaultValue={editing.school || ""} icon={<School className="h-4 w-4" />} />
            <F name="grade" label="الصف الدراسي" defaultValue={editing.grade || ""} icon={<GraduationCap className="h-4 w-4" />} />
            <F name="section" label="الشعبة" defaultValue={editing.section || ""} />
            <div className="sm:col-span-2 lg:col-span-3">
              <F name="address" label="العنوان السكني بالتفصيل" defaultValue={editing.address || ""} icon={<MapPin className="h-4 w-4" />} />
            </div>
          </div>
          <div className="mt-6 flex gap-3">
            <button type="submit" disabled={isSaving} className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-8 py-2.5 text-sm font-black text-primary-foreground shadow-lg hover:opacity-90 disabled:opacity-50">
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              حفظ التغييرات
            </button>
            <button type="button" onClick={() => setEditing(null)} className="flex-1 sm:flex-none rounded-lg border bg-white px-8 py-2.5 text-sm font-bold hover:bg-muted">إلغاء</button>
          </div>
        </form>
      )}

      <div className="overflow-hidden rounded-2xl border bg-white shadow-md">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead className="bg-primary text-primary-foreground">
              <tr>
                <th className="p-4 font-black">بيانات الطالب</th>
                <th className="p-4 font-black">المدرسة والعنوان</th>
                <th className="p-4 font-black">التواصل</th>
                <th className="p-4 font-black">المجموعة</th>
                <th className="p-4 font-black text-center">الإجراءات</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="p-20 text-center text-muted-foreground"><Loader2 className="mx-auto h-10 w-10 animate-spin mb-4 text-primary" /> جارٍ جلب بيانات الطلاب من السيرفر...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={5} className="p-20 text-center text-muted-foreground">لا يوجد طلاب مسجلين حالياً أو لا توجد نتائج للبحث.</td></tr>
              ) : (
                filtered.map((s, i) => (
                  <tr key={s.id} className={`border-t hover:bg-primary/5 transition-colors ${i % 2 ? 'bg-muted/5' : ''}`}>
                    <td className="p-4">
                      <div className="font-bold text-base text-primary">{s.full_name}</div>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-mono">{s.code}</span>
                        <span className="text-[10px] bg-secondary/10 text-secondary px-2 py-0.5 rounded-full font-bold">{s.grade || 'بدون صف'}</span>
                      </div>
                    </td>
                    <td className="p-4">
                      {s.school ? <div className="flex items-center gap-1.5 text-xs font-semibold"><School className="h-3 w-3 text-muted-foreground" /> {s.school}</div> : <div className="text-xs text-muted-foreground italic">المدرسة غير مسجلة</div>}
                      {s.address && <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mt-1"><MapPin className="h-3 w-3" /> {s.address}</div>}
                    </td>
                    <td className="p-4">
                      {s.phone ? <div className="flex items-center gap-1.5 text-xs font-mono"><Phone className="h-3 w-3 text-muted-foreground" /> {s.phone}</div> : <div className="text-xs text-muted-foreground italic">بدون هاتف</div>}
                      {s.parent_phone && <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mt-1 font-mono"><Users className="h-3 w-3" /> {s.parent_phone}</div>}
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2 max-w-[200px]">
                        <select 
                          value={s.group_id || ""} 
                          onChange={e => assignGroup(s.id, e.target.value)} 
                          className={`flex-1 rounded-lg border-2 px-2 py-1.5 text-xs font-bold transition-all ${!s.group_id ? 'border-amber-400 bg-amber-50 text-amber-700' : 'border-primary/20 bg-white focus:border-primary'}`}
                        >
                          <option value="">— اختر المجموعة —</option>
                          {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                        </select>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex justify-center gap-2">
                        <button 
                          onClick={() => { setEditing(s); window.scrollTo({ top: 0, behavior: 'smooth' }); }} 
                          className="group relative rounded-xl bg-primary/10 p-2.5 text-primary hover:bg-primary hover:text-white transition-all duration-300" 
                          title="تعديل البيانات"
                        >
                          <Pencil className="h-4.5 w-4.5" />
                        </button>
                        <button 
                          onClick={() => remove(s.id, s.full_name)} 
                          className="group relative rounded-xl bg-destructive/10 p-2.5 text-destructive hover:bg-destructive hover:text-white transition-all duration-300" 
                          title="حذف الطالب"
                        >
                          <Trash2 className="h-4.5 w-4.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      <p className="text-center text-xs text-muted-foreground py-2">عدد الطلاب المعروضين حالياً: <b>{filtered.length}</b> طالب</p>
    </div>
  );
}

function F({ name, label, defaultValue, required = false, icon }: { name: string; label: string; defaultValue?: string; required?: boolean; icon?: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-bold text-muted-foreground flex items-center gap-1.5">
        {icon}
        {label}
      </label>
      <input 
        name={name} 
        defaultValue={defaultValue} 
        required={required} 
        className="w-full rounded-xl border-2 border-input bg-white px-4 py-2.5 text-sm font-semibold outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all" 
      />
    </div>
  );
}
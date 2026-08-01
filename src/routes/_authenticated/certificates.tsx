import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Award, Printer, Loader2, Send, CheckCircle } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { LOGO_URL } from "@/components/BrandLogo";
import { getAdminDataSummary, sendCertificateToPortal } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/certificates")({
  head: () => ({ meta: [{ title: "شهادات التقدير — الأستاذ" }] }),
  component: CertsPage,
});

const TEMPLATES = [
  { id: "royal", name: "الملكي الذهبي", preview: "linear-gradient(135deg,#fdfaf3,#fff)", css: ".frame { background: #fdfaf3; border:8px double #c9a227; }" },
  { id: "emerald", name: "الزمرد الأنيق", preview: "linear-gradient(135deg,#ecfdf5,#fff)", css: ".frame { background: #ecfdf5; border:6px solid #059669; }" },
];

function CertsPage() {
  const [students, setStudents] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [templateId, setTemplateId] = useState("royal");
  const [title, setTitle] = useState("شهادة تقدير وامتياز");
  const [reason, setReason] = useState("تقديراً لتفوّقه والتزامه ومثابرته المتميزة");
  const [signer, setSigner] = useState("الأستاذ / محمد نجم");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const loadFn = useServerFn(getAdminDataSummary);
  const sendFn = useServerFn(sendCertificateToPortal);

  useEffect(() => { loadFn({}).then(res => { setStudents(res.students); setGroups(res.groups); setLoading(false); }); }, []);

  const groupMap = useMemo(() => Object.fromEntries(groups.map(g => [g.id, g.name])), [groups]);

  async function handleSendToPortal() {
    if (selected.size === 0) { toast.error("اختر طالباً واحداً على الأقل"); return; }
    setSending(true);
    try {
      for (const sid of Array.from(selected)) {
        await sendFn({ data: { student_id: sid, title, reason, template_id: templateId, signer } });
      }
      toast.success(`تم إرسال ${selected.size} شهادة إلى بوابات الطلاب بنجاح`);
      setSelected(new Set());
    } catch { toast.error("فشل الإرسال"); }
    finally { setSending(false); }
  }

  function toggle(id: string) { const n = new Set(selected); n.has(id) ? n.delete(id) : n.add(id); setSelected(n); }

  if (loading) return <div className="p-20 text-center"><Loader2 className="mx-auto h-8 w-8 animate-spin" /></div>;

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-black flex items-center gap-2"><Award className="h-6 w-6 text-gold" /> شهادات التقدير</h1>
      
      <div className="grid grid-cols-1 gap-4 rounded-2xl bg-white p-5 shadow-sm md:grid-cols-2">
        <label className="block text-xs font-bold">عنوان الشهادة<input className="w-full border rounded-lg p-2 mt-1" value={title} onChange={e => setTitle(e.target.value)} /></label>
        <label className="block text-xs font-bold">اسم الموقِّع<input className="w-full border rounded-lg p-2 mt-1" value={signer} onChange={e => setSigner(e.target.value)} /></label>
        <label className="block text-xs font-bold md:col-span-2">نص التقدير<textarea className="w-full border rounded-lg p-2 mt-1" value={reason} onChange={e => setReason(e.target.value)} rows={2} /></label>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button onClick={handleSendToPortal} disabled={sending || selected.size === 0} className="inline-flex items-center gap-2 rounded-xl bg-secondary px-6 py-2.5 text-sm font-black text-white shadow-lg disabled:opacity-50">
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} إرسال المختار للبوابة ({selected.size})
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
        <table className="w-full text-right text-sm">
          <thead className="bg-primary text-white"><tr><th className="p-3 w-10"></th><th className="p-3">الطالب</th><th className="p-3">الصف</th><th className="p-3">المجموعة</th></tr></thead>
          <tbody>
            {students.filter(s => s.active).map(s => (
              <tr key={s.id} className="border-t hover:bg-muted/30">
                <td className="p-3"><input type="checkbox" checked={selected.has(s.id)} onChange={() => toggle(s.id)} /></td>
                <td className="p-3 font-bold">{s.full_name}</td>
                <td className="p-3 font-semibold">{s.grade || "—"}</td>
                <td className="p-3">{groupMap[s.group_id!] || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
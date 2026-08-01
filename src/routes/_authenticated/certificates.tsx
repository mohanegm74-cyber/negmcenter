import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Award, Printer, Loader2, Send, CheckCircle, X, Eye, Sparkles } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { LOGO_URL } from "@/components/BrandLogo";
import { getAdminDataSummary, sendCertificateToPortal } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/certificates")({
  head: () => ({ meta: [{ title: "شهادات التقدير — الأستاذ" }] }),
  component: CertsPage,
});

const TEMPLATES = [
  { id: "royal", name: "الملكي الذهبي", preview: "linear-gradient(135deg,#fdfaf3,#fff)", css: ".frame { background: #fdfaf3; border:10px double #c9a227; } .title { color: #854d0e; }" },
  { id: "emerald", name: "الزمرد الأنيق", preview: "linear-gradient(135deg,#ecfdf5,#fff)", css: ".frame { background: #ecfdf5; border:6px solid #059669; } .title { color: #065f46; }" },
  { id: "modern-blue", name: "العصري الأزرق", preview: "linear-gradient(135deg,#eff6ff,#fff)", css: ".frame { background: #eff6ff; border:8px solid #1e3a8a; border-radius: 40px; } .title { color: #1e3a8a; }" },
  { id: "classic", name: "الكلاسيكي الموقر", preview: "linear-gradient(135deg,#fff,#f8fafc)", css: ".frame { background: #fff; border:4px solid #334155; padding: 40px; } .title { color: #0f172a; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px; }" },
];

function CertsPage() {
  const [students, setStudents] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [templateId, setTemplateId] = useState("royal");
  const [title, setTitle] = useState("شهادة تقدير وامتياز");
  const [reason, setReason] = useState("تقديراً لتفوّقه والتزامه ومثابرته المتميزة في جميع الاختبارات والمشاركة الفعالة");
  const [signer, setSigner] = useState("الأستاذ / محمد نجم");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [previewing, setPreviewing] = useState(false);

  const loadFn = useServerFn(getAdminDataSummary);
  const sendFn = useServerFn(sendCertificateToPortal);

  useEffect(() => { loadFn({}).then(res => { setStudents(res.students); setGroups(res.groups); setLoading(false); }); }, []);

  const groupMap = useMemo(() => Object.fromEntries(groups.map(g => [g.id, g.name])), [groups]);
  const activeTemplate = useMemo(() => TEMPLATES.find(t => t.id === templateId) || TEMPLATES[0], [templateId]);

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
  function toggleAll() {
    if (selected.size === students.filter(s => s.active).length) setSelected(new Set());
    else setSelected(new Set(students.filter(s => s.active).map(s => s.id)));
  }

  if (loading) return <div className="p-20 text-center"><Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-black flex items-center gap-2"><Award className="h-6 w-6 text-gold" /> شهادات التقدير والامتياز</h1>
        <button onClick={() => setPreviewing(true)} className="inline-flex items-center gap-2 rounded-xl border-2 border-primary/20 bg-white px-4 py-2 text-sm font-bold text-primary hover:bg-primary hover:text-white transition-all"><Eye className="h-4 w-4" /> معاينة النموذج</button>
      </div>
      
      <div className="grid grid-cols-1 gap-6 rounded-[2rem] bg-white p-6 shadow-sm border border-slate-100 md:grid-cols-2">
        <div className="space-y-4">
          <label className="block text-xs font-black text-muted-foreground uppercase">عنوان الشهادة<input className="w-full border rounded-xl p-3 mt-1 font-bold focus:border-primary outline-none" value={title} onChange={e => setTitle(e.target.value)} /></label>
          <label className="block text-xs font-black text-muted-foreground uppercase">اسم الموقِّع (الأستاذ)<input className="w-full border rounded-xl p-3 mt-1 font-bold focus:border-primary outline-none" value={signer} onChange={e => setSigner(e.target.value)} /></label>
          <label className="block text-xs font-black text-muted-foreground uppercase">نص التقدير والثناء<textarea className="w-full border rounded-xl p-3 mt-1 text-sm leading-relaxed focus:border-primary outline-none" value={reason} onChange={e => setReason(e.target.value)} rows={3} /></label>
        </div>
        
        <div>
          <div className="text-xs font-black text-muted-foreground uppercase mb-2">اختر قالب التصميم</div>
          <div className="grid grid-cols-2 gap-3">
            {TEMPLATES.map(t => (
              <button key={t.id} onClick={() => setTemplateId(t.id)} className={`flex flex-col gap-2 p-3 rounded-2xl border-2 transition-all ${templateId === t.id ? "border-primary bg-primary/5" : "border-slate-100 hover:border-slate-200"}`}>
                <div className="h-16 w-full rounded-lg shadow-inner" style={{ background: t.preview }} />
                <span className="text-[11px] font-black">{t.name}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <button onClick={handleSendToPortal} disabled={sending || selected.size === 0} className="inline-flex items-center gap-2 rounded-2xl bg-secondary px-8 py-3 text-sm font-black text-white shadow-lg shadow-secondary/20 hover:opacity-90 disabled:opacity-50 transition-all">
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} اعتماد وإرسال المختار للبوابة ({selected.size})
        </button>
        <div className="text-xs font-bold text-muted-foreground bg-white px-4 py-2 rounded-full border border-slate-100">سيتم ربط الشهادة بباركود التحقق التلقائي في بوابة الطالب</div>
      </div>

      <div className="overflow-hidden rounded-[2rem] border bg-white shadow-sm">
        <div className="p-4 border-b bg-slate-50 flex justify-between items-center">
          <h3 className="font-black text-slate-800">اختر الطلاب المتميزين</h3>
          <button onClick={toggleAll} className="text-xs font-bold text-primary hover:underline">{selected.size === students.filter(s => s.active).length ? "إلغاء تحديد الكل" : "تحديد كل الطلاب"}</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead className="bg-primary text-white"><tr><th className="p-4 w-12"></th><th className="p-4">الطالب</th><th className="p-4">الصف الدراسي</th><th className="p-4">المجموعة</th><th className="p-4">الموقف</th></tr></thead>
            <tbody className="divide-y">
              {students.filter(s => s.active).map(s => (
                <tr key={s.id} className="hover:bg-primary/5 transition-colors cursor-pointer" onClick={() => toggle(s.id)}>
                  <td className="p-4" onClick={e => e.stopPropagation()}><input type="checkbox" className="h-4 w-4" checked={selected.has(s.id)} onChange={() => toggle(s.id)} /></td>
                  <td className="p-4 font-bold text-slate-800">{s.full_name}</td>
                  <td className="p-4 font-semibold text-slate-600">{s.grade || "—"}</td>
                  <td className="p-4"><span className="text-xs font-bold text-muted-foreground">{groupMap[s.group_id!] || "—"}</span></td>
                  <td className="p-4"><div className={`h-2.5 w-2.5 rounded-full ${selected.has(s.id) ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" : "bg-slate-200"}`}></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* نافذة المعاينة */}
      {previewing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={() => setPreviewing(false)}>
          <div className="w-full max-w-2xl bg-white rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b flex justify-between items-center">
              <h3 className="font-black text-lg flex items-center gap-2"><Sparkles className="h-5 w-5 text-gold" /> معاينة شهادة التقدير</h3>
              <button onClick={() => setPreviewing(false)} className="p-2 hover:bg-slate-100 rounded-full"><X className="h-6 w-6" /></button>
            </div>
            
            <div className="p-10 bg-slate-100">
              <style dangerouslySetInnerHTML={{ __html: activeTemplate.css }} />
              <div className="frame relative mx-auto p-12 text-center shadow-2xl overflow-hidden">
                <img src={LOGO_URL} className="mx-auto h-20 w-20 mb-6 object-contain" alt="logo" />
                <h1 className="title text-3xl font-black mb-6">{title}</h1>
                <p className="text-sm text-slate-500 font-bold mb-2">تمنح إدارة السنتر هذه الشهادة للطالب /</p>
                <div className="text-2xl font-black text-slate-800 mb-6 border-b-2 border-dashed border-slate-300 inline-block px-10 pb-2">اسم الطالب يظهر هنا</div>
                <p className="text-base text-slate-700 leading-relaxed max-w-md mx-auto mb-10">{reason}</p>
                <div className="flex justify-between items-end mt-12 text-right">
                  <div className="text-xs font-bold text-slate-400">تحريراً في: {new Date().toLocaleDateString("ar-EG")}</div>
                  <div className="text-center">
                    <div className="text-sm font-black text-slate-800">{signer}</div>
                    <div className="text-[10px] text-slate-400 mt-1 uppercase font-bold">توقيع الإدارة</div>
                  </div>
                </div>
                <Award className="absolute -bottom-10 -left-10 h-32 w-32 text-gold/10 -rotate-12" />
              </div>
            </div>

            <div className="p-6 bg-white border-t flex gap-3">
              <button onClick={() => setPreviewing(false)} className="flex-1 rounded-xl bg-slate-100 py-3 text-sm font-black text-slate-600">إغلاق المعاينة</button>
              <button onClick={() => { setPreviewing(false); handleSendToPortal(); }} disabled={selected.size === 0} className="flex-1 rounded-xl bg-primary py-3 text-sm font-black text-white shadow-lg">اعتماد وإرسال الآن ({selected.size})</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
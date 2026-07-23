import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Award, Printer } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { LOGO_URL } from "@/components/BrandLogo";

export const Route = createFileRoute("/_authenticated/certificates")({
  head: () => ({ meta: [{ title: "شهادات التقدير — الأستاذ" }, { name: "description", content: "إصدار شهادات تقدير احترافية للطلاب." }] }),
  component: CertsPage,
});

type Student = { id: string; full_name: string; code: string; grade: string | null; group_id: string | null };
type Group = { id: string; name: string };

function CertsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [gradeF, setGradeF] = useState("");
  const [groupF, setGroupF] = useState("");
  const [title, setTitle] = useState("شهادة تقدير وامتياز");
  const [reason, setReason] = useState("تقديراً لتفوّقه والتزامه ومثابرته المتميزة خلال الفصل الدراسي");
  const [signer, setSigner] = useState("الأستاذ / محمد نجم");

  useEffect(() => {
    (async () => {
      const [s, g] = await Promise.all([
        supabase.from("students").select("id,full_name,code,grade,group_id").eq("active", true).order("full_name"),
        supabase.from("groups").select("id,name").order("name"),
      ]);
      setStudents((s.data as Student[]) || []);
      setGroups((g.data as Group[]) || []);
    })();
  }, []);

  const groupMap = useMemo(() => Object.fromEntries(groups.map(g => [g.id, g.name])), [groups]);
  const grades = useMemo(() => Array.from(new Set(students.map(s => s.grade).filter(Boolean))) as string[], [students]);
  const filtered = useMemo(() => students.filter(s => (!gradeF || s.grade === gradeF) && (!groupF || s.group_id === groupF)), [students, gradeF, groupF]);

  function toggleAll() {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map(s => s.id)));
  }
  function toggle(id: string) {
    const n = new Set(selected); n.has(id) ? n.delete(id) : n.add(id); setSelected(n);
  }

  function print() {
    const chosen = filtered.filter(s => selected.has(s.id));
    if (chosen.length === 0) { alert("اختر طالباً واحداً على الأقل"); return; }
    const logoAbs = new URL(LOGO_URL, window.location.origin).href;
    const today = new Date().toLocaleDateString("ar-EG");
    const certs = chosen.map(s => `
      <section class="cert">
        <div class="frame">
          <div class="corner tl"></div><div class="corner tr"></div>
          <div class="corner bl"></div><div class="corner br"></div>
          <img class="logo" src="${logoAbs}" alt="logo"/>
          <div class="brand">سنتر الأستاذ محمد نجم</div>
          <h1 class="title">${esc(title)}</h1>
          <div class="ribbon">تُمنح هذه الشهادة إلى</div>
          <div class="name">${esc(s.full_name)}</div>
          <div class="meta">${esc(s.grade || "")}${groupMap[s.group_id || ""] ? " — مجموعة " + esc(groupMap[s.group_id || ""]) : ""}</div>
          <p class="reason">${esc(reason)}</p>
          <div class="sign">
            <div>
              <div class="line"></div>
              <div class="lbl">${esc(signer)}</div>
            </div>
            <div>
              <div class="line"></div>
              <div class="lbl">التاريخ: ${today}</div>
            </div>
          </div>
        </div>
      </section>
    `).join("");
    const w = window.open("", "_blank", "width=1100,height=800");
    if (!w) return;
    w.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"/>
    <title>شهادات تقدير</title>
    <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&family=Amiri:wght@700&display=swap" rel="stylesheet">
    <style>
      body { margin:0; background:#eef2f7; font-family:'Cairo', sans-serif; }
      .toolbar { padding:10px; text-align:left; }
      .toolbar button { background:#1e3a8a; color:#fff; border:0; padding:8px 16px; border-radius:8px; font-family:inherit; font-weight:700; cursor:pointer; }
      .cert { page-break-after: always; padding: 20px; }
      .frame { position:relative; background: linear-gradient(135deg,#fdfaf3 0%,#fff 100%); border:8px double #c9a227; border-radius:18px; padding:40px 60px; text-align:center; box-shadow:0 8px 30px rgba(0,0,0,.08); min-height: 700px; display:flex; flex-direction:column; align-items:center; justify-content:center; }
      .frame::before { content:""; position:absolute; inset:14px; border:2px solid #1e3a8a; border-radius:12px; pointer-events:none; }
      .corner { position:absolute; width:60px; height:60px; border:3px solid #c9a227; }
      .corner.tl { top:22px; right:22px; border-left:0; border-bottom:0; }
      .corner.tr { top:22px; left:22px; border-right:0; border-bottom:0; }
      .corner.bl { bottom:22px; right:22px; border-left:0; border-top:0; }
      .corner.br { bottom:22px; left:22px; border-right:0; border-top:0; }
      .logo { width:110px; height:110px; object-fit:contain; margin-bottom:10px; filter: drop-shadow(0 4px 10px rgba(0,0,0,.15)); }
      .brand { font-size:16px; color:#1e3a8a; font-weight:900; letter-spacing:.5px; }
      .title { font-family:'Amiri', serif; font-size:44px; color:#c9a227; margin:14px 0 6px; font-weight:700; }
      .ribbon { display:inline-block; background:#1e3a8a; color:#fff; padding:6px 22px; border-radius:20px; font-size:13px; margin:10px 0; }
      .name { font-family:'Amiri', serif; font-size:40px; color:#0f172a; font-weight:700; margin:8px 0 4px; border-bottom:2px dashed #c9a227; padding: 0 30px 8px; }
      .meta { color:#64748b; font-size:14px; margin-bottom:14px; }
      .reason { font-size:16px; color:#334155; max-width:600px; line-height:1.9; margin:10px auto 30px; }
      .sign { display:flex; justify-content:space-around; width:100%; margin-top:auto; padding-top:20px; }
      .sign .line { width:180px; border-top:2px solid #1e3a8a; margin-bottom:6px; }
      .sign .lbl { font-size:13px; color:#1e3a8a; font-weight:700; }
      @media print { .toolbar { display:none; } body { background:#fff; } .cert { padding:0; } }
    </style></head><body>
    <div class="toolbar"><button onclick="window.print()">🖨️ طباعة / حفظ PDF</button></div>
    ${certs}
    </body></html>`);
    w.document.close();

    function esc(v: unknown) { return String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!)); }
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-black flex items-center gap-2"><Award className="h-6 w-6 text-gold" /> شهادات التقدير</h1>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-3 rounded-2xl bg-white p-5 shadow-sm md:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-sm font-semibold">عنوان الشهادة</label>
          <input value={title} onChange={e => setTitle(e.target.value)} className="w-full rounded-lg border border-input px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-semibold">اسم الموقِّع</label>
          <input value={signer} onChange={e => setSigner(e.target.value)} className="w-full rounded-lg border border-input px-3 py-2 text-sm" />
        </div>
        <div className="md:col-span-2">
          <label className="mb-1.5 block text-sm font-semibold">نص التقدير</label>
          <textarea value={reason} onChange={e => setReason(e.target.value)} rows={2} className="w-full rounded-lg border border-input px-3 py-2 text-sm" />
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <select value={gradeF} onChange={(e) => setGradeF(e.target.value)} className="rounded-lg border border-input bg-white px-3 py-2 text-sm">
          <option value="">كل الصفوف</option>
          {grades.map(g => <option key={g} value={g}>{g}</option>)}
        </select>
        <select value={groupF} onChange={(e) => setGroupF(e.target.value)} className="rounded-lg border border-input bg-white px-3 py-2 text-sm">
          <option value="">كل المجموعات</option>
          {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
        <button onClick={toggleAll} className="rounded-lg border border-input bg-white px-3 py-2 text-sm">{selected.size === filtered.length ? "إلغاء التحديد" : "تحديد الكل"}</button>
        <button onClick={print} className="inline-flex items-center gap-1 rounded-lg bg-gold px-4 py-2 text-sm font-bold text-gold-foreground"><Printer className="h-4 w-4" /> إصدار الشهادات ({selected.size})</button>
      </div>

      <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-primary text-primary-foreground text-right"><tr>
            <th className="p-3 w-10"></th><th className="p-3">الطالب</th><th className="p-3">الكود</th><th className="p-3">الصف</th><th className="p-3">المجموعة</th>
          </tr></thead>
          <tbody>
            {filtered.map((s, i) => (
              <tr key={s.id} className={`border-t ${i % 2 ? "bg-muted/10" : ""}`}>
                <td className="p-3"><input type="checkbox" checked={selected.has(s.id)} onChange={() => toggle(s.id)} /></td>
                <td className="p-3 font-semibold">{s.full_name}</td>
                <td className="p-3 font-mono text-xs">{s.code}</td>
                <td className="p-3">{s.grade || "—"}</td>
                <td className="p-3">{groupMap[s.group_id || ""] || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Printer, IdCard, Loader2, Phone, GraduationCap } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import QRCode from "qrcode";
import { LOGO_URL } from "@/components/BrandLogo";
import { getAdminDataSummary } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/cards")({
  head: () => ({ meta: [{ title: "كروت الطلاب — الأستاذ" }, { name: "description", content: "طباعة كروت الطلاب مع QR." }] }),
  component: CardsPage,
});

type Student = { id: string; full_name: string; code: string; grade: string | null; group_id: string | null; phone: string | null; parent_phone: string | null };
type Group = { id: string; name: string };

function CardsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [gradeF, setGradeF] = useState("");
  const [groupF, setGroupF] = useState("");
  const [qrs, setQrs] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const printRef = useRef<HTMLDivElement>(null);
  
  const loadFn = useServerFn(getAdminDataSummary);

  useEffect(() => {
    loadFn({}).then(res => {
      setStudents(res.students as unknown as Student[]);
      setGroups(res.groups as Group[]);
      setLoading(false);
    });
  }, []);

  const groupMap = useMemo(() => Object.fromEntries(groups.map(g => [g.id, g.name])), [groups]);
  const grades = useMemo(() => Array.from(new Set(students.map(s => s.grade).filter(Boolean))) as string[], [students]);
  const filtered = useMemo(() => students.filter(s => (!gradeF || s.grade === gradeF) && (!groupF || s.group_id === groupF)), [students, gradeF, groupF]);

  useEffect(() => {
    (async () => {
      const out: Record<string, string> = {};
      for (const s of filtered.slice(0, 200)) {
        out[s.id] = await QRCode.toDataURL(s.code, { width: 160, margin: 1, color: { dark: "#1e3a8a", light: "#ffffff" } });
      }
      setQrs(out);
    })();
  }, [filtered]);

  function print() {
    const html = printRef.current?.innerHTML || "";
    const w = window.open("", "_blank", "width=900,height=700");
    if (!w) return;
    const logoAbs = new URL(LOGO_URL, window.location.origin).href;
    w.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"/>
    <title>كروت الطلاب</title>
    <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap" rel="stylesheet">
    <style>
      body { margin: 0; font-family: 'Cairo', sans-serif; background:#f1f5f9; }
      .grid { display:grid; grid-template-columns: repeat(2, 1fr); gap: 12px; padding: 12px; }
      .card { background: linear-gradient(135deg,#1e3a8a 0%,#1e40af 60%,#1e3a8a 100%); color:#fff; border-radius: 14px; padding: 14px; display:flex; gap:12px; box-shadow:0 4px 14px rgba(0,0,0,.1); page-break-inside: avoid; }
      .card .logo { width:64px; height:64px; border-radius:10px; background:#fff url('${logoAbs}') center/contain no-repeat; flex-shrink:0; }
      .card .info { flex:1; overflow: hidden; }
      .card h3 { margin:0 0 4px; font-size:16px; font-weight:900; color:#facc15; }
      .card .name { font-size:15px; font-weight:800; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .card .row { font-size:11px; opacity:.9; margin-top:2px; display:flex; align-items:center; gap:4px; }
      .card .qr { background:#fff; padding:4px; border-radius:8px; align-self:center; }
      .card .qr img { display:block; width:74px; height:74px; }
      .toolbar { padding:10px; text-align:left; }
      .toolbar button { background:#1e3a8a; color:#fff; border:0; padding:8px 16px; border-radius:8px; font-family:inherit; font-weight:700; cursor:pointer; }
      @media print { .toolbar { display:none; } body { background:#fff; } .grid { padding: 6px; } }
    </style></head><body>
    <div class="toolbar"><button onclick="window.print()">🖨️ طباعة / PDF</button></div>
    <div class="grid">${html}</div>
    </body></html>`);
    w.document.close();
  }

  if (loading) return <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-black flex items-center gap-2"><IdCard className="h-6 w-6 text-primary" /> كروت الطلاب</h1>
        <div className="flex flex-wrap items-center gap-2">
          <select value={gradeF} onChange={(e) => setGradeF(e.target.value)} className="rounded-lg border border-input bg-white px-3 py-2 text-sm">
            <option value="">كل الصفوف</option>
            {grades.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
          <select value={groupF} onChange={(e) => setGroupF(e.target.value)} className="rounded-lg border border-input bg-white px-3 py-2 text-sm">
            <option value="">كل المجموعات</option>
            {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
          <button onClick={print} className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-2 text-sm font-bold text-primary-foreground"><Printer className="h-4 w-4" /> طباعة الكروت</button>
        </div>
      </div>

      <p className="mb-3 text-sm text-muted-foreground">عدد الكروت الجاهزة للطباعة: <b>{filtered.length}</b></p>

      <div ref={printRef} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {filtered.map(s => (
          <div key={s.id} className="card flex gap-3 rounded-2xl p-3 text-white shadow-md" style={{ background: "linear-gradient(135deg,#1e3a8a 0%,#1e40af 60%,#1e3a8a 100%)" }}>
            <div className="logo h-16 w-16 flex-shrink-0 rounded-lg bg-white bg-contain bg-center bg-no-repeat" style={{ backgroundImage: `url(${LOGO_URL})` }} />
            <div className="info flex-1">
              <h3 className="mb-1 text-base font-black" style={{ color: "#facc15" }}>سنتر الأستاذ محمد نجم</h3>
              <div className="name text-sm font-extrabold">{s.full_name}</div>
              <div className="row text-xs opacity-90">الكود: <span className="font-mono">{s.code}</span></div>
              <div className="row text-xs opacity-90">
                <span>الصف: {s.grade || "—"}</span>
                <span> · </span>
                <span>المجموعة: {groupMap[s.group_id || ""] || "—"}</span>
              </div>
              <div className="row text-xs opacity-90" dir="ltr">
                <span>☎ {s.phone || "—"}</span>
              </div>
            </div>
            <div className="qr self-center rounded-md bg-white p-1">
              {qrs[s.id] && <img src={qrs[s.id]} alt="qr" width={74} height={74} />}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
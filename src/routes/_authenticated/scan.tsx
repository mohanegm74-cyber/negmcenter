import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Camera, StopCircle, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/scan")({
  head: () => ({ meta: [{ title: "مسح QR — الأستاذ" }, { name: "description", content: "تسجيل الحضور بمسح كود QR." }] }),
  component: ScanPage,
});

type Group = { id: string; name: string };

function ScanPage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [groupId, setGroupId] = useState("");
  const [scanning, setScanning] = useState(false);
  const [log, setLog] = useState<Array<{ code: string; name: string; time: string }>>([]);
  const scannerRef = useRef<any>(null);
  const seenRef = useRef<Set<string>>(new Set());

  useEffect(() => { supabase.from("groups").select("id,name").order("name").then(({ data }) => setGroups((data as Group[]) || [])); }, []);

  async function start() {
    if (!groupId) { toast.error("اختر المجموعة أولاً"); return; }
    setScanning(true);
    const { Html5Qrcode } = await import("html5-qrcode");
    const scanner = new Html5Qrcode("qr-reader");
    scannerRef.current = scanner;
    try {
      await scanner.start({ facingMode: "environment" }, { fps: 10, qrbox: { width: 260, height: 260 } }, onScan, () => {});
    } catch (e: any) {
      toast.error("تعذر فتح الكاميرا: " + (e?.message || e));
      setScanning(false);
    }
  }

  async function stop() {
    try { await scannerRef.current?.stop(); await scannerRef.current?.clear(); } catch {}
    scannerRef.current = null;
    setScanning(false);
  }

  useEffect(() => () => { stop(); }, []);

  async function onScan(text: string) {
    const code = text.trim().toUpperCase();
    if (seenRef.current.has(code)) return;
    seenRef.current.add(code);
    const { data: s } = await supabase.from("students").select("id, full_name, code").eq("code", code).maybeSingle();
    if (!s) { toast.error("كود غير معروف: " + code); return; }
    const today = new Date().toISOString().slice(0, 10);
    const { error } = await supabase.from("attendance").upsert({ student_id: s.id, group_id: groupId, date: today, status: "present" }, { onConflict: "student_id,date" });
    if (error) { toast.error(error.message); return; }
    toast.success("✓ " + s.full_name);
    setLog(l => [{ code: s.code, name: s.full_name, time: new Date().toLocaleTimeString("ar-EG") }, ...l]);
  }

  return (
    <div>
      <h1 className="mb-4 text-2xl font-black">مسح كود QR</h1>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <label className="mb-1.5 block text-sm font-semibold">المجموعة</label>
          <select value={groupId} onChange={(e) => setGroupId(e.target.value)} disabled={scanning} className="w-full rounded-lg border border-input bg-white px-3 py-2 text-sm">
            <option value="">— اختر —</option>
            {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>

          <div id="qr-reader" className="mt-4 overflow-hidden rounded-xl border bg-black/5" style={{ minHeight: 240 }} />

          <div className="mt-4 flex gap-2">
            {!scanning ? (
              <button onClick={start} className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 font-bold text-primary-foreground"><Camera className="h-4 w-4" /> بدء المسح</button>
            ) : (
              <button onClick={stop} className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-destructive px-4 py-2.5 font-bold text-destructive-foreground"><StopCircle className="h-4 w-4" /> إيقاف</button>
            )}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">امنح الإذن للكاميرا عند طلبه. اعرض كود الطالب أمام الكاميرا.</p>
        </div>

        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="mb-3 flex items-center gap-2 text-lg font-bold"><CheckCircle2 className="h-5 w-5 text-secondary" /> تم تسجيل حضورهم ({log.length})</h2>
          {log.length === 0 ? (
            <p className="text-sm text-muted-foreground">لم يتم تسجيل أي طالب بعد.</p>
          ) : (
            <ul className="max-h-96 divide-y overflow-auto text-sm">
              {log.map((l, i) => (
                <li key={i} className="flex items-center justify-between py-2">
                  <div><div className="font-semibold">{l.name}</div><div className="font-mono text-xs text-muted-foreground">{l.code}</div></div>
                  <div className="text-xs text-muted-foreground">{l.time}</div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

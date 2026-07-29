import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { Database, Download, Upload, ShieldAlert, Trash2, Loader2, RefreshCcw } from "lucide-react";
import { exportBackup, importBackup } from "@/lib/backup.functions";
import { factoryResetSystem } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/backup")({
  head: () => ({
    meta: [
      { title: "النسخ الاحتياطي — سنتر الأستاذ محمد نجم" },
      { name: "description", content: "تصدير نسخة احتياطية كاملة من بيانات السنتر واستعادتها عند الحاجة." },
      { property: "og:title", content: "النسخ الاحتياطي واستعادة البيانات" },
      { property: "og:description", content: "تصدير واستعادة بيانات الطلاب والمجموعات والحضور والماليات والاختبارات." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: BackupPage,
});

const LABELS: Record<string, string> = {
  groups: "المجموعات", students: "الطلاب", attendance: "الحضور", payments: "الماليات",
  homework: "الواجبات", homework_submissions: "تسليمات الواجبات", student_notes: "ملاحظات الطلاب",
  questions: "أسئلة الطلاب", exams: "الاختبارات", exam_questions: "أسئلة الاختبارات",
  exam_attempts: "محاولات الاختبار", exam_answers: "إجابات الاختبار",
};

function BackupPage() {
  const doExport = useServerFn(exportBackup);
  const doImport = useServerFn(importBackup);
  const doReset = useServerFn(factoryResetSystem);
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<null | "export" | "import" | "reset">(null);
  const [mode, setMode] = useState<"merge" | "replace">("merge");
  const [summary, setSummary] = useState<Record<string, number> | null>(null);

  async function onExport() {
    setBusy("export");
    try {
      const data = await doExport({});
      const counts: Record<string, number> = {};
      Object.entries(data.tables).forEach(([k, v]) => { counts[k] = (v as any[])?.length || 0; });
      setSummary(counts);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `negm-backup-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("تم إنشاء النسخة الاحتياطية وتنزيلها");
    } catch (e: any) { toast.error(e.message || "فشل التصدير"); }
    finally { setBusy(null); }
  }

  async function onImport(f: File) {
    if (mode === "replace" && !confirm("سيتم حذف كل البيانات الحالية واستبدالها بمحتوى الملف. متابعة؟")) return;
    setBusy("import");
    try {
      const file = JSON.parse(await f.text());
      const r = await doImport({ data: { file, mode } });
      setSummary(r.counts);
      toast.success("تمت استعادة البيانات بنجاح");
    } catch (e: any) { toast.error(e.message || "فشل الاسترجاع"); }
    finally { setBusy(null); if (fileRef.current) fileRef.current.value = ""; }
  }

  async function onReset() {
    const confirmation = prompt("تحذير نهائي: سيتم مسح كافة الطلاب والمجموعات والماليات تماماً. اكتب 'تصفير' للتأكيد:");
    if (confirmation !== "تصفير") return;
    setBusy("reset");
    try {
      await doReset({});
      setSummary(null);
      toast.success("تم تصفير النظام بنجاح. يمكنك الآن البدء من جديد.");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-black flex items-center gap-2"><Database className="h-6 w-6 text-primary" /> النسخ الاحتياطي واستعادة البيانات</h1>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="mb-2 text-lg font-bold">تصدير نسخة احتياطية</h2>
          <p className="mb-4 text-sm text-muted-foreground">ملف JSON واحد يحتوي كل البيانات: الطلاب، المجموعات، الحضور، الماليات، الواجبات، الملاحظات، والاختبارات.</p>
          <button onClick={onExport} disabled={!!busy} className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-60">
            <Download className="h-4 w-4" /> {busy === "export" ? "جارٍ التحضير..." : "تنزيل نسخة احتياطية"}
          </button>
        </div>

        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="mb-2 text-lg font-bold">استعادة البيانات</h2>
          <p className="mb-3 text-sm text-muted-foreground">اختر ملف نسخة احتياطية سبق تنزيله من التطبيق.</p>
          <div className="mb-3 flex flex-wrap gap-2">
            <button onClick={() => setMode("merge")} className={`rounded-lg px-3 py-1.5 text-xs font-bold ${mode === "merge" ? "bg-secondary text-secondary-foreground" : "border border-input"}`}>دمج (إضافة وتحديث)</button>
            <button onClick={() => setMode("replace")} className={`rounded-lg px-3 py-1.5 text-xs font-bold ${mode === "replace" ? "bg-destructive text-destructive-foreground" : "border border-input"}`}>استبدال كامل</button>
          </div>
          {mode === "replace" && (
            <div className="mb-3 flex items-start gap-2 rounded-lg bg-destructive/10 p-3 text-xs text-destructive">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" /> تحذير: الاستبدال يحذف كل البيانات الحالية قبل الاسترجاع.
            </div>
          )}
          <input ref={fileRef} type="file" accept="application/json,.json" disabled={!!busy}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) onImport(f); }}
            className="block w-full text-sm file:me-3 file:rounded-lg file:border-0 file:bg-secondary file:px-4 file:py-2 file:text-sm file:font-bold file:text-secondary-foreground" />
          {busy === "import" && <p className="mt-3 text-sm text-muted-foreground">جارٍ الاسترجاع...</p>}
        </div>

        <div className="rounded-2xl border-2 border-destructive/20 bg-destructive/5 p-5 shadow-sm">
          <h2 className="mb-2 text-lg font-bold text-destructive">تهيئة النظام (تصفير)</h2>
          <p className="mb-4 text-xs text-muted-foreground leading-relaxed">هذا الإجراء يحذف كل شيء فوراً. يوصى بأخذ نسخة احتياطية أولاً قبل المسح النهائي.</p>
          <button onClick={onReset} disabled={!!busy} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-destructive px-5 py-2.5 text-sm font-black text-white shadow-lg shadow-destructive/20 hover:opacity-90 disabled:opacity-60">
            {busy === "reset" ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
            تصفير النظام نهائياً
          </button>
        </div>
      </div>

      {summary && (
        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-lg font-bold">ملخص السجلات</h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {Object.entries(summary).map(([k, v]) => (
              <div key={k} className="rounded-xl border bg-muted/10 p-3">
                <div className="text-xs text-muted-foreground">{LABELS[k] || k}</div>
                <div className="text-xl font-black text-primary">{v}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
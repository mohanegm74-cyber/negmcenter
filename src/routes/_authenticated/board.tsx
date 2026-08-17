import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, X, Loader2, Image as ImageIcon, Calendar, UploadCloud, Users } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { getBoardImagesAdmin, createBoardUploadUrlAdmin, saveBoardImagePostAdmin, deleteBoardImagePostAdmin } from "@/lib/admin.functions";
import { GRADES } from "@/lib/exam-constants";

export const Route = createFileRoute("/_authenticated/board")({
  head: () => ({
    meta: [
      { title: "صورة السبورة — لوحة الأستاذ" },
      { name: "description", content: "رفع صور السبورة وحفظها بالتاريخ والمجموعة وإرسالها لصفحات الطلاب." },
      { property: "og:title", content: "صورة السبورة — لوحة الأستاذ" },
      { property: "og:description", content: "رفع صور السبورة وحفظها بالتاريخ والمجموعة وإرسالها لصفحات الطلاب." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: BoardPage,
});

type Group = { id: string; name: string; grade: string | null };
type Post = { id: string; group_id: string | null; grade: string | null; date: string; title: string | null; urls: string[] };

function BoardPage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [files, setFiles] = useState<File[]>([]);

  const loadFn = useServerFn(getBoardImagesAdmin);
  const urlFn = useServerFn(createBoardUploadUrlAdmin);
  const saveFn = useServerFn(saveBoardImagePostAdmin);
  const delFn = useServerFn(deleteBoardImagePostAdmin);

  async function load() {
    setLoading(true);
    try {
      const res = await loadFn({});
      setGroups(res.groups as Group[]);
      setPosts(res.posts as Post[]);
    } catch { toast.error("فشل تحميل صور السبورة"); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  function addFiles(list: FileList | null) {
    if (!list) return;
    setFiles((prev) => [...prev, ...Array.from(list)]);
  }

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (files.length === 0) { toast.error("اختر صورة واحدة على الأقل"); return; }
    setBusy(true);
    const fd = new FormData(e.currentTarget);
    try {
      const paths: string[] = [];
      for (const f of files) {
        const { path, token } = await urlFn({ data: { filename: f.name } });
        const { error } = await supabase.storage.from("board-images").uploadToSignedUrl(path, token, f);
        if (error) throw new Error(error.message);
        paths.push(path);
      }
      await saveFn({ data: { payload: {
        group_id: String(fd.get("group_id") || "") || null,
        grade: String(fd.get("grade") || "") || null,
        date: String(fd.get("date") || new Date().toISOString().slice(0, 10)),
        title: String(fd.get("title") || "").trim() || null,
        paths,
      } } });
      toast.success("تم حفظ صور السبورة وإرسالها للطلاب");
      setOpen(false); setFiles([]); load();
    } catch (err: any) { toast.error(err.message || "فشل الرفع"); }
    finally { setBusy(false); }
  }

  async function remove(id: string) {
    if (!confirm("حذف صور هذه السبورة؟")) return;
    try { await delFn({ data: { id } }); toast.success("تم الحذف"); load(); }
    catch (e: any) { toast.error(e.message); }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-primary flex items-center gap-2"><ImageIcon className="h-6 w-6" /> صورة السبورة</h1>
          <p className="text-xs text-muted-foreground">ارفع صور السبورة وحدد المجموعة والصف والتاريخ لتظهر في صفحات الطلاب.</p>
        </div>
        <button onClick={() => { setFiles([]); setOpen(true); }} className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-black text-primary-foreground shadow">
          <Plus className="h-4 w-4" /> إضافة صور
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center p-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : posts.length === 0 ? (
        <div className="rounded-2xl border border-dashed bg-white p-12 text-center text-sm text-muted-foreground">لا توجد صور سبورة محفوظة بعد</div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {posts.map((p) => (
            <div key={p.id} className="rounded-2xl border bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-start justify-between gap-2">
                <div>
                  <div className="font-black">{p.title || "صورة السبورة"}</div>
                  <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                    <span className="inline-flex items-center gap-1"><Calendar className="h-3 w-3" /> {new Date(p.date + "T00:00:00").toLocaleDateString("ar-EG")}</span>
                    <span className="inline-flex items-center gap-1"><Users className="h-3 w-3" /> {groups.find(g => g.id === p.group_id)?.name || p.grade || "الجميع"}</span>
                  </div>
                </div>
                <button onClick={() => remove(p.id)} className="rounded-lg bg-destructive/10 p-2 text-destructive hover:bg-destructive/15"><Trash2 className="h-4 w-4" /></button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {p.urls.map((u, i) => (
                  <a key={i} href={u} target="_blank" rel="noreferrer" className="overflow-hidden rounded-lg border">
                    <img src={u} alt={`صورة السبورة ${i + 1} بتاريخ ${p.date}`} loading="lazy" className="h-24 w-full object-cover transition hover:scale-105" />
                  </a>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <form onSubmit={save} className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-black">إضافة صور السبورة</h2>
              <button type="button" onClick={() => setOpen(false)} className="rounded-lg p-1 hover:bg-accent"><X className="h-5 w-5" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-bold">العنوان (اختياري)</label>
                <input name="title" className="w-full rounded-xl border px-3 py-2 text-sm" placeholder="مثال: شرح درس الإعراب" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-bold">المجموعة</label>
                  <select name="group_id" className="w-full rounded-xl border px-3 py-2 text-sm">
                    <option value="">كل المجموعات</option>
                    {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold">الصف</label>
                  <select name="grade" className="w-full rounded-xl border px-3 py-2 text-sm">
                    <option value="">كل الصفوف</option>
                    {GRADES.map((g: string) => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold">التاريخ</label>
                <input type="date" name="date" defaultValue={new Date().toISOString().slice(0, 10)} className="w-full rounded-xl border px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold">الصور</label>
                <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed p-4 text-sm text-muted-foreground hover:bg-accent">
                  <UploadCloud className="h-5 w-5" /> اختر صورة أو أكثر
                  <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => addFiles(e.target.files)} />
                </label>
                {files.length > 0 && (
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    {files.map((f, i) => (
                      <div key={i} className="relative overflow-hidden rounded-lg border">
                        <img src={URL.createObjectURL(f)} alt={f.name} className="h-20 w-full object-cover" />
                        <button type="button" onClick={() => setFiles(files.filter((_, j) => j !== i))} className="absolute top-1 left-1 rounded-full bg-black/60 p-1 text-white"><X className="h-3 w-3" /></button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <button disabled={busy} className="mt-5 w-full rounded-xl bg-primary py-2.5 text-sm font-black text-primary-foreground disabled:opacity-60">
              {busy ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : "حفظ وإرسال للطلاب"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

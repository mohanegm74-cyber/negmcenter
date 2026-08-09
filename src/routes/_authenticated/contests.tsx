import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Trophy, Loader2, Play, Users, Swords, User, Shuffle } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { getFinanceDataAdmin } from "@/lib/admin.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/contests")({
  head: () => ({
    meta: [
      { title: "مسابقات نجمية — اختيار عشوائي للطلاب" },
      { name: "description", content: "اختيار طالب فردي أو تحدي ثنائي أو تقسيم المجموعة إلى فرق متساوية بعد عد تنازلي بصوت." },
      { property: "og:title", content: "مسابقات نجمية — سنتر الأستاذ محمد نجم" },
      { property: "og:description", content: "اختيار عشوائي للطلاب: فردي، تحدي ثنائي، أو فرق جماعية." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ContestsPage,
});

type Student = { id: string; full_name: string; code: string; grade: string | null; group_id: string | null };
type Group = { id: string; name: string; grade: string | null; subject: string | null };

type Mode = "single" | "duo" | "teams";

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function beep(freq: number, duration = 180) {
  try {
    const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration / 1000);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration / 1000 + 0.05);
    setTimeout(() => ctx.close().catch(() => {}), duration + 300);
  } catch {}
}

function speak(text: string) {
  try {
    const synth = window.speechSynthesis;
    if (!synth) return;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "ar-EG";
    u.rate = 0.95;
    synth.cancel();
    synth.speak(u);
  } catch {}
}

function ContestsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);

  const [grade, setGrade] = useState("");
  const [groupId, setGroupId] = useState("");
  const [mode, setMode] = useState<Mode>("single");
  const [teamsCount, setTeamsCount] = useState(2);
  const [seconds, setSeconds] = useState(5);

  const [counter, setCounter] = useState<number | null>(null);
  const [rolling, setRolling] = useState<string>("");
  const [winners, setWinners] = useState<string[]>([]);
  const [teams, setTeams] = useState<{ name: string; members: string[] }[]>([]);

  const timerRef = useRef<any>(null);
  const rollRef = useRef<any>(null);

  const loadFn = useServerFn(getFinanceDataAdmin);

  useEffect(() => {
    (async () => {
      try {
        const res: any = await loadFn({});
        setStudents(res.students as Student[]);
        setGroups(res.groups as Group[]);
      } catch {
        toast.error("فشل تحميل البيانات");
      } finally {
        setLoading(false);
      }
    })();
    return () => { clearInterval(timerRef.current); clearInterval(rollRef.current); };
  }, []);

  const gradeOptions = useMemo(
    () => Array.from(new Set(students.map((s) => s.grade).filter(Boolean) as string[])),
    [students]
  );

  const visibleGroups = useMemo(
    () => (grade ? groups.filter((g) => !g.grade || g.grade === grade) : groups),
    [groups, grade]
  );

  const pool = useMemo(() => {
    let list = students;
    if (groupId) list = list.filter((s) => s.group_id === groupId);
    if (grade) list = list.filter((s) => s.grade === grade);
    return list;
  }, [students, groupId, grade]);

  function reveal() {
    const names = shuffle(pool).map((s) => s.full_name);
    if (mode === "single") {
      setWinners(names.slice(0, 1));
      setTeams([]);
      beep(880, 400);
      speak(`أهلاً يا بطل ${names[0]}`);
    } else if (mode === "duo") {
      setWinners(names.slice(0, 2));
      setTeams([]);
      beep(880, 400);
      speak(`تحدي بين ${names[0]} و ${names[1]}`);
    } else {
      const n = Math.max(2, Math.min(teamsCount, names.length));
      const buckets: { name: string; members: string[] }[] = Array.from({ length: n }, (_, i) => ({
        name: `الفريق ${i + 1}`,
        members: [],
      }));
      names.forEach((nm, i) => buckets[i % n].members.push(nm));
      setTeams(buckets);
      setWinners([]);
      beep(880, 400);
      speak("تم تقسيم الفرق");
    }
  }

  function start() {
    if (pool.length === 0) return toast.error("لا يوجد طلاب في هذا الاختيار");
    if (mode === "duo" && pool.length < 2) return toast.error("التحدي يحتاج طالبين على الأقل");
    clearInterval(timerRef.current);
    clearInterval(rollRef.current);
    setWinners([]);
    setTeams([]);

    let n = Math.max(1, Math.min(60, Number(seconds) || 5));
    setCounter(n);
    beep(520, 150);

    rollRef.current = setInterval(() => {
      const r = pool[Math.floor(Math.random() * pool.length)];
      setRolling(r?.full_name || "");
    }, 90);

    timerRef.current = setInterval(() => {
      n -= 1;
      if (n > 0) {
        setCounter(n);
        beep(520, 150);
      } else {
        clearInterval(timerRef.current);
        clearInterval(rollRef.current);
        setCounter(null);
        setRolling("");
        reveal();
      }
    }, 1000);
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-primary/10 p-2 text-primary"><Trophy className="h-6 w-6" /></div>
        <div>
          <h1 className="text-xl font-black text-foreground">مسابقات نجمية</h1>
          <p className="text-xs text-muted-foreground">اختيار عشوائي: فردي — تحدي ثنائي — فرق جماعية</p>
        </div>
      </div>

      <div className="rounded-2xl border bg-card p-4 shadow-sm">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="mb-1 block text-xs font-semibold text-muted-foreground">الصف</label>
            <select value={grade} onChange={(e) => { setGrade(e.target.value); setGroupId(""); }} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm">
              <option value="">كل الصفوف</option>
              {gradeOptions.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-muted-foreground">المجموعة</label>
            <select value={groupId} onChange={(e) => setGroupId(e.target.value)} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm">
              <option value="">كل المجموعات</option>
              {visibleGroups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-muted-foreground">المدة (ثانية)</label>
            <input type="number" min={1} max={60} value={seconds} onChange={(e) => setSeconds(Number(e.target.value))} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" />
          </div>
          {mode === "teams" && (
            <div>
              <label className="mb-1 block text-xs font-semibold text-muted-foreground">عدد الفرق</label>
              <input type="number" min={2} max={10} value={teamsCount} onChange={(e) => setTeamsCount(Number(e.target.value))} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" />
            </div>
          )}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {([
            { k: "single", label: "فردي", icon: User },
            { k: "duo", label: "تحدي ثنائي", icon: Swords },
            { k: "teams", label: "فرق جماعية", icon: Users },
          ] as const).map(({ k, label, icon: Icon }) => (
            <button key={k} onClick={() => setMode(k)} className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition ${mode === k ? "bg-primary text-primary-foreground shadow" : "border border-input hover:bg-accent"}`}>
              <Icon className="h-4 w-4" /> {label}
            </button>
          ))}
          <div className="ms-auto flex items-center gap-3">
            <span className="text-xs text-muted-foreground">عدد الطلاب: {pool.length}</span>
            <button onClick={start} disabled={counter !== null} className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-black text-primary-foreground shadow disabled:opacity-60">
              <Play className="h-4 w-4" /> ابدأ
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border bg-card p-8 text-center shadow-sm">
        {counter !== null ? (
          <div className="space-y-4">
            <div className="text-7xl font-black text-primary tabular-nums animate-pulse">{counter}</div>
            <div className="flex items-center justify-center gap-2 text-lg font-bold text-muted-foreground">
              <Shuffle className="h-5 w-5 animate-spin" /> {rolling}
            </div>
          </div>
        ) : winners.length === 1 ? (
          <div className="space-y-3">
            <div className="text-2xl font-black text-emerald-600">أهلاً يا بطل 🎉</div>
            <div className="text-4xl font-black text-foreground">{winners[0]}</div>
          </div>
        ) : winners.length === 2 ? (
          <div className="space-y-4">
            <div className="text-2xl font-black text-primary">تحدي نجمي ⚔️</div>
            <div className="flex flex-wrap items-center justify-center gap-4">
              <div className="rounded-xl border-2 border-emerald-500/40 bg-emerald-500/10 px-6 py-4 text-2xl font-black">{winners[0]}</div>
              <div className="text-xl font-black text-muted-foreground">ضد</div>
              <div className="rounded-xl border-2 border-amber-500/40 bg-amber-500/10 px-6 py-4 text-2xl font-black">{winners[1]}</div>
            </div>
          </div>
        ) : teams.length > 0 ? (
          <div className="space-y-4">
            <div className="text-2xl font-black text-primary">الفرق النجمية 🌟</div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {teams.map((t) => (
                <div key={t.name} className="rounded-xl border bg-background p-4 text-right">
                  <div className="mb-2 text-sm font-black text-primary">{t.name} ({t.members.length})</div>
                  <ol className="space-y-1 text-sm">
                    {t.members.map((m, i) => <li key={m + i} className="rounded bg-muted/50 px-2 py-1">{i + 1}. {m}</li>)}
                  </ol>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">اختر المجموعة والمدة ونوع المسابقة ثم اضغط «ابدأ».</p>
        )}
      </div>
    </div>
  );
}

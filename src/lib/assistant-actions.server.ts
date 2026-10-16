// منفّذ أوامر مساعد الأستاذ (المرحلة الأولى): الحضور، الماليات، الملاحظات والتقييمات.
// يُستدعى فقط بعد التحقق من دور الأستاذ في الدالة العامة.

export type AssistantAction =
  | { type: "attendance"; status: "present" | "absent" | "late"; students?: string[]; group?: string; except?: string[]; date?: string }
  | { type: "payment"; student: string; amount: number; kind?: "payment" | "exempt" | "charge"; month?: string; note?: string }
  | { type: "note"; body: string; title?: string; students?: string[]; group?: string; all?: boolean }
  | { type: "record"; student: string; exam_level?: string; recitation_level?: string; note?: string; date?: string };

const norm = (s: string) =>
  String(s || "").trim().toLowerCase()
    .replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي").replace(/[\u064B-\u0652]/g, "").replace(/\s+/g, " ");

const isDate = (d?: string) => !!d && /^\d{4}-\d{2}-\d{2}$/.test(d);
const isMonth = (m?: string) => !!m && /^\d{4}-\d{2}$/.test(m);

export async function executeActions(actions: AssistantAction[]): Promise<string[]> {
  const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
  const [{ data: st }, { data: gr }] = await Promise.all([
    db.from("students").select("id,full_name,code,group_id,archived").limit(5000),
    db.from("groups").select("id,name").limit(500),
  ]);
  const students = (st || []).filter((s: any) => !s.archived);
  const groups = gr || [];
  const today = new Date().toISOString().slice(0, 10);
  const month = today.slice(0, 7);

  const findStudent = (q: string) => {
    const n = norm(q);
    if (!n) return { err: "اسم فارغ" } as const;
    const byCode = students.find((s: any) => norm(s.code) === n);
    if (byCode) return { s: byCode } as const;
    const exact = students.filter((s: any) => norm(s.full_name) === n);
    if (exact.length === 1) return { s: exact[0] } as const;
    const part = students.filter((s: any) => norm(s.full_name).includes(n));
    if (part.length === 1) return { s: part[0] } as const;
    if (part.length > 1 || exact.length > 1) return { err: `«${q}» يطابق أكثر من طالب (${part.slice(0, 4).map((s: any) => s.full_name).join("، ")}) — حدد الاسم كامل أو الكود` } as const;
    return { err: `مش لاقي طالب باسم «${q}»` } as const;
  };
  const findGroup = (q: string) => {
    const n = norm(q);
    return groups.find((g: any) => norm(g.name) === n) || groups.find((g: any) => norm(g.name).includes(n) || n.includes(norm(g.name)));
  };

  const out: string[] = [];
  for (const a of actions.slice(0, 20)) {
    try {
      if (a.type === "attendance") {
        const date = isDate(a.date) ? a.date! : today;
        let targets: any[] = [];
        const errs: string[] = [];
        if (a.group) {
          const g = findGroup(a.group);
          if (!g) { out.push(`❌ مش لاقي مجموعة «${a.group}»`); continue; }
          const ex = new Set((a.except || []).map((x) => { const r = findStudent(x); return "s" in r ? r.s.id : ""; }));
          targets = students.filter((s: any) => s.group_id === g.id && !ex.has(s.id));
        }
        for (const q of a.students || []) {
          const r = findStudent(q);
          if ("s" in r) { if (!targets.some((t) => t.id === r.s.id)) targets.push(r.s); } else errs.push(r.err);
        }
        if (targets.length) {
          const ids = targets.map((t) => t.id);
          const { data: existing } = await db.from("attendance").select("id,student_id").eq("date", date).in("student_id", ids);
          const exMap = new Map((existing || []).map((e: any) => [e.student_id, e.id]));
          for (const t of targets) {
            const id = exMap.get(t.id);
            if (id) await db.from("attendance").update({ status: a.status, group_id: t.group_id }).eq("id", id);
            else await db.from("attendance").insert({ student_id: t.id, group_id: t.group_id, date, status: a.status });
          }
          const lbl = a.status === "present" ? "حضور" : a.status === "absent" ? "غياب" : "تأخير";
          out.push(`✅ اتسجل ${lbl} ${targets.length} طالب بتاريخ ${date}: ${targets.slice(0, 8).map((t) => t.full_name).join("، ")}${targets.length > 8 ? "…" : ""}`);
        }
        errs.forEach((e) => out.push(`❌ ${e}`));
      } else if (a.type === "payment") {
        const r = findStudent(a.student);
        if (!("s" in r)) { out.push(`❌ ${r.err}`); continue; }
        const amount = Number(a.amount);
        if (!(amount > 0) || amount > 100000) { out.push("❌ المبلغ غير صحيح"); continue; }
        const kind = a.kind && ["payment", "exempt", "charge"].includes(a.kind) ? a.kind : "payment";
        const m = isMonth(a.month) ? a.month! : month;
        const { error } = await db.from("payments").insert({ student_id: r.s.id, group_id: r.s.group_id, amount, kind, month: m, paid_at: today, method: "cash", note: a.note || "عبر المساعد" });
        if (error) throw new Error(error.message);
        const lbl = kind === "payment" ? "دفع" : kind === "exempt" ? "إعفاء" : "مستحق";
        out.push(`✅ اتسجل ${lbl} ${amount} جنيه لـ ${r.s.full_name} عن شهر ${m}`);
      } else if (a.type === "note") {
        const body = String(a.body || "").trim().slice(0, 2000);
        if (!body) { out.push("❌ نص الملاحظة فاضي"); continue; }
        let targets: any[] = [];
        if (a.all) targets = students;
        else if (a.group) { const g = findGroup(a.group); if (!g) { out.push(`❌ مش لاقي مجموعة «${a.group}»`); continue; } targets = students.filter((s: any) => s.group_id === g.id); }
        for (const q of a.students || []) { const r = findStudent(q); if ("s" in r) targets.push(r.s); else out.push(`❌ ${r.err}`); }
        if (!targets.length) { out.push("❌ مفيش طلاب محددين للملاحظة"); continue; }
        const rows = targets.map((t) => ({ student_id: t.id, title: a.title || "ملاحظة من المستر", body }));
        const { error } = await db.from("student_notes").insert(rows);
        if (error) throw new Error(error.message);
        out.push(`✅ اتبعتت الملاحظة لـ ${targets.length} طالب`);
      } else if (a.type === "record") {
        const r = findStudent(a.student);
        if (!("s" in r)) { out.push(`❌ ${r.err}`); continue; }
        const date = isDate(a.date) ? a.date! : today;
        const { error } = await db.from("student_records").insert({ student_id: r.s.id, group_id: r.s.group_id, date, exam_level: a.exam_level || null, recitation_level: a.recitation_level || null, note: a.note || null });
        if (error) throw new Error(error.message);
        out.push(`✅ اتسجل تقييم ${r.s.full_name} بتاريخ ${date}`);
      }
    } catch (e: any) {
      out.push(`❌ تعذر التنفيذ: ${e?.message || "خطأ"}`);
    }
  }
  return out;
}

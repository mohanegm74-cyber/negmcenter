// منفّذ أوامر مساعد الأستاذ (المرحلة الأولى): الحضور، الماليات، الملاحظات والتقييمات.
// يُستدعى فقط بعد التحقق من دور الأستاذ في الدالة العامة.

export type AssistantAction =
  | { type: "attendance"; status: "present" | "absent" | "late"; students?: string[]; group?: string; except?: string[]; date?: string }
  | { type: "payment"; student: string; amount: number; kind?: "payment" | "exempt" | "charge"; month?: string; note?: string }
  | { type: "note"; body: string; title?: string; students?: string[]; group?: string; all?: boolean }
  | { type: "record"; student: string; exam_level?: string; recitation_level?: string; note?: string; date?: string }
  | { type: "add_student"; full_name: string; phone?: string; parent_phone?: string; grade?: string; group?: string; school?: string }
  | { type: "update_student"; student: string; full_name?: string; phone?: string; parent_phone?: string; grade?: string; group?: string; school?: string; active?: boolean }
  | { type: "delete_student"; student: string }
  | { type: "add_group"; name: string; grade?: string; monthly_fee?: number; days?: string; time?: string; max_students?: number }
  | { type: "update_group"; group: string; name?: string; grade?: string; monthly_fee?: number; days?: string; time?: string; max_students?: number }
  | { type: "homework"; title: string; description?: string; due_date?: string; group?: string; grade?: string; max_score?: number }
  | { type: "exam"; title?: string; grade?: string; subject?: string; lesson?: string; group?: string; question_count?: number; total_score?: number; difficulty?: string; duration_minutes?: number };

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

  const findStudent = (q: string): { s: any; err?: undefined } | { err: string; s?: undefined } => {
    const n = norm(q);
    if (!n) return { err: "اسم فارغ" };
    const byCode = students.find((s: any) => norm(s.code) === n);
    if (byCode) return { s: byCode };
    const exact = students.filter((s: any) => norm(s.full_name) === n);
    if (exact.length === 1) return { s: exact[0] };
    const part = students.filter((s: any) => norm(s.full_name).includes(n));
    if (part.length === 1) return { s: part[0] };
    if (part.length > 1 || exact.length > 1) return { err: `«${q}» يطابق أكثر من طالب (${part.slice(0, 4).map((s: any) => s.full_name).join("، ")}) — حدد الاسم كامل أو الكود` };
    return { err: `مش لاقي طالب باسم «${q}»` };
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
          const ex = new Set((a.except || []).map((x) => { const r = findStudent(x); return r.s ? r.s.id : ""; }));
          targets = students.filter((s: any) => s.group_id === g.id && !ex.has(s.id));
        }
        for (const q of a.students || []) {
          const r = findStudent(q);
          if (r.s) { if (!targets.some((t) => t.id === r.s.id)) targets.push(r.s); } else errs.push(r.err || "");
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
        if (!(r.s)) { out.push(`❌ ${r.err}`); continue; }
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
        for (const q of a.students || []) { const r = findStudent(q); if (r.s) targets.push(r.s); else out.push(`❌ ${r.err}`); }
        if (!targets.length) { out.push("❌ مفيش طلاب محددين للملاحظة"); continue; }
        const rows = targets.map((t) => ({ student_id: t.id, title: a.title || "ملاحظة من المستر", body }));
        const { error } = await db.from("student_notes").insert(rows);
        if (error) throw new Error(error.message);
        out.push(`✅ اتبعتت الملاحظة لـ ${targets.length} طالب`);
      } else if (a.type === "record") {
        const r = findStudent(a.student);
        if (!(r.s)) { out.push(`❌ ${r.err}`); continue; }
        const date = isDate(a.date) ? a.date! : today;
        const { error } = await db.from("student_records").insert({ student_id: r.s.id, group_id: r.s.group_id, date, exam_level: a.exam_level || null, recitation_level: a.recitation_level || null, note: a.note || null });
        if (error) throw new Error(error.message);
        out.push(`✅ اتسجل تقييم ${r.s.full_name} بتاريخ ${date}`);
      } else if (a.type === "add_student") {
        const name = String(a.full_name || "").trim().slice(0, 120);
        if (name.length < 3) { out.push("❌ اسم الطالب ناقص"); continue; }
        const g = a.group ? findGroup(a.group) : null;
        if (a.group && !g) { out.push(`❌ مش لاقي مجموعة «${a.group}»`); continue; }
        const { data: ins, error } = await db.from("students").insert({ full_name: name, phone: a.phone || null, parent_phone: a.parent_phone || null, grade: a.grade || (g as any)?.grade || null, group_id: g?.id || null, school: a.school || null }).select("id,full_name,code,group_id,archived").single();
        if (error) throw new Error(error.message);
        students.push(ins);
        out.push(`✅ اتضاف الطالب ${ins.full_name} بكود ${ins.code}${g ? ` في مجموعة ${g.name}` : ""}`);
      } else if (a.type === "update_student") {
        const r = findStudent(a.student);
        if (!(r.s)) { out.push(`❌ ${r.err}`); continue; }
        const patch: any = {};
        if (a.full_name) patch.full_name = String(a.full_name).slice(0, 120);
        if (a.phone) patch.phone = a.phone;
        if (a.parent_phone) patch.parent_phone = a.parent_phone;
        if (a.grade) patch.grade = a.grade;
        if (a.school) patch.school = a.school;
        if (typeof a.active === "boolean") patch.active = a.active;
        if (a.group) { const g = findGroup(a.group); if (!g) { out.push(`❌ مش لاقي مجموعة «${a.group}»`); continue; } patch.group_id = g.id; }
        if (!Object.keys(patch).length) { out.push("❌ مفيش بيانات للتعديل"); continue; }
        const { error } = await db.from("students").update(patch).eq("id", r.s.id);
        if (error) throw new Error(error.message);
        out.push(`✅ اتعدلت بيانات ${r.s.full_name}`);
      } else if (a.type === "delete_student") {
        const r = findStudent(a.student);
        if (!(r.s)) { out.push(`❌ ${r.err}`); continue; }
        const { count } = await db.from("payments").select("id", { count: "exact", head: true }).eq("student_id", r.s.id);
        if ((count || 0) > 0) {
          await db.from("students").update({ archived: true, active: false }).eq("id", r.s.id);
          out.push(`✅ اتأرشف ${r.s.full_name} (عنده مدفوعات فاتحفظ سجله المالي)`);
        } else {
          const { error } = await db.from("students").delete().eq("id", r.s.id);
          if (error) throw new Error(error.message);
          out.push(`✅ اتحذف الطالب ${r.s.full_name}`);
        }
      } else if (a.type === "add_group") {
        const name = String(a.name || "").trim().slice(0, 80);
        if (!name) { out.push("❌ اسم المجموعة ناقص"); continue; }
        const { data: g, error } = await db.from("groups").insert({ name, grade: a.grade || null, monthly_fee: Number(a.monthly_fee) || 0, days: a.days || null, time: a.time || null, max_students: a.max_students ? Number(a.max_students) : null }).select("id,name").single();
        if (error) throw new Error(error.message);
        groups.push(g);
        out.push(`✅ اتعملت مجموعة ${g.name}`);
      } else if (a.type === "update_group") {
        const g = findGroup(a.group);
        if (!g) { out.push(`❌ مش لاقي مجموعة «${a.group}»`); continue; }
        const patch: any = {};
        if (a.name) patch.name = a.name;
        if (a.grade) patch.grade = a.grade;
        if (a.monthly_fee != null) patch.monthly_fee = Number(a.monthly_fee);
        if (a.days) patch.days = a.days;
        if (a.time) patch.time = a.time;
        if (a.max_students) patch.max_students = Number(a.max_students);
        const { error } = await db.from("groups").update(patch).eq("id", g.id);
        if (error) throw new Error(error.message);
        out.push(`✅ اتعدلت مجموعة ${g.name}`);
      } else if (a.type === "homework") {
        const title = String(a.title || "").trim().slice(0, 200);
        if (!title) { out.push("❌ عنوان الواجب ناقص"); continue; }
        const g = a.group ? findGroup(a.group) : null;
        if (a.group && !g) { out.push(`❌ مش لاقي مجموعة «${a.group}»`); continue; }
        const { error } = await db.from("homework").insert({ title, description: a.description || null, due_date: isDate(a.due_date) ? a.due_date : null, group_id: g?.id || null, grade: a.grade || null, max_score: a.max_score ? Number(a.max_score) : null });
        if (error) throw new Error(error.message);
        out.push(`✅ اتضاف واجب «${title}»${g ? ` لمجموعة ${g.name}` : ""}`);
      } else if (a.type === "exam") {
        const count = Math.min(30, Math.max(1, Number(a.question_count) || 10));
        const total = Math.max(1, Number(a.total_score) || count);
        const { callAi, parseJson } = await import("./ai.server");
        const raw = await callAi("أنت خبير مناهج مصري تكتب اختبارات دقيقة علميًا ولغويًا مطابقة للمنهج المصري.", `أنشئ اختبارًا: الصف ${a.grade || "-"}، المادة ${a.subject || "-"}، الدرس ${a.lesson || a.title}، عدد الأسئلة ${count}، الصعوبة ${a.difficulty || "متوسط"}، مجموع الدرجات ${total}.
أخرج JSON فقط: {"questions":[{"kind":"اختيار من متعدد|صح وخطأ|أكمل|مقالي","prompt":"","options":[],"correct_answer":"","rationale":"","skill":"","difficulty":"","score":1}]}`, true);
        const qs = (parseJson(raw)?.questions || []).slice(0, count);
        if (!qs.length) { out.push("❌ معرفتش أولّد أسئلة، جرب تاني"); continue; }
        const g = a.group ? findGroup(a.group) : null;
        const { data: ex, error } = await db.from("exams").insert({ title: String(a.title || a.lesson || "اختبار").slice(0, 200), grade: a.grade || null, subject: a.subject || null, lesson: a.lesson || null, group_id: g?.id || null, question_count: qs.length, total_score: total, difficulty: a.difficulty || "متوسط", duration_minutes: Number(a.duration_minutes) || 30, status: "draft" }).select("id,title").single();
        if (error) throw new Error(error.message);
        await db.from("exam_questions").insert(qs.map((q: any, i: number) => ({ exam_id: ex.id, position: i, kind: q.kind || "اختيار من متعدد", prompt: String(q.prompt || ""), options: Array.isArray(q.options) ? q.options : [], correct_answer: q.correct_answer ?? null, rationale: q.rationale || null, skill: q.skill || null, difficulty: q.difficulty || "متوسط", score: Number(q.score) || 1 })));
        out.push(`✅ اتكتب اختبار «${ex.title}» (${qs.length} سؤال) كمسودة في تبويب الاختبارات — راجعه وانشره بنفسك`);
      } else {
        out.push("❌ أمر غير مدعوم");
      }
    } catch (e: any) {
      out.push(`❌ تعذر التنفيذ: ${e?.message || "خطأ"}`);
    }
  }
  return out;
}

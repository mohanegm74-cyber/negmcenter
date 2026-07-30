import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** كلمة المرور الافتراضية القوية للسيطرة */
const DEFAULT_MASTER_PASS = "Negm74!Center#Secure$2024";

/** وظيفة فرض السيطرة الشاملة (تنظيف رتب + إعادة تعيين كلمة مرور) */
export const forceSetupAdminMaster = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => d as { email: string; secret: string })
  .handler(async ({ data }) => {
    if (data.secret !== "N@031274") throw new Error("المفتاح الرئيسي غير صحيح");
    if (data.email.trim().toLowerCase() !== "mohanegm74@gmail.com") {
      throw new Error("عذراً، هذا الإجراء مسموح به فقط للأستاذ محمد نجم");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1. البحث عن المستخدم أو إنشاؤه
    const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    if (listError) throw listError;

    let targetUser = users.find(u => u.email?.toLowerCase() === data.email.toLowerCase());
    
    if (!targetUser) {
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: data.email,
        password: DEFAULT_MASTER_PASS,
        email_confirm: true
      });
      if (createError) throw createError;
      targetUser = newUser.user;
    } else {
      const { error: resetError } = await supabaseAdmin.auth.admin.updateUserById(targetUser.id, {
        password: DEFAULT_MASTER_PASS
      });
      if (resetError) throw resetError;
    }

    // 2. تنظيف الرتب ومنحها للأستاذ محمد حصرياً
    await supabaseAdmin.from("user_roles").delete().neq("user_id", "00000000-0000-0000-0000-000000000000");
    await supabaseAdmin.from("user_roles").insert({ user_id: targetUser.id, role: "teacher" });

    return { success: true, message: "تم تفعيل سيطرتك على النظام بكلمة المرور: " + DEFAULT_MASTER_PASS };
  });

// --- وظائف الحضور ---
export const markAttendanceAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => d as { student_id: string; group_id: string; date: string; status: string })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: existing } = await supabaseAdmin.from("attendance").select("id").eq("student_id", data.student_id).eq("date", data.date).maybeSingle();
    if (existing) {
      await supabaseAdmin.from("attendance").update({ status: data.status, group_id: data.group_id }).eq("id", existing.id);
    } else {
      await supabaseAdmin.from("attendance").insert(data);
    }
    return { ok: true };
  });

// --- وظائف المجموعات ---
export const getGroupsAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin.from("groups").select("*").order("name");
    return { groups: data || [] };
  });

export const saveGroup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => d as { id?: string; payload: any })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const q = data.id ? supabaseAdmin.from("groups").update(data.payload).eq("id", data.id) : supabaseAdmin.from("groups").insert(data.payload);
    await q; return { ok: true };
  });

export const deleteGroup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => d as { id: string })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("groups").delete().eq("id", data.id);
    return { ok: true };
  });

// --- وظائف الطلاب ---
export const getAllStudentsAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: st } = await supabaseAdmin.from("students").select("*").order("full_name");
    const { data: gr } = await supabaseAdmin.from("groups").select("id,name,grade").order("name");
    return { students: st || [], groups: gr || [] };
  });

export const updateStudentAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => d as { id: string; payload: any })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.payload.group_id === "") data.payload.group_id = null;
    await supabaseAdmin.from("students").update(data.payload).eq("id", data.id);
    return { ok: true };
  });

export const deleteStudentAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => d as { id: string })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("students").delete().eq("id", data.id);
    return { ok: true };
  });

// --- وظائف الواجبات (الإصلاح المطلوب) ---
export const getHomeworkDataAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [g, h, s, sb] = await Promise.all([
      supabaseAdmin.from("groups").select("id,name,grade").order("name"),
      supabaseAdmin.from("homework").select("*").order("created_at", { ascending: false }),
      supabaseAdmin.from("students").select("id,full_name,code,group_id").eq("active", true).order("full_name"),
      supabaseAdmin.from("homework_submissions").select("*"),
    ]);
    return { groups: g.data || [], items: h.data || [], students: s.data || [], subs: sb.data || [] };
  });

export const saveHomeworkAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => d as { id?: string; payload: any })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const q = data.id ? supabaseAdmin.from("homework").update(data.payload).eq("id", data.id) : supabaseAdmin.from("homework").insert(data.payload);
    await q; return { ok: true };
  });

export const deleteHomeworkAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => d as { id: string })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("homework").delete().eq("id", data.id);
    return { ok: true };
  });

export const upsertHomeworkSubmissionAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => d as { id?: string; payload: any })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: existing } = await supabaseAdmin.from("homework_submissions").select("id").eq("student_id", data.payload.student_id).eq("homework_id", data.payload.homework_id).maybeSingle();
    if (existing) { await supabaseAdmin.from("homework_submissions").update(data.payload).eq("id", existing.id); }
    else { await supabaseAdmin.from("homework_submissions").insert(data.payload); }
    return { ok: true };
  });

// --- وظائف الاختبارات ---
export const getExamsDataAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [g, s, e, at] = await Promise.all([
      supabaseAdmin.from("groups").select("id,name,grade,subject").order("name"),
      supabaseAdmin.from("students").select("id,full_name,code,group_id,grade").order("full_name"),
      supabaseAdmin.from("exams").select("*").order("created_at", { ascending: false }),
      supabaseAdmin.from("exam_attempts").select("*").eq("status", "submitted"),
    ]);
    return { groups: g.data || [], students: s.data || [], exams: e.data || [], attempts: at.data || [] };
  });

export const saveExamFullAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => d as { exam: any; questions: any[] })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: exam, error } = await supabaseAdmin.from("exams").insert(data.exam).select().single();
    if (error) throw error;
    const questions = data.questions.map(q => ({ ...q, exam_id: exam.id }));
    await supabaseAdmin.from("exam_questions").insert(questions);
    return { ok: true };
  });

export const updateExamStatusAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => d as { id: string; status: string })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("exams").update({ status: data.status }).eq("id", data.id);
    return { ok: true };
  });

export const deleteExamAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => d as { id: string })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("exams").delete().eq("id", data.id);
    return { ok: true };
  });

export const getExamDetailedResultsAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => d as { exam_id: string })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [q, at] = await Promise.all([
      supabaseAdmin.from("exam_questions").select("*").eq("exam_id", data.exam_id).order("position"),
      supabaseAdmin.from("exam_attempts").select("*").eq("exam_id", data.exam_id),
    ]);
    let ans: any[] = [];
    if (at.data && at.data.length > 0) {
      const { data: ansData } = await supabaseAdmin.from("exam_answers").select("id,attempt_id,question_id,is_correct").in("attempt_id", at.data.map(x => x.id));
      ans = ansData || [];
    }
    return { questions: q.data || [], attempts: at.data || [], answers: ans };
  });

// --- وظائف المالية ---
export const getFinanceDataAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [st, gr, py] = await Promise.all([
      supabaseAdmin.from("students").select("id,full_name,code,grade,group_id").eq("active", true).order("full_name"),
      supabaseAdmin.from("groups").select("id,name,monthly_fee").order("name"),
      supabaseAdmin.from("payments").select("*").order("paid_at", { ascending: false }),
    ]);
    return { students: st.data || [], groups: gr.data || [], payments: py.data || [] };
  });

export const addPaymentAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => d as { student_id: string; group_id: string | null; amount: number; kind: string; month: string; paid_at: string; note: string | null })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("payments").insert(data);
    return { ok: true };
  });

export const updatePaymentAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => d as { id: string; payload: any })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("payments").update(data.payload).eq("id", data.id);
    return { ok: true };
  });

export const deletePaymentAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => d as { id: string })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("payments").delete().eq("id", data.id);
    return { ok: true };
  });

// --- وظائف الملاحظات والتقارير والأسئلة ---
export const getAdminDataSummary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [gr, st, at] = await Promise.all([
      supabaseAdmin.from("groups").select("id,name").order("name"),
      supabaseAdmin.from("students").select("id,full_name,code,group_id").eq("active", true).order("full_name"),
      supabaseAdmin.from("attendance").select("*"),
    ]);
    return { groups: gr.data || [], students: st.data || [], attendance: at.data || [] };
  });

export const getDashboardStatsAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const today = new Date().toISOString().slice(0, 10);
    const [st, gr, ap, aa, pay, groups] = await Promise.all([
      supabaseAdmin.from("students").select("id", { count: "exact" }).eq("active", true),
      supabaseAdmin.from("groups").select("id"),
      supabaseAdmin.from("attendance").select("id", { count: "exact", head: true }).eq("date", today).eq("status", "present"),
      supabaseAdmin.from("attendance").select("id", { count: "exact", head: true }).eq("date", today).eq("status", "absent"),
      supabaseAdmin.from("payments").select("amount,kind"),
      supabaseAdmin.from("groups").select("monthly_fee"),
    ]);
    const income = (pay.data || []).filter((p: any) => p.kind === "payment").reduce((a, b) => a + Number(b.amount || 0), 0);
    const manualDues = (pay.data || []).filter((p: any) => p.kind === "charge").reduce((a, b) => a + Number(b.amount || 0), 0);
    const estimatedDues = manualDues || ((st.count || 0) * (groups.data?.[0]?.monthly_fee || 0));
    return { students: st.count || 0, groups: (gr.data || []).length, present: ap.count || 0, absent: aa.count || 0, income, dues: estimatedDues, outstanding: Math.max(0, estimatedDues - income) };
  });

export const getReportsDataAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => d as { from: string; to: string })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [s, g, a, p] = await Promise.all([
      supabaseAdmin.from("students").select("id,full_name,code,grade,group_id,phone").eq("active", true),
      supabaseAdmin.from("groups").select("id,name,grade,monthly_fee"),
      supabaseAdmin.from("attendance").select("student_id,group_id,date,status").gte("date", data.from).lte("date", data.to),
      supabaseAdmin.from("payments").select("student_id,amount,kind,month"),
    ]);
    return { students: s.data || [], groups: g.data || [], attendance: a.data || [], payments: p.data || [] };
  });

export const getStudentNotesAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => d as { student_id: string })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: notes } = await supabaseAdmin.from("student_notes").select("*").eq("student_id", data.student_id).order("created_at", { ascending: false });
    return { notes: notes || [] };
  });

export const addStudentNoteAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => d as { student_id: string; title: string; body: string })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("student_notes").insert(data);
    return { ok: true };
  });

export const deleteStudentNoteAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => d as { id: string })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("student_notes").delete().eq("id", data.id);
    return { ok: true };
  });

export const getStudentQuestionsAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: q } = await supabaseAdmin.from("questions").select("*").order("created_at", { ascending: false });
    const { data: s } = await supabaseAdmin.from("students").select("id,full_name,code");
    return { questions: q || [], students: s || [] };
  });

export const answerStudentQuestionAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => d as { id: string; answer: string })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("questions").update({ answer: data.answer, answered_at: new Date().toISOString(), is_read: true }).eq("id", data.id);
    return { ok: true };
  });

export const deleteStudentQuestionAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => d as { id: string })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("questions").delete().eq("id", data.id);
    return { ok: true };
  });

export const factoryResetSystem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const tables = ["exam_answers", "exam_attempts", "exam_questions", "exams", "homework_submissions", "homework", "attendance", "payments", "student_notes", "questions", "students", "groups"];
    for (const table of tables) {
      await supabaseAdmin.from(table as any).delete().neq("id", "00000000-0000-0000-0000-000000000000");
    }
    return { ok: true };
  });
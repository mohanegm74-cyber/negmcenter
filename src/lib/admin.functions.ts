import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** وظيفة عامة (بدون ميدل وير) لإصلاح حساب المسئول وحل التعارضات */
export const forceResetAdminPassword = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => d as { secret: string })
  .handler(async ({ data }) => {
    // التأكد من أن الطلب شرعي (كلمة السر المطلوبة هي المفتاح)
    if (data.secret !== "N@031274") throw new Error("غير مصرح");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const ADMIN_EMAIL = "admin@negm-center.local";
    const NEW_PASS = "N@031274";

    // 1. البحث عن الحساب الحالي
    const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    if (listError) throw listError;

    const existingUser = users.find(u => u.email === ADMIN_EMAIL);

    if (existingUser) {
      // 2. إذا كان موجوداً، نقوم بتغيير كلمة المرور قسراً وحل التعارض
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
        existingUser.id,
        { password: NEW_PASS, email_confirm: true }
      );
      if (updateError) throw updateError;
    } else {
      // 3. إذا لم يكن موجوداً، نقوم بإنشائه
      const { error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: ADMIN_EMAIL,
        password: NEW_PASS,
        email_confirm: true
      });
      if (createError) throw createError;
    }

    // 4. منح الصلاحيات (Role) للتأكد من عمل كافة البرمجيات
    await supabaseAdmin.from("user_roles").upsert({ 
      user_id: existingUser?.id || (await supabaseAdmin.auth.admin.listUsers()).data.users.find(u => u.email === ADMIN_EMAIL)?.id,
      role: "teacher" 
    }, { onConflict: "user_id" });

    return { ok: true };
  });

/** باقي الوظائف السابقة ... */
export const getDashboardStatsAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin;
    const today = new Date().toISOString().slice(0, 10);
    
    const [st, gr, ap, aa, pay, groups] = await Promise.all([
      db.from("students").select("id", { count: "exact" }).eq("active", true),
      db.from("groups").select("id"),
      db.from("attendance").select("id", { count: "exact", head: true }).eq("date", today).eq("status", "present"),
      db.from("attendance").select("id", { count: "exact", head: true }).eq("date", today).eq("status", "absent"),
      db.from("payments").select("amount,kind"),
      db.from("groups").select("monthly_fee"),
    ]);

    const income = (pay.data || []).filter((p: any) => p.kind === "payment").reduce((a, b) => a + Number(b.amount || 0), 0);
    const manualDues = (pay.data || []).filter((p: any) => p.kind === "charge").reduce((a, b) => a + Number(b.amount || 0), 0);
    
    const totalStudentsCount = st.count || 0;
    const averageFee = groups.data?.length ? groups.data.reduce((a, b) => a + (b.monthly_fee || 0), 0) / groups.data.length : 0;
    const estimatedDues = manualDues || (totalStudentsCount * averageFee);

    return {
      students: totalStudentsCount,
      groups: (gr.data || []).length,
      present: ap.count || 0,
      absent: aa.count || 0,
      income,
      dues: estimatedDues,
      outstanding: Math.max(0, estimatedDues - income)
    };
  });

export const getStudentNotesAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => d as { student_id: string })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: notes, error } = await supabaseAdmin.from("student_notes").select("*").eq("student_id", data.student_id).order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { notes: notes || [] };
  });

export const addStudentNoteAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => d as { student_id: string; title: string; body: string })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("student_notes").insert(data);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteStudentNoteAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => d as { id: string })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("student_notes").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updatePaymentAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => d as { id: string; payload: any })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("payments").update(data.payload).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getGroupsAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.from("groups").select("*").order("name");
    if (error) throw new Error(error.message);
    return { groups: data || [] };
  });

export const markAttendanceAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => d as { student_id: string; group_id: string; date: string; status: string })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("attendance").upsert(data, { onConflict: "student_id,date" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const saveGroup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => d as { id?: string; payload: any })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin;
    const q = data.id ? db.from("groups").update(data.payload).eq("id", data.id) : db.from("groups").insert(data.payload);
    const { error } = await q;
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteGroup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => d as { id: string })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("groups").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateStudentAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => d as { id: string; payload: any })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.payload.group_id === "") data.payload.group_id = null;
    const { error } = await supabaseAdmin.from("students").update(data.payload).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const answerStudentQuestionAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => d as { id: string; answer: string })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("questions").update({ 
      answer: data.answer, 
      answered_at: new Date().toISOString(),
      is_read: true 
    }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteStudentQuestionAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => d as { id: string })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("questions").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteStudentAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => d as { id: string })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("students").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const saveHomeworkAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => d as { id?: string; payload: any })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin;
    const q = data.id ? db.from("homework").update(data.payload).eq("id", data.id) : db.from("homework").insert(data.payload);
    const { error } = await q;
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const upsertHomeworkSubmissionAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => d as { id?: string; payload: any })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("homework_submissions").upsert(data.payload, { onConflict: "homework_id,student_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteHomeworkAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => d as { id: string })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("homework").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteExamAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => d as { id: string })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("exams").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getExamDetailedResultsAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => d as { exam_id: string })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin;
    
    const [q, at] = await Promise.all([
      db.from("exam_questions").select("*").eq("exam_id", data.exam_id).order("position"),
      db.from("exam_attempts").select("*").eq("exam_id", data.exam_id),
    ]);

    if (q.error || at.error) throw new Error(q.error?.message || at.error?.message);

    let ans: any[] = [];
    if (at.data && at.data.length > 0) {
      const { data: ansData, error: ansError } = await db.from("exam_answers").select("id,attempt_id,question_id,is_correct").in("attempt_id", at.data.map(x => x.id));
      if (!ansError) ans = ansData || [];
    }

    return { questions: q.data || [], attempts: at.data || [], answers: ans };
  });

export const saveExamFullAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => d as { exam: any; questions: any[] })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin;
    
    const { data: exam, error: ee } = await db.from("exams").insert(data.exam).select().single();
    if (ee) throw new Error(ee.message);

    const questions = data.questions.map(q => ({ ...q, exam_id: exam.id }));
    const { error: qe } = await db.from("exam_questions").insert(questions);
    if (qe) throw new Error(qe.message);

    return { ok: true };
  });

export const updateExamStatusAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => d as { id: string; status: string })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("exams").update({ status: data.status }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const addPaymentAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => d as { student_id: string; group_id: string | null; amount: number; kind: string; month: string; paid_at: string; note: string | null })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("payments").insert(data);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deletePaymentAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => d as { id: string })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("payments").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getAdminDataSummary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin;
    const [gr, st, at] = await Promise.all([
      db.from("groups").select("id,name").order("name"),
      db.from("students").select("id,full_name,code,group_id").eq("active", true).order("full_name"),
      db.from("attendance").select("*"),
    ]);
    return { groups: gr.data || [], students: st.data || [], attendance: at.data || [] };
  });

export const getAllStudentsAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: st, error: se } = await supabaseAdmin.from("students").select("*").order("full_name");
    const { data: gr, error: ge } = await supabaseAdmin.from("groups").select("id,name,grade").order("name");
    if (se || ge) throw new Error(se?.message || ge?.message);
    return { students: st || [], groups: gr || [] };
  });

export const getHomeworkDataAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin;
    const [g, h, s, sb] = await Promise.all([
      db.from("groups").select("id,name,grade").order("name"),
      db.from("homework").select("*").order("created_at", { ascending: false }),
      db.from("students").select("id,full_name,code,group_id").eq("active", true).order("full_name"),
      db.from("homework_submissions").select("*"),
    ]);
    return { groups: g.data || [], items: h.data || [], students: s.data || [], subs: sb.data || [] };
  });

export const getExamsDataAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin;
    const [g, s, e, at] = await Promise.all([
      db.from("groups").select("id,name,grade,subject").order("name"),
      db.from("students").select("id,full_name,code,group_id,grade").order("full_name"),
      db.from("exams").select("*").order("created_at", { ascending: false }),
      db.from("exam_attempts").select("*").eq("status", "submitted"),
    ]);
    return { groups: g.data || [], students: s.data || [], exams: e.data || [], attempts: at.data || [] };
  });

export const getReportsDataAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => d as { from: string; to: string })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin;
    const [s, g, a, p] = await Promise.all([
      db.from("students").select("id,full_name,code,grade,group_id,phone").eq("active", true),
      db.from("groups").select("id,name,grade,monthly_fee"),
      db.from("attendance").select("student_id,group_id,date,status").gte("date", data.from).lte("date", data.to),
      db.from("payments").select("student_id,amount,kind,month"),
    ]);
    return { students: s.data || [], groups: g.data || [], attendance: a.data || [], payments: p.data || [] };
  });

export const getFinanceDataAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin;
    const [st, gr, py] = await Promise.all([
      db.from("students").select("id,full_name,code,grade,group_id").eq("active", true).order("full_name"),
      db.from("groups").select("id,name,monthly_fee").order("name"),
      db.from("payments").select("*").order("paid_at", { ascending: false }),
    ]);
    return { students: st.data || [], groups: gr.data || [], payments: py.data || [] };
  });

export const getStudentQuestionsAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: q } = await supabaseAdmin.from("questions").select("*").order("created_at", { ascending: false });
    const { data: s } = await supabaseAdmin.from("students").select("id,full_name,code");
    return { questions: q || [], students: s || [] };
  });

export const factoryResetSystem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin;
    const tables = [
      "exam_answers", "exam_attempts", "exam_questions", "exams",
      "homework_submissions", "homework", "attendance", "payments",
      "student_notes", "questions", "students", "groups"
    ];
    for (const table of tables) {
      await db.from(table as any).delete().neq("id", "00000000-0000-0000-0000-000000000000");
    }
    return { ok: true };
  });
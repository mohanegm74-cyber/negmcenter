import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** جلب ملخص إحصائيات لوحة التحكم */
export const getDashboardStatsAdmin = createServerFn({ method: "GET" })
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin;
    const today = new Date().toISOString().slice(0, 10);
    
    const [st, gr, ap, aa, pay] = await Promise.all([
      db.from("students").select("id", { count: "exact" }).eq("active", true),
      db.from("groups").select("id"),
      db.from("attendance").select("id", { count: "exact", head: true }).eq("date", today).eq("status", "present"),
      db.from("attendance").select("id", { count: "exact", head: true }).eq("date", today).eq("status", "absent"),
      db.from("payments").select("amount,kind"),
    ]);

    const income = (pay.data || []).filter((p: any) => p.kind === "payment").reduce((a, b) => a + Number(b.amount || 0), 0);
    const dues = (pay.data || []).filter((p: any) => p.kind === "charge").reduce((a, b) => a + Number(b.amount || 0), 0);

    return {
      students: st.count || 0,
      groups: (gr.data || []).length,
      present: ap.count || 0,
      absent: aa.count || 0,
      income,
      dues,
      outstanding: Math.max(0, dues - income)
    };
  });

/** جلب ملخص البيانات للحضور */
export const getAdminDataSummary = createServerFn({ method: "GET" })
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

/** تسجيل الحضور */
export const markAttendanceAdmin = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => d as { student_id: string; group_id: string; date: string; status: string })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("attendance").upsert(data, { onConflict: "student_id,date" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** جلب بيانات المجموعات */
export const getGroupsAdmin = createServerFn({ method: "GET" })
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.from("groups").select("*").order("name");
    if (error) throw new Error(error.message);
    return { groups: data || [] };
  });

/** حفظ أو تحديث مجموعة */
export const saveGroup = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => d as { id?: string; payload: any })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin;
    const q = data.id ? db.from("groups").update(data.payload).eq("id", data.id) : db.from("groups").insert(data.payload);
    const { error } = await q;
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** حذف مجموعة */
export const deleteGroup = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => d as { id: string })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("groups").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** جلب كافة الطلاب */
export const getAllStudentsAdmin = createServerFn({ method: "GET" })
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.from("students").select("*").order("full_name");
    if (error) throw new Error(error.message);
    return { students: data || [] };
  });

/** حذف طالب */
export const deleteStudentAdmin = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => d as { id: string })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("students").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** جلب بيانات الواجبات */
export const getHomeworkDataAdmin = createServerFn({ method: "GET" })
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

/** جلب بيانات الاختبارات */
export const getExamsDataAdmin = createServerFn({ method: "GET" })
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

/** تحديث حالة الاختبار */
export const updateExamStatusAdmin = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => d as { id: string; status: string })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("exams").update({ status: data.status }).eq("id", data.id);
    if (error) throw new Error(`فشل تحديث الحالة: ${error.message}`);
    return { ok: true };
  });

/** جلب بيانات التقارير */
export const getReportsDataAdmin = createServerFn({ method: "POST" })
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

/** جلب بيانات المالية */
export const getFinanceDataAdmin = createServerFn({ method: "GET" })
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

/** تسجيل حركة مالية */
export const addPaymentAdmin = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => d as { student_id: string; group_id: string | null; amount: number; kind: string; month: string; paid_at: string; note: string | null })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("payments").insert(data);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** حذف حركة مالية */
export const deletePaymentAdmin = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => d as { id: string })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("payments").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** تهيئة النظام (تصفير) */
export const factoryResetSystem = createServerFn({ method: "POST" })
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
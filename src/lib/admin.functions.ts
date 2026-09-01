import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth as requireAuthMiddleware } from "@/integrations/supabase/auth-middleware";

export const getHomeworkSubmissionFileUrl = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware])
  .inputValidator((d: unknown) => d as { path: string })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: res, error } = await supabaseAdmin.storage.from("submissions").createSignedUrl(data.path, 3600);
    if (error) throw new Error(error.message);
    return { url: res.signedUrl };
  });

export const checkAdminSetup = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { count } = await supabaseAdmin
    .from("user_roles")
    .select("*", { count: "exact", head: true })
    .in("role", ["teacher", "admin"]);
  return { hasAdmin: (count ?? 0) > 0 };
});

export const assignFirstAdminRole = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => d as { userId: string })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { count } = await supabaseAdmin
      .from("user_roles")
      .select("*", { count: "exact", head: true })
      .in("role", ["teacher", "admin"]);
    if ((count ?? 0) > 0) throw new Error("يوجد مسئول مسجّل بالفعل.");
    await supabaseAdmin.from("user_roles").insert({ user_id: data.userId, role: "teacher" });
    return { success: true };
  });

export const markAttendanceAdmin = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware])
  .inputValidator((d: unknown) => d as { student_id: string; group_id: string; date: string; status: string })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: ex } = await supabaseAdmin.from("attendance").select("id").eq("student_id", data.student_id).eq("date", data.date).maybeSingle();
    if (ex) await supabaseAdmin.from("attendance").update({ status: data.status, group_id: data.group_id }).eq("id", ex.id);
    else await supabaseAdmin.from("attendance").insert(data);
    return { ok: true };
  });

export const markAttendanceBulkAdmin = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware])
  .inputValidator((d: unknown) => d as { student_ids: string[]; group_id: string; date: string; status: string })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const ids = (data.student_ids || []).filter(Boolean);
    if (ids.length === 0) throw new Error("لم يتم تحديد أي طالب");
    const { data: existing } = await supabaseAdmin
      .from("attendance")
      .select("id,student_id")
      .eq("date", data.date)
      .in("student_id", ids);
    const map = new Map((existing || []).map((r: any) => [r.student_id, r.id]));
    const toInsert = ids.filter(id => !map.has(id)).map(id => ({ student_id: id, group_id: data.group_id, date: data.date, status: data.status }));
    const updateIds = (existing || []).map((r: any) => r.id);
    if (updateIds.length > 0) {
      const { error } = await supabaseAdmin.from("attendance").update({ status: data.status, group_id: data.group_id }).in("id", updateIds);
      if (error) throw new Error(error.message);
    }
    if (toInsert.length > 0) {
      const { error } = await supabaseAdmin.from("attendance").insert(toInsert);
      if (error) throw new Error(error.message);
    }
    return { ok: true, count: ids.length };
  });

export const getGroupsAdmin = createServerFn({ method: "GET" })
  .middleware([requireAuthMiddleware])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin.from("groups").select("*").order("name");
    return { groups: data || [] };
  });

export const saveGroup = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware])
  .inputValidator((d: unknown) => d as { id?: string; payload: any })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const q = data.id ? supabaseAdmin.from("groups").update(data.payload).eq("id", data.id) : supabaseAdmin.from("groups").insert(data.payload);
    await q; return { ok: true };
  });

export const deleteGroup = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware])
  .inputValidator((d: unknown) => d as { id: string })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("groups").delete().eq("id", data.id);
    return { ok: true };
  });

export const getAllStudentsAdmin = createServerFn({ method: "GET" })
  .middleware([requireAuthMiddleware])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: st } = await supabaseAdmin.from("students").select("*").order("created_at", { ascending: false });
    const { data: gr } = await supabaseAdmin.from("groups").select("id,name,grade").order("name");
    return { students: st || [], groups: gr || [] };
  });

export const toggleStudentActive = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware])
  .inputValidator((d: unknown) => d as { id: string; active: boolean })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("students").update({ active: data.active }).eq("id", data.id);
    return { ok: true };
  });

export const updateStudentAdmin = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware])
  .inputValidator((d: unknown) => d as { id: string; payload: any })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.payload.group_id === "") data.payload.group_id = null;
    await supabaseAdmin.from("students").update(data.payload).eq("id", data.id);
    return { ok: true };
  });

export const deleteStudentAdmin = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware])
  .inputValidator((d: unknown) => d as { id: string })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("students").delete().eq("id", data.id);
    return { ok: true };
  });

export const getHomeworkDataAdmin = createServerFn({ method: "GET" })
  .middleware([requireAuthMiddleware])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [g, h, s, sb] = await Promise.all([
      supabaseAdmin.from("groups").select("id,name,grade").order("name"),
      supabaseAdmin.from("homework").select("*").order("created_at", { ascending: false }),
      supabaseAdmin.from("students").select("id,full_name,code,group_id,grade").order("full_name"),
      supabaseAdmin.from("homework_submissions").select("*"),
    ]);
    return { groups: g.data || [], items: h.data || [], students: s.data || [], subs: sb.data || [] };
  });

export const saveHomeworkAdmin = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware])
  .inputValidator((d: unknown) => d as { id?: string; payload: any })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const q = data.id ? supabaseAdmin.from("homework").update(data.payload).eq("id", data.id).select("id") : supabaseAdmin.from("homework").insert(data.payload).select("id");
    const { data: row, error } = await q;
    if (error) throw new Error("تعذر حفظ الواجب: " + error.message);
    return { ok: true, id: row?.[0]?.id as string | undefined };
  });

export const deleteHomeworkAdmin = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware])
  .inputValidator((d: unknown) => d as { id: string })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("homework").delete().eq("id", data.id);
    return { ok: true };
  });

export const releaseHomeworkResultsAdmin = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware])
  .inputValidator((d: unknown) => d as { id: string; released: boolean })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("homework").update({ results_released: data.released } as any).eq("id", data.id);
    if (error) throw new Error("تعذر إرسال النتائج: " + error.message);
    return { ok: true };
  });

export const upsertHomeworkSubmissionAdmin = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware])
  .inputValidator((d: unknown) => d as { id?: string; payload: any })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: ex } = await supabaseAdmin.from("homework_submissions").select("id").eq("student_id", data.payload.student_id).eq("homework_id", data.payload.homework_id).maybeSingle();
    const { error } = ex
      ? await supabaseAdmin.from("homework_submissions").update(data.payload).eq("id", ex.id)
      : await supabaseAdmin.from("homework_submissions").insert(data.payload);
    if (error) throw new Error("تعذر حفظ التقييم: " + error.message);
    return { ok: true };
  });

export const getExamsDataAdmin = createServerFn({ method: "GET" })
  .middleware([requireAuthMiddleware])
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
  .middleware([requireAuthMiddleware])
  .inputValidator((d: unknown) => d as { id?: string; exam: any; questions: any[] })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let examId = data.id;
    if (examId) {
      await supabaseAdmin.from("exams").update(data.exam).eq("id", examId);
      await supabaseAdmin.from("exam_questions").delete().eq("exam_id", examId);
    } else {
      const { data: ex, error } = await supabaseAdmin.from("exams").insert(data.exam).select().single();
      if (error) throw error;
      examId = ex.id;
    }
    const qs = data.questions.map(q => ({ ...q, exam_id: examId }));
    await supabaseAdmin.from("exam_questions").insert(qs);
    return { ok: true };
  });

export const updateExamStatusAdmin = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware])
  .inputValidator((d: unknown) => d as { id: string; status: string })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("exams").update({ status: data.status }).eq("id", data.id);
    return { ok: true };
  });

export const setExamAnswersReleasedAdmin = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware])
  .inputValidator((d: unknown) => d as { id: string; released: boolean })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("exams").update({ answers_released: data.released }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });



export const deleteExamAdmin = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware])
  .inputValidator((d: unknown) => d as { id: string })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("exams").delete().eq("id", data.id);
    return { ok: true };
  });

export const getFinanceDataAdmin = createServerFn({ method: "GET" })
  .middleware([requireAuthMiddleware])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [st, gr, py] = await Promise.all([
      supabaseAdmin.from("students").select("id,full_name,code,grade,group_id").order("full_name"),
      supabaseAdmin.from("groups").select("id,name,monthly_fee").order("name"),
      supabaseAdmin.from("payments").select("*").order("paid_at", { ascending: false }),
    ]);
    return { students: st.data || [], groups: gr.data || [], payments: py.data || [] };
  });

export const addPaymentAdmin = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware])
  .inputValidator((d: unknown) => d as { student_id: string; group_id: string | null; amount: number; kind: string; month: string; paid_at: string; note: string | null })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("payments").insert(data);
    return { ok: true };
  });

export const deletePaymentAdmin = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware])
  .inputValidator((d: unknown) => d as { id: string })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("payments").delete().eq("id", data.id);
    return { ok: true };
  });

export const updatePaymentAdmin = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware])
  .inputValidator((d: unknown) => d as { id: string; payload: { amount: number; kind: string; month: string; paid_at: string; note: string | null } })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("payments").update(data.payload).eq("id", data.id);
    return { ok: true };
  });

export const sendCertificateToPortal = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware])
  .inputValidator((d: unknown) => d as { student_id: string; title: string; reason: string; template_id: string; signer: string })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("certificates").insert(data);
    return { ok: true };
  });

export const getAdminDataSummary = createServerFn({ method: "GET" })
  .middleware([requireAuthMiddleware])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [gr, st, at] = await Promise.all([
      supabaseAdmin.from("groups").select("id,name").order("name"),
      supabaseAdmin.from("students").select("id,full_name,code,group_id,active,grade,phone").order("full_name"),
      supabaseAdmin.from("attendance").select("*"),
    ]);
    return { groups: gr.data || [], students: st.data || [], attendance: at.data || [] };
  });

export const getDashboardStatsAdmin = createServerFn({ method: "GET" })
  .middleware([requireAuthMiddleware])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const today = new Date().toISOString().slice(0, 10);
    const [st, gr, ap, aa, pay, nq] = await Promise.all([
      supabaseAdmin.from("students").select("id", { count: "exact" }).eq("active", true),
      supabaseAdmin.from("groups").select("id", { count: "exact" }),
      supabaseAdmin.from("attendance").select("id", { count: "exact", head: true }).eq("date", today).eq("status", "present"),
      supabaseAdmin.from("attendance").select("id", { count: "exact", head: true }).eq("date", today).eq("status", "absent"),
      supabaseAdmin.from("payments").select("amount,kind"),
      supabaseAdmin.from("questions").select("id", { count: "exact", head: true }).eq("is_read", false),
    ]);
    const inc = (pay.data || []).filter((p: any) => p.kind === "payment").reduce((a, b) => a + Number(b.amount || 0), 0);
    const dues = (pay.data || []).filter((p: any) => p.kind === "charge").reduce((a, b) => a + Number(b.amount || 0), 0);
    return { 
      students: st.count || 0, 
      groups: gr.count || 0, 
      present: ap.count || 0, 
      absent: aa.count || 0, 
      income: inc, 
      dues, 
      outstanding: Math.max(0, dues - inc),
      newQuestions: nq.count || 0
    };
  });

export const getReportsDataAdmin = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware])
  .inputValidator((d: unknown) => d as { from: string; to: string })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [s, g, a, p] = await Promise.all([
      supabaseAdmin.from("students").select("*"),
      supabaseAdmin.from("groups").select("*"),
      supabaseAdmin.from("attendance").select("*").gte("date", data.from).lte("date", data.to),
      supabaseAdmin.from("payments").select("*"),
    ]);
    return { students: s.data || [], groups: g.data || [], attendance: a.data || [], payments: p.data || [] };
  });

export const getStudentNotesAdmin = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware])
  .inputValidator((d: unknown) => d as { student_id: string })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: n } = await supabaseAdmin.from("student_notes").select("*").eq("student_id", data.student_id).order("created_at", { ascending: false });
    return { notes: n || [] };
  });

export const addStudentNoteAdmin = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware])
  .inputValidator((d: unknown) => d as { student_id: string; title: string; body: string })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("student_notes").insert(data);
    return { ok: true };
  });

export const deleteStudentNoteAdmin = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware])
  .inputValidator((d: unknown) => d as { id: string })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("student_notes").delete().eq("id", data.id);
    return { ok: true };
  });

export const getStudentQuestionsAdmin = createServerFn({ method: "GET" })
  .middleware([requireAuthMiddleware])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: q } = await supabaseAdmin.from("questions").select("*").order("created_at", { ascending: false });
    const { data: s } = await supabaseAdmin.from("students").select("id,full_name,code");
    return { questions: q || [], students: s || [] };
  });

export const answerStudentQuestionAdmin = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware])
  .inputValidator((d: unknown) => d as { id: string; answer: string })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("questions").update({ answer: data.answer, answered_at: new Date().toISOString(), is_read: true }).eq("id", data.id);
    return { ok: true };
  });

export const deleteStudentQuestionAdmin = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware])
  .inputValidator((d: unknown) => d as { id: string })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("questions").delete().eq("id", data.id);
    return { ok: true };
  });

export const deleteAllStudentQuestionsAdmin = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("questions").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const factoryResetSystem = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const tables = ["exam_answers", "exam_attempts", "exam_questions", "exams", "homework_submissions", "homework", "attendance", "payments", "student_notes", "questions", "students", "groups", "certificates"];
    for (const table of tables) {
      await supabaseAdmin.from(table as any).delete().neq("id", "00000000-0000-0000-0000-000000000000");
    }
    return { ok: true };
  });
/* ===== صور السبورة ===== */

export const getBoardImagesAdmin = createServerFn({ method: "GET" })
  .middleware([requireAuthMiddleware])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [g, b] = await Promise.all([
      supabaseAdmin.from("groups").select("id, name, grade").order("name"),
      supabaseAdmin.from("board_images").select("*").order("date", { ascending: false }).order("created_at", { ascending: false }),
    ]);
    const posts = await Promise.all((b.data || []).map(async (p: any) => {
      const paths: string[] = Array.isArray(p.paths) ? p.paths : [];
      const urls = await Promise.all(paths.map(async (path) => {
        const { data } = await supabaseAdmin.storage.from("board-images").createSignedUrl(path, 3600);
        return data?.signedUrl || null;
      }));
      return { ...p, paths, urls: urls.filter(Boolean) as string[] };
    }));
    return { groups: g.data || [], posts };
  });

export const createBoardUploadUrlAdmin = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware])
  .inputValidator((d: unknown) => d as { filename: string })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const safe = String(data.filename || "board.jpg").replace(/[^\w.\-]/g, "_").slice(-60);
    const path = `${new Date().toISOString().slice(0, 10)}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safe}`;
    const { data: res, error } = await supabaseAdmin.storage.from("board-images").createSignedUploadUrl(path);
    if (error) throw new Error(error.message);
    return { path, token: res.token };
  });

export const saveBoardImagePostAdmin = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware])
  .inputValidator((d: unknown) => d as { id?: string; payload: { group_id: string | null; grade: string | null; date: string; title: string | null; paths: string[] } })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const payload = { ...data.payload, paths: data.payload.paths || [] } as any;
    if (!payload.paths.length) throw new Error("يجب رفع صورة واحدة على الأقل");
    if (data.id) {
      const { error } = await supabaseAdmin.from("board_images").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { ok: true, id: data.id };
    }
    const { data: row, error } = await supabaseAdmin.from("board_images").insert(payload).select("id").single();
    if (error) throw new Error(error.message);
    return { ok: true, id: row.id };
  });

export const deleteBoardImagePostAdmin = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware])
  .inputValidator((d: unknown) => d as { id: string })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin.from("board_images").select("paths").eq("id", data.id).maybeSingle();
    const paths: string[] = Array.isArray(row?.paths) ? (row!.paths as any) : [];
    if (paths.length) await supabaseAdmin.storage.from("board-images").remove(paths);
    const { error } = await supabaseAdmin.from("board_images").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ===== ملاحظات ودرجات المتابعة (الاختبار والتسميع) ===== */

export const getStudentRecordsAdmin = createServerFn({ method: "GET" })
  .middleware([requireAuthMiddleware])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [g, s, r] = await Promise.all([
      supabaseAdmin.from("groups").select("id,name,grade").order("name"),
      supabaseAdmin.from("students").select("id,full_name,code,group_id,grade").order("full_name"),
      supabaseAdmin.from("student_records").select("*").order("date", { ascending: false }),
    ]);
    return { groups: g.data || [], students: s.data || [], records: r.data || [] };
  });

export const saveStudentRecordAdmin = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware])
  .inputValidator((d: unknown) => d as { id?: string; payload: { student_id: string; group_id: string | null; date: string; exam_level: string | null; recitation_level: string | null; note: string | null } })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const q = data.id
      ? supabaseAdmin.from("student_records").update(data.payload).eq("id", data.id)
      : supabaseAdmin.from("student_records").insert(data.payload);
    const { error } = await q;
    if (error) throw new Error("تعذر الحفظ: " + error.message);
    return { ok: true };
  });

export const saveStudentRecordsBulkAdmin = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware])
  .inputValidator((d: unknown) => d as { rows: { student_id: string; group_id: string | null; date: string; exam_level: string | null; recitation_level: string | null; note: string | null }[] })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const rows = (data.rows || []).filter(r => r.student_id && (r.exam_level || r.recitation_level || r.note));
    if (!rows.length) throw new Error("لا توجد بيانات للحفظ");
    for (const r of rows) {
      const { data: ex } = await supabaseAdmin.from("student_records").select("id").eq("student_id", r.student_id).eq("date", r.date).maybeSingle();
      if (ex) await supabaseAdmin.from("student_records").update(r).eq("id", ex.id);
      else await supabaseAdmin.from("student_records").insert(r);
    }
    return { ok: true, count: rows.length };
  });

export const deleteStudentRecordAdmin = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware])
  .inputValidator((d: unknown) => d as { id: string })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("student_records").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** روابط موقعة لعدة صور واجب */
export const getHomeworkSubmissionFileUrls = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware])
  .inputValidator((d: unknown) => d as { paths: string[] })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const urls = await Promise.all((data.paths || []).map(async (p) => {
      const { data: res } = await supabaseAdmin.storage.from("submissions").createSignedUrl(p, 3600);
      return res?.signedUrl || null;
    }));
    return { urls: urls.filter(Boolean) as string[] };
  });

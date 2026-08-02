import { createServerFn } from "@tanstack/react-start";

export const registerStudent = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => d as Record<string, string>)
  .handler(async ({ data }) => {
    const { admin, str } = await import("./student.server");
    const FIELDS = ["full_name", "phone", "parent_phone", "gender", "birth_date", "national_id", "address", "governorate", "education_dept", "school", "grade", "section", "subject", "teacher_name", "notes", "group_id"];
    const payload: Record<string, any> = { active: false };
    for (const k of FIELDS) {
      const v = str(data?.[k], k === "notes" || k === "address" ? 1000 : 120);
      if (v) payload[k] = v;
    }
    if (!payload.full_name) throw new Error("الاسم مطلوب");
    if (payload.group_id === "") payload.group_id = null;
    const { data: row, error } = await admin.from("students").insert(payload as any).select("code, full_name").single();
    if (error) throw new Error(`فشل الحفظ: ${error.message}`);
    return { code: row.code as string, full_name: row.full_name as string };
  });

export const getAvailableGroups = createServerFn({ method: "GET" })
  .handler(async () => {
    const { admin } = await import("./student.server");
    const { data, error } = await admin.from("groups").select("id, name, grade").order("name");
    if (error) throw new Error(error.message);
    return { groups: data || [] };
  });

export const getStudentPortal = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => d as { code: string })
  .handler(async ({ data }) => {
    const { requireStudent } = await import("./student.server");
    const { db, student } = await requireStudent(data?.code);
    
    if (!student.active) {
      throw new Error("حسابك قيد المراجعة من قبل الأستاذ. يرجى المحاولة لاحقاً.");
    }

    const [a, hs, p, n, q, g, hw, certs] = await Promise.all([
      db.from("attendance").select("id,date,status").eq("student_id", student.id).order("date", { ascending: false }).limit(100),
      db.from("homework_submissions").select("*").eq("student_id", student.id),
      db.from("payments").select("*").eq("student_id", student.id).order("paid_at", { ascending: false }),
      db.from("student_notes").select("*").eq("student_id", student.id).order("created_at", { ascending: false }),
      db.from("questions").select("*").eq("student_id", student.id).order("created_at", { ascending: false }),
      student.group_id ? db.from("groups").select("*").eq("id", student.group_id).maybeSingle() : Promise.resolve({ data: null }),
      student.group_id ? db.from("homework").select("*").eq("group_id", student.group_id).order("created_at", { ascending: false }) : db.from("homework").select("*").is("group_id", null),
      db.from("certificates").select("*").eq("student_id", student.id).order("created_at", { ascending: false }),
    ]);

    // حساب التنبيهات للطالب (الملاحظات غير المقروءة والواجبات المعلقة)
    const unreadNotes = (n.data || []).filter((x: any) => x.is_read === false).length;
    const pendingHw = (hw.data || []).filter((h: any) => !hs.data?.some((s: any) => s.homework_id === h.id)).length;
    
    return { 
      student, group: g.data, attendance: a.data || [], subs: hs.data || [], payments: p.data || [], notes: n.data || [], questions: q.data || [], homework: hw.data || [], certificates: certs.data || [],
      counts: { unreadNotes, pendingHw, certificates: certs.data?.length || 0 }
    };
  });

export const markNotesAsRead = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => d as { code: string })
  .handler(async ({ data }) => {
    const { requireStudent } = await import("./student.server");
    const { db, student } = await requireStudent(data.code);
    await db.from("student_notes").update({ is_read: true }).eq("student_id", student.id).eq("is_read", false);
    return { ok: true };
  });

export const deleteCertificatePortal = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => d as { code: string; id: string })
  .handler(async ({ data }) => {
    const { requireStudent } = await import("./student.server");
    const { db, student } = await requireStudent(data.code);
    await db.from("certificates").delete().eq("id", data.id).eq("student_id", student.id);
    return { ok: true };
  });

export const deleteExamAttemptPortal = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => d as { code: string; attempt_id: string })
  .handler(async ({ data }) => {
    const { requireStudent } = await import("./student.server");
    const { db, student } = await requireStudent(data.code);
    // حذف الإجابات المرتبطة أولاً (بسبب المفاتيح الخارجية)
    await db.from("exam_answers").delete().eq("attempt_id", data.attempt_id);
    await db.from("exam_attempts").delete().eq("id", data.attempt_id).eq("student_id", student.id);
    return { ok: true };
  });

export const getAttemptDetails = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => d as { code: string; attempt_id: string })
  .handler(async ({ data }) => {
    const { requireStudent } = await import("./student.server");
    const { db } = await requireStudent(data.code);
    const { data: attempt } = await db.from("exam_attempts").select("*").eq("id", data.attempt_id).single();
    if (!attempt) throw new Error("المحاولة غير موجودة");
    
    const [qs, ans] = await Promise.all([
      db.from("exam_questions").select("*").eq("exam_id", attempt.exam_id).order("position"),
      db.from("exam_answers").select("*").eq("attempt_id", data.attempt_id),
    ]);
    
    return { questions: qs || [], answers: ans || [] };
  });

export const updateStudentProfile = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => d as { code: string; fields: Record<string, string> })
  .handler(async ({ data }) => {
    const { requireStudent, str } = await import("./student.server");
    const { db, student } = await requireStudent(data.code);
    const upd: any = {};
    for (const [k, v] of Object.entries(data.fields)) {
      if (["full_name", "phone", "parent_phone", "address", "school", "section", "group_id"].includes(k)) {
        upd[k] = v === "" ? null : str(v);
      }
    }
    const { error } = await db.from("students").update(upd).eq("id", student.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const askTeacher = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => d as { code: string; body: string })
  .handler(async ({ data }) => {
    const { requireStudent, str } = await import("./student.server");
    const { db, student } = await requireStudent(data.code);
    
    const { count } = await db.from("questions").select("*", { count: "exact", head: true }).eq("student_id", student.id);
    if ((count ?? 0) >= 1) throw new Error("مسموح بسؤال واحد فقط. احذف سؤالك السابق لإرسال سؤال جديد.");

    const body = str(data.body, 2000);
    if (!body) throw new Error("السؤال فارغ");
    const { error } = await db.from("questions").insert({ student_id: student.id, body, is_read: false });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteStudentQuestionPortal = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => d as { code: string; id: string })
  .handler(async ({ data }) => {
    const { requireStudent } = await import("./student.server");
    const { db, student } = await requireStudent(data.code);
    const { error } = await db.from("questions").delete().eq("id", data.id).eq("student_id", student.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const submitHomeworkText = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => d as { code: string; homework_id: string; answer_text: string })
  .handler(async ({ data }) => {
    const { requireStudent, str } = await import("./student.server");
    const { db, student } = await requireStudent(data.code);
    const { data: existing } = await db.from("homework_submissions").select("id").eq("student_id", student.id).eq("homework_id", data.homework_id).maybeSingle();
    if (existing) {
      await db.from("homework_submissions").update({ answer_text: str(data.answer_text, 5000), status: "submitted", submitted_at: new Date().toISOString() }).eq("id", existing.id);
    } else {
      await db.from("homework_submissions").insert({ student_id: student.id, homework_id: data.homework_id, answer_text: str(data.answer_text, 5000), status: "submitted", submitted_at: new Date().toISOString() });
    }
    return { ok: true };
  });

export const createHomeworkUploadUrl = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => d as { code: string; homework_id: string; filename: string })
  .handler(async ({ data }) => {
    const { requireStudent } = await import("./student.server");
    const { db, student } = await requireStudent(data.code);
    const path = `${student.id}/${data.homework_id}/${Date.now()}-${data.filename}`;
    const { data: res, error } = await db.storage.from("submissions").createSignedUploadUrl(path);
    if (error) throw new Error(error.message);
    return { path, token: res.token };
  });

export const finalizeHomeworkUpload = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => d as { code: string; homework_id: string; path: string })
  .handler(async ({ data }) => {
    const { requireStudent } = await import("./student.server");
    const { db, student } = await requireStudent(data.code);
    const { data: existing } = await db.from("homework_submissions").select("id").eq("student_id", student.id).eq("homework_id", data.homework_id).maybeSingle();
    if (existing) {
      await db.from("homework_submissions").update({ file_url: data.path, status: "submitted", submitted_at: new Date().toISOString() }).eq("id", existing.id);
    } else {
      await db.from("homework_submissions").insert({ student_id: student.id, homework_id: data.homework_id, file_url: data.path, status: "submitted", submitted_at: new Date().toISOString() });
    }
    return { ok: true };
  });

export const getSubmissionUrl = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => d as { code: string; path: string })
  .handler(async ({ data }) => {
    const { requireStudent } = await import("./student.server");
    const { db } = await requireStudent(data.code);
    const { data: res, error } = await db.storage.from("submissions").createSignedUrl(data.path, 3600);
    if (error) throw new Error(error.message);
    return { url: res.signedUrl };
  });

export const getStudentExams = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => d as { code: string })
  .handler(async ({ data }) => {
    const { requireStudent } = await import("./student.server");
    const { db, student } = await requireStudent(data.code);
    const { data: exams } = await db.from("exams").select("*").eq("status", "published").or(`group_id.eq.${student.group_id},grade.eq.${student.grade}`).order("created_at", { ascending: false });
    const { data: attempts } = await db.from("exam_attempts").select("*").eq("student_id", student.id).order("submitted_at", { ascending: false });
    return { exams: exams || [], attempts: attempts || [] };
  });

export const startExamAttempt = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => d as { code: string; exam_id: string })
  .handler(async ({ data }) => {
    const { requireStudent } = await import("./student.server");
    const { db, student } = await requireStudent(data.code);
    const { data: exam } = await db.from("exams").select("*").eq("id", data.exam_id).single();
    const { data: questions } = await db.from("exam_questions").select("id, position, kind, prompt, passage, options, skill, difficulty, score").eq("exam_id", data.exam_id).order("position");
    const { data: attempt } = await db.from("exam_attempts").insert({ student_id: student.id, exam_id: data.exam_id, status: "in_progress", started_at: new Date().toISOString() }).select().single();
    return { exam, questions: questions || [], attempt };
  });

export const submitExamAttempt = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => d as { code: string; attempt_id: string; answers: Record<string, any>; time_spent_seconds: number })
  .handler(async ({ data }) => {
    const { requireStudent } = await import("./student.server");
    const { db, student } = await requireStudent(data.code);
    const { data: attempt } = await db.from("exam_attempts").select("*").eq("id", data.attempt_id).single();
    if (!attempt) throw new Error("محاولة الاختبار غير موجودة");
    const { data: questions } = await db.from("exam_questions").select("*").eq("exam_id", attempt.exam_id);
    const { gradeAndAnalyze } = await import("./exams.server");
    const { data: exam } = await db.from("exams").select("title").eq("id", attempt.exam_id).single();
    const items = (questions || []).map(q => ({ id: q.id, kind: q.kind, prompt: q.prompt, correct: String(q.correct_answer || ""), answer: String(data.answers[q.id] || ""), score: q.score, skill: q.skill, autoCorrect: ["اختيار من متعدد", "صح أو خطأ", "اختر من القائمة"].includes(q.kind) }));
    const result = await gradeAndAnalyze({ studentName: student.full_name, examTitle: exam?.title || "اختبار", classAverage: null, items });
    await db.from("exam_attempts").update({ status: "submitted", submitted_at: new Date().toISOString(), score: result.total, max_score: result.max, percentage: result.percentage, time_spent_seconds: data.time_spent_seconds, analysis: result.analysis, strengths: result.strengths, weaknesses: result.weaknesses, remedial_plan: result.remedial_plan }).eq("id", data.attempt_id);
    const answersToInsert = items.map(i => { const res = result.results.find(r => r.id === i.id); return { attempt_id: data.attempt_id, question_id: i.id, answer: data.answers[i.id] || "", score: res?.score || 0, is_correct: res?.is_correct || false, feedback: res?.feedback || "", time_spent_seconds: 0 }; });
    await db.from("exam_answers").insert(answersToInsert);
    return { total: result.total, max: result.max, percentage: result.percentage };
  });
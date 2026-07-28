import { createServerFn } from "@tanstack/react-start";

/** تسجيل طالب جديد */
export const registerStudent = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => d as Record<string, string>)
  .handler(async ({ data }) => {
    const { admin, str } = await import("./student.server");
    const db = admin;

    const FIELDS = [
      "full_name", "phone", "parent_phone", "gender", "birth_date", "national_id",
      "address", "governorate", "education_dept", "school", "grade", "section",
      "subject", "teacher_name", "notes",
    ];
    const payload: Record<string, string | null> = {};
    for (const k of FIELDS) {
      const v = str(data?.[k], k === "notes" || k === "address" ? 1000 : 120);
      if (v) payload[k] = v;
    }
    
    if (!payload.full_name) throw new Error("الاسم مطلوب");

    const { data: row, error } = await db.from("students").insert(payload as never).select("code, full_name").single();
    if (error) throw new Error(`فشل الحفظ: ${error.message}`);
    
    return { code: row.code as string, full_name: row.full_name as string };
  });

/** جلب بيانات بوابة الطالب */
export const getStudentPortal = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => d as { code: string })
  .handler(async ({ data }) => {
    const { requireStudent } = await import("./student.server");
    const { db, student } = await requireStudent(data?.code);

    const [a, hs, p, n, q, g, hw] = await Promise.all([
      db.from("attendance").select("id,date,status").eq("student_id", student.id).order("date", { ascending: false }).limit(100),
      db.from("homework_submissions").select("*").eq("student_id", student.id),
      db.from("payments").select("*").eq("student_id", student.id).order("paid_at", { ascending: false }),
      db.from("student_notes").select("*").eq("student_id", student.id).order("created_at", { ascending: false }),
      db.from("questions").select("*").eq("student_id", student.id).order("created_at", { ascending: false }),
      student.group_id ? db.from("groups").select("*").eq("id", student.group_id).maybeSingle() : Promise.resolve({ data: null }),
      student.group_id ? db.from("homework").select("*").eq("group_id", student.group_id).order("created_at", { ascending: false }) : db.from("homework").select("*").is("group_id", null),
    ]);

    return {
      student,
      group: g.data,
      attendance: a.data || [],
      subs: hs.data || [],
      payments: p.data || [],
      notes: n.data || [],
      questions: q.data || [],
      homework: hw.data || [],
    };
  });

/** تحديث بيانات الطالب من قبله */
export const updateStudentProfile = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => d as { code: string; fields: Record<string, string> })
  .handler(async ({ data }) => {
    const { requireStudent, str } = await import("./student.server");
    const { db, student } = await requireStudent(data.code);
    const upd: any = {};
    for (const [k, v] of Object.entries(data.fields)) {
      if (["full_name", "phone", "parent_phone", "address", "school", "section"].includes(k)) {
        upd[k] = str(v);
      }
    }
    const { error } = await db.from("students").update(upd).eq("id", student.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** سؤال الأستاذ */
export const askTeacher = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => d as { code: string; body: string })
  .handler(async ({ data }) => {
    const { requireStudent, str } = await import("./student.server");
    const { db, student } = await requireStudent(data.code);
    const body = str(data.body, 2000);
    if (!body) throw new Error("السؤال فارغ");
    const { error } = await db.from("questions").insert({ student_id: student.id, body });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** تسليم الواجب نصياً */
export const submitHomeworkText = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => d as { code: string; homework_id: string; answer_text: string })
  .handler(async ({ data }) => {
    const { requireStudent, str } = await import("./student.server");
    const { db, student } = await requireStudent(data.code);
    const { error } = await db.from("homework_submissions").upsert({
      student_id: student.id,
      homework_id: data.homework_id,
      answer_text: str(data.answer_text, 5000),
      status: "submitted",
      submitted_at: new Date().toISOString()
    }, { onConflict: "student_id,homework_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** إنشاء رابط لرفع ملف الواجب */
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

/** تأكيد رفع الملف */
export const finalizeHomeworkUpload = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => d as { code: string; homework_id: string; path: string })
  .handler(async ({ data }) => {
    const { requireStudent } = await import("./student.server");
    const { db, student } = await requireStudent(data.code);
    const { error } = await db.from("homework_submissions").upsert({
      student_id: student.id,
      homework_id: data.homework_id,
      file_url: data.path,
      status: "submitted",
      submitted_at: new Date().toISOString()
    }, { onConflict: "student_id,homework_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** الحصول على رابط عرض الملف */
export const getSubmissionUrl = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => d as { code: string; path: string })
  .handler(async ({ data }) => {
    const { requireStudent } = await import("./student.server");
    const { db } = await requireStudent(data.code);
    const { data: res, error } = await db.storage.from("submissions").createSignedUrl(data.path, 3600);
    if (error) throw new Error(error.message);
    return { url: res.signedUrl };
  });

/** جلب الاختبارات المتاحة للطالب */
export const getStudentExams = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => d as { code: string })
  .handler(async ({ data }) => {
    const { requireStudent } = await import("./student.server");
    const { db, student } = await requireStudent(data.code);
    
    // جلب الاختبارات المنشورة لمجموعة الطالب أو لصفه
    const { data: exams } = await db.from("exams")
      .select("*")
      .eq("status", "published")
      .or(`group_id.eq.${student.group_id},grade.eq.${student.grade}`)
      .order("created_at", { ascending: false });

    // جلب محاولات الطالب
    const { data: attempts } = await db.from("exam_attempts")
      .select("*")
      .eq("student_id", student.id);

    return { exams: exams || [], attempts: attempts || [] };
  });

/** بدء محاولة اختبار */
export const startExamAttempt = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => d as { code: string; exam_id: string })
  .handler(async ({ data }) => {
    const { requireStudent } = await import("./student.server");
    const { db, student } = await requireStudent(data.code);

    const { data: exam, error: exErr } = await db.from("exams").select("*").eq("id", data.exam_id).single();
    if (exErr || !exam) throw new Error("الاختبار غير موجود");

    const { data: questions } = await db.from("exam_questions")
      .select("id, position, kind, prompt, passage, options, skill, difficulty, score")
      .eq("exam_id", data.exam_id)
      .order("position");

    const { data: attempt, error: attErr } = await db.from("exam_attempts").insert({
      student_id: student.id,
      exam_id: data.exam_id,
      status: "in_progress",
      started_at: new Date().toISOString()
    }).select().single();

    if (attErr) throw new Error("تعذر بدء المحاولة");

    return { exam, questions: questions || [], attempt };
  });

/** إرسال إجابات الاختبار وتصحيحه */
export const submitExamAttempt = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => d as { code: string; attempt_id: string; answers: Record<string, any>; time_spent_seconds: number })
  .handler(async ({ data }) => {
    const { requireStudent } = await import("./student.server");
    const { db, student } = await requireStudent(data.code);

    const { data: attempt } = await db.from("exam_attempts").select("*").eq("id", data.attempt_id).single();
    if (!attempt || attempt.student_id !== student.id) throw new Error("محاولة غير صالحة");

    const { data: questions } = await db.from("exam_questions").select("*").eq("exam_id", attempt.exam_id);
    if (!questions) throw new Error("الأسئلة غير موجودة");

    const { gradeAndAnalyze } = await import("./exams.server");
    const { data: exam } = await db.from("exams").select("title").eq("id", attempt.exam_id).single();

    const items = questions.map(q => ({
      id: q.id, kind: q.kind, prompt: q.prompt, correct: String(q.correct_answer || ""),
      answer: String(data.answers[q.id] || ""), score: q.score, skill: q.skill,
      autoCorrect: ["اختيار من متعدد", "صح أو خطأ", "اختر من القائمة"].includes(q.kind)
    }));

    const result = await gradeAndAnalyze({
      studentName: student.full_name,
      examTitle: exam?.title || "اختبار",
      classAverage: null,
      items
    });

    // حفظ النتائج
    await db.from("exam_attempts").update({
      status: "submitted",
      submitted_at: new Date().toISOString(),
      score: result.total,
      max_score: result.max,
      percentage: result.percentage,
      time_spent_seconds: data.time_spent_seconds,
      analysis: result.analysis,
      strengths: result.strengths,
      weaknesses: result.weaknesses,
      remedial_plan: result.remedial_plan
    }).eq("id", data.attempt_id);

    // حفظ الإجابات التفصيلية
    const ansRows = result.results.map(r => ({
      attempt_id: data.attempt_id,
      question_id: r.id,
      answer: data.answers[r.id],
      is_correct: r.is_correct,
      score: r.score,
      feedback: r.feedback,
      time_spent_seconds: 0 
    }));
    await db.from("exam_answers").insert(ansRows);

    return { total: result.total, max: result.max, percentage: result.percentage };
  });
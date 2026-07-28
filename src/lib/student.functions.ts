import { createServerFn } from "@tanstack/react-start";

/** إنشاء حساب طالب جديد (عام) — يمر بتحقق من التكرار على الخادم */
export const registerStudent = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => d as Record<string, string>)
  .handler(async ({ data }) => {
    const { admin, str } = await import("./student.server");
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

    const db = admin();
    
    // التحقق من وجود مفتاح السيرفر (Service Role)
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("خطأ في تكوين النظام: مفتاح السيرفر مفقود. يرجى ربط قاعدة البيانات بشكل صحيح.");
    }

    const orParts: string[] = [];
    for (const k of ["parent_phone", "national_id", "phone"]) {
      if (payload[k]) orParts.push(`${k}.eq.${payload[k]}`);
    }
    
    if (orParts.length) {
      const { data: dups } = await db
        .from("students").select("id").eq("full_name", payload.full_name).or(orParts.join(",")).limit(1);
      if (dups && dups.length) {
        throw new Error("هذا الطالب مسجَّل بالفعل بكود مختلف. يرجى مراجعة الأستاذ.");
      }
    }

    const { data: row, error } = await db.from("students").insert(payload as never).select("code, full_name").single();
    
    if (error) {
      console.error("Database Insert Error:", error);
      throw new Error(`تعذر الحفظ في قاعدة البيانات: ${error.message}`);
    }
    
    return { code: row.code as string, full_name: row.full_name as string };
  });

/** كل بيانات صفحة الطالب — محمية بكود الطالب الخاص */
export const getStudentPortal = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => d as { code: string })
  .handler(async ({ data }) => {
    const { requireStudent } = await import("./student.server");
    const { db, student } = await requireStudent(data?.code);

    const [a, hs, p, n, q] = await Promise.all([
      db.from("attendance").select("id,date,status").eq("student_id", student.id).order("date", { ascending: false }).limit(100),
      db.from("homework_submissions").select("*").eq("student_id", student.id),
      db.from("payments").select("*").eq("student_id", student.id).order("paid_at", { ascending: false }),
      db.from("student_notes").select("*").eq("student_id", student.id).order("created_at", { ascending: false }),
      db.from("questions").select("*").eq("student_id", student.id).order("created_at", { ascending: false }),
    ]);

    const group = student.group_id
      ? (await db.from("groups").select("*").eq("id", student.group_id).maybeSingle()).data
      : null;
    const hw = student.group_id
      ? await db.from("homework").select("*").eq("group_id", student.group_id).order("created_at", { ascending: false })
      : await db.from("homework").select("*").is("group_id", null);

    return {
      student: {
        id: student.id, code: student.code, full_name: student.full_name, grade: student.grade,
        group_id: student.group_id, subject: student.subject, teacher_name: student.teacher_name,
        phone: student.phone, parent_phone: student.parent_phone, address: student.address,
        school: student.school, section: student.section,
      },
      group,
      attendance: a.data || [],
      subs: hs.data || [],
      payments: p.data || [],
      notes: n.data || [],
      questions: q.data || [],
      homework: hw.data || [],
    };
  });

/** تعديل الطالب لبياناته الشخصية فقط */
export const updateStudentProfile = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => d as { code: string; fields: Record<string, string> })
  .handler(async ({ data }) => {
    const { requireStudent, str } = await import("./student.server");
    const { db, student } = await requireStudent(data?.code);
    const payload: Record<string, string | null> = {};
    for (const k of ["full_name", "phone", "parent_phone", "address", "school", "section"]) {
      payload[k] = str(data?.fields?.[k], 300);
    }
    if (!payload.full_name) throw new Error("الاسم مطلوب");
    const { error } = await db.from("students").update(payload as never).eq("id", student.id);
    if (error) throw new Error("تعذر حفظ التعديلات");
    return { ok: true };
  });

/** إرسال سؤال للأستاذ */
export const askTeacher = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => d as { code: string; body: string })
  .handler(async ({ data }) => {
    const { requireStudent, str } = await import("./student.server");
    const { db, student } = await requireStudent(data?.code);
    const body = str(data?.body, 2000);
    if (!body) throw new Error("اكتب سؤالك أولاً");
    const { error } = await db.from("questions").insert({ student_id: student.id, body } as never);
    if (error) throw new Error("تعذر إرسال السؤال");
    return { ok: true };
  });

/** تسليم حل نصي للواجب */
export const submitHomeworkText = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => d as { code: string; homework_id: string; answer_text: string })
  .handler(async ({ data }) => {
    const { requireStudent, str } = await import("./student.server");
    const { db, student } = await requireStudent(data?.code);
    const text = str(data?.answer_text, 20000);
    if (!text) throw new Error("اكتب حل الواجب أولاً");
    const { error } = await db.from("homework_submissions").upsert(
      { homework_id: String(data.homework_id), student_id: student.id, answer_text: text, status: "submitted" } as never,
      { onConflict: "homework_id,student_id" },
    );
    if (error) throw new Error("تعذر حفظ الحل");
    return { ok: true };
  });

/** رابط رفع موقّع لملف الحل داخل مجلد الطالب فقط */
export const createHomeworkUploadUrl = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => d as { code: string; homework_id: string; filename: string })
  .handler(async ({ data }) => {
    const { requireStudent } = await import("./student.server");
    const { db, student } = await requireStudent(data?.code);
    const safe = String(data?.filename || "file").replace(/[^\w.\-]/g, "_").slice(-60);
    const path = `${student.id}/${String(data.homework_id)}_${Date.now()}_${safe}`;
    const { data: up, error } = await db.storage.from("submissions").createSignedUploadUrl(path);
    if (error || !up) throw new Error("تعذر تجهيز الرفع");
    return { path, token: up.token };
  });

/** تسجيل مسار الملف بعد رفعه */
export const finalizeHomeworkUpload = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => d as { code: string; homework_id: string; path: string })
  .handler(async ({ data }) => {
    const { requireStudent } = await import("./student.server");
    const { db, student } = await requireStudent(data?.code);
    const path = String(data?.path || "");
    if (!path.startsWith(`${student.id}/`)) throw new Error("مسار غير صالح");
    const { error } = await db.from("homework_submissions").upsert(
      { homework_id: String(data.homework_id), student_id: student.id, file_url: path, status: "submitted" } as never,
      { onConflict: "homework_id,student_id" },
    );
    if (error) throw new Error("تعذر حفظ الملف");
    return { ok: true };
  });

/** رابط عرض موقّع لملف الطالب نفسه فقط */
export const getSubmissionUrl = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => d as { code: string; path: string })
  .handler(async ({ data }) => {
    const { requireStudent } = await import("./student.server");
    const { db, student } = await requireStudent(data?.code);
    const path = String(data?.path || "");
    if (!path.startsWith(`${student.id}/`)) throw new Error("غير مصرح");
    const { data: signed, error } = await db.storage.from("submissions").createSignedUrl(path, 3600);
    if (error || !signed) throw new Error("تعذر فتح الملف");
    return { url: signed.signedUrl };
  });

/** الاختبارات المتاحة للطالب + محاولاته */
export const getStudentExams = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => d as { code: string })
  .handler(async ({ data }) => {
    const { requireStudent } = await import("./student.server");
    const { gradeMatches } = await import("./exam-constants");
    const { db, student } = await requireStudent(data?.code);
    const { data: ex } = await db.from("exams").select("*").eq("status", "published").order("created_at", { ascending: false });
    const exams = (ex || []).filter(
      (e: any) => (!e.group_id || !student.group_id || e.group_id === student.group_id) && gradeMatches(e.grade, student.grade),
    );
    const { data: at } = await db.from("exam_attempts").select("*").eq("student_id", student.id);
    return { exams, attempts: at || [] };
  });

/** بدء محاولة اختبار — الأسئلة تُرسل بدون الإجابات الصحيحة */
export const startExamAttempt = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => d as { code: string; exam_id: string })
  .handler(async ({ data }) => {
    const { requireStudent } = await import("./student.server");
    const { gradeMatches } = await import("./exam-constants");
    const { db, student } = await requireStudent(data?.code);

    const { data: exam } = await db.from("exams").select("*").eq("id", String(data.exam_id)).eq("status", "published").maybeSingle();
    if (!exam) throw new Error("الاختبار غير متاح");
    const e: any = exam;
    if (!((!e.group_id || !student.group_id || e.group_id === student.group_id) && gradeMatches(e.grade, student.grade))) {
      throw new Error("هذا الاختبار غير متاح لك");
    }

    const { data: qs } = await db.from("exam_questions").select("*").eq("exam_id", e.id).order("position");
    let questions: any[] = qs || [];
    if (!questions.length) throw new Error("لا توجد أسئلة في هذا الاختبار");
    if (e.adaptive) {
      const order = ["easy", "medium", "hard"];
      questions = [...questions].sort((x, y) => order.indexOf(x.difficulty) - order.indexOf(y.difficulty));
    }

    const { count } = await db.from("exam_attempts").select("id", { count: "exact", head: true })
      .eq("exam_id", e.id).eq("student_id", student.id);
    const { data: attempt, error } = await db.from("exam_attempts").insert({
      exam_id: e.id, student_id: student.id, attempt_no: (count || 0) + 1, status: "in_progress",
      max_score: questions.reduce((s, q) => s + Number(q.score), 0),
    } as never).select().single();
    if (error) throw new Error("تعذر بدء الاختبار");

    return {
      exam: e,
      attempt,
      questions: questions.map((q) => ({
        id: q.id, position: q.position, kind: q.kind, prompt: q.prompt, passage: q.passage,
        options: q.options, skill: q.skill, difficulty: q.difficulty, score: q.score,
      })),
    };
  });

/** إنهاء المحاولة والتصحيح على الخادم */
export const submitExamAttempt = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => d as { code: string; attempt_id: string; answers: Record<string, string>; time_spent_seconds: number })
  .handler(async ({ data }) => {
    const { requireStudent } = await import("./student.server");
    const { gradeAndAnalyze } = await import("./exams.server");
    const { isAuto, answerToText } = await import("./exam-constants");
    const { db, student } = await requireStudent(data?.code);

    const { data: attempt } = await db.from("exam_attempts").select("*")
      .eq("id", String(data.attempt_id)).eq("student_id", student.id).maybeSingle();
    if (!attempt) throw new Error("المحاولة غير موجودة");
    const at: any = attempt;
    if (at.status === "submitted") throw new Error("تم تسليم هذه المحاولة بالفعل");

    const { data: exam } = await db.from("exams").select("*").eq("id", at.exam_id).maybeSingle();
    const { data: qs } = await db.from("exam_questions").select("*").eq("exam_id", at.exam_id).order("position");
    const questions: any[] = qs || [];
    const answers = data?.answers && typeof data.answers === "object" ? data.answers : {};

    const { data: peers } = await db.from("exam_attempts").select("percentage").eq("exam_id", at.exam_id).eq("status", "submitted");
    const avg = peers && peers.length ? Math.round(peers.reduce((s: number, p: any) => s + Number(p.percentage), 0) / peers.length) : null;

    const res = await gradeAndAnalyze({
      studentName: student.full_name,
      examTitle: (exam as any)?.title || "اختبار",
      classAverage: avg,
      items: questions.map((q) => ({
        id: q.id, kind: q.kind, prompt: q.prompt, correct: answerToText(q.correct_answer),
        answer: String(answers[q.id] ?? "").slice(0, 20000), score: Number(q.score),
        skill: q.skill, autoCorrect: isAuto(q.kind),
      })),
    });

    const spent = Math.max(0, Math.min(Number(data?.time_spent_seconds) || 0, 86400));
    await db.from("exam_answers").upsert(
      res.results.map((r) => ({
        attempt_id: at.id, question_id: r.id, answer: String(answers[r.id] ?? ""),
        is_correct: r.is_correct, score: r.score, feedback: r.feedback,
      })) as never,
      { onConflict: "attempt_id,question_id" },
    );
    await db.from("exam_attempts").update({
      status: "submitted", submitted_at: new Date().toISOString(), time_spent_seconds: spent,
      score: res.total, max_score: res.max, percentage: res.percentage, analysis: res.analysis,
      strengths: res.strengths, weaknesses: res.weaknesses, remedial_plan: res.remedial_plan,
    } as never).eq("id", at.id);

    return { total: res.total, max: res.max, percentage: res.percentage };
  });
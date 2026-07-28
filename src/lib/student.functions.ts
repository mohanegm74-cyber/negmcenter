import { createServerFn } from "@tanstack/react-start";

/** تسجيل طالب جديد - إصلاح شامل للربط مع المجموعات وقاعدة البيانات */
export const registerStudent = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => d as Record<string, string>)
  .handler(async ({ data }) => {
    const { admin, str } = await import("./student.server");
    const db = admin; // استخدام الكائن البروكسي مباشرة

    const FIELDS = [
      "full_name", "phone", "parent_phone", "gender", "birth_date", "national_id",
      "address", "governorate", "education_dept", "school", "grade", "section",
      "subject", "teacher_name", "notes", "group_id"
    ];
    
    const payload: Record<string, any> = {};
    for (const k of FIELDS) {
      const v = str(data?.[k], k === "notes" || k === "address" ? 1000 : 120);
      if (v) payload[k] = v;
    }
    
    if (!payload.full_name) throw new Error("الاسم مطلوب");
    if (payload.group_id === "") payload.group_id = null;

    // التحقق من التكرار
    const orParts: string[] = [];
    if (payload.parent_phone) orParts.push(`parent_phone.eq.${payload.parent_phone}`);
    if (payload.national_id) orParts.push(`national_id.eq.${payload.national_id}`);
    
    if (orParts.length) {
      const { data: dups } = await db.from("students").select("id").or(orParts.join(",")).limit(1);
      if (dups && dups.length) {
        throw new Error("هذا الطالب مسجَّل بالفعل (رقم هاتف ولي الأمر أو الرقم القومي موجود مسبقاً).");
      }
    }

    const { data: row, error } = await db.from("students").insert(payload as any).select("code, full_name").single();
    if (error) throw new Error(`فشل الحفظ: ${error.message}`);
    
    return { code: row.code as string, full_name: row.full_name as string };
  });

/** جلب المجموعات المتاحة للتسجيل العام */
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

    const [a, hs, p, n, q, g, hw] = await Promise.all([
      db.from("attendance").select("id,date,status").eq("student_id", student.id).order("date", { ascending: false }).limit(100),
      db.from("homework_submissions").select("*").eq("student_id", student.id),
      db.from("payments").select("*").eq("student_id", student.id).order("paid_at", { ascending: false }),
      db.from("student_notes").select("*").eq("student_id", student.id).order("created_at", { ascending: false }),
      db.from("questions").select("*").eq("student_id", student.id).order("created_at", { ascending: false }),
      student.group_id ? db.from("groups").select("*").eq("id", student.group_id).maybeSingle() : Promise.resolve({ data: null }),
      student.group_id ? db.from("homework").select("*").eq("group_id", student.group_id).order("created_at", { ascending: false }) : db.from("homework").select("*").is("group_id", null),
    ]);

    return { student, group: g.data, attendance: a.data || [], subs: hs.data || [], payments: p.data || [], notes: n.data || [], questions: q.data || [], homework: hw.data || [] };
  });

export const updateStudentProfile = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => d as { code: string; fields: Record<string, string> })
  .handler(async ({ data }) => {
    const { requireStudent, str } = await import("./student.server");
    const { db, student } = await requireStudent(data.code);
    const upd: any = {};
    for (const [k, v] of Object.entries(data.fields)) {
      if (["full_name", "phone", "parent_phone", "address", "school", "section"].includes(k)) upd[k] = str(v);
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
    const body = str(data.body, 2000);
    if (!body) throw new Error("السؤال فارغ");
    const { error } = await db.from("questions").insert({ student_id: student.id, body });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const submitHomeworkText = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => d as { code: string; homework_id: string; answer_text: string })
  .handler(async ({ data }) => {
    const { requireStudent, str } = await import("./student.server");
    const { db, student } = await requireStudent(data.code);
    const { error } = await db.from("homework_submissions").upsert({ student_id: student.id, homework_id: data.homework_id, answer_text: str(data.answer_text, 5000), status: "submitted", submitted_at: new Date().toISOString() }, { onConflict: "student_id,homework_id" });
    if (error) throw new Error(error.message);
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
    const { error } = await db.from("homework_submissions").upsert({ student_id: student.id, homework_id: data.homework_id, file_url: data.path, status: "submitted", submitted_at: new Date().toISOString() }, { onConflict: "student_id,homework_id" });
    if (error) throw new Error(error.message);
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
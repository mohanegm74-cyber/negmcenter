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

    const db = admin; // استخدام الكائن مباشرة وليس كدالة
    
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
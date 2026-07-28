import { createServerFn } from "@tanstack/react-start";

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

    const orParts: string[] = [];
    if (payload.parent_phone) orParts.push(`parent_phone.eq.${payload.parent_phone}`);
    if (payload.national_id) orParts.push(`national_id.eq.${payload.national_id}`);
    
    if (orParts.length) {
      const { data: dups } = await db.from("students").select("id").or(orParts.join(",")).limit(1);
      if (dups && dups.length) {
        throw new Error("هذا الطالب مسجَّل بالفعل بكود مختلف.");
      }
    }

    const { data: row, error } = await db.from("students").insert(payload as never).select("code, full_name").single();
    if (error) throw new Error(`فشل الحفظ: ${error.message}`);
    
    return { code: row.code as string, full_name: row.full_name as string };
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
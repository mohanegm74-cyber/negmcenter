import { createServerFn } from "@tanstack/react-start";

/** فحص صلاحية الأستاذ بشكل مباشر من جدول الرتب */
export const verifyTeacherStatus = createServerFn({ method: "GET" })
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin;
    const { data: { user } } = await db.auth.getUser();
    if (!user) return { isTeacher: false };
    
    const { data } = await db.from("user_roles").select("role").eq("user_id", user.id).maybeSingle();
    const isTeacher = data?.role === "teacher" || data?.role === "admin";
    
    if (!data) {
      await db.from("user_roles").insert({ user_id: user.id, role: "teacher" });
      return { isTeacher: true };
    }
    
    return { isTeacher };
  });

/** جلب الإحصائيات مع ضمان الربط الصحيح بين الجداول */
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

export const getAllStudentsAdmin = createServerFn({ method: "GET" })
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.from("students").select("*").order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { students: data || [] };
  });

export const getGroupsAdmin = createServerFn({ method: "GET" })
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.from("groups").select("*").order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { groups: data || [] };
  });

export const saveGroup = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => d as { id?: string; payload: any })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin;
    if (data.id) {
      const { error } = await db.from("groups").update(data.payload).eq("id", data.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await db.from("groups").insert(data.payload);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const deleteGroup = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => d as { id: string })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("groups").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
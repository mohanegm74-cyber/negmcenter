import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/** حفظ أو تحديث مجموعة - يتخطى قيود RLS */
export const saveGroup = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => d as { id?: string; payload: any })
  .handler(async ({ data }) => {
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

/** حذف مجموعة */
export const deleteGroup = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => d as { id: string })
  .handler(async ({ data }) => {
    const { error } = await supabaseAdmin.from("groups").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** جلب كافة الطلاب للمعلم - يضمن الظهور حتى لو فشل RLS */
export const getAllStudentsAdmin = createServerFn({ method: "GET" })
  .handler(async () => {
    const { data, error } = await supabaseAdmin.from("students").select("*").order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { students: data || [] };
  });
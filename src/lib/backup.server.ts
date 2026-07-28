/** Server-only helpers for full database backup & restore (teacher only). */
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const admin = supabaseAdmin;

/** الترتيب مهم: الجداول الأساسية أولاً لضمان عدم حدوث أخطاء في المفاتيح الخارجية */
export const BACKUP_TABLES = [
  "groups",
  "students",
  "attendance",
  "payments",
  "homework",
  "homework_submissions",
  "student_notes",
  "questions",
  "exams",
  "exam_questions",
  "exam_attempts",
  "exam_answers",
] as const;

export type BackupTable = (typeof BACKUP_TABLES)[number];

export type BackupFile = {
  app: "negm-center";
  version: 1;
  created_at: string;
  tables: Partial<Record<BackupTable, any[]>>;
};

export async function dumpAll(): Promise<BackupFile> {
  const db = admin;
  const tables: Partial<Record<BackupTable, any[]>> = {};
  for (const t of BACKUP_TABLES) {
    const { data, error } = await db.from(t as any).select("*").limit(50000);
    if (error) throw new Error(`فشل قراءة جدول ${t}: ${error.message}`);
    tables[t] = (data as any[]) || [];
  }
  return { app: "negm-center", version: 1, created_at: new Date().toISOString(), tables };
}

export async function restoreAll(file: any, mode: "merge" | "replace") {
  if (!file || typeof file !== "object" || !file.tables) throw new Error("ملف النسخة الاحتياطية غير صالح");
  const db = admin;
  const result: Record<string, number> = {};

  if (mode === "replace") {
    for (const t of [...BACKUP_TABLES].reverse()) {
      const { error } = await db.from(t as any).delete().not("id", "is", null);
      if (error) throw new Error(`فشل حذف ${t}: ${error.message}`);
    }
  }

  for (const t of BACKUP_TABLES) {
    const rows = file.tables[t];
    if (!Array.isArray(rows) || rows.length === 0) { result[t] = 0; continue; }
    for (let i = 0; i < rows.length; i += 500) {
      const chunk = rows.slice(i, i + 500);
      const { error } = await db.from(t as any).upsert(chunk as any, { onConflict: "id" });
      if (error) throw new Error(`فشل استرجاع ${t}: ${error.message}`);
    }
    result[t] = rows.length;
  }
  return result;
}
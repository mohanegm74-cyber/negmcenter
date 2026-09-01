ALTER TABLE public.homework_submissions ADD COLUMN IF NOT EXISTS level text;
ALTER TABLE public.homework_submissions ADD COLUMN IF NOT EXISTS file_urls jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE TABLE IF NOT EXISTS public.student_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  group_id uuid REFERENCES public.groups(id) ON DELETE SET NULL,
  date date NOT NULL DEFAULT CURRENT_DATE,
  exam_level text,
  recitation_level text,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_records TO authenticated;
GRANT ALL ON public.student_records TO service_role;

ALTER TABLE public.student_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY student_records_teacher_select ON public.student_records FOR SELECT TO authenticated USING (public.is_teacher());
CREATE POLICY student_records_teacher_insert ON public.student_records FOR INSERT TO authenticated WITH CHECK (public.is_teacher());
CREATE POLICY student_records_teacher_update ON public.student_records FOR UPDATE TO authenticated USING (public.is_teacher()) WITH CHECK (public.is_teacher());
CREATE POLICY student_records_teacher_delete ON public.student_records FOR DELETE TO authenticated USING (public.is_teacher());

CREATE INDEX IF NOT EXISTS student_records_student_idx ON public.student_records(student_id);
CREATE INDEX IF NOT EXISTS student_records_group_date_idx ON public.student_records(group_id, date);
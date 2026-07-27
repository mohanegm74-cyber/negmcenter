-- 1) Roles
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('teacher', 'admin');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_roles self read" ON public.user_roles;
CREATE POLICY "user_roles self read" ON public.user_roles
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.is_teacher()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(auth.uid(), 'teacher');
$$;

-- Only the very first account can claim the teacher role.
CREATE OR REPLACE FUNCTION public.claim_teacher_role()
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE existing int;
BEGIN
  IF auth.uid() IS NULL THEN RETURN false; END IF;
  SELECT count(*) INTO existing FROM public.user_roles WHERE role = 'teacher';
  IF existing = 0 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (auth.uid(), 'teacher')
    ON CONFLICT DO NOTHING;
    RETURN true;
  END IF;
  RETURN public.has_role(auth.uid(), 'teacher');
END $$;

GRANT EXECUTE ON FUNCTION public.claim_teacher_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_teacher() TO authenticated;

-- Existing signed-up users keep working as teachers.
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'teacher' FROM auth.users
ON CONFLICT DO NOTHING;

-- 2) Drop all existing permissive policies
DROP POLICY IF EXISTS "attendance auth all" ON public.attendance;
DROP POLICY IF EXISTS "attendance public read" ON public.attendance;
DROP POLICY IF EXISTS "exam_answers delete auth" ON public.exam_answers;
DROP POLICY IF EXISTS "exam_answers insert all" ON public.exam_answers;
DROP POLICY IF EXISTS "exam_answers read all" ON public.exam_answers;
DROP POLICY IF EXISTS "exam_answers update all" ON public.exam_answers;
DROP POLICY IF EXISTS "exam_attempts delete auth" ON public.exam_attempts;
DROP POLICY IF EXISTS "exam_attempts insert all" ON public.exam_attempts;
DROP POLICY IF EXISTS "exam_attempts read all" ON public.exam_attempts;
DROP POLICY IF EXISTS "exam_attempts update all" ON public.exam_attempts;
DROP POLICY IF EXISTS "exam_questions read all" ON public.exam_questions;
DROP POLICY IF EXISTS "exam_questions write auth" ON public.exam_questions;
DROP POLICY IF EXISTS "exams read all" ON public.exams;
DROP POLICY IF EXISTS "exams write auth" ON public.exams;
DROP POLICY IF EXISTS "groups read all" ON public.groups;
DROP POLICY IF EXISTS "groups write auth" ON public.groups;
DROP POLICY IF EXISTS "homework auth write" ON public.homework;
DROP POLICY IF EXISTS "homework read all" ON public.homework;
DROP POLICY IF EXISTS "hw_sub auth write" ON public.homework_submissions;
DROP POLICY IF EXISTS "hw_sub read all" ON public.homework_submissions;
DROP POLICY IF EXISTS "payments auth write" ON public.payments;
DROP POLICY IF EXISTS "payments read all" ON public.payments;
DROP POLICY IF EXISTS "q read all" ON public.questions;
DROP POLICY IF EXISTS "q write all" ON public.questions;
DROP POLICY IF EXISTS "notes read all" ON public.student_notes;
DROP POLICY IF EXISTS "notes write all" ON public.student_notes;
DROP POLICY IF EXISTS "students auth all" ON public.students;
DROP POLICY IF EXISTS "students public insert" ON public.students;
DROP POLICY IF EXISTS "students public read" ON public.students;

-- 3) Teacher-only policies
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['attendance','exam_answers','exam_attempts','exam_questions','exams','groups','homework','homework_submissions','payments','questions','student_notes','students']
  LOOP
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (public.is_teacher())', t || '_teacher_select', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (public.is_teacher())', t || '_teacher_insert', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (public.is_teacher()) WITH CHECK (public.is_teacher())', t || '_teacher_update', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (public.is_teacher())', t || '_teacher_delete', t);
  END LOOP;
END $$;

-- 4) Storage: submissions bucket is teacher-only; students use short-lived signed URLs issued server-side
DO $$
DECLARE p record;
BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects'
           AND (qual ILIKE '%submissions%' OR with_check ILIKE '%submissions%')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', p.policyname);
  END LOOP;
END $$;

CREATE POLICY "submissions teacher read" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'submissions' AND public.is_teacher());
CREATE POLICY "submissions teacher write" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'submissions' AND public.is_teacher());
CREATE POLICY "submissions teacher update" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'submissions' AND public.is_teacher())
  WITH CHECK (bucket_id = 'submissions' AND public.is_teacher());
CREATE POLICY "submissions teacher delete" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'submissions' AND public.is_teacher());
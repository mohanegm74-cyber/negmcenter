
-- Teacher notes about a student (visible to parent via portal)
CREATE TABLE IF NOT EXISTS public.student_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL,
  title TEXT,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_notes TO anon, authenticated;
GRANT ALL ON public.student_notes TO service_role;
ALTER TABLE public.student_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notes read all" ON public.student_notes FOR SELECT USING (true);
CREATE POLICY "notes write all" ON public.student_notes FOR ALL USING (true) WITH CHECK (true);

-- Student questions to teacher
CREATE TABLE IF NOT EXISTS public.questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL,
  body TEXT NOT NULL,
  answer TEXT,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  answered_at TIMESTAMPTZ
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.questions TO anon, authenticated;
GRANT ALL ON public.questions TO service_role;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "q read all" ON public.questions FOR SELECT USING (true);
CREATE POLICY "q write all" ON public.questions FOR ALL USING (true) WITH CHECK (true);

-- Homework submission file
ALTER TABLE public.homework_submissions
  ADD COLUMN IF NOT EXISTS file_url TEXT;

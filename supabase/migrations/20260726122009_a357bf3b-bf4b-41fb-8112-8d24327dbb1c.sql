CREATE TABLE public.exams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  grade text,
  term text,
  group_id uuid REFERENCES public.groups(id) ON DELETE SET NULL,
  subject text,
  unit text,
  lesson text,
  question_count integer NOT NULL DEFAULT 10,
  duration_minutes integer NOT NULL DEFAULT 20,
  total_score numeric NOT NULL DEFAULT 100,
  difficulty text NOT NULL DEFAULT 'medium',
  question_types text[] NOT NULL DEFAULT ARRAY['mcq']::text[],
  adaptive boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'draft',
  sources jsonb NOT NULL DEFAULT '[]'::jsonb,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.exams TO authenticated;
GRANT SELECT ON public.exams TO anon;
GRANT ALL ON public.exams TO service_role;
ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;
CREATE POLICY "exams read all" ON public.exams FOR SELECT USING (true);
CREATE POLICY "exams write auth" ON public.exams FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.exam_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id uuid NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
  position integer NOT NULL DEFAULT 1,
  kind text NOT NULL DEFAULT 'mcq',
  prompt text NOT NULL,
  passage text,
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  correct_answer jsonb,
  rationale text,
  distractor_explanations jsonb NOT NULL DEFAULT '[]'::jsonb,
  skill text,
  learning_outcome text,
  difficulty text NOT NULL DEFAULT 'medium',
  expected_seconds integer NOT NULL DEFAULT 60,
  score numeric NOT NULL DEFAULT 1,
  source_ref text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.exam_questions TO authenticated;
GRANT SELECT ON public.exam_questions TO anon;
GRANT ALL ON public.exam_questions TO service_role;
ALTER TABLE public.exam_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "exam_questions read all" ON public.exam_questions FOR SELECT USING (true);
CREATE POLICY "exam_questions write auth" ON public.exam_questions FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.exam_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id uuid NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  attempt_no integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'in_progress',
  started_at timestamptz NOT NULL DEFAULT now(),
  submitted_at timestamptz,
  time_spent_seconds integer NOT NULL DEFAULT 0,
  score numeric NOT NULL DEFAULT 0,
  max_score numeric NOT NULL DEFAULT 0,
  percentage numeric NOT NULL DEFAULT 0,
  analysis text,
  strengths jsonb NOT NULL DEFAULT '[]'::jsonb,
  weaknesses jsonb NOT NULL DEFAULT '[]'::jsonb,
  remedial_plan text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.exam_attempts TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.exam_attempts TO anon;
GRANT ALL ON public.exam_attempts TO service_role;
ALTER TABLE public.exam_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "exam_attempts read all" ON public.exam_attempts FOR SELECT USING (true);
CREATE POLICY "exam_attempts insert all" ON public.exam_attempts FOR INSERT WITH CHECK (true);
CREATE POLICY "exam_attempts update all" ON public.exam_attempts FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "exam_attempts delete auth" ON public.exam_attempts FOR DELETE TO authenticated USING (true);

CREATE TABLE public.exam_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id uuid NOT NULL REFERENCES public.exam_attempts(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES public.exam_questions(id) ON DELETE CASCADE,
  answer jsonb,
  is_correct boolean,
  score numeric NOT NULL DEFAULT 0,
  feedback text,
  time_spent_seconds integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (attempt_id, question_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.exam_answers TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.exam_answers TO anon;
GRANT ALL ON public.exam_answers TO service_role;
ALTER TABLE public.exam_answers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "exam_answers read all" ON public.exam_answers FOR SELECT USING (true);
CREATE POLICY "exam_answers insert all" ON public.exam_answers FOR INSERT WITH CHECK (true);
CREATE POLICY "exam_answers update all" ON public.exam_answers FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "exam_answers delete auth" ON public.exam_answers FOR DELETE TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql SET search_path = public;
CREATE TRIGGER update_exams_updated_at BEFORE UPDATE ON public.exams
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_exam_questions_exam ON public.exam_questions(exam_id);
CREATE INDEX idx_exam_attempts_exam ON public.exam_attempts(exam_id);
CREATE INDEX idx_exam_attempts_student ON public.exam_attempts(student_id);
CREATE INDEX idx_exam_answers_attempt ON public.exam_answers(attempt_id);
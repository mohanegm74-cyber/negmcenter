
-- Add monthly fee to groups
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS monthly_fee numeric NOT NULL DEFAULT 0;

-- Payments table
CREATE TABLE IF NOT EXISTS public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  group_id uuid REFERENCES public.groups(id) ON DELETE SET NULL,
  amount numeric NOT NULL DEFAULT 0,
  kind text NOT NULL DEFAULT 'payment', -- 'payment' | 'charge'
  method text,
  note text,
  paid_at date NOT NULL DEFAULT CURRENT_DATE,
  month text, -- e.g. '2026-07'
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payments TO authenticated;
GRANT SELECT ON public.payments TO anon;
GRANT ALL ON public.payments TO service_role;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "payments read all" ON public.payments FOR SELECT USING (true);
CREATE POLICY "payments auth write" ON public.payments FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Homework table
CREATE TABLE IF NOT EXISTS public.homework (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid REFERENCES public.groups(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  due_date date,
  max_score numeric DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.homework TO authenticated;
GRANT SELECT ON public.homework TO anon;
GRANT ALL ON public.homework TO service_role;
ALTER TABLE public.homework ENABLE ROW LEVEL SECURITY;
CREATE POLICY "homework read all" ON public.homework FOR SELECT USING (true);
CREATE POLICY "homework auth write" ON public.homework FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Homework submissions
CREATE TABLE IF NOT EXISTS public.homework_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  homework_id uuid NOT NULL REFERENCES public.homework(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  score numeric,
  status text NOT NULL DEFAULT 'pending', -- pending|submitted|graded|missing
  note text,
  submitted_at timestamptz DEFAULT now(),
  UNIQUE (homework_id, student_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.homework_submissions TO authenticated;
GRANT SELECT ON public.homework_submissions TO anon;
GRANT ALL ON public.homework_submissions TO service_role;
ALTER TABLE public.homework_submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hw_sub read all" ON public.homework_submissions FOR SELECT USING (true);
CREATE POLICY "hw_sub auth write" ON public.homework_submissions FOR ALL TO authenticated USING (true) WITH CHECK (true);

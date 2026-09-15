CREATE TABLE public.lessons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grade text,
  group_id uuid REFERENCES public.groups(id) ON DELETE SET NULL,
  subject text,
  title text NOT NULL,
  date date NOT NULL DEFAULT CURRENT_DATE,
  paths jsonb NOT NULL DEFAULT '[]'::jsonb,
  explanation text,
  vocabulary text,
  qa text,
  beauty text,
  rhetoric text,
  grammar text,
  exercises text,
  ai_status text NOT NULL DEFAULT 'none',
  ai_raw jsonb,
  published boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lessons TO authenticated;
GRANT ALL ON public.lessons TO service_role;

ALTER TABLE public.lessons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers manage lessons" ON public.lessons
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'teacher') OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'teacher') OR public.has_role(auth.uid(), 'admin'));
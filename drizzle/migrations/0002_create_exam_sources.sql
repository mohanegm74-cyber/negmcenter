CREATE TABLE public.exam_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  grade text,
  subject text,
  lesson text,
  path text NOT NULL,
  mime text,
  extracted_text text,
  status text NOT NULL DEFAULT 'pending',
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.exam_sources TO authenticated;
GRANT ALL ON public.exam_sources TO service_role;
ALTER TABLE public.exam_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Teachers manage exam sources" ON public.exam_sources FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'teacher') OR public.has_role(auth.uid(),'admin'))
WITH CHECK (public.has_role(auth.uid(),'teacher') OR public.has_role(auth.uid(),'admin'));
CREATE INDEX exam_sources_filter_idx ON public.exam_sources (grade, subject);
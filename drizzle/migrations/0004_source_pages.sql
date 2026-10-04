ALTER TABLE public.exam_sources ADD COLUMN IF NOT EXISTS parts jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.exam_sources ADD COLUMN IF NOT EXISTS page_count integer NOT NULL DEFAULT 0;
ALTER TABLE public.exam_sources ADD COLUMN IF NOT EXISTS size_bytes bigint;

CREATE TABLE public.exam_source_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid NOT NULL REFERENCES public.exam_sources(id) ON DELETE CASCADE,
  page_no integer NOT NULL,
  text text NOT NULL DEFAULT '',
  ocr boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_id, page_no)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.exam_source_pages TO authenticated;
GRANT ALL ON public.exam_source_pages TO service_role;
ALTER TABLE public.exam_source_pages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Teachers manage source pages" ON public.exam_source_pages FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'teacher') OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'teacher') OR public.has_role(auth.uid(), 'admin'));
CREATE INDEX exam_source_pages_source_idx ON public.exam_source_pages(source_id, page_no);
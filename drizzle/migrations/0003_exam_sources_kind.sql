ALTER TABLE public.exam_sources ADD COLUMN kind text NOT NULL DEFAULT 'source';
ALTER TABLE public.exam_sources ADD COLUMN spec jsonb;
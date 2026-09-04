ALTER TABLE public.homework_submissions
  ADD COLUMN IF NOT EXISTS level text;

ALTER TABLE public.homework_submissions
  ADD COLUMN IF NOT EXISTS file_urls jsonb NOT NULL DEFAULT '[]'::jsonb;
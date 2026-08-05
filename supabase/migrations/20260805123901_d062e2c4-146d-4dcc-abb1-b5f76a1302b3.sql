ALTER TABLE public.homework
  ADD COLUMN IF NOT EXISTS grade text,
  ADD COLUMN IF NOT EXISTS model_solution text,
  ADD COLUMN IF NOT EXISTS results_released boolean NOT NULL DEFAULT false;
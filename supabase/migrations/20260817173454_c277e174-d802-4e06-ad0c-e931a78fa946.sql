CREATE TABLE public.board_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid REFERENCES public.groups(id) ON DELETE SET NULL,
  grade text,
  date date NOT NULL DEFAULT CURRENT_DATE,
  title text,
  paths jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.board_images TO authenticated;
GRANT ALL ON public.board_images TO service_role;
ALTER TABLE public.board_images ENABLE ROW LEVEL SECURITY;
CREATE POLICY board_images_teacher_select ON public.board_images FOR SELECT TO authenticated USING (public.is_teacher());
CREATE POLICY board_images_teacher_insert ON public.board_images FOR INSERT TO authenticated WITH CHECK (public.is_teacher());
CREATE POLICY board_images_teacher_update ON public.board_images FOR UPDATE TO authenticated USING (public.is_teacher()) WITH CHECK (public.is_teacher());
CREATE POLICY board_images_teacher_delete ON public.board_images FOR DELETE TO authenticated USING (public.is_teacher());
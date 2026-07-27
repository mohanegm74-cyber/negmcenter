REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_teacher() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_teacher_role() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_teacher_role() TO authenticated;
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
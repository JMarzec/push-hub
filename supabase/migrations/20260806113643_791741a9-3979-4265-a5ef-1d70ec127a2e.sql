REVOKE EXECUTE ON FUNCTION public.is_team_member(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.join_team_by_code(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.team_today_stats(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.team_preview_by_code(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.is_team_member(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.join_team_by_code(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.team_today_stats(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.team_preview_by_code(text) TO anon, authenticated;
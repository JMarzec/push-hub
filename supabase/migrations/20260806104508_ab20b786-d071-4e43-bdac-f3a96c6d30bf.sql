CREATE OR REPLACE FUNCTION public.team_today_stats(_team_id uuid)
RETURNS TABLE (
  user_id uuid,
  display_name text,
  role text,
  reps_today integer,
  daily_target integer,
  reps_week integer,
  reps_total integer
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_team_member(_team_id, auth.uid()) THEN
    RAISE EXCEPTION 'Not a member of this team';
  END IF;

  RETURN QUERY
  SELECT
    m.user_id,
    COALESCE(NULLIF(p.display_name, ''), 'Member') AS display_name,
    m.role,
    COALESCE((SELECT sum(l.reps)::int FROM public.pushup_logs l
              WHERE l.user_id = m.user_id AND l.log_date = CURRENT_DATE), 0),
    COALESCE(s.daily_target, 50),
    COALESCE((SELECT sum(l.reps)::int FROM public.pushup_logs l
              WHERE l.user_id = m.user_id AND l.log_date > CURRENT_DATE - 7), 0),
    COALESCE((SELECT sum(l.reps)::int FROM public.pushup_logs l
              WHERE l.user_id = m.user_id), 0)
  FROM public.team_members m
  LEFT JOIN public.profiles p ON p.id = m.user_id
  LEFT JOIN public.user_settings s ON s.user_id = m.user_id
  WHERE m.team_id = _team_id
  ORDER BY 4 DESC;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.team_today_stats(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.team_today_stats(uuid) TO authenticated;
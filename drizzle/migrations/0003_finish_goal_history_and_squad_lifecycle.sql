ALTER TABLE public.daily_goals ADD COLUMN history_basis text NOT NULL DEFAULT 'preserved';
COMMENT ON COLUMN public.daily_goals.history_basis IS 'pretracking_fallback records reconstructed settings, not verified historical targets';
CREATE OR REPLACE FUNCTION public.capture_daily_goals(p_user uuid,p_until date) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE last_date date;
BEGIN
 SELECT max(goal_date) INTO last_date FROM daily_goals WHERE user_id=p_user;
 INSERT INTO daily_goals(user_id,goal_date,daily_target,frequency,rest_day_of_week)
 SELECT s.user_id,d::date,coalesce(case when m.follow_shared_target then t.shared_target end,p.daily_target,s.daily_target),coalesce(case when m.follow_shared_target then t.shared_frequency end,p.frequency,s.frequency),s.rest_day_of_week
 FROM user_settings s CROSS JOIN LATERAL generate_series(greatest(s.start_date,coalesce(last_date+1,s.start_date))::timestamp,p_until::timestamp,interval '1 day') d
 LEFT JOIN LATERAL (SELECT * FROM team_members WHERE user_id=s.user_id ORDER BY created_at DESC,id LIMIT 1) m ON true LEFT JOIN teams t ON t.id=m.team_id
 LEFT JOIN LATERAL (SELECT daily_target,frequency FROM target_plans WHERE user_id=s.user_id AND applied_at IS NULL AND effective_date<=d::date ORDER BY effective_date DESC,id DESC LIMIT 1) p ON true
 WHERE s.user_id=p_user ON CONFLICT(user_id,goal_date) DO NOTHING;
END; $$;
CREATE OR REPLACE FUNCTION public.refresh_squad_daily_goals(p_team uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE u uuid; BEGIN FOR u IN SELECT user_id FROM team_members WHERE team_id=p_team LOOP PERFORM capture_daily_goals(u,(now() AT TIME ZONE 'UTC')::date-1); END LOOP; END; $$;
REVOKE ALL ON FUNCTION public.refresh_squad_daily_goals(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_squad_daily_goals(uuid) TO service_role;
CREATE OR REPLACE FUNCTION public.create_squad(p_name text,p_code text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE u uuid:=auth.uid(); tid uuid:=gen_random_uuid(); BEGIN
 IF u IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
 IF length(trim(p_name)) NOT BETWEEN 1 AND 40 OR p_code !~ '^[A-Z2-9]{6}$' THEN RAISE EXCEPTION 'Invalid squad details'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(u::text,0));
 IF EXISTS(SELECT 1 FROM teams WHERE owner_id=u) THEN RAISE EXCEPTION 'Leave your owned squad before creating another'; END IF;
 DELETE FROM team_members WHERE user_id=u;
 INSERT INTO teams(id,name,invite_code,owner_id) VALUES(tid,trim(p_name),p_code,u);
 INSERT INTO team_members(team_id,user_id,role) VALUES(tid,u,'owner'); RETURN tid;
 END; $$;
REVOKE ALL ON FUNCTION public.create_squad(text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.create_squad(text,text) TO authenticated,service_role;
CREATE OR REPLACE FUNCTION public.leave_squad(p_team uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE u uuid:=auth.uid(); successor uuid; BEGIN
 IF u IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(u::text,0));
 PERFORM 1 FROM teams WHERE id=p_team FOR UPDATE;
 IF NOT EXISTS(SELECT 1 FROM team_members WHERE team_id=p_team AND user_id=u) THEN RAISE EXCEPTION 'You are not in this squad'; END IF;
 IF EXISTS(SELECT 1 FROM teams WHERE id=p_team AND owner_id=u) THEN
 SELECT user_id INTO successor FROM team_members WHERE team_id=p_team AND user_id<>u ORDER BY created_at,id LIMIT 1;
 IF successor IS NULL THEN DELETE FROM teams WHERE id=p_team AND owner_id=u; RETURN; END IF;
 UPDATE teams SET owner_id=successor WHERE id=p_team; UPDATE team_members SET role='owner' WHERE team_id=p_team AND user_id=successor;
 END IF;
 DELETE FROM team_members WHERE team_id=p_team AND user_id=u;
 END; $$;
REVOKE ALL ON FUNCTION public.leave_squad(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.leave_squad(uuid) TO authenticated,service_role;
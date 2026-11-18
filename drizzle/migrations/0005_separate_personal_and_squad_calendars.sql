CREATE OR REPLACE FUNCTION public.personal_calendar_day(p_user uuid) RETURNS date LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT (now() AT TIME ZONE coalesce((SELECT timezone FROM user_settings WHERE user_id=p_user),'UTC'))::date; $$;
REVOKE ALL ON FUNCTION public.personal_calendar_day(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.personal_calendar_day(uuid) TO service_role;
CREATE OR REPLACE FUNCTION public.sync_personal_calendar(p_timezone text DEFAULT NULL) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE u uuid:=auth.uid(); tz text; BEGIN
IF u IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
IF p_timezone IS NOT NULL AND NOT EXISTS(SELECT 1 FROM pg_timezone_names WHERE name=p_timezone) THEN RAISE EXCEPTION 'Invalid timezone'; END IF;
PERFORM pg_advisory_xact_lock(hashtextextended(u::text,0));
SELECT timezone INTO tz FROM user_settings WHERE user_id=u;
IF p_timezone IS NOT NULL AND tz IS DISTINCT FROM p_timezone THEN
IF tz IS NOT NULL THEN PERFORM capture_daily_goals(u,personal_calendar_day(u)-1); END IF;
UPDATE user_settings SET timezone=p_timezone WHERE user_id=u;
END IF;
RETURN coalesce(p_timezone,tz,'UTC'); END; $$;
REVOKE ALL ON FUNCTION public.sync_personal_calendar(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.sync_personal_calendar(text) TO authenticated,service_role;
CREATE TABLE public.squad_daily_goals(user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE, goal_date date NOT NULL, daily_target integer NOT NULL, rest_day_of_week smallint, history_basis text NOT NULL DEFAULT 'preserved', PRIMARY KEY(user_id,goal_date));
GRANT SELECT ON public.squad_daily_goals TO authenticated;
GRANT ALL ON public.squad_daily_goals TO service_role;
ALTER TABLE public.squad_daily_goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read own UTC goals" ON public.squad_daily_goals FOR SELECT TO authenticated USING(user_id=auth.uid());
INSERT INTO public.squad_daily_goals(user_id,goal_date,daily_target,rest_day_of_week,history_basis) SELECT user_id,goal_date,daily_target,rest_day_of_week,history_basis FROM public.daily_goals ON CONFLICT DO NOTHING;
CREATE OR REPLACE FUNCTION public.capture_squad_goals(p_user uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE last_date date; BEGIN
SELECT max(goal_date) INTO last_date FROM squad_daily_goals WHERE user_id=p_user;
INSERT INTO squad_daily_goals(user_id,goal_date,daily_target,rest_day_of_week)
SELECT s.user_id,d::date,coalesce(CASE WHEN m.follow_shared_target THEN t.shared_target END,p.daily_target,s.daily_target),s.rest_day_of_week
FROM user_settings s CROSS JOIN LATERAL generate_series(greatest(s.start_date,coalesce(last_date+1,s.start_date))::timestamp,((now() AT TIME ZONE 'UTC')::date-1)::timestamp,interval '1 day') d
LEFT JOIN LATERAL(SELECT * FROM team_members WHERE user_id=s.user_id ORDER BY created_at DESC,id LIMIT 1) m ON true LEFT JOIN teams t ON t.id=m.team_id
LEFT JOIN LATERAL(SELECT daily_target FROM target_plans WHERE user_id=s.user_id AND applied_at IS NULL AND effective_date<=d::date ORDER BY effective_date DESC,id DESC LIMIT 1) p ON true
WHERE s.user_id=p_user ON CONFLICT DO NOTHING; END; $$;
REVOKE ALL ON FUNCTION public.capture_squad_goals(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.capture_squad_goals(uuid) TO service_role;
CREATE OR REPLACE FUNCTION public.preserve_goal_history() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE u uuid; BEGIN
IF TG_TABLE_NAME='teams' THEN FOR u IN SELECT user_id FROM team_members WHERE team_id=OLD.id LOOP PERFORM capture_daily_goals(u,personal_calendar_day(u)-1); PERFORM capture_squad_goals(u); END LOOP;
ELSE u:=OLD.user_id; PERFORM capture_daily_goals(u,personal_calendar_day(u)-1); PERFORM capture_squad_goals(u); END IF;
IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW; END; $$;
CREATE OR REPLACE FUNCTION public.refresh_daily_goals() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF; PERFORM capture_daily_goals(auth.uid(),personal_calendar_day(auth.uid())-1); END; $$;
CREATE OR REPLACE FUNCTION public.refresh_squad_daily_goals(p_team uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE u uuid; BEGIN FOR u IN SELECT user_id FROM team_members WHERE team_id=p_team LOOP PERFORM capture_daily_goals(u,personal_calendar_day(u)-1); PERFORM capture_squad_goals(u); END LOOP; END; $$;
CREATE OR REPLACE FUNCTION public.apply_due_goal_plans(p_today date) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE u uuid:=auth.uid(); winner target_plans%rowtype; actual_today date; BEGIN
IF u IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
PERFORM pg_advisory_xact_lock(hashtextextended(u::text,0)); actual_today:=personal_calendar_day(u);
SELECT * INTO winner FROM target_plans WHERE user_id=u AND applied_at IS NULL AND effective_date<=actual_today ORDER BY effective_date DESC,id DESC LIMIT 1;
IF NOT FOUND THEN RETURN NULL; END IF;
PERFORM capture_daily_goals(u,winner.effective_date-1);
UPDATE user_settings SET daily_target=winner.daily_target,frequency=winner.frequency,slot_times=CASE winner.frequency WHEN 1 THEN ARRAY['08:00'] WHEN 2 THEN ARRAY['08:00','18:00'] WHEN 3 THEN ARRAY['08:00','13:00','19:00'] WHEN 4 THEN ARRAY['08:00','12:00','17:00','21:00'] WHEN 6 THEN ARRAY['07:00','10:00','13:00','16:00','19:00','21:30'] ELSE ARRAY(SELECT to_char(time '07:00'+make_interval(mins=>round(i*840.0/(winner.frequency-1))::int),'HH24:MI') FROM generate_series(0,winner.frequency-1) i) END WHERE user_id=u;
UPDATE target_plans SET applied_at=now() WHERE user_id=u AND applied_at IS NULL AND effective_date<=actual_today;
RETURN jsonb_build_object('dailyTarget',winner.daily_target,'frequency',winner.frequency,'effectiveDate',winner.effective_date); END; $$;
CREATE OR REPLACE FUNCTION public.squad_daily_accounting(p_team uuid) RETURNS TABLE(user_id uuid,day date,logged_reps bigint,net_bank bigint,rolling_reps bigint) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
WITH l AS(SELECT l.user_id,(l.logged_at AT TIME ZONE 'UTC')::date AS day,sum(l.reps)::bigint reps,coalesce(sum(l.reps) FILTER(WHERE l.logged_at>=now()-interval '48 hours' AND l.logged_at<=now()),0)::bigint rolling FROM pushup_logs l JOIN team_members m ON m.user_id=l.user_id AND m.team_id=p_team GROUP BY l.user_id,(l.logged_at AT TIME ZONE 'UTC')::date),
b AS(SELECT b.user_id,(b.created_at AT TIME ZONE 'UTC')::date AS day,sum(CASE WHEN b.kind='withdrawal' THEN b.reps ELSE -b.reps END)::bigint net,coalesce(sum(CASE WHEN b.kind='withdrawal' THEN b.reps ELSE -b.reps END) FILTER(WHERE b.created_at>=now()-interval '48 hours' AND b.created_at<=now()),0)::bigint rolling FROM bank_entries b JOIN team_members m ON m.user_id=b.user_id AND m.team_id=p_team GROUP BY b.user_id,(b.created_at AT TIME ZONE 'UTC')::date)
SELECT coalesce(l.user_id,b.user_id),coalesce(l.day,b.day),coalesce(l.reps,0),coalesce(b.net,0),coalesce(l.rolling,0)+coalesce(b.rolling,0) FROM l FULL JOIN b ON l.user_id=b.user_id AND l.day=b.day; $$;
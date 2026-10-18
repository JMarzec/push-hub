CREATE TABLE public.daily_goals (user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE, goal_date date NOT NULL, daily_target integer NOT NULL, frequency integer NOT NULL, rest_day_of_week smallint, PRIMARY KEY(user_id,goal_date));
GRANT SELECT ON public.daily_goals TO authenticated;
GRANT ALL ON public.daily_goals TO service_role;
ALTER TABLE public.daily_goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read own daily goals" ON public.daily_goals FOR SELECT TO authenticated USING (user_id=auth.uid());
CREATE INDEX IF NOT EXISTS pushup_logs_user_date_idx ON public.pushup_logs(user_id,log_date,id);
CREATE INDEX IF NOT EXISTS bank_entries_user_date_idx ON public.bank_entries(user_id,entry_date,id);
CREATE OR REPLACE FUNCTION public.capture_daily_goals(p_user uuid, p_until date) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 INSERT INTO daily_goals(user_id,goal_date,daily_target,frequency,rest_day_of_week)
 SELECT s.user_id, d::date, coalesce(case when m.follow_shared_target then t.shared_target end, p.daily_target,s.daily_target), coalesce(case when m.follow_shared_target then t.shared_frequency end,p.frequency,s.frequency), s.rest_day_of_week
 FROM user_settings s CROSS JOIN LATERAL generate_series(s.start_date::timestamp,p_until::timestamp,interval '1 day') d
 LEFT JOIN LATERAL (SELECT * FROM team_members WHERE user_id=s.user_id ORDER BY created_at DESC,id LIMIT 1) m ON true
 LEFT JOIN teams t ON t.id=m.team_id
 LEFT JOIN LATERAL (SELECT daily_target,frequency FROM target_plans WHERE user_id=s.user_id AND effective_date<=d::date ORDER BY effective_date DESC LIMIT 1) p ON true
 WHERE s.user_id=p_user ON CONFLICT(user_id,goal_date) DO NOTHING;
END; $$;
REVOKE ALL ON FUNCTION public.capture_daily_goals(uuid,date) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.capture_daily_goals(uuid,date) TO service_role;
INSERT INTO public.daily_goals(user_id,goal_date,daily_target,frequency,rest_day_of_week)
SELECT s.user_id,d::date,coalesce(case when m.follow_shared_target then t.shared_target end,p.daily_target,s.daily_target),coalesce(case when m.follow_shared_target then t.shared_frequency end,p.frequency,s.frequency),s.rest_day_of_week
FROM public.user_settings s CROSS JOIN LATERAL generate_series(s.start_date::timestamp,(now() AT TIME ZONE 'UTC')::date::timestamp,interval '1 day') d
LEFT JOIN LATERAL (SELECT * FROM public.team_members WHERE user_id=s.user_id ORDER BY created_at DESC,id LIMIT 1) m ON true LEFT JOIN public.teams t ON t.id=m.team_id
LEFT JOIN LATERAL (SELECT daily_target,frequency FROM public.target_plans WHERE user_id=s.user_id AND effective_date<=d::date ORDER BY effective_date DESC LIMIT 1) p ON true;
CREATE OR REPLACE FUNCTION public.preserve_goal_history() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE u uuid;
BEGIN
 IF TG_TABLE_NAME='teams' THEN
  FOR u IN SELECT user_id FROM team_members WHERE team_id=OLD.id LOOP PERFORM capture_daily_goals(u,(now() AT TIME ZONE 'UTC')::date-1); END LOOP;
 ELSE
  u:=OLD.user_id;
  PERFORM capture_daily_goals(u,(now() AT TIME ZONE 'UTC')::date-1);
 END IF;
 RETURN OLD;
END; $$;
CREATE TRIGGER preserve_settings_goals BEFORE UPDATE OF daily_target,frequency,rest_day_of_week ON public.user_settings FOR EACH ROW EXECUTE FUNCTION public.preserve_goal_history();
CREATE TRIGGER preserve_membership_goals BEFORE UPDATE OR DELETE ON public.team_members FOR EACH ROW EXECUTE FUNCTION public.preserve_goal_history();
CREATE TRIGGER preserve_team_goals BEFORE UPDATE OF shared_target,shared_frequency ON public.teams FOR EACH ROW EXECUTE FUNCTION public.preserve_goal_history();
CREATE OR REPLACE FUNCTION public.lock_rep_account() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended(coalesce(NEW.user_id,OLD.user_id)::text,0));
 IF TG_OP='UPDATE' AND NEW.user_id<>OLD.user_id THEN RAISE EXCEPTION 'Cannot move entries between accounts'; END IF;
 RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END; $$;
CREATE OR REPLACE FUNCTION public.check_rep_account() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE u uuid:=coalesce(NEW.user_id,OLD.user_id); balance bigint; invalid_day date;
BEGIN
 SELECT coalesce(sum(CASE WHEN kind='deposit' THEN reps ELSE -reps END),0) INTO balance FROM bank_entries WHERE user_id=u;
 IF balance<0 THEN RAISE EXCEPTION 'Not enough banked push-ups available'; END IF;
 SELECT b.entry_date INTO invalid_day FROM bank_entries b WHERE b.user_id=u GROUP BY b.entry_date
 HAVING sum(CASE WHEN b.kind='deposit' THEN b.reps ELSE -b.reps END)>(SELECT coalesce(sum(l.reps),0) FROM pushup_logs l WHERE l.user_id=u AND l.log_date=b.entry_date) LIMIT 1;
 IF invalid_day IS NOT NULL THEN RAISE EXCEPTION 'These reps are already banked. Undo the transfer before reducing this day.'; END IF;
 RETURN NULL;
END; $$;
CREATE TRIGGER lock_bank_account BEFORE INSERT OR UPDATE OR DELETE ON public.bank_entries FOR EACH ROW EXECUTE FUNCTION public.lock_rep_account();
CREATE TRIGGER validate_bank_account AFTER INSERT OR UPDATE OR DELETE ON public.bank_entries FOR EACH ROW EXECUTE FUNCTION public.check_rep_account();
CREATE TRIGGER lock_log_account BEFORE INSERT OR UPDATE OR DELETE ON public.pushup_logs FOR EACH ROW EXECUTE FUNCTION public.lock_rep_account();
CREATE TRIGGER validate_log_account AFTER INSERT OR UPDATE OR DELETE ON public.pushup_logs FOR EACH ROW EXECUTE FUNCTION public.check_rep_account();
CREATE OR REPLACE FUNCTION public.apply_due_goal_plans(p_today date) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE u uuid:=auth.uid(); winner target_plans%rowtype;
BEGIN
 IF u IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(u::text,0));
 SELECT * INTO winner FROM target_plans WHERE user_id=u AND applied_at IS NULL AND effective_date<=p_today ORDER BY effective_date DESC,id DESC LIMIT 1;
 IF NOT FOUND THEN RETURN NULL; END IF;
 PERFORM capture_daily_goals(u,winner.effective_date-1);
 UPDATE user_settings SET daily_target=winner.daily_target,frequency=winner.frequency,slot_times=CASE winner.frequency WHEN 1 THEN ARRAY['08:00'] WHEN 2 THEN ARRAY['08:00','18:00'] WHEN 3 THEN ARRAY['08:00','13:00','19:00'] WHEN 4 THEN ARRAY['08:00','12:00','17:00','21:00'] WHEN 6 THEN ARRAY['07:00','10:00','13:00','16:00','19:00','21:30'] ELSE ARRAY(SELECT to_char(time '07:00'+make_interval(mins=>round(i*840.0/(winner.frequency-1))::int),'HH24:MI') FROM generate_series(0,winner.frequency-1) i) END WHERE user_id=u;
 UPDATE target_plans SET applied_at=now() WHERE user_id=u AND applied_at IS NULL AND effective_date<=p_today;
 RETURN jsonb_build_object('dailyTarget',winner.daily_target,'frequency',winner.frequency,'effectiveDate',winner.effective_date);
END; $$;
REVOKE ALL ON FUNCTION public.apply_due_goal_plans(date) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.apply_due_goal_plans(date) TO authenticated,service_role;
REVOKE ALL ON FUNCTION public.preserve_goal_history(),public.lock_rep_account(),public.check_rep_account() FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.join_squad(p_code text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE u uuid:=auth.uid(); squad teams%rowtype;
BEGIN
 IF u IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(u::text,0));
 SELECT * INTO squad FROM teams WHERE upper(invite_code)=upper(trim(p_code)) FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'That invite code is not valid'; END IF;
 IF NOT EXISTS(SELECT 1 FROM team_members WHERE team_id=squad.id AND user_id=u) AND (SELECT count(*) FROM team_members WHERE team_id=squad.id)>=50 THEN RAISE EXCEPTION 'This team is full'; END IF;
 IF EXISTS(SELECT 1 FROM teams WHERE owner_id=u AND id<>squad.id) THEN RAISE EXCEPTION 'Leave your owned squad before joining another squad'; END IF;
 DELETE FROM team_members WHERE user_id=u AND team_id<>squad.id;
 INSERT INTO team_members(team_id,user_id,role) VALUES(squad.id,u,CASE WHEN squad.owner_id=u THEN 'owner' ELSE 'member' END) ON CONFLICT(team_id,user_id) DO NOTHING;
 RETURN squad.id;
END; $$;
REVOKE ALL ON FUNCTION public.join_squad(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.join_squad(text) TO authenticated,service_role;
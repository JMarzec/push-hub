CREATE OR REPLACE FUNCTION public.default_personal_progress_date() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN IF TG_TABLE_NAME='pushup_logs' THEN IF NEW.log_date IS NULL THEN NEW.log_date:=personal_calendar_day(NEW.user_id); END IF; ELSE IF NEW.entry_date IS NULL THEN NEW.entry_date:=personal_calendar_day(NEW.user_id); END IF; END IF; RETURN NEW; END; $$;
REVOKE ALL ON FUNCTION public.default_personal_progress_date() FROM PUBLIC,anon,authenticated;
ALTER TABLE public.pushup_logs ALTER COLUMN log_date DROP DEFAULT;
ALTER TABLE public.bank_entries ALTER COLUMN entry_date DROP DEFAULT;
CREATE TRIGGER assign_personal_log_date BEFORE INSERT ON public.pushup_logs FOR EACH ROW EXECUTE FUNCTION public.default_personal_progress_date();
CREATE TRIGGER assign_personal_bank_date BEFORE INSERT ON public.bank_entries FOR EACH ROW EXECUTE FUNCTION public.default_personal_progress_date();
CREATE OR REPLACE FUNCTION public.default_personal_start_date() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN IF NEW.start_date IS NULL THEN NEW.start_date:=(now() AT TIME ZONE NEW.timezone)::date; END IF; RETURN NEW; END; $$;
ALTER TABLE public.user_settings ALTER COLUMN start_date DROP DEFAULT;
CREATE TRIGGER assign_personal_start_date BEFORE INSERT ON public.user_settings FOR EACH ROW EXECUTE FUNCTION public.default_personal_start_date();
-- =========================
-- user_settings
-- =========================
CREATE TABLE public.user_settings (
  user_id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  daily_target INTEGER NOT NULL DEFAULT 50,
  frequency INTEGER NOT NULL DEFAULT 4,
  slot_times TEXT[] NOT NULL DEFAULT ARRAY['08:00','12:00','17:00','21:00'],
  timezone TEXT NOT NULL DEFAULT 'UTC',
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  baseline_reps INTEGER,
  parq_passed BOOLEAN NOT NULL DEFAULT false,
  disclaimer_accepted_at TIMESTAMPTZ,
  onboarding_completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT user_settings_daily_target_range CHECK (daily_target BETWEEN 1 AND 500),
  CONSTRAINT user_settings_frequency_range CHECK (frequency BETWEEN 1 AND 12)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_settings TO authenticated;
GRANT ALL ON public.user_settings TO service_role;

ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own settings"
  ON public.user_settings FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own settings"
  ON public.user_settings FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own settings"
  ON public.user_settings FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own settings"
  ON public.user_settings FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- =========================
-- pushup_logs
-- =========================
CREATE TABLE public.pushup_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reps INTEGER NOT NULL,
  slot TEXT,
  log_date DATE NOT NULL DEFAULT CURRENT_DATE,
  logged_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT pushup_logs_reps_range CHECK (reps > 0 AND reps <= 500)
);

CREATE INDEX pushup_logs_user_date_idx ON public.pushup_logs (user_id, log_date);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pushup_logs TO authenticated;
GRANT ALL ON public.pushup_logs TO service_role;

ALTER TABLE public.pushup_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own logs"
  ON public.pushup_logs FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own logs"
  ON public.pushup_logs FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own logs"
  ON public.pushup_logs FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own logs"
  ON public.pushup_logs FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- =========================
-- bank_entries
-- =========================
CREATE TABLE public.bank_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reps INTEGER NOT NULL,
  kind TEXT NOT NULL,
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT bank_entries_kind_check CHECK (kind IN ('deposit','withdrawal')),
  CONSTRAINT bank_entries_reps_positive CHECK (reps > 0)
);

CREATE INDEX bank_entries_user_idx ON public.bank_entries (user_id, entry_date);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bank_entries TO authenticated;
GRANT ALL ON public.bank_entries TO service_role;

ALTER TABLE public.bank_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own bank entries"
  ON public.bank_entries FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own bank entries"
  ON public.bank_entries FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own bank entries"
  ON public.bank_entries FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own bank entries"
  ON public.bank_entries FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- =========================
-- updated_at trigger
-- =========================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_user_settings_updated_at
  BEFORE UPDATE ON public.user_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_pushup_logs_updated_at
  BEFORE UPDATE ON public.pushup_logs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_bank_entries_updated_at
  BEFORE UPDATE ON public.bank_entries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
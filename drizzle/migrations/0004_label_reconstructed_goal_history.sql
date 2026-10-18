ALTER TABLE public.daily_goals ADD COLUMN recorded_at timestamptz NOT NULL DEFAULT now();
COMMENT ON COLUMN public.daily_goals.recorded_at IS 'When this dated goal was captured; legacy rows are explicitly reconstructed rather than verified history';
UPDATE public.daily_goals SET recorded_at=now(), history_basis='pretracking_fallback' WHERE goal_date <= (now() AT TIME ZONE 'UTC')::date;

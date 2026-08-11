ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS rest_day_of_week smallint;

ALTER TABLE public.user_settings
  ADD CONSTRAINT user_settings_rest_day_of_week_range
  CHECK (rest_day_of_week IS NULL OR (rest_day_of_week >= 0 AND rest_day_of_week <= 6));
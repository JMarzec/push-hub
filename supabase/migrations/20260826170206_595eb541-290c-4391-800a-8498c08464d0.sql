ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS email_reminders_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS email_reminders_paused_until date,
  ADD COLUMN IF NOT EXISTS last_nudge_email_at timestamptz;
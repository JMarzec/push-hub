CREATE TABLE public.activity_conversions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  activity_key text NOT NULL,
  label text NOT NULL,
  unit text NOT NULL,
  unit_step numeric NOT NULL DEFAULT 1,
  pushups_per_unit numeric NOT NULL DEFAULT 1,
  is_custom boolean NOT NULL DEFAULT false,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, activity_key)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.activity_conversions TO authenticated;
GRANT ALL ON public.activity_conversions TO service_role;

ALTER TABLE public.activity_conversions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own conversions" ON public.activity_conversions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own conversions" ON public.activity_conversions
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own conversions" ON public.activity_conversions
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own conversions" ON public.activity_conversions
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER update_activity_conversions_updated_at
  BEFORE UPDATE ON public.activity_conversions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.pushup_logs
  ADD COLUMN activity_key text,
  ADD COLUMN activity_label text,
  ADD COLUMN activity_amount numeric,
  ADD COLUMN activity_unit text;
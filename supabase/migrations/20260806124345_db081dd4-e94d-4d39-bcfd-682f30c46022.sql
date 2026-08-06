ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;

ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS reminders_enabled BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.target_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  effective_date DATE NOT NULL,
  daily_target INTEGER NOT NULL,
  frequency INTEGER NOT NULL,
  note TEXT,
  applied_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, effective_date)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.target_plans TO authenticated;
GRANT ALL ON public.target_plans TO service_role;

ALTER TABLE public.target_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own target plans" ON public.target_plans
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own target plans" ON public.target_plans
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own target plans" ON public.target_plans
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own target plans" ON public.target_plans
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER update_target_plans_updated_at BEFORE UPDATE ON public.target_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
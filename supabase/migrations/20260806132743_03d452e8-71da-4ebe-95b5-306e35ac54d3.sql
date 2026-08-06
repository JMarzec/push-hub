ALTER TABLE public.teams
  ADD COLUMN IF NOT EXISTS shared_target integer,
  ADD COLUMN IF NOT EXISTS shared_frequency integer;

ALTER TABLE public.team_members
  ADD COLUMN IF NOT EXISTS follow_shared_target boolean NOT NULL DEFAULT false;

CREATE POLICY "Users can update their own membership"
ON public.team_members
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
CREATE TABLE public.teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT 'My squad',
  invite_code text NOT NULL UNIQUE,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (team_id, user_id)
);

CREATE INDEX team_members_user_idx ON public.team_members(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.teams TO authenticated;
GRANT ALL ON public.teams TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.team_members TO authenticated;
GRANT ALL ON public.team_members TO service_role;

CREATE OR REPLACE FUNCTION public.is_team_member(_team_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.team_members
    WHERE team_id = _team_id AND user_id = _user_id
  )
$$;

ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view their teams" ON public.teams
FOR SELECT TO authenticated USING (public.is_team_member(id, auth.uid()));

CREATE POLICY "Users can create teams they own" ON public.teams
FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Owners can update their team" ON public.teams
FOR UPDATE TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Owners can delete their team" ON public.teams
FOR DELETE TO authenticated USING (auth.uid() = owner_id);

CREATE POLICY "Members can view team roster" ON public.team_members
FOR SELECT TO authenticated USING (public.is_team_member(team_id, auth.uid()));

CREATE POLICY "Users can add themselves to a team" ON public.team_members
FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can leave a team" ON public.team_members
FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER update_teams_updated_at BEFORE UPDATE ON public.teams
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_team_members_updated_at BEFORE UPDATE ON public.team_members
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.team_preview_by_code(_code text)
RETURNS TABLE (team_id uuid, team_name text, member_count integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT t.id, t.name, (SELECT count(*)::int FROM public.team_members m WHERE m.team_id = t.id)
  FROM public.teams t
  WHERE upper(t.invite_code) = upper(_code)
  LIMIT 1
$$;

GRANT EXECUTE ON FUNCTION public.team_preview_by_code(text) TO authenticated, anon;

CREATE OR REPLACE FUNCTION public.join_team_by_code(_code text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _team_id uuid;
  _count integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in required';
  END IF;

  SELECT id INTO _team_id FROM public.teams WHERE upper(invite_code) = upper(_code) LIMIT 1;
  IF _team_id IS NULL THEN
    RAISE EXCEPTION 'That invite code is not valid';
  END IF;

  SELECT count(*) INTO _count FROM public.team_members WHERE team_id = _team_id;
  IF _count >= 50 AND NOT public.is_team_member(_team_id, auth.uid()) THEN
    RAISE EXCEPTION 'This team is full';
  END IF;

  INSERT INTO public.team_members (team_id, user_id, role)
  VALUES (_team_id, auth.uid(), 'member')
  ON CONFLICT (team_id, user_id) DO NOTHING;

  RETURN _team_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.join_team_by_code(text) TO authenticated;
-- profiles: own row only
DROP POLICY IF EXISTS "Signed-in users can view profiles" ON public.profiles;
CREATE POLICY "Users can view their own profile"
ON public.profiles FOR SELECT TO authenticated
USING (auth.uid() = id);

-- team_members: own membership rows only (no recursive helper needed)
DROP POLICY IF EXISTS "Members can view team roster" ON public.team_members;
CREATE POLICY "Users can view their own memberships"
ON public.team_members FOR SELECT TO authenticated
USING (auth.uid() = user_id);

-- teams: visible to members via own membership rows
DROP POLICY IF EXISTS "Members can view their teams" ON public.teams;
CREATE POLICY "Members can view their teams"
ON public.teams FOR SELECT TO authenticated
USING (id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid()));

-- remove API-exposed SECURITY DEFINER helpers; logic now lives in server code
DROP FUNCTION IF EXISTS public.team_preview_by_code(text);
DROP FUNCTION IF EXISTS public.join_team_by_code(text);
DROP FUNCTION IF EXISTS public.team_today_stats(uuid);
DROP FUNCTION IF EXISTS public.is_team_member(uuid, uuid);
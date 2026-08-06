CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (
    NEW.id,
    COALESCE(
      NULLIF(NEW.raw_user_meta_data->>'display_name', ''),
      NULLIF(NEW.raw_user_meta_data->>'full_name', ''),
      NULLIF(NEW.raw_user_meta_data->>'name', ''),
      NULLIF(split_part(NEW.email, '@', 1), ''),
      'Member'
    )
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$function$;

UPDATE public.profiles p
SET display_name = COALESCE(
      NULLIF(u.raw_user_meta_data->>'display_name', ''),
      NULLIF(u.raw_user_meta_data->>'full_name', ''),
      NULLIF(split_part(u.email, '@', 1), ''),
      'Member'
    )
FROM auth.users u
WHERE u.id = p.id AND COALESCE(NULLIF(p.display_name, ''), '') = '';
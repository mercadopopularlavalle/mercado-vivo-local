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
    left(coalesce(
      nullif(NEW.raw_user_meta_data->>'full_name', ''),
      nullif(NEW.raw_user_meta_data->>'name', ''),
      nullif(split_part(NEW.email, '@', 1), ''),
      'Vendedor'
    ), 80)
  )
  ON CONFLICT (id) DO NOTHING;

  IF lower(NEW.email) = 'mercadopopularlavalle@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin')
    ON CONFLICT DO NOTHING;
    UPDATE public.profiles SET is_active = true WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$function$;
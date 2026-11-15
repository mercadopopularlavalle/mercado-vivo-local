CREATE OR REPLACE FUNCTION public.admin_list_admins()
RETURNS TABLE(user_id uuid, email text, display_name text, granted_at timestamptz)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
#variable_conflict use_column
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT r.user_id, u.email::text, p.display_name, r.created_at
    FROM public.user_roles r
    LEFT JOIN auth.users u ON u.id = r.user_id
    LEFT JOIN public.profiles p ON p.id = r.user_id
    WHERE r.role = 'admin'
    ORDER BY r.created_at;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_grant_admin(_email text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _target uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  SELECT u.id INTO _target FROM auth.users u WHERE lower(u.email) = lower(trim(_email)) LIMIT 1;
  IF _target IS NULL THEN
    RAISE EXCEPTION 'user_not_found' USING ERRCODE = 'P0002';
  END IF;
  INSERT INTO public.user_roles (user_id, role) VALUES (_target, 'admin')
  ON CONFLICT (user_id, role) DO NOTHING;
  RETURN _target;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_revoke_admin(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF _user_id = auth.uid() THEN
    RAISE EXCEPTION 'cannot_revoke_self' USING ERRCODE = 'P0001';
  END IF;
  PERFORM 1 FROM public.user_roles WHERE role = 'admin' FOR UPDATE;
  IF (SELECT count(*) FROM public.user_roles WHERE role = 'admin') <= 1 THEN
    RAISE EXCEPTION 'last_admin' USING ERRCODE = 'P0001';
  END IF;
  DELETE FROM public.user_roles WHERE user_id = _user_id AND role = 'admin';
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_admins() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_grant_admin(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_revoke_admin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_admins() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_grant_admin(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_revoke_admin(uuid) TO authenticated;
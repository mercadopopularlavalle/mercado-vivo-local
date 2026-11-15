-- Helper so listing policies can check seller activation without reading profiles under RLS
CREATE OR REPLACE FUNCTION public.is_active_seller(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT p.is_active FROM public.profiles p WHERE p.id = _user_id), false)
$$;

REVOKE ALL ON FUNCTION public.is_active_seller(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_active_seller(uuid) TO anon, authenticated, service_role;

-- Listings: same rules, now via the helper (avoids policy recursion with profiles)
DROP POLICY IF EXISTS "Avisos activos de vendedores habilitados" ON public.listings;
CREATE POLICY "Avisos activos de vendedores habilitados"
  ON public.listings FOR SELECT
  TO anon, authenticated
  USING (status = 'active' AND public.is_active_seller(user_id));

DROP POLICY IF EXISTS "Vendedor habilitado crea avisos" ON public.listings;
CREATE POLICY "Vendedor habilitado crea avisos"
  ON public.listings FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id AND public.is_active_seller(auth.uid()));

-- Profiles: replace the open read rule
DROP POLICY IF EXISTS "Perfiles visibles para todos" ON public.profiles;

CREATE POLICY "Usuario ve su perfil"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Admin ve perfiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Vendedores activos con avisos publicados"
  ON public.profiles FOR SELECT
  TO anon, authenticated
  USING (
    is_active
    AND EXISTS (
      SELECT 1 FROM public.listings l
      WHERE l.user_id = profiles.id AND l.status = 'active'
    )
  );

-- App settings: only registered sellers and admins
DROP POLICY IF EXISTS "Configuración visible para usuarios" ON public.app_settings;
CREATE POLICY "Configuración visible para vendedores"
  ON public.app_settings FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid())
  );

-- Listing photos: owner folder, or photos attached to a publicly visible listing
DROP POLICY IF EXISTS "Fotos de avisos visibles" ON storage.objects;

CREATE POLICY "Usuario ve sus fotos"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'listing-images'
    AND (storage.foldername(name))[1] = (auth.uid())::text
  );

CREATE POLICY "Fotos de avisos publicados"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (
    bucket_id = 'listing-images'
    AND EXISTS (
      SELECT 1 FROM public.listings l
      WHERE l.image_url = objects.name
        AND l.status = 'active'
        AND public.is_active_seller(l.user_id)
    )
  );
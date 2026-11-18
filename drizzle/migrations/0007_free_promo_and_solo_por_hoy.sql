ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS is_flash_today boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS expires_at timestamptz;

CREATE OR REPLACE FUNCTION public.free_promo_ends_at()
RETURNS timestamptz
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$ SELECT '2026-12-15 23:59:59.999999-03'::timestamptz $$;

CREATE OR REPLACE FUNCTION public.end_of_today_ar()
RETURNS timestamptz
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT ((date_trunc('day', now() AT TIME ZONE 'America/Argentina/Buenos_Aires')
          + interval '1 day' - interval '1 microsecond')
         AT TIME ZONE 'America/Argentina/Buenos_Aires')
$$;

-- Who may publish regular (non-flash) listings right now.
CREATE OR REPLACE FUNCTION public.can_publish_regular(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$ SELECT public.is_active_seller(_user_id) OR now() <= public.free_promo_ends_at() $$;

-- Whether a listing is visible to buyers.
CREATE OR REPLACE FUNCTION public.listing_is_public(_user_id uuid, _status text, _is_flash boolean, _expires_at timestamptz)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _status = 'active'
     AND (_expires_at IS NULL OR _expires_at > now())
     AND (_is_flash OR public.can_publish_regular(_user_id))
$$;

-- Flash listings always expire at the end of the current day (Argentina);
-- owners cannot change flash/expiry afterwards.
CREATE OR REPLACE FUNCTION public.enforce_listing_flash()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.is_flash_today THEN
      NEW.expires_at := public.end_of_today_ar();
    ELSE
      NEW.expires_at := NULL;
    END IF;
  ELSE
    NEW.is_flash_today := OLD.is_flash_today;
    NEW.expires_at := OLD.expires_at;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS listings_enforce_flash ON public.listings;
CREATE TRIGGER listings_enforce_flash
  BEFORE INSERT OR UPDATE ON public.listings
  FOR EACH ROW EXECUTE FUNCTION public.enforce_listing_flash();

DROP POLICY IF EXISTS "Vendedor habilitado crea avisos" ON public.listings;
CREATE POLICY "Vendedor habilitado crea avisos" ON public.listings
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND (is_flash_today OR public.can_publish_regular(auth.uid())));

DROP POLICY IF EXISTS "Avisos activos de vendedores habilitados" ON public.listings;
CREATE POLICY "Avisos activos de vendedores habilitados" ON public.listings
  FOR SELECT TO anon, authenticated
  USING (public.listing_is_public(user_id, status, is_flash_today, expires_at));

DROP POLICY IF EXISTS "Vendedores activos con avisos publicados" ON public.profiles;
CREATE POLICY "Vendedores activos con avisos publicados" ON public.profiles
  FOR SELECT TO anon, authenticated
  USING (EXISTS (
    SELECT 1 FROM public.listings l
    WHERE l.user_id = profiles.id
      AND public.listing_is_public(l.user_id, l.status, l.is_flash_today, l.expires_at)
  ));

DROP POLICY IF EXISTS "Fotos de avisos publicados" ON storage.objects;
CREATE POLICY "Fotos de avisos publicados" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'listing-images' AND EXISTS (
    SELECT 1 FROM public.listings l
    WHERE (l.image_url = objects.name OR l.image_url_2 = objects.name)
      AND public.listing_is_public(l.user_id, l.status, l.is_flash_today, l.expires_at)
  ));
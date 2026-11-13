-- Seller subscription state + optional store name
ALTER TABLE public.profiles ADD COLUMN is_active boolean NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN store_name text;

-- Roles live in their own table (never on profiles)
CREATE TYPE public.app_role AS ENUM ('admin', 'seller');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Usuario ve sus roles" ON public.user_roles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- Only admins (or the backend itself) may change is_active
CREATE OR REPLACE FUNCTION public.protect_seller_activation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.is_active := false;
  ELSIF NEW.is_active IS DISTINCT FROM OLD.is_active THEN
    NEW.is_active := OLD.is_active;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER profiles_protect_activation BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_seller_activation();

CREATE POLICY "Admin edita perfiles" ON public.profiles
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Public sees only active listings of enabled sellers
DROP POLICY "Avisos activos visibles para todos" ON public.listings;
CREATE POLICY "Avisos activos de vendedores habilitados" ON public.listings
  FOR SELECT TO anon, authenticated
  USING (
    status = 'active'
    AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = listings.user_id AND p.is_active)
  );

-- Only enabled sellers can create listings
DROP POLICY "Dueño crea avisos" ON public.listings;
CREATE POLICY "Vendedor habilitado crea avisos" ON public.listings
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_active)
  );

-- Subscription settings editable by the admin
CREATE TABLE public.app_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  mercadopago_url text,
  admin_whatsapp text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Configuración visible para usuarios" ON public.app_settings
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin edita configuración" ON public.app_settings
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER app_settings_updated_at BEFORE UPDATE ON public.app_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
INSERT INTO public.app_settings (id) VALUES (true) ON CONFLICT DO NOTHING;

-- Admin-only seller list (includes account email)
CREATE OR REPLACE FUNCTION public.admin_list_sellers()
RETURNS TABLE (
  id uuid, display_name text, store_name text, whatsapp text, city text,
  is_active boolean, created_at timestamptz, email text, listings_count bigint, is_admin boolean
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
#variable_conflict use_column
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT p.id, p.display_name, p.store_name, p.whatsapp, p.city, p.is_active, p.created_at,
           u.email::text,
           (SELECT count(*) FROM public.listings l WHERE l.user_id = p.id),
           public.has_role(p.id, 'admin')
    FROM public.profiles p
    LEFT JOIN auth.users u ON u.id = p.id
    ORDER BY p.created_at DESC;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_list_sellers() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_sellers() TO authenticated;

-- Backfill: demo sellers keep their listings visible
UPDATE public.profiles SET is_active = true
WHERE id IN ('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000003');
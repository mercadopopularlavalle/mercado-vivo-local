-- Profiles (seller info). Plain UUID id so demo sellers can exist without auth accounts.
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name text NOT NULL DEFAULT 'Vendedor' CHECK (char_length(display_name) BETWEEN 1 AND 80),
  whatsapp text CHECK (whatsapp IS NULL OR whatsapp ~ '^[0-9]{8,15}$'),
  city text CHECK (city IS NULL OR char_length(city) <= 120),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.profiles TO anon;
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Perfiles visibles para todos" ON public.profiles
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Usuario crea su perfil" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "Usuario edita su perfil" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Listings
CREATE TABLE public.listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(title) BETWEEN 3 AND 120),
  description text NOT NULL DEFAULT '' CHECK (char_length(description) <= 5000),
  price numeric(14,2) NOT NULL CHECK (price >= 0),
  category text NOT NULL CHECK (category IN ('hogar','indumentaria','comidas-bebidas','servicios','electronica','vehiculos')),
  location text NOT NULL CHECK (char_length(location) BETWEEN 2 AND 120),
  image_url text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX listings_status_created_idx ON public.listings (status, created_at DESC);
CREATE INDEX listings_user_idx ON public.listings (user_id);
CREATE INDEX listings_category_idx ON public.listings (category);

GRANT SELECT ON public.listings TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.listings TO authenticated;
GRANT ALL ON public.listings TO service_role;

ALTER TABLE public.listings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Avisos activos visibles para todos" ON public.listings
  FOR SELECT TO anon, authenticated USING (status = 'active');
CREATE POLICY "Dueño ve sus avisos" ON public.listings
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Dueño crea avisos" ON public.listings
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Dueño edita avisos" ON public.listings
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Dueño elimina avisos" ON public.listings
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER listings_updated_at BEFORE UPDATE ON public.listings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Storage policies: users manage files inside their own folder; anyone can read listing images
CREATE POLICY "Fotos de avisos visibles" ON storage.objects
  FOR SELECT TO anon, authenticated USING (bucket_id = 'listing-images');
CREATE POLICY "Usuario sube fotos a su carpeta" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'listing-images' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Usuario edita sus fotos" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'listing-images' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Usuario borra sus fotos" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'listing-images' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Demo sellers and listings
INSERT INTO public.profiles (id, display_name, whatsapp, city) VALUES
  ('00000000-0000-4000-8000-000000000001', 'Laura Gómez', '5491155550101', 'Palermo, CABA'),
  ('00000000-0000-4000-8000-000000000002', 'Martín Ríos', '5493415550102', 'Rosario, Santa Fe'),
  ('00000000-0000-4000-8000-000000000003', 'Sofía Herrera', '5493515550103', 'Córdoba Capital');

INSERT INTO public.listings (user_id, title, description, price, category, location, image_url, created_at) VALUES
  ('00000000-0000-4000-8000-000000000001', 'Sillón de 3 cuerpos en pana verde', 'Sillón de 3 cuerpos tapizado en pana verde oliva, estructura de madera maciza. Muy cómodo, sin manchas ni roturas. Medidas: 2,10 m de largo x 90 cm de profundidad. Se retira por Palermo, puedo ayudar a coordinar un flete.', 180000, 'hogar', 'Palermo, CABA', '/images/seed/sillon.jpg', now() - interval '1 hour'),
  ('00000000-0000-4000-8000-000000000002', 'Campera de jean vintage talle M', 'Campera de jean clásica, lavado medio, talle M. Usada pocas veces, en excelente estado. Ideal para media estación. Envíos por moto dentro de Rosario.', 35000, 'indumentaria', 'Rosario, Santa Fe', '/images/seed/campera.jpg', now() - interval '3 hours'),
  ('00000000-0000-4000-8000-000000000003', 'Empanadas caseras salteñas x docena', 'Empanadas caseras de carne cortada a cuchillo, horneadas en horno de barro. También hay de pollo, jamón y queso, y humita. Pedidos con 24 hs de anticipación. Retiro o envío en Córdoba Capital.', 9000, 'comidas-bebidas', 'Córdoba Capital', '/images/seed/empanadas.jpg', now() - interval '5 hours'),
  ('00000000-0000-4000-8000-000000000003', 'Electricista matriculado a domicilio', 'Instalaciones eléctricas, tableros, disyuntores, tomas y luminarias. Presupuesto sin cargo. El precio corresponde a la visita de diagnóstico. Trabajos con garantía y factura.', 15000, 'servicios', 'Córdoba Capital', '/images/seed/electricista.jpg', now() - interval '8 hours'),
  ('00000000-0000-4000-8000-000000000001', 'Notebook 14" Ryzen 7, 16 GB RAM, 512 GB SSD', 'Notebook liviana de 14 pulgadas, procesador Ryzen 7, 16 GB de RAM y disco SSD de 512 GB. Batería que dura toda la jornada. Incluye cargador original y caja. Un año de uso, impecable.', 650000, 'electronica', 'Palermo, CABA', '/images/seed/notebook.jpg', now() - interval '1 day'),
  ('00000000-0000-4000-8000-000000000002', 'Fiat Palio 1.4 2012 – 120.000 km', 'Fiat Palio 1.4 modelo 2012, 5 puertas, 120.000 km reales. Service al día, cubiertas nuevas, aire acondicionado y dirección asistida. Papeles al día, listo para transferir.', 6500000, 'vehiculos', 'Rosario, Santa Fe', '/images/seed/auto.jpg', now() - interval '2 days'),
  ('00000000-0000-4000-8000-000000000001', 'Auriculares inalámbricos con cancelación de ruido', 'Auriculares bluetooth over-ear con cancelación activa de ruido, 30 horas de batería. Incluye estuche rígido y cable. Funcionan perfecto, los vendo porque me regalaron otros.', 28000, 'electronica', 'Palermo, CABA', '/images/seed/auriculares.jpg', now() - interval '3 days'),
  ('00000000-0000-4000-8000-000000000003', 'Mesa de comedor de madera para 6 personas', 'Mesa de comedor rectangular de madera de pino macizo, 1,60 m x 0,90 m. Para 6 personas. Tiene algunas marcas de uso que le dan carácter. Sin sillas.', 120000, 'hogar', 'Córdoba Capital', '/images/seed/mesa.jpg', now() - interval '4 days');
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS image_url_2 text;

COMMENT ON COLUMN public.listings.image_url_2 IS 'Optional second photo (bucket path or /images/seed path). Listings allow at most two photos: image_url and image_url_2.';

ALTER POLICY "Fotos de avisos publicados"
  ON storage.objects
  TO anon, authenticated
  USING (
    bucket_id = 'listing-images'
    AND EXISTS (
      SELECT 1 FROM public.listings l
      WHERE (l.image_url = objects.name OR l.image_url_2 = objects.name)
        AND l.status = 'active'
        AND public.is_active_seller(l.user_id)
    )
  );
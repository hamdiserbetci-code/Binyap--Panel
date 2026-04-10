-- =============================================================================
-- current_firma_id() Fonksiyonu
-- RLS politikalarında firma_id'yi güvenli bir şekilde almak için kullanılır.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.current_firma_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT firma_id FROM kullanici_profilleri WHERE auth_user_id = auth.uid() LIMIT 1;
$$;
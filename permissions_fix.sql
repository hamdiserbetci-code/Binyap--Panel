-- İzin (Permission Denied) Hatası Çözümü
-- Lütfen bu kodları Supabase SQL Editor üzerinden çalıştırın:

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL PRIVILEGES ON TABLE public.dokumanlar TO anon, authenticated, service_role;

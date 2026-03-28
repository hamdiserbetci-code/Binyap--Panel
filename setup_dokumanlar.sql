-- Evrak Yönetim Sistemi İçin "dokumanlar" Tablosunu Oluşturma Betiği
-- Lütfen bu SQL kodunu Supabase projenizdeki "SQL Editor" bölümünde çalıştırın.

-- 1. dokumanlar tablosunu oluştur
CREATE TABLE IF NOT EXISTS public.dokumanlar (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    firma_id UUID NOT NULL REFERENCES public.firmalar(id) ON DELETE CASCADE,
    proje_id UUID REFERENCES public.projeler(id) ON DELETE SET NULL,
    musteri_id UUID REFERENCES public.musteriler(id) ON DELETE SET NULL,
    yukleyen_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    sirket TEXT,
    modul TEXT NOT NULL DEFAULT 'genel_evrak',
    kategori TEXT,
    bagli_tablo TEXT,
    bagli_kayit_id UUID,
    dosya_adi TEXT NOT NULL,
    dosya_url TEXT NOT NULL,
    mime_type TEXT,
    dosya_boyutu BIGINT,
    aciklama TEXT,
    etiketler TEXT[] DEFAULT '{}'::TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. RLS (Row Level Security) Politikalarını Ekle (Opsiyonel ama önerilir)
ALTER TABLE public.dokumanlar ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Herkes görebilir" ON public.dokumanlar
    FOR SELECT USING (true);

CREATE POLICY "Herkes ekleyebilir" ON public.dokumanlar
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Herkes güncelleyebilir" ON public.dokumanlar
    FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "Herkes silebilir" ON public.dokumanlar
    FOR DELETE USING (true);

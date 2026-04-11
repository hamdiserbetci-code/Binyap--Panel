-- Yeni Dönemsel Satışlar Tablosu
CREATE TABLE donemsel_satislar (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    firma_id UUID NOT NULL REFERENCES firmalar(id) ON DELETE CASCADE,
    donem TEXT NOT NULL, -- Örn: 2024-03
    musteri_ad TEXT NOT NULL,
    musteri_vkn TEXT,
    
    -- Tutar Bilgileri
    iskonto NUMERIC(15,2) DEFAULT 0,
    kdv_0_matrah NUMERIC(15,2) DEFAULT 0,
    kdv_1_matrah NUMERIC(15,2) DEFAULT 0,
    kdv_10_matrah NUMERIC(15,2) DEFAULT 0,
    kdv_20_matrah NUMERIC(15,2) DEFAULT 0,
    toplam_matrah NUMERIC(15,2) DEFAULT 0,
    toplam_kdv NUMERIC(15,2) DEFAULT 0,
    
    -- Tevkifatlar (Otomatik tespit edilen)
    tevkifat_turu TEXT DEFAULT 'yok', -- yok, 2/10, 5/10 vb.
    tevkifat_tutari NUMERIC(15,2) DEFAULT 0,
    genel_toplam NUMERIC(15,2) DEFAULT 0,
    
    -- Kontrol / Durum
    uyumsuzluk_var BOOLEAN DEFAULT false,
    uyumsuzluk_nedeni TEXT,
    notlar TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- API için Schema yenileme
NOTIFY pgrst, 'reload schema';
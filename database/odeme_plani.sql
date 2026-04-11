-- Ödeme Planı Tablosu
CREATE TABLE IF NOT EXISTS odeme_plani (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    firma_id UUID NOT NULL REFERENCES firmalar(id) ON DELETE CASCADE,
    odeme_tipi TEXT NOT NULL, -- cek | cari | vergi | sgk | Maas | diger
    aciklama TEXT,
    tedarikci_cari_id UUID,
    tutar NUMERIC(15,2) NOT NULL DEFAULT 0,
    odenen_tutar NUMERIC(15,2) DEFAULT 0,
    kalan_tutar NUMERIC(15,2) DEFAULT 0,
    vade_tarihi DATE,
    odeme_tarihi DATE,
    odeme_kanali TEXT, -- banka | nakit | cek
    cek_no TEXT,
    banka_hesabi TEXT,
    durum TEXT DEFAULT 'bekliyor', -- bekliyor | odendi | kismi | iptal
    hatirlatici_tarihi DATE,
    hatirlatildi BOOLEAN DEFAULT false,
    notlar TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE odeme_plani ENABLE ROW LEVEL SECURITY;
CREATE POLICY "odeme_plani_select" ON odeme_plani FOR SELECT USING (true);
CREATE POLICY "odeme_plani_insert" ON odeme_plani FOR INSERT WITH CHECK (true);
CREATE POLICY "odeme_plani_update" ON odeme_plani FOR UPDATE USING (true);
CREATE POLICY "odeme_plani_delete" ON odeme_plani FOR DELETE USING (true);

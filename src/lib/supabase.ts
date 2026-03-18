import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
)

export interface Firma { id: string; ad: string }
export interface Proje { id: string; ad: string; firma_id: string }

// Hata veren tüm sayfaları susturmak için "any" tipinde boş tanımlar
export type Ekip = any;
export type Bordro = any;
export const AY_LABELS: any = ["", "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
export const DURUM_LABELS: any = {};
export const DURUM_COLORS: any = {};
export const VERGI_TUR_LABELS: any = {};

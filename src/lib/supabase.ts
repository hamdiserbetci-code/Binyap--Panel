import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
)

export interface Firma { id: string; ad: string; vergi_no?: string; yetkili?: string; [key: string]: any }
export interface Proje { id: string; ad: string; firma_id: string; [key: string]: any }

export type Ekip = any;
export type Bordro = any;
export type Gorev = any;
export type VergiSureci = any;
export type Maliyet = any;
export type OdemePlani = any;
export const AY_LABELS: string[] = ["", "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
export const DURUM_LABELS: Record<string, string> = {};
export const DURUM_COLORS: Record<string, string> = {};
export const VERGI_TUR_LABELS: Record<string, string> = {};

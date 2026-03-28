import { IsTip, Periyot, GorevDurum, Oncelik, DokumanTipi } from '@/types'

export const TIP_LABEL: Record<IsTip, string> = {
  beyanname: 'Beyanname',
  odeme: 'Ödeme',
  bordro: 'Bordro',
  mutabakat: 'Mutabakat',
  edefter: 'E-Defter',
  diger: 'Diğer',
}

export const PERIYOT_LABEL: Record<Periyot, string> = {
  haftalik: 'Haftalık',
  aylik: 'Aylık',
  uc_aylik: '3 Aylık',
  alti_aylik: '6 Aylık',
  yillik: 'Yıllık',
  tek_seferlik: 'Tek Seferlik',
}

export const DURUM_LABEL: Record<GorevDurum, string> = {
  bekliyor: 'Bekliyor',
  hazirlaniyor: 'Hazırlanıyor',
  kontrolde: 'Kontrolde',
  tamamlandi: 'Tamamlandı',
  iptal: 'İptal',
}

export const ONCELIK_LABEL: Record<Oncelik, string> = {
  dusuk: 'Düşük',
  orta: 'Orta',
  yuksek: 'Yüksek',
  kritik: 'Kritik',
}

export const ONCELIK_COLOR: Record<Oncelik, string> = {
  dusuk: 'bg-slate-100 text-slate-600',
  orta: 'bg-blue-100 text-blue-700',
  yuksek: 'bg-amber-100 text-amber-700',
  kritik: 'bg-red-100 text-red-700',
}

export const DURUM_COLOR: Record<GorevDurum, string> = {
  bekliyor: 'bg-slate-100 text-slate-600',
  hazirlaniyor: 'bg-blue-100 text-blue-700',
  kontrolde: 'bg-amber-100 text-amber-700',
  tamamlandi: 'bg-emerald-100 text-emerald-700',
  iptal: 'bg-red-100 text-red-600',
}

export const TARIH = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleDateString('tr-TR') : '—'

export function kalanGun(sonTarih: string): number {
  const bugun = new Date(); bugun.setHours(0,0,0,0)
  const son = new Date(sonTarih); son.setHours(0,0,0,0)
  return Math.ceil((son.getTime() - bugun.getTime()) / 86400000)
}

export const DOKUMAN_TIP_LABEL: Record<DokumanTipi, string> = {
  fatura: 'Fatura',
  sozlesme: 'Sözleşme',
  rapor: 'Rapor',
  irsaliye: 'İrsaliye',
  makbuz: 'Makbuz',
  diger: 'Diğer',
  genel_evrak: 'Genel Evrak',
}

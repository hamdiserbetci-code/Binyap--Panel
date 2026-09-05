import {
  Wallet, Clock, Scale, Settings, ShieldCheck, BarChart2,
} from 'lucide-react'
import type { NavItem } from '@/types'

export const NAV: NavItem[] = [
  { id: 'kasa',        label: 'Kasa & Banka',     icon: Wallet,          group: 'Finans' },
  { id: 'odeme-plani', label: 'Ödeme Planı',      icon: Clock,           group: 'Finans' },
  { id: 'arabulucu',   label: 'Arabulucu',         icon: Scale,           group: 'İK & Bordro' },
  { id: 'icra',        label: 'İcra Takibi',       icon: Scale,           group: 'İK & Bordro' },
  { id: 'police',      label: 'Poliçe Takibi',     icon: ShieldCheck,     group: 'Sigorta' },
  { id: 'raporlar',    label: 'Raporlar',           icon: BarChart2,       group: 'Sistem' },
  { id: 'ayarlar',     label: 'Ayarlar',           icon: Settings,        group: 'Sistem' },
]

import {
  Wallet, Clock, Scale, Settings, ShieldCheck, BarChart2, ClipboardCheck, FileText, CheckSquare, TrendingUp,
} from 'lucide-react'
import type { NavItem } from '@/types'

export const NAV: NavItem[] = [
  { id: 'kasa',        label: 'Kasa & Banka',     icon: Wallet,          group: 'Finans' },
  { id: 'odeme-plani', label: 'Ödeme Planı',      icon: Clock,           group: 'Finans' },
  { id: 'kar-zarar',   label: 'Kar / Zarar',      icon: TrendingUp,      group: 'Finans' },
  { id: 'gorevler',    label: 'Görev Takibi',     icon: CheckSquare,     group: 'Operasyon' },
  { id: 'arabulucu',   label: 'Arabulucu',         icon: Scale,           group: 'İK & Bordro' },
  { id: 'icra',        label: 'İcra Takibi',       icon: Scale,           group: 'İK & Bordro' },
  { id: 'bordro',      label: 'Puantaj & Bordro',   icon: FileText,        group: 'İK & Bordro' },
  { id: 'police',      label: 'Poliçe Takibi',     icon: ShieldCheck,     group: 'Sigorta' },
  { id: 'beyanname',   label: 'Beyanname & SGK',   icon: ClipboardCheck,  group: 'Vergi & SGK' },
  { id: 'raporlar',    label: 'Raporlar',           icon: BarChart2,       group: 'Sistem' },
  { id: 'ayarlar',     label: 'Ayarlar',           icon: Settings,        group: 'Sistem' },
]

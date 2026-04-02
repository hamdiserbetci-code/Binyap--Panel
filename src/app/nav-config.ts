import {
  ClipboardList, Users2,
  BarChart2, Settings,
  Building2, CalendarCheck, Wallet, TrendingUp,
  Landmark, CalendarClock, HardDrive, Scale,
} from 'lucide-react'

export const NAV = [
  { id: 'musteriler', label: 'Müşteriler',      icon: Building2,       group: 'Yönetim' },
  { id: 'gorevler',   label: 'Periyodik İşler', icon: ClipboardList,   group: 'Yönetim' },
  { id: 'gunluk',     label: 'Günlük İşler',   icon: CalendarCheck,   group: 'Yönetim' },
  { id: 'kasa',       label: 'Kasa',            icon: Wallet,          group: 'Finans' },
  { id: 'cekler',     label: 'Çek Takibi',     icon: Landmark,        group: 'Finans' },
  { id: 'odemeplani', label: 'Odeme Plani',     icon: CalendarClock,   group: 'Finans' },
  { id: 'karzarar',   label: 'Kar / Zarar',     icon: TrendingUp,      group: 'Finans' },
  { id: 'icra',       label: 'İcra Takibi',     icon: Scale,           group: 'Finans' },
  { id: 'bordro',     label: 'Bordro Süreci',   icon: Users2,          group: 'Yönetim' },
  { id: 'raporlar',   label: 'Raporlar',         icon: BarChart2,       group: 'Analiz' },
  { id: 'ayarlar',    label: 'Ayarlar',          icon: Settings,        group: 'Analiz' },
  { id: 'yedek',      label: 'Yedekleme',         icon: HardDrive,       group: 'Analiz' },
] as const

export const BOTTOM_NAV = [
  { id: 'musteriler', label: 'Müşteriler', icon: Building2     },
  { id: 'gorevler',   label: 'İşler',      icon: ClipboardList },
  { id: 'kasa',       label: 'Kasa',       icon: Wallet        },
  { id: 'ayarlar',    label: 'Ayarlar',    icon: Settings      },
] as const

export type ModuleId = typeof NAV[number]['id']
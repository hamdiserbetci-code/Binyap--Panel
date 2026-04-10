import {
  ClipboardList, Users2, Users,
  BarChart2, Settings,
  CalendarCheck, Wallet, TrendingUp,
  Landmark, CalendarClock, HardDrive, Scale,
  FolderKanban, FileCheck, FileDigit,
} from 'lucide-react'

export const NAV = [
  // Yönetim
  { id: 'gorevler',   label: 'İş Takibi',       icon: ClipboardList,   group: 'Yönetim', color: 'from-blue-700 to-blue-900' },
  { id: 'gunluk',     label: 'Günlük İşler',    icon: CalendarCheck,   group: 'Yönetim', color: 'from-sky-700 to-sky-900' },
  { id: 'projeler',   label: 'Projeler',        icon: FolderKanban,    group: 'Yönetim', color: 'from-cyan-700 to-cyan-900' },
  { id: 'bordro',     label: 'Bordro Süreci',   icon: Users2,          group: 'Yönetim', color: 'from-indigo-700 to-indigo-900' },
  { id: 'icra',       label: 'İcra Takibi',     icon: Scale,           group: 'Yönetim', color: 'from-slate-700 to-slate-900' },
  
  // Finans
  { id: 'cari',       label: 'Cari Hesaplar',   icon: Users,           group: 'Finans',  color: 'from-blue-800 to-blue-950' },
  { id: 'kasa',       label: 'Kasa',            icon: Wallet,          group: 'Finans',  color: 'from-sky-800 to-sky-950' },
  { id: 'cekler',     label: 'Çek Takibi',      icon: Landmark,        group: 'Finans',  color: 'from-cyan-800 to-cyan-950' },
  { id: 'odemeplani', label: 'Ödeme Planı',     icon: CalendarClock,   group: 'Finans',  color: 'from-indigo-800 to-indigo-950' },
  { id: 'karzarar',   label: 'Kar / Zarar',     icon: TrendingUp,      group: 'Finans',  color: 'from-violet-800 to-violet-950' },
  
  // Vergi & Mevzuat
  { id: 'vergi',      label: 'Vergi Beyannameleri', icon: FileCheck,   group: 'Vergi',   color: 'from-emerald-700 to-emerald-900' },
  { id: 'efatura',    label: 'E-Fatura / E-Defter', icon: FileDigit,   group: 'Vergi',   color: 'from-teal-700 to-teal-900' },
  
  // Analiz
  { id: 'raporlar',   label: 'Raporlar',        icon: BarChart2,       group: 'Analiz',  color: 'from-blue-600 to-blue-800' },
  { id: 'yedek',      label: 'Yedekleme',       icon: HardDrive,       group: 'Analiz',  color: 'from-sky-600 to-sky-800' },
  { id: 'ayarlar',    label: 'Ayarlar',         icon: Settings,        group: 'Analiz',  color: 'from-slate-600 to-slate-800' },
] as const

export const BOTTOM_NAV = [
  { id: 'gorevler',   label: 'İş Takibi',  icon: ClipboardList },
  { id: 'kasa',       label: 'Kasa',       icon: Wallet        },
  { id: 'raporlar',   label: 'Raporlar',   icon: BarChart2     },
  { id: 'ayarlar',    label: 'Ayarlar',    icon: Settings      },
] as const

export type ModuleId = typeof NAV[number]['id']

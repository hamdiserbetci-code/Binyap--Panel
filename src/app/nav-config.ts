import {
  Users, Building2, FileText, CreditCard, Wallet,
  UsersRound, Calculator, Scale, FolderKanban, FileCheck,
  BarChart2, Package, Settings, LayoutDashboard, Bell
} from 'lucide-react'

export const NAV = [
  // ERP v2 Modülleri
  { id: 'cari',       label: 'Cari Hesaplar',      icon: Users,         group: 'ERP v2', color: 'from-sky-700 to-sky-900' },
  { id: 'fatura',     label: 'Faturalar',          icon: FileText,      group: 'ERP v2', color: 'from-cyan-700 to-cyan-900' },
  { id: 'finans',     label: 'Finans Fişleri',     icon: Wallet,        group: 'ERP v2', color: 'from-teal-700 to-teal-900' },
  { id: 'banka',      label: 'Banka & Kasa',       icon: Building2,     group: 'ERP v2', color: 'from-blue-700 to-blue-900' },
  { id: 'cek-senet',  label: 'Çek & Senet',        icon: CreditCard,    group: 'ERP v2', color: 'from-indigo-700 to-indigo-900' },
  { id: 'stok',       label: 'Stok Kartları',      icon: Package,       group: 'ERP v2', color: 'from-purple-700 to-purple-900' },
  
  // Bordro & İK
  { id: 'bordro',     label: 'Bordro Süreci',      icon: Calculator,    group: 'Bordro & İK', color: 'from-slate-700 to-slate-900' },
  { id: 'ik',         label: 'İK & Personel',      icon: UsersRound,    group: 'Bordro & İK', color: 'from-gray-700 to-gray-900' },
  
  // İş Takibi
  { id: 'proje',      label: 'Proje & İş Takibi',  icon: FolderKanban,  group: 'İş Takibi', color: 'from-amber-700 to-amber-900' },
  { id: 'icra',       label: 'İcra Takibi',        icon: Scale,         group: 'İş Takibi', color: 'from-orange-700 to-orange-900' },
  
  // Vergi & Mevzuat
  { id: 'vergi',      label: 'Vergi & SGK',        icon: FileCheck,     group: 'Vergi & Mevzuat', color: 'from-emerald-700 to-emerald-900' },
  
  // Analiz & Raporlama
  { id: 'raporlar',   label: 'Raporlar',           icon: BarChart2,     group: 'Analiz & Raporlama', color: 'from-blue-600 to-blue-800' },
  { id: 'ayarlar',    label: 'Ayarlar',            icon: Settings,      group: 'Sistem', color: 'from-slate-600 to-slate-800' },
] as const

export const BOTTOM_NAV = [
  { id: 'cari',       label: 'Cari',       icon: Users },
  { id: 'fatura',     label: 'Fatura',     icon: FileText },
  { id: 'finans',     label: 'Finans',     icon: Wallet },
  { id: 'raporlar',   label: 'Raporlar',   icon: BarChart2 },
  { id: 'ayarlar',    label: 'Ayarlar',    icon: Settings },
] as const

export type ModuleId = typeof NAV[number]['id']
import {
  LayoutDashboard, Wallet, Clock, TrendingUp,
  FolderOpen, Users, FileText, Scale, Settings, Briefcase, CheckSquare, ShieldCheck, BarChart2, BookUser,
} from 'lucide-react'
import type { NavItem } from '@/types'

export const NAV: NavItem[] = [
  { id: 'dashboard',   label: 'Ana Ekran',       icon: LayoutDashboard, group: 'Genel' },
  { id: 'gorevler',    label: 'Görev Takibi',     icon: CheckSquare,     group: 'Genel' },
  { id: 'cari',        label: 'Cari Hesaplar',    icon: BookUser,        group: 'Finans' },
  { id: 'kasa',        label: 'Kasa & Banka',     icon: Wallet,          group: 'Finans' },
  { id: 'odeme-plani', label: 'Ödeme Planı',      icon: Clock,           group: 'Finans' },
  { id: 'kar-zarar',   label: 'Kar / Zarar',      icon: TrendingUp,      group: 'Finans' },
  { id: 'projeler',    label: 'Projeler',          icon: FolderOpen,      group: 'Proje' },
  { id: 'ekipler',     label: 'Ekipler',           icon: Users,           group: 'Proje' },
  { id: 'personel',    label: 'Personel',          icon: Users,           group: 'İK & Bordro' },
  { id: 'bordro',      label: 'Bordro',            icon: FileText,        group: 'İK & Bordro' },
  { id: 'arabulucu',   label: 'Arabulucu',         icon: Scale,           group: 'İK & Bordro' },
  { id: 'icra',        label: 'İcra Takibi',       icon: Scale,           group: 'İK & Bordro' },
  { id: 'is-takibi',   label: 'İş Takibi',         icon: Briefcase,       group: 'Vergi & Beyanname' },
  { id: 'police',      label: 'Poliçe Takibi',     icon: ShieldCheck,     group: 'Sigorta' },
  { id: 'raporlar',    label: 'Raporlar',           icon: BarChart2,       group: 'Sistem' },
  { id: 'ayarlar',     label: 'Ayarlar',           icon: Settings,        group: 'Sistem' },
]

import { Clock, Settings, FileCheck, FolderOpen, Receipt, Shield } from 'lucide-react'

export type ModuleId = string

export const NAV = [
  { id: 'odemeplani', label: 'Ödeme Planı', icon: Clock, group: 'Finans', color: 'from-amber-700 to-amber-900' },
  { id: 'projeler', label: 'Proje Takibi', icon: FolderOpen, group: 'Yönetim', color: 'from-purple-700 to-purple-900' },
  { id: 'payrolls', label: 'Bordro Yönetimi', icon: FileCheck, group: 'İnsan Kaynakları', color: 'from-cyan-700 to-cyan-900' },
  { id: 'vergiler', label: 'Vergi Takibi', icon: Receipt, group: 'Finans', color: 'from-red-700 to-red-900' },
  { id: 'sgk', label: 'SGK Takibi', icon: Shield, group: 'İnsan Kaynakları', color: 'from-green-700 to-green-900' },
  { id: 'ayarlar', label: 'Ayarlar', icon: Settings, group: 'Sistem', color: 'from-slate-700 to-slate-900' },
]

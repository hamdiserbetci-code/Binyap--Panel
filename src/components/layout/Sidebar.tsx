'use client'
import { useFirma } from '@/context/FirmaContext'
import { useRouter } from 'next/navigation'
import { ActivePage } from '@/app/panel/[firmaId]/page'
import {
  ClipboardList, TrendingUp, FolderOpen, CheckSquare,
  Wallet, Users, CreditCard,
  FileText, Shield, Gavel,
  BarChart2, Settings, Database,
  Building2, ChevronDown, LogOut
} from 'lucide-react'

interface Props {
  activePage: ActivePage
  onNavigate: (page: ActivePage) => void
}

const MENU = [
  {
    group: 'YÖNETİM',
    items: [
      { id: 'is-takibi' as ActivePage,    label: 'İş Takibi',     icon: ClipboardList },
      { id: 'kar-zarar' as ActivePage,    label: 'Kar / Zarar',   icon: TrendingUp },
      { id: 'evrak-takibi' as ActivePage, label: 'Evrak Takibi',  icon: FolderOpen },
      { id: 'gunluk-isler' as ActivePage, label: 'Günlük İşler',  icon: CheckSquare },
    ]
  },
  {
    group: 'FİNANS',
    items: [
      { id: 'kasa' as ActivePage,         label: 'Kasa',          icon: Wallet },
      { id: 'cari-hesap' as ActivePage,   label: 'Cari Hesap',    icon: Users },
      { id: 'odeme-plani' as ActivePage,  label: 'Ödeme Planı',   icon: CreditCard },
    ]
  },
  {
    group: 'İK',
    items: [
      { id: 'bordro' as ActivePage,       label: 'Bordro',        icon: FileText },
      { id: 'sgk-bildirge' as ActivePage, label: 'SGK Bildirgesi',icon: Shield },
      { id: 'icra-takibi' as ActivePage,  label: 'İcra Takibi',   icon: Gavel },
    ]
  },
  {
    group: 'ANALİZ',
    items: [
      { id: 'raporlama' as ActivePage,    label: 'Raporlama',     icon: BarChart2 },
      { id: 'ayarlar' as ActivePage,      label: 'Ayarlar',       icon: Settings },
      { id: 'yedekleme' as ActivePage,    label: 'Yedekleme',     icon: Database },
    ]
  },
]

export default function Sidebar({ activePage, onNavigate }: Props) {
  const { firma, firmalar, setFirma } = useFirma()
  const router = useRouter()

  async function signOut() {
    const { supabase } = await import('@/lib/supabase')
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <aside className="h-full bg-white border-r border-slate-200 flex flex-col shadow-sm">
      {/* Logo + Firma */}
      <div className="px-5 py-5 border-b border-slate-100">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
            <Building2 size={15} className="text-white"/>
          </div>
          <span className="font-bold text-slate-800 text-sm tracking-wide">ETM Panel</span>
        </div>
        {firmalar.length > 1 ? (
          <button onClick={() => router.push('/panel')}
            className="w-full flex items-center justify-between bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl px-3 py-2 transition-all">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-700 truncate">{firma?.ad}</p>
              <p className="text-[10px] text-slate-400">Firma değiştir</p>
            </div>
            <ChevronDown size={13} className="text-slate-400 flex-shrink-0"/>
          </button>
        ) : (
          <div className="bg-blue-50 rounded-xl px-3 py-2">
            <p className="text-xs font-semibold text-blue-700 truncate">{firma?.ad}</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto space-y-1">
        {MENU.map(({ group, items }) => (
          <div key={group} className="mb-2">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-3 mb-1">{group}</p>
            {items.map(({ id, label, icon: Icon }) => {
              const isActive = activePage === id
              return (
                <button key={id} onClick={() => onNavigate(id)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all mb-0.5 ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-sm shadow-blue-200'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-800'
                  }`}>
                  <Icon size={15} className={isActive ? 'text-white' : 'text-slate-400'}/>
                  <span>{label}</span>
                </button>
              )
            })}
          </div>
        ))}
      </nav>

      {/* User */}
      <div className="px-3 py-3 border-t border-slate-100">
        <button onClick={signOut}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-slate-500 hover:text-red-500 hover:bg-red-50 transition-all">
          <LogOut size={14}/>
          <span>Çıkış Yap</span>
        </button>
      </div>
    </aside>
  )
}

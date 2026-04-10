'use client'
import { ActivePage } from '@/app/panel/[firmaId]/page'
import { Firma } from '@/types'
import { Menu, Building2 } from 'lucide-react'

interface Props {
  firma: Firma
  activePage: ActivePage
  onMenuOpen: () => void
  userId: string
}

const PAGE_TITLES: Record<ActivePage, string> = {
  'is-takibi':    'İş Takibi',
  'kar-zarar':    'Kar / Zarar Takibi',
  'evrak-takibi': 'Evrak Takibi',
  'gunluk-isler': 'Günlük İşler',
  'kasa':         'Kasa',
  'cari-hesap':   'Cari Hesap',
  'odeme-plani':  'Ödeme Planı',
  'bordro':       'Bordro',
  'sgk-bildirge': 'SGK Bildirgesi',
  'icra-takibi':  'İcra Takibi',
  'raporlama':    'Raporlama',
  'ayarlar':      'Ayarlar',
  'yedekleme':    'Yedekleme',
}

export default function Header({ firma, activePage, onMenuOpen }: Props) {
  return (
    <header className="bg-white border-b border-slate-200 h-14 flex items-center px-5 gap-4 flex-shrink-0">
      <button onClick={onMenuOpen} className="lg:hidden text-slate-400 hover:text-slate-600">
        <Menu size={20}/>
      </button>
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <span className="text-slate-300 text-lg font-light hidden sm:block">|</span>
        <span className="font-semibold text-slate-800 text-sm">{PAGE_TITLES[activePage]}</span>
      </div>
      <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5">
        <Building2 size={13} className="text-blue-600 flex-shrink-0"/>
        <span className="text-xs font-medium text-slate-600 max-w-[140px] truncate">{firma.ad}</span>
      </div>
    </header>
  )
}

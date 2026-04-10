'use client'

import { LogOut, ClipboardList } from 'lucide-react'
import type { Firma, KullaniciProfil } from '@/types'
import { NAV, type ModuleId } from '@/app/nav-config'

interface AppSidebarProps {
  firma: Firma
  profil: KullaniciProfil
  activeModule: ModuleId
  navigate: (id: ModuleId) => void
  signOut: () => void
  collapsed?: boolean
}

export function AppSidebar({ firma, profil, activeModule, navigate, signOut, collapsed }: AppSidebarProps) {
  const groups = ['Yönetim', 'Finans', 'Analiz']

  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-4 pt-[calc(1.25rem+env(safe-area-inset-top))] pb-4 shrink-0 transition-all duration-300">
        <div className={`flex items-center gap-3 ${collapsed ? 'justify-center ml-1' : ''}`}>
          <div className="w-9 h-9 rounded-2xl flex items-center justify-center shrink-0"
            style={{ background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)', boxShadow: '0 4px 12px rgba(59, 130, 246, 0.4)' }}>
            <ClipboardList size={16} strokeWidth={1.5} className="text-white" />
          </div>
          <div className={`min-w-0 whitespace-nowrap overflow-hidden transition-all duration-300 ${collapsed ? 'opacity-0 max-w-0' : 'opacity-100 max-w-[200px]'}`}>
            <p className="text-[15px] font-semibold text-slate-800 truncate">{firma.kisa_ad || firma.ad}</p>
            <p className="text-[10px] text-slate-400 uppercase tracking-wider">İş Takip Sistemi</p>
          </div>
        </div>
      </div>

      {/* Navigations */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden py-3 px-3 space-y-5 custom-scroll">
        <div className="space-y-0.5">
          {NAV.filter(n => !n.group).map(item => {
            const Icon = item.icon
            const isActive = activeModule === item.id
            return (
              <button key={item.id} onClick={() => navigate(item.id)} title={collapsed ? item.label : undefined}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-[13px] font-medium transition-all group ${
                  isActive
                    ? 'bg-blue-50 text-blue-700 border border-blue-200'
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                }`}>
                <Icon size={16} strokeWidth={1.5} className="shrink-0" />
                <span className={`flex-1 text-left whitespace-nowrap overflow-hidden transition-all duration-300 ${collapsed ? 'opacity-0 max-w-0' : 'opacity-100 max-w-[200px]'}`}>{item.label}</span>
              </button>
            )
          })}
        </div>
        {groups.map(group => (
          <div key={group}>
            <p className={`px-3 whitespace-nowrap overflow-hidden text-[10px] font-semibold uppercase tracking-widest text-slate-400 transition-all duration-300 ${collapsed ? 'opacity-0 max-h-0 m-0' : 'opacity-100 max-h-10 mb-2'}`}>
              {group}
            </p>
            <div className="space-y-0.5">
              {NAV.filter(n => n.group === group).map(item => {
                const Icon = item.icon
                const isActive = activeModule === item.id
                return (
                  <button key={item.id} onClick={() => navigate(item.id)} title={collapsed ? item.label : undefined}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-[13px] font-medium transition-all group ${
                      isActive
                        ? 'bg-blue-50 text-blue-700 border border-blue-200'
                        : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                    }`}>
                    <Icon size={16} strokeWidth={1.5} className="shrink-0" />
                    <span className={`flex-1 text-left whitespace-nowrap overflow-hidden transition-all duration-300 ${collapsed ? 'opacity-0 max-w-0' : 'opacity-100 max-w-[200px]'}`}>{item.label}</span>
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* User */}
      <div className="p-3 mt-auto border-t border-blue-50 shrink-0">
        <div className={`flex items-center gap-3 p-2 rounded-xl transition-all ${collapsed ? 'justify-center' : 'hover:bg-slate-50'}`}>
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[11px] font-semibold shrink-0"
            style={{ background: 'linear-gradient(135deg, #3b82f6, #0ea5e9)' }}>
            {(profil.ad_soyad || profil.email || 'U')[0]?.toUpperCase() || 'U'}
          </div>
          <div className={`flex-1 min-w-0 whitespace-nowrap overflow-hidden transition-all duration-300 ${collapsed ? 'opacity-0 max-w-0' : 'opacity-100 max-w-[150px]'}`}>
            <p className="text-[13px] font-medium text-slate-700 truncate">{profil.ad_soyad || (profil.email?.split('@')[0] ?? '')}</p>
            <p className="text-[11px] capitalize text-slate-400">{profil.rol}</p>
          </div>
          <button onClick={signOut} title="Çıkış"
            className="w-7 h-7 rounded-lg flex items-center justify-center transition-all hover:bg-slate-100 text-slate-400 hover:text-slate-700 shrink-0">
            <LogOut size={14} strokeWidth={1.5} />
          </button>
        </div>
      </div>
    </div>
  )
}

'use client'
import React, { useState, useMemo, useEffect } from 'react'
import { Building2, ChevronDown, LogOut, Menu, X, Bell, BellOff } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { NAV } from '@/lib/nav'
import type { Firma, ModuleId } from '@/types'
import Hatirlatici from '@/components/ui/Hatirlatici'

interface SidebarProps {
  firmalar: Firma[]
  activeFirmaId: string
  onFirmaChange: (id: string) => void
  activeModule: ModuleId
  onModuleChange: (id: ModuleId) => void
}

export default function Sidebar({ firmalar, activeFirmaId, onFirmaChange, activeModule, onModuleChange }: SidebarProps) {
  const [open, setOpen] = useState(false)
  const [firmaOpen, setFirmaOpen] = useState(false)
  const [bildirimIzni, setBildirimIzni] = useState<NotificationPermission | 'unsupported'>('default')

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setBildirimIzni(Notification.permission)
    } else {
      setBildirimIzni('unsupported')
    }
  }, [])

  async function bildirimIzniIste() {
    const { bildirimIzniIste: iste } = await import('@/lib/notifications')
    const izin = await iste()
    setBildirimIzni(izin)
  }

  const activeFirma = firmalar.find(f => f.id === activeFirmaId)

  const groups = useMemo(() => {
    const map: Record<string, typeof NAV> = {}
    NAV.forEach(item => {
      if (!map[item.group]) map[item.group] = []
      map[item.group].push(item)
    })
    return map
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    window.location.reload()
  }

  const NavContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-5 py-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <Building2 className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="text-sm font-bold text-white">ETM BİNYAPI</div>
            <div className="text-xs text-slate-500">Yönetim Paneli</div>
          </div>
        </div>
      </div>

      {/* Firma Seçici */}
      {firmalar.length > 0 && (
        <div className="px-3 py-3 border-b border-slate-800 relative">
          <button
            onClick={() => setFirmaOpen(v => !v)}
            className="w-full flex items-center justify-between px-3 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
          >
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-6 h-6 bg-blue-500 rounded flex items-center justify-center flex-shrink-0 text-white text-xs font-bold">
                {(activeFirma?.kisa_ad || activeFirma?.ad || 'F')[0]}
              </div>
              <span className="text-sm text-slate-200 truncate font-medium">
                {activeFirma?.kisa_ad || activeFirma?.ad || 'Firma Seç'}
              </span>
            </div>
            <ChevronDown className={`w-4 h-4 text-slate-400 flex-shrink-0 transition-transform ${firmaOpen ? 'rotate-180' : ''}`} />
          </button>

          {firmaOpen && (
            <div className="absolute left-3 right-3 top-full mt-1 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-20 overflow-hidden">
              {firmalar.map(f => (
                <button
                  key={f.id}
                  onClick={() => { onFirmaChange(f.id); setFirmaOpen(false) }}
                  className={`w-full flex items-center gap-2 px-3 py-2.5 text-sm transition-colors ${f.id === activeFirmaId ? 'bg-blue-600/20 text-blue-400' : 'text-slate-300 hover:bg-slate-700'}`}
                >
                  <div className="w-6 h-6 bg-slate-600 rounded flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                    {(f.kisa_ad || f.ad)[0]}
                  </div>
                  <span className="truncate">{f.ad}</span>
                  {f.id === activeFirmaId && <span className="ml-auto text-blue-400">✓</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Menü */}
      <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-4">
        {Object.entries(groups).map(([groupName, items]) => (
          <div key={groupName}>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-3 mb-1">{groupName}</p>
            {items.map(item => {
              const Icon = item.icon
              const active = activeModule === item.id
              return (
                <button
                  key={item.id}
                  onClick={() => { onModuleChange(item.id); setOpen(false) }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors mb-0.5 ${
                    active
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                  }`}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  {item.label}
                </button>
              )
            })}
          </div>
        ))}
      </nav>

      {/* Çıkış */}
      <div className="px-3 py-4 border-t border-slate-800">
        <div className="flex items-center justify-between mb-2">
          <Hatirlatici firmaId={activeFirmaId} onNavigate={(m) => onModuleChange(m as any)} />
          <span className="text-xs text-slate-500 truncate flex-1 ml-2">
            {activeFirma?.kisa_ad || activeFirma?.ad || ''}
          </span>
        </div>

        {/* Bildirim İzin */}
        {bildirimIzni !== 'unsupported' && bildirimIzni !== 'granted' && bildirimIzni !== 'denied' && (
          <button onClick={bildirimIzniIste}
            className="w-full flex items-center gap-2 px-3 py-2 mb-2 rounded-lg text-xs font-medium bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 transition-colors border border-amber-500/20">
            <Bell className="w-3.5 h-3.5 flex-shrink-0" />
            Bildirimlere İzin Ver
          </button>
        )}
        {bildirimIzni === 'granted' && (
          <div className="flex items-center gap-2 px-3 py-1.5 mb-2 rounded-lg text-xs text-green-400 bg-green-500/10">
            <Bell className="w-3.5 h-3.5" />Bildirimler Aktif
          </div>
        )}
        {bildirimIzni === 'denied' && (
          <div className="flex items-center gap-2 px-3 py-1.5 mb-2 rounded-lg text-xs text-slate-500">
            <BellOff className="w-3.5 h-3.5" />Bildirimler Kapalı
          </div>
        )}

        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-rose-400 hover:bg-slate-800 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Çıkış Yap
        </button>
      </div>
    </div>
  )

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-60 bg-slate-900 h-screen flex-shrink-0">
        <NavContent />
      </aside>

      {/* Mobil Üst Bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 bg-slate-900 border-b border-slate-800 safe-top">
        <div className="flex items-center justify-between px-4 h-14">
          <button onClick={() => setOpen(true)} className="p-2 text-slate-400 hover:text-white rounded-lg">
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-blue-600 rounded flex items-center justify-center">
              <Building2 className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="text-sm font-bold text-white">ETM BİNYAPI</span>
          </div>
          <div className="flex items-center gap-1">
            <Hatirlatici firmaId={activeFirmaId} onNavigate={(m) => { onModuleChange(m as any); setOpen(false) }} />
          </div>
        </div>
        {/* Aktif firma bandı */}
        {activeFirma && (
          <div className="px-4 pb-2">
            <span className="text-xs text-slate-500">{activeFirma.ad}</span>
          </div>
        )}
      </div>

      {/* Mobile drawer */}
      {open && (
        <>
          <div className="fixed inset-0 bg-black/60 z-40 md:hidden" onClick={() => setOpen(false)} />
          <aside className="fixed inset-y-0 left-0 z-50 w-72 bg-slate-900 flex flex-col md:hidden shadow-2xl safe-top">
            <button onClick={() => setOpen(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white p-1">
              <X className="w-5 h-5" />
            </button>
            <NavContent />
          </aside>
        </>
      )}
    </>
  )
}

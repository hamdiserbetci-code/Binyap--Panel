'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Briefcase, BookUser, FileArchive, FileSpreadsheet, FolderKanban,
  History, KeyRound, Landmark, LayoutGrid, ListTodo, LogOut,
  ShieldCheck, Users, Wallet, Menu, ChevronDown, ChevronLeft,
  Building2,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import ProjectsModule, { type FirmaRecord } from '@/components/newpanel/ProjectsModule'
import TimesheetModule from '@/components/newpanel/TimesheetModule'
import CashModule from '@/components/newpanel/CashModule'
import TaxModule from '@/components/newpanel/TaxModule'
import DocumentsModule from '@/components/newpanel/DocumentsModule'
import ReportsModule from '@/components/newpanel/ReportsModule'
import TasksModule from '@/components/newpanel/TasksModule'
import OverviewModule from '@/components/newpanel/OverviewModule'
import NotificationCenter from '@/components/newpanel/NotificationCenter'
import ActivityLogModule from '@/components/newpanel/ActivityLogModule'
import UsersModule, { type UserProfileRecord } from '@/components/newpanel/UsersModule'
import CariHesapModule from '@/components/newpanel/CariHesapModule'
import BankalarModule from '@/components/newpanel/BankalarModule'
import SgkModule from '@/components/newpanel/SgkModule'
import { logActivity } from '@/lib/activityLog'

type ModuleId =
  | 'genel-bakis' | 'projeler' | 'puantaj' | 'sgk-bildirimleri'
  | 'bankalar' | 'cari' | 'kasa' | 'vergi-sgk' | 'dokuman'
  | 'raporlar' | 'gorevler' | 'kullanicilar' | 'aktivite'

type ModuleConfig = {
  id: ModuleId; category: string; label: string; shortLabel: string
  icon: LucideIcon; accent: string; title: string; description: string
  allowedRoles: string[]
}

const iconRegistry: Record<string, LucideIcon> = {
  LayoutGrid, FolderKanban, Users, BookUser, Landmark, Wallet,
  ShieldCheck, FileArchive, FileSpreadsheet, ListTodo, KeyRound, History, Building2,
}

const CATEGORY_META: Record<string, { color: string; dim: string; label: string }> = {
  'Operasyon':     { color: '#3B82F6', dim: 'rgba(59,130,246,0.18)',   label: 'OPR' },
  'Finans':        { color: '#10B981', dim: 'rgba(16,185,129,0.18)',   label: 'FIN' },
  'Personel':      { color: '#F59E0B', dim: 'rgba(245,158,11,0.18)',   label: 'PRS' },
  'Arşiv & Rapor': { color: '#8B5CF6', dim: 'rgba(139,92,246,0.18)',   label: 'ARS' },
  'Sistem':        { color: '#64748B', dim: 'rgba(100,116,139,0.18)',  label: 'SYS' },
  'Diğer':         { color: '#64748B', dim: 'rgba(100,116,139,0.18)',  label: 'DGR' },
}

const defaultModules: ModuleConfig[] = [
  { id: 'genel-bakis',      category: 'Operasyon',     label: 'Maliyet Takibi',    shortLabel: 'Maliyet',     icon: LayoutGrid,    accent: 'from-sky-500 to-cyan-400',    title: 'Merkezi Operasyon Paneli',          description: '', allowedRoles: ['yonetici','muhasebe','santiye','izleme'] },
  { id: 'projeler',         category: 'Operasyon',     label: 'Projeler',           shortLabel: 'Projeler',    icon: FolderKanban,  accent: 'from-blue-500 to-indigo-400', title: 'Proje Yönetimi',                     description: '', allowedRoles: ['yonetici','santiye','izleme'] },
  { id: 'gorevler',         category: 'Operasyon',     label: 'Yapılacaklar',       shortLabel: 'Görevler',    icon: ListTodo,      accent: 'from-amber-500 to-orange-400',title: 'Görev Yönetimi',                     description: '', allowedRoles: ['yonetici','muhasebe','santiye','izleme'] },
  { id: 'vergi-sgk',        category: 'Operasyon',     label: 'Vergi / SGK',        shortLabel: 'Vergi/SGK',   icon: ShieldCheck,   accent: 'from-rose-500 to-orange-400', title: 'Resmi Süreçler',                     description: '', allowedRoles: ['yonetici','muhasebe'] },
  { id: 'cari',             category: 'Finans',        label: 'Cari Hesap',         shortLabel: 'Cari',        icon: BookUser,      accent: 'from-cyan-500 to-teal-400',   title: 'Cari Hesap Takibi',                  description: '', allowedRoles: ['yonetici','muhasebe'] },
  { id: 'bankalar',         category: 'Finans',        label: 'Banka Hesapları',    shortLabel: 'Banka',       icon: Landmark,      accent: 'from-indigo-500 to-blue-500', title: 'Banka ve Finans Yönetimi',           description: '', allowedRoles: ['yonetici','muhasebe'] },
  { id: 'kasa',             category: 'Finans',        label: 'Kasa',               shortLabel: 'Kasa',        icon: Wallet,        accent: 'from-teal-500 to-cyan-400',   title: 'Nakit Yönetimi',                     description: '', allowedRoles: ['yonetici','muhasebe'] },
  { id: 'puantaj',          category: 'Personel',      label: 'Puantaj',            shortLabel: 'Puantaj',     icon: Users,         accent: 'from-orange-500 to-amber-400',title: 'Personel Mesai Takibi',              description: '', allowedRoles: ['yonetici','santiye'] },
  { id: 'sgk-bildirimleri', category: 'Personel',      label: 'SGK Bildirimleri',   shortLabel: 'SGK',         icon: ShieldCheck,   accent: 'from-cyan-500 to-sky-400',    title: 'SGK Bildirimleri',                   description: '', allowedRoles: ['yonetici','muhasebe'] },
  { id: 'dokuman',          category: 'Arşiv & Rapor', label: 'Dökümanlar',         shortLabel: 'Arşiv',       icon: FileArchive,   accent: 'from-slate-700 to-slate-500', title: 'Kurumsal Arşiv',                     description: '', allowedRoles: ['yonetici','muhasebe','santiye','izleme'] },
  { id: 'raporlar',         category: 'Arşiv & Rapor', label: 'Raporlar',           shortLabel: 'Raporlar',    icon: FileSpreadsheet,accent:'from-indigo-500 to-blue-400', title: 'Raporlama ve Analiz',                description: '', allowedRoles: ['yonetici','muhasebe','izleme'] },
  { id: 'kullanicilar',     category: 'Sistem',        label: 'Kullanıcılar',       shortLabel: 'Yetkiler',    icon: KeyRound,      accent: 'from-slate-600 to-slate-400', title: 'Sistem Erişimi',                     description: '', allowedRoles: ['yonetici'] },
  { id: 'aktivite',         category: 'Sistem',        label: 'Aktivite Logu',      shortLabel: 'Log',         icon: History,       accent: 'from-cyan-500 to-sky-400',    title: 'Sistem Günlüğü',                     description: '', allowedRoles: ['yonetici','muhasebe'] },
]

const roleLabels: Record<string, string> = {
  yonetici: 'Yönetici', muhasebe: 'Muhasebe', santiye: 'Şantiye', izleme: 'İzleme',
}

function isMissingProfilesTable(message?: string) {
  const v = (message || '').toLowerCase()
  return v.includes('kullanici_profilleri') && (v.includes('schema cache') || v.includes('does not exist') || v.includes('could not find the table'))
}

export default function Page() {
  const [user, setUser] = useState<any>(null)
  const [firma, setFirma] = useState<FirmaRecord | null>(null)
  const [profile, setProfile] = useState<UserProfileRecord | null>(null)
  const [modules, setModules] = useState<ModuleConfig[]>([])
  const [activeModule, setActiveModule] = useState<ModuleId>('genel-bakis')
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [isMobile, setIsMobile] = useState(false)
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    'Operasyon': true, 'Finans': true, 'Personel': true,
    'Arşiv & Rapor': true, 'Sistem': false,
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const handle = () => {
      setIsMobile(window.innerWidth < 1024)
      if (window.innerWidth < 1024) setIsSidebarOpen(false)
    }
    handle()
    window.addEventListener('resize', handle)
    return () => window.removeEventListener('resize', handle)
  }, [])

  function toggleGroup(group: string) {
    setExpandedGroups(prev => ({ ...prev, [group]: !prev[group] }))
  }

  useEffect(() => {
    let mounted = true
    async function bootstrap() {
      try {
        const { data: authData, error: authError } = await supabase.auth.getUser()
        if (authError) throw authError
        if (!authData.user) { window.location.href = '/login'; return }
        if (!mounted) return
        setUser(authData.user)

        const firmaRes = await supabase.from('firmalar').select('*').limit(1)
        if (firmaRes.error) throw new Error(`Firmalar tablosuna erişilemedi: ${firmaRes.error.message}`)
        let activeFirma: FirmaRecord | null = null
        if (!firmaRes.data || firmaRes.data.length === 0) {
          const ins = await supabase.from('firmalar').insert({ ad: 'ETM' }).select('*').single()
          if (ins.error) throw new Error(`Varsayılan firma oluşturulamadı: ${ins.error.message}`)
          activeFirma = ins.data as FirmaRecord
        } else {
          activeFirma = firmaRes.data[0] as FirmaRecord
        }
        if (!mounted) return
        setFirma(activeFirma)

        let activeProfile: UserProfileRecord | null = null
        const profileRes = await supabase.from('kullanici_profilleri').select('*').eq('auth_user_id', authData.user.id).maybeSingle()
        if (profileRes.error) {
          if (isMissingProfilesTable(profileRes.error.message)) {
            activeProfile = { id: 'local-admin', auth_user_id: authData.user.id, firma_id: activeFirma.id, ad_soyad: authData.user.user_metadata?.full_name || null, email: authData.user.email || 'kullanici@etm.local', rol: 'yonetici', aktif: true, son_giris_at: new Date().toISOString() }
            if (mounted) setError('kullanici_profilleri tablosu bulunamadı. Panel geçici yönetici modu ile açıldı.')
          } else throw profileRes.error
        } else {
          activeProfile = profileRes.data as UserProfileRecord | null
          if (!activeProfile) {
            const ins2 = await supabase.from('kullanici_profilleri').insert({ auth_user_id: authData.user.id, firma_id: activeFirma.id, email: authData.user.email || 'kullanici@etm.local', ad_soyad: authData.user.user_metadata?.full_name || null, aktif: true, son_giris_at: new Date().toISOString() }).select('*').single()
            if (ins2.error) throw ins2.error
            activeProfile = ins2.data as UserProfileRecord
          } else {
            const upd = await supabase.from('kullanici_profilleri').update({ son_giris_at: new Date().toISOString() }).eq('id', activeProfile.id).select('*').single()
            if (!upd.error && upd.data) activeProfile = upd.data as UserProfileRecord
          }
        }

        if (activeProfile && !activeProfile.aktif) {
          if (mounted) { setError('Bu hesap pasif durumdadır.'); setLoading(false) }
          await supabase.auth.signOut(); window.location.href = '/login'; return
        }
        if (!mounted) return
        setProfile(activeProfile)

        let loadedModules = defaultModules
        const modRes = await supabase.from('sistem_modulleri').select('*').eq('aktif', true).order('sira', { ascending: true })
        if (!modRes.error && modRes.data && modRes.data.length > 0) {
          const dbMods = modRes.data
            .filter((m: any) => m.id !== 'gelir-gider' && m.id !== 'finans')
            .map((m: any) => {
              const def = defaultModules.find(d => d.id === m.id)
              return { id: m.id as ModuleId, category: def?.category || 'Diğer', label: m.label, shortLabel: m.short_label, icon: iconRegistry[m.icon] || LayoutGrid, accent: m.accent, title: m.title, description: m.description, allowedRoles: m.izin_verilen_roller || ['yonetici'] }
            })
          defaultModules.forEach(dm => { if (!dbMods.find((m: any) => m.id === dm.id)) dbMods.push(dm) })
          loadedModules = dbMods
        }
        if (!mounted) return
        setModules(loadedModules)
        setLoading(false)

        if (activeProfile?.id !== 'local-admin') {
          void logActivity({ firmaId: activeFirma.id, authUserId: authData.user.id, kullaniciProfilId: activeProfile?.id || null, modul: 'oturum', islemTuru: 'oturum_acildi', kayitTuru: 'kullanici_profili', kayitId: activeProfile?.id || null, aciklama: `${authData.user.email || 'Kullanici'} panel oturumu açtı.` })
        }
      } catch (err: any) {
        if (!mounted) return
        setError(err?.message || 'Panel başlatılırken bir hata oluştu.')
        setLoading(false)
      }
    }
    bootstrap()
    return () => { mounted = false }
  }, [])

  const visibleModules = useMemo(() => {
    const role = profile?.rol || 'izleme'
    return modules.filter(m => m.allowedRoles.includes(role))
  }, [modules, profile?.rol])

  const CATEGORY_ORDER = ['Operasyon', 'Finans', 'Personel', 'Arşiv & Rapor', 'Sistem', 'Diğer']
  const groupedModules = useMemo(() => {
    const groups: Record<string, ModuleConfig[]> = {}
    visibleModules.forEach(m => { const c = m.category || 'Diğer'; if (!groups[c]) groups[c] = []; groups[c].push(m) })
    return groups
  }, [visibleModules])

  useEffect(() => {
    if (!visibleModules.length) return
    if (!visibleModules.some(m => m.id === activeModule)) setActiveModule(visibleModules[0].id)
  }, [activeModule, visibleModules])

  const activeItem = useMemo(() => visibleModules.find(m => m.id === activeModule) ?? visibleModules[0], [activeModule, visibleModules])

  async function signOut() {
    if (firma && user && profile?.id !== 'local-admin') {
      void logActivity({ firmaId: firma.id, authUserId: user.id, kullaniciProfilId: profile?.id || null, modul: 'oturum', islemTuru: 'oturum_kapandi', kayitTuru: 'kullanici_profili', kayitId: profile?.id || null, aciklama: `${user.email || 'Kullanici'} oturumu kapattı.` })
    }
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  // ── Loading / Error screens ──────────────────────────────────────────────
  if (loading) return (
    <div className="flex min-h-screen items-center justify-center" style={{ background: '#0B0F1A' }}>
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg,#3B82F6,#6366F1)' }}>
          <Briefcase size={18} className="text-white" />
        </div>
        <div className="flex gap-1.5">
          {[0,1,2].map(i => (
            <div key={i} className="w-1.5 h-1.5 rounded-full bg-blue-500" style={{ animation: `pulseAccent 1.2s ease ${i*0.2}s infinite` }} />
          ))}
        </div>
        <p className="text-xs text-slate-500 tracking-widest uppercase">Panel Yükleniyor</p>
      </div>
    </div>
  )

  if (error && (!user || !activeItem || !firma)) return (
    <div className="flex min-h-screen items-center justify-center px-4" style={{ background: '#0B0F1A' }}>
      <div className="w-full max-w-lg rounded-2xl p-6" style={{ background: '#161B27', border: '1px solid rgba(239,68,68,0.25)' }}>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-2 h-2 rounded-full bg-red-500" />
          <p className="text-xs uppercase tracking-widest text-red-400 font-semibold">Panel Hatası</p>
        </div>
        <p className="text-sm text-slate-300 leading-6">{error}</p>
        <button onClick={() => window.location.reload()} className="mt-4 px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors" style={{ background: '#3B82F6' }}>
          Yenile
        </button>
      </div>
    </div>
  )

  if (!user || !activeItem) return (
    <div className="flex min-h-screen items-center justify-center" style={{ background: '#0B0F1A' }}>
      <p className="text-sm text-slate-500">Kullanıcı bilgisi bekleniyor...</p>
    </div>
  )

  const activeCatMeta = CATEGORY_META[activeItem.category] || CATEGORY_META['Diğer']

  // ── Main Layout ──────────────────────────────────────────────────────────
  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#0B0F1A', fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>

      {/* Mobile overlay */}
      {isMobile && isSidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm" onClick={() => setIsSidebarOpen(false)} />
      )}

      {/* ══ SIDEBAR ══════════════════════════════════════════════════════════ */}
      <aside
        className={`${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'} absolute lg:relative shrink-0 flex flex-col h-screen z-50`}
        style={{
          width: isSidebarOpen ? '260px' : isMobile ? '260px' : '72px',
          background: '#0D1117',
          borderRight: '1px solid rgba(255,255,255,0.06)',
          transition: 'width 0.25s cubic-bezier(0.4,0,0.2,1), transform 0.25s cubic-bezier(0.4,0,0.2,1)',
        }}
      >
        {/* ── Logo area ── */}
        <div className="shrink-0 flex items-center gap-3 px-4 h-16" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'linear-gradient(135deg,#3B82F6 0%,#6366F1 100%)', boxShadow: '0 0 20px rgba(99,102,241,0.35)' }}>
            <Briefcase size={16} strokeWidth={2.5} className="text-white" />
          </div>
          {isSidebarOpen && (
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-blue-400">ETM · BİNYAPI</p>
              <div className="flex items-center gap-2 mt-0.5">
                <p className="text-[13px] font-semibold text-white leading-none">ERP Panel</p>
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md" style={{ background: 'rgba(59,130,246,0.2)', color: '#60A5FA', border: '1px solid rgba(59,130,246,0.3)' }}>v2.2</span>
              </div>
            </div>
          )}
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center hidden lg:flex transition-colors"
            style={{ color: '#4B5563' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'; (e.currentTarget as HTMLElement).style.color = '#9CA3AF' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = '#4B5563' }}
          >
            <ChevronLeft size={15} style={{ transform: isSidebarOpen ? 'rotate(0deg)' : 'rotate(180deg)', transition: 'transform 0.25s' }} />
          </button>
        </div>

        {/* ── Navigation ── */}
        <nav className="flex-1 overflow-y-auto py-3 [&::-webkit-scrollbar]:hidden">
          {Object.entries(groupedModules)
            .sort(([a], [b]) => {
              const ai = CATEGORY_ORDER.indexOf(a), bi = CATEGORY_ORDER.indexOf(b)
              return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
            })
            .map(([group, items]) => {
              const meta = CATEGORY_META[group] || CATEGORY_META['Diğer']
              const isExpanded = expandedGroups[group] ?? true
              return (
                <div key={group} className="mb-1">
                  {/* Category header */}
                  {isSidebarOpen ? (
                    <button
                      onClick={() => toggleGroup(group)}
                      className="w-full flex items-center justify-between px-4 py-2 group"
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full" style={{ background: meta.color }} />
                        <span className="text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: '#4B5563' }}>{group}</span>
                      </div>
                      <ChevronDown
                        size={12}
                        style={{ color: '#374151', transform: isExpanded ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 0.2s' }}
                      />
                    </button>
                  ) : (
                    <div className="px-3 py-2">
                      <div className="w-full h-px" style={{ background: 'rgba(255,255,255,0.05)' }} />
                    </div>
                  )}

                  {/* Module items */}
                  {(isExpanded || !isSidebarOpen) && (
                    <div className="px-2 space-y-0.5">
                      {items.map(item => {
                        const Icon = item.icon
                        const isActive = item.id === activeModule
                        const itemMeta = CATEGORY_META[item.category] || CATEGORY_META['Diğer']
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => { setActiveModule(item.id); if (isMobile) setIsSidebarOpen(false) }}
                            title={!isSidebarOpen ? item.label : undefined}
                            className="w-full flex items-center rounded-lg transition-all duration-150 group relative"
                            style={{
                              gap: isSidebarOpen ? '10px' : '0',
                              padding: isSidebarOpen ? '8px 10px' : '10px 0',
                              justifyContent: isSidebarOpen ? 'flex-start' : 'center',
                              background: isActive ? itemMeta.dim : 'transparent',
                            }}
                            onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)' }}
                            onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                          >
                            {/* Active indicator bar */}
                            {isActive && isSidebarOpen && (
                              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r-full" style={{ background: itemMeta.color }} />
                            )}
                            {/* Icon */}
                            <div
                              className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center transition-all duration-150"
                              style={isActive
                                ? { background: itemMeta.dim, color: itemMeta.color }
                                : { color: '#4B5563' }}
                            >
                              <Icon size={15} strokeWidth={isActive ? 2.5 : 2} />
                            </div>
                            {/* Label */}
                            {isSidebarOpen && (
                              <span
                                className="text-[12.5px] font-medium truncate transition-colors duration-150"
                                style={{ color: isActive ? '#F1F5F9' : '#6B7280' }}
                              >
                                {item.shortLabel}
                              </span>
                            )}
                            {/* Active dot for collapsed */}
                            {isActive && !isSidebarOpen && (
                              <div className="absolute right-0.5 top-0.5 w-1.5 h-1.5 rounded-full" style={{ background: itemMeta.color }} />
                            )}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
        </nav>

        {/* ── User / Logout ── */}
        <div className="shrink-0 p-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          {isSidebarOpen ? (
            <div className="rounded-xl p-2.5 mb-2" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="flex items-center gap-2.5">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-[12px] font-bold shrink-0"
                  style={{ background: 'linear-gradient(135deg,#1E3A5F,#1D3461)', color: '#60A5FA', border: '1px solid rgba(59,130,246,0.2)' }}
                >
                  {user.email?.charAt(0).toUpperCase() || 'U'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-medium truncate text-slate-300">{user.email}</p>
                  {profile?.rol && (
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md inline-block mt-0.5" style={{ background: 'rgba(59,130,246,0.15)', color: '#60A5FA' }}>
                      {roleLabels[profile.rol] ?? profile.rol}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div
              className="w-8 h-8 mx-auto rounded-lg flex items-center justify-center text-[12px] font-bold mb-2 cursor-default"
              style={{ background: '#1A2535', color: '#60A5FA', border: '1px solid rgba(59,130,246,0.2)' }}
              title={user.email}
            >
              {user.email?.charAt(0).toUpperCase() || 'U'}
            </div>
          )}
          <button
            type="button"
            onClick={signOut}
            title="Güvenli Çıkış"
            className="w-full flex items-center rounded-lg py-2 text-[12px] font-medium transition-all duration-150"
            style={{ gap: isSidebarOpen ? '8px' : '0', justifyContent: isSidebarOpen ? 'flex-start' : 'center', paddingLeft: isSidebarOpen ? '10px' : '0', color: '#4B5563' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.08)'; (e.currentTarget as HTMLElement).style.color = '#EF4444' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = '#4B5563' }}
          >
            <LogOut size={15} />
            {isSidebarOpen && 'Çıkış Yap'}
          </button>
        </div>
      </aside>

      {/* ══ MAIN AREA ════════════════════════════════════════════════════════ */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* ── Top Header ── */}
        <header className="shrink-0 flex items-center justify-between h-16 px-5 gap-4" style={{ background: '#0D1117', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          {/* Left: mobile toggle + breadcrumb */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="lg:hidden w-8 h-8 flex items-center justify-center rounded-lg transition-colors shrink-0"
              style={{ color: '#4B5563', border: '1px solid rgba(255,255,255,0.08)' }}
            >
              <Menu size={17} />
            </button>
            {/* Breadcrumb */}
            <div className="flex items-center gap-2 min-w-0">
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: activeCatMeta.dim }}
              >
                {activeItem && <activeItem.icon size={14} style={{ color: activeCatMeta.color }} strokeWidth={2.5} />}
              </div>
              <div className="min-w-0 hidden sm:block">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: activeCatMeta.color }}>
                    {activeItem?.category}
                  </span>
                  <span className="text-slate-700">/</span>
                  <span className="text-[13px] font-semibold text-white truncate">{activeItem?.label}</span>
                </div>
              </div>
              <span className="text-[13px] font-semibold text-white sm:hidden truncate">{activeItem?.label}</span>
            </div>
          </div>

          {/* Right: notifications + user */}
          <div className="flex items-center gap-2 shrink-0">
            {error && (
              <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#F87171' }}>
                <div className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                {error.length > 60 ? error.slice(0,60) + '…' : error}
              </div>
            )}
            {firma && <NotificationCenter firma={firma} />}
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center text-[12px] font-bold cursor-default"
              style={{ background: 'linear-gradient(135deg,#1E3A5F,#1D3461)', color: '#60A5FA', border: '1px solid rgba(59,130,246,0.2)' }}
              title={user.email}
            >
              {user.email?.charAt(0).toUpperCase() || 'U'}
            </div>
          </div>
        </header>

        {/* Accent line under header */}
        <div className="topbar-accent shrink-0" style={{ opacity: 0.6 }} />

        {/* ── Module content ── */}
        <main className="flex-1 overflow-auto" style={{ background: '#0B0F1A', padding: '20px' }}>
          {firma ? (
            <div key={activeModule} className="module-enter h-full">
              {renderModule(activeModule, firma, profile, setFirma)}
            </div>
          ) : (
            <div className="rounded-xl p-5 text-sm" style={{ background: '#161B27', border: '1px solid rgba(255,255,255,0.07)', color: '#6B7280' }}>
              Firma bulunamadı.
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

function renderModule(moduleId: ModuleId, firma: FirmaRecord, profile: UserProfileRecord | null, onFirmaUpdated: (f: FirmaRecord) => void) {
  switch (moduleId) {
    case 'projeler':         return <ProjectsModule firma={firma} role={profile?.rol} />
    case 'puantaj':          return <TimesheetModule firma={firma} role={profile?.rol} />
    case 'sgk-bildirimleri': return <SgkModule firma={firma} role={profile?.rol} />
    case 'cari':             return <CariHesapModule firma={firma} role={profile?.rol} />
    case 'bankalar':         return <BankalarModule firma={firma} role={profile?.rol} />
    case 'kasa':             return <CashModule firma={firma} role={profile?.rol} />
    case 'vergi-sgk':        return <TaxModule firma={firma} role={profile?.rol} />
    case 'dokuman':          return <DocumentsModule firma={firma} role={profile?.rol} />
    case 'raporlar':         return <ReportsModule firma={firma} role={profile?.rol} />
    case 'gorevler':         return <TasksModule firma={firma} role={profile?.rol} />
    case 'kullanicilar':     return <UsersModule firma={firma} currentProfile={profile} role={profile?.rol} onFirmaUpdated={onFirmaUpdated} />
    case 'aktivite':         return <ActivityLogModule firma={firma} role={profile?.rol} />
    case 'genel-bakis':      return <OverviewModule firma={firma} />
    default:                 return <PlaceholderModule moduleId={moduleId} />
  }
}

function PlaceholderModule({ moduleId }: { moduleId: string }) {
  return (
    <div className="rounded-2xl p-6" style={{ background: '#161B27', border: '1px solid rgba(255,255,255,0.07)' }}>
      <p className="text-sm text-slate-400">Bu modül henüz aktif değil: <code className="text-blue-400">{moduleId}</code></p>
    </div>
  )
}

'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  BookUser, FileArchive, FileSpreadsheet, FolderKanban,
  History, KeyRound, Landmark, LayoutGrid, ListTodo, LogOut,
  ShieldCheck, Users, Wallet, Menu, ChevronDown, ChevronLeft,
  Building2, ShoppingCart,
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
import SatinAlmaModule from '@/components/newpanel/SatinAlmaModule'
import { logActivity } from '@/lib/activityLog'

// ── BİNYAPI Logo SVG ──────────────────────────────────────────────────────────
function BinyapiLogo({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="by_g1" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FCD34D" />
          <stop offset="100%" stopColor="#F59E0B" />
        </linearGradient>
        <linearGradient id="by_g2" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FDE68A" />
          <stop offset="100%" stopColor="#FBBF24" />
        </linearGradient>
      </defs>
      {/* Zemin çizgisi */}
      <rect x="3" y="33" width="34" height="3" rx="1.5" fill="url(#by_g1)" />
      {/* Sol bina - kısa */}
      <rect x="4" y="21" width="8" height="13" rx="1.5" fill="url(#by_g1)" opacity="0.7" />
      {/* Pencereler sol bina */}
      <rect x="6" y="23" width="2" height="2" rx="0.5" fill="white" opacity="0.5" />
      <rect x="9" y="23" width="2" height="2" rx="0.5" fill="white" opacity="0.5" />
      <rect x="6" y="27" width="2" height="2" rx="0.5" fill="white" opacity="0.5" />
      <rect x="9" y="27" width="2" height="2" rx="0.5" fill="white" opacity="0.5" />
      {/* Orta bina - en uzun */}
      <rect x="14" y="8" width="12" height="26" rx="2" fill="url(#by_g2)" />
      {/* Pencereler orta bina */}
      <rect x="16" y="11" width="3" height="3" rx="0.5" fill="white" opacity="0.55" />
      <rect x="21" y="11" width="3" height="3" rx="0.5" fill="white" opacity="0.55" />
      <rect x="16" y="17" width="3" height="3" rx="0.5" fill="white" opacity="0.55" />
      <rect x="21" y="17" width="3" height="3" rx="0.5" fill="white" opacity="0.55" />
      <rect x="16" y="23" width="3" height="3" rx="0.5" fill="white" opacity="0.55" />
      <rect x="21" y="23" width="3" height="3" rx="0.5" fill="white" opacity="0.55" />
      {/* Anten */}
      <rect x="19" y="3" width="2" height="6" rx="1" fill="url(#by_g1)" />
      <circle cx="20" cy="3" r="1.5" fill="#FCD34D" />
      {/* Sağ bina - orta boy */}
      <rect x="28" y="16" width="8" height="18" rx="1.5" fill="url(#by_g1)" opacity="0.75" />
      {/* Pencereler sağ bina */}
      <rect x="30" y="18" width="2" height="2" rx="0.5" fill="white" opacity="0.5" />
      <rect x="33" y="18" width="2" height="2" rx="0.5" fill="white" opacity="0.5" />
      <rect x="30" y="23" width="2" height="2" rx="0.5" fill="white" opacity="0.5" />
      <rect x="33" y="23" width="2" height="2" rx="0.5" fill="white" opacity="0.5" />
      <rect x="30" y="28" width="2" height="2" rx="0.5" fill="white" opacity="0.5" />
      <rect x="33" y="28" width="2" height="2" rx="0.5" fill="white" opacity="0.5" />
    </svg>
  )
}

// ── Tipler ────────────────────────────────────────────────────────────────────
type ModuleId =
  | 'genel-bakis' | 'projeler' | 'puantaj' | 'sgk-bildirimleri'
  | 'bankalar' | 'cari' | 'kasa' | 'vergi-sgk' | 'dokuman'
  | 'raporlar' | 'gorevler' | 'kullanicilar' | 'aktivite' | 'satinalma'

type ModuleConfig = {
  id: ModuleId; category: string; label: string; shortLabel: string
  icon: LucideIcon; accent: string; title: string; description: string
  allowedRoles: string[]
}

const iconRegistry: Record<string, LucideIcon> = {
  LayoutGrid, FolderKanban, Users, BookUser, Landmark, Wallet,
  ShieldCheck, FileArchive, FileSpreadsheet, ListTodo, KeyRound,
  History, Building2, ShoppingCart,
}

const CATEGORY_META: Record<string, { color: string; dim: string; glow: string }> = {
  'Operasyon':     { color: '#60A5FA', dim: 'rgba(96,165,250,0.15)',  glow: 'rgba(96,165,250,0.3)' },
  'Finans':        { color: '#34D399', dim: 'rgba(52,211,153,0.15)',  glow: 'rgba(52,211,153,0.3)' },
  'Personel':      { color: '#FBBF24', dim: 'rgba(251,191,36,0.15)', glow: 'rgba(251,191,36,0.3)' },
  'Arşiv & Rapor': { color: '#A78BFA', dim: 'rgba(167,139,250,0.15)',glow: 'rgba(167,139,250,0.3)' },
  'Sistem':        { color: '#94A3B8', dim: 'rgba(148,163,184,0.12)',glow: 'rgba(148,163,184,0.25)' },
  'Diğer':         { color: '#94A3B8', dim: 'rgba(148,163,184,0.12)',glow: 'rgba(148,163,184,0.25)' },
}

const defaultModules: ModuleConfig[] = [
  { id: 'genel-bakis',      category: 'Operasyon',     label: 'Maliyet Takibi',    shortLabel: 'Maliyet',     icon: LayoutGrid,    accent: '', title: '', description: '', allowedRoles: ['yonetici','muhasebe','santiye','izleme'] },
  { id: 'projeler',         category: 'Operasyon',     label: 'Projeler',           shortLabel: 'Projeler',    icon: FolderKanban,  accent: '', title: '', description: '', allowedRoles: ['yonetici','santiye','izleme'] },
  { id: 'gorevler',         category: 'Operasyon',     label: 'Yapılacaklar',       shortLabel: 'Görevler',    icon: ListTodo,      accent: '', title: '', description: '', allowedRoles: ['yonetici','muhasebe','santiye','izleme'] },
  { id: 'satinalma',        category: 'Operasyon',     label: 'Satın Alma',         shortLabel: 'Satın Alma',  icon: ShoppingCart,  accent: '', title: '', description: '', allowedRoles: ['yonetici','muhasebe','santiye'] },
  { id: 'vergi-sgk',        category: 'Operasyon',     label: 'Vergi / SGK',        shortLabel: 'Vergi/SGK',   icon: ShieldCheck,   accent: '', title: '', description: '', allowedRoles: ['yonetici','muhasebe'] },
  { id: 'cari',             category: 'Finans',        label: 'Cari Hesap',         shortLabel: 'Cari Hesap', icon: BookUser,      accent: '', title: '', description: '', allowedRoles: ['yonetici','muhasebe'] },
  { id: 'bankalar',         category: 'Finans',        label: 'Banka Hesapları',    shortLabel: 'Banka',       icon: Landmark,      accent: '', title: '', description: '', allowedRoles: ['yonetici','muhasebe'] },
  { id: 'kasa',             category: 'Finans',        label: 'Kasa',               shortLabel: 'Kasa',        icon: Wallet,        accent: '', title: '', description: '', allowedRoles: ['yonetici','muhasebe'] },
  { id: 'puantaj',          category: 'Personel',      label: 'Puantaj',            shortLabel: 'Puantaj',     icon: Users,         accent: '', title: '', description: '', allowedRoles: ['yonetici','santiye'] },
  { id: 'sgk-bildirimleri', category: 'Personel',      label: 'SGK Bildirimleri',   shortLabel: 'SGK',         icon: ShieldCheck,   accent: '', title: '', description: '', allowedRoles: ['yonetici','muhasebe'] },
  { id: 'dokuman',          category: 'Arşiv & Rapor', label: 'Dökümanlar',         shortLabel: 'Arşiv',       icon: FileArchive,   accent: '', title: '', description: '', allowedRoles: ['yonetici','muhasebe','santiye','izleme'] },
  { id: 'raporlar',         category: 'Arşiv & Rapor', label: 'Raporlar',           shortLabel: 'Raporlar',    icon: FileSpreadsheet,accent:'', title: '', description: '', allowedRoles: ['yonetici','muhasebe','izleme'] },
  { id: 'kullanicilar',     category: 'Sistem',        label: 'Kullanıcılar',       shortLabel: 'Kullanıcılar',icon: KeyRound,      accent: '', title: '', description: '', allowedRoles: ['yonetici'] },
  { id: 'aktivite',         category: 'Sistem',        label: 'Aktivite Logu',      shortLabel: 'Aktivite',    icon: History,       accent: '', title: '', description: '', allowedRoles: ['yonetici','muhasebe'] },
]

const roleLabels: Record<string, string> = {
  yonetici: 'Yönetici', muhasebe: 'Muhasebe', santiye: 'Şantiye', izleme: 'İzleme',
}
const roleColors: Record<string, string> = {
  yonetici: '#F87171', muhasebe: '#60A5FA', santiye: '#FBBF24', izleme: '#94A3B8',
}

function isMissingProfilesTable(message?: string) {
  const v = (message || '').toLowerCase()
  return v.includes('kullanici_profilleri') && (v.includes('schema cache') || v.includes('does not exist') || v.includes('could not find the table'))
}

// ── Ana Bileşen ───────────────────────────────────────────────────────────────
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
            if (mounted) setError('kullanici_profilleri tablosu bulunamadı.')
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
              return { id: m.id as ModuleId, category: def?.category || 'Diğer', label: m.label, shortLabel: m.short_label, icon: iconRegistry[m.icon] || LayoutGrid, accent: m.accent || '', title: m.title || '', description: m.description || '', allowedRoles: m.izin_verilen_roller || ['yonetici'] }
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

  // ── Loading screen ─────────────────────────────────────────────────────────
  if (loading) return (
    <div className="flex min-h-screen items-center justify-center" style={{ background: 'linear-gradient(135deg, #0D1B2E 0%, #142040 100%)' }}>
      <div className="flex flex-col items-center gap-6">
        <BinyapiLogo size={56} />
        <div>
          <p className="text-center text-lg font-bold text-white tracking-wide">BİNYAPI</p>
          <p className="text-center text-xs text-amber-400/70 tracking-[0.3em] uppercase font-semibold">İnşaat ERP</p>
        </div>
        <div className="flex gap-2">
          {[0,1,2].map(i => (
            <div key={i} className="w-2 h-2 rounded-full bg-amber-400 dot-pulse" style={{ animationDelay: `${i * 0.2}s` }} />
          ))}
        </div>
      </div>
    </div>
  )

  if (error && (!user || !activeItem || !firma)) return (
    <div className="flex min-h-screen items-center justify-center px-4" style={{ background: 'linear-gradient(135deg, #0D1B2E 0%, #142040 100%)' }}>
      <div className="w-full max-w-lg rounded-2xl p-6 glass">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
          <p className="text-xs uppercase tracking-widest text-red-400 font-bold">Panel Hatası</p>
        </div>
        <p className="text-sm text-slate-300 leading-6">{error}</p>
        <button onClick={() => window.location.reload()} className="mt-4 px-5 py-2.5 rounded-xl text-sm font-semibold text-white" style={{ background: '#3B82F6' }}>
          Yenile
        </button>
      </div>
    </div>
  )

  if (!user || !activeItem) return (
    <div className="flex min-h-screen items-center justify-center" style={{ background: '#0D1B2E' }}>
      <p className="text-slate-500">Yükleniyor...</p>
    </div>
  )

  const activeCatMeta = CATEGORY_META[activeItem.category] || CATEGORY_META['Diğer']
  const sidebarW = isSidebarOpen ? '280px' : isMobile ? '280px' : '80px'

  // ── Main Layout ────────────────────────────────────────────────────────────
  return (
    <div className="flex h-screen overflow-hidden" style={{
      background: 'linear-gradient(160deg, #0D1B2E 0%, #0F2341 40%, #0D1B2E 100%)',
      fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
    }}>
      {/* Arka plan ışık efektleri */}
      <div className="fixed inset-0 -z-10 pointer-events-none">
        <div style={{ position: 'absolute', top: '-10%', left: '20%', width: '500px', height: '500px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(59,130,246,0.06) 0%, transparent 70%)', filter: 'blur(40px)' }} />
        <div style={{ position: 'absolute', bottom: '10%', right: '10%', width: '400px', height: '400px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(245,158,11,0.04) 0%, transparent 70%)', filter: 'blur(40px)' }} />
      </div>

      {/* Mobile overlay */}
      {isMobile && isSidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={() => setIsSidebarOpen(false)} />
      )}

      {/* ══ SIDEBAR ══════════════════════════════════════════════════════════ */}
      <aside
        className={`${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'} absolute lg:relative shrink-0 flex flex-col h-screen z-50`}
        style={{
          width: sidebarW,
          background: 'rgba(8, 18, 38, 0.88)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderRight: '1px solid rgba(255,255,255,0.10)',
          transition: 'width 0.28s cubic-bezier(0.4,0,0.2,1), transform 0.28s cubic-bezier(0.4,0,0.2,1)',
          boxShadow: '4px 0 32px rgba(0,0,0,0.35)',
        }}
      >
        {/* ── Logo alanı ── */}
        <div className="shrink-0 flex items-center gap-3.5 px-5 h-20" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="shrink-0 relative">
            <BinyapiLogo size={isSidebarOpen ? 40 : 36} />
          </div>
          {isSidebarOpen && (
            <div className="flex-1 min-w-0">
              <p className="text-[17px] font-extrabold leading-tight text-white tracking-wide">BİNYAPI</p>
              <div className="flex items-center gap-2 mt-0.5">
                <p className="text-[11px] font-semibold text-amber-400/80 tracking-widest uppercase leading-none">İnşaat &amp; ETM</p>
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(251,191,36,0.15)', color: '#FBBF24', border: '1px solid rgba(251,191,36,0.3)' }}>ERP v2.2</span>
              </div>
            </div>
          )}
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="shrink-0 w-8 h-8 rounded-lg items-center justify-center hidden lg:flex transition-all duration-200"
            style={{ color: '#4B5563' }}
            onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.background = 'rgba(255,255,255,0.08)'; el.style.color = '#CBD5E1' }}
            onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.background = 'transparent'; el.style.color = '#4B5563' }}
          >
            <ChevronLeft size={17} style={{ transform: isSidebarOpen ? 'rotate(0deg)' : 'rotate(180deg)', transition: 'transform 0.28s' }} />
          </button>
        </div>

        {/* ── Navigasyon ── */}
        <nav className="flex-1 overflow-y-auto py-4 [&::-webkit-scrollbar]:hidden" style={{ paddingLeft: isSidebarOpen ? '0' : '0' }}>
          {Object.entries(groupedModules)
            .sort(([a], [b]) => {
              const ai = CATEGORY_ORDER.indexOf(a), bi = CATEGORY_ORDER.indexOf(b)
              return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
            })
            .map(([group, items]) => {
              const meta = CATEGORY_META[group] || CATEGORY_META['Diğer']
              const isExpanded = expandedGroups[group] ?? true
              return (
                <div key={group} className="mb-2">
                  {/* Kategori başlığı */}
                  {isSidebarOpen ? (
                    <button
                      onClick={() => toggleGroup(group)}
                      className="w-full flex items-center justify-between px-5 py-2 group transition-all"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-2 h-2 rounded-full" style={{ background: meta.color, boxShadow: `0 0 6px ${meta.glow}` }} />
                        <span className="text-[11.5px] font-bold uppercase tracking-[0.15em]" style={{ color: 'rgba(255,255,255,0.35)' }}>{group}</span>
                      </div>
                      <ChevronDown size={13} style={{ color: 'rgba(255,255,255,0.2)', transform: isExpanded ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 0.2s' }} />
                    </button>
                  ) : (
                    <div className="mx-4 my-2">
                      <div className="w-full h-px" style={{ background: 'rgba(255,255,255,0.07)' }} />
                    </div>
                  )}

                  {/* Modül item'ları */}
                  {(isExpanded || !isSidebarOpen) && (
                    <div className="space-y-0.5 px-3">
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
                            className="w-full flex items-center rounded-xl transition-all duration-150 relative"
                            style={{
                              gap: isSidebarOpen ? '12px' : '0',
                              padding: isSidebarOpen ? '10px 12px' : '11px 0',
                              justifyContent: isSidebarOpen ? 'flex-start' : 'center',
                              background: isActive
                                ? `linear-gradient(135deg, ${itemMeta.dim}, rgba(255,255,255,0.04))`
                                : 'transparent',
                              border: isActive ? `1px solid ${itemMeta.color}25` : '1px solid transparent',
                            }}
                            onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)' }}
                            onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                          >
                            {/* Sol aktif çizgi */}
                            {isActive && isSidebarOpen && (
                              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 rounded-r-full" style={{ background: itemMeta.color, boxShadow: `0 0 8px ${itemMeta.glow}` }} />
                            )}
                            {/* İkon */}
                            <div
                              className="shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-150"
                              style={isActive
                                ? { background: itemMeta.dim, boxShadow: `0 0 12px ${itemMeta.glow}` }
                                : { background: 'rgba(255,255,255,0.04)' }}
                            >
                              <Icon
                                size={18}
                                strokeWidth={isActive ? 2.5 : 1.8}
                                style={{ color: isActive ? itemMeta.color : 'rgba(255,255,255,0.35)' }}
                              />
                            </div>
                            {/* Etiket */}
                            {isSidebarOpen && (
                              <span
                                className="text-[14px] font-semibold truncate"
                                style={{ color: isActive ? '#F1F5F9' : 'rgba(255,255,255,0.45)', letterSpacing: '0.01em' }}
                              >
                                {item.shortLabel}
                              </span>
                            )}
                            {/* Collapsed aktif nokta */}
                            {isActive && !isSidebarOpen && (
                              <div className="absolute right-1 top-1 w-2 h-2 rounded-full" style={{ background: itemMeta.color, boxShadow: `0 0 6px ${itemMeta.glow}` }} />
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

        {/* ── Kullanıcı & Çıkış ── */}
        <div className="shrink-0 p-4" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          {isSidebarOpen ? (
            <div className="rounded-xl p-3 mb-3" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)' }}>
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-[14px] font-extrabold shrink-0"
                  style={{
                    background: 'linear-gradient(135deg, rgba(59,130,246,0.3), rgba(99,102,241,0.3))',
                    color: '#93C5FD',
                    border: '1px solid rgba(59,130,246,0.3)',
                    boxShadow: '0 0 16px rgba(59,130,246,0.2)',
                  }}
                >
                  {user.email?.charAt(0).toUpperCase() || 'U'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[12.5px] font-semibold truncate" style={{ color: '#CBD5E1' }}>{profile?.ad_soyad || user.email}</p>
                  <p className="text-[11px] truncate mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>{user.email}</p>
                  {profile?.rol && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full inline-block mt-1" style={{ background: `${roleColors[profile.rol] || '#94A3B8'}18`, color: roleColors[profile.rol] || '#94A3B8', border: `1px solid ${roleColors[profile.rol] || '#94A3B8'}30` }}>
                      {roleLabels[profile.rol] ?? profile.rol}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div
              className="w-10 h-10 mx-auto rounded-xl flex items-center justify-center text-[14px] font-extrabold mb-3 cursor-default"
              style={{ background: 'rgba(59,130,246,0.2)', color: '#93C5FD', border: '1px solid rgba(59,130,246,0.25)' }}
              title={user.email}
            >
              {user.email?.charAt(0).toUpperCase() || 'U'}
            </div>
          )}
          <button
            type="button"
            onClick={signOut}
            title="Güvenli Çıkış"
            className="w-full flex items-center rounded-xl py-2.5 text-[13px] font-semibold transition-all duration-150"
            style={{ gap: isSidebarOpen ? '10px' : '0', justifyContent: isSidebarOpen ? 'flex-start' : 'center', paddingLeft: isSidebarOpen ? '12px' : '0', color: 'rgba(255,255,255,0.3)' }}
            onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.background = 'rgba(239,68,68,0.1)'; el.style.color = '#FCA5A5' }}
            onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.background = 'transparent'; el.style.color = 'rgba(255,255,255,0.3)' }}
          >
            <LogOut size={17} />
            {isSidebarOpen && 'Çıkış Yap'}
          </button>
        </div>
      </aside>

      {/* ══ ANA ALAN ══════════════════════════════════════════════════════════ */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* ── Üst bar ── */}
        <header
          className="shrink-0 flex items-center justify-between gap-4 px-6"
          style={{
            height: '72px',
            background: 'rgba(8,18,38,0.75)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            borderBottom: '1px solid rgba(255,255,255,0.09)',
          }}
        >
          {/* Sol: mobil toggle + breadcrumb */}
          <div className="flex items-center gap-4 min-w-0">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="lg:hidden w-9 h-9 flex items-center justify-center rounded-xl transition-colors shrink-0"
              style={{ color: '#6B7280', border: '1px solid rgba(255,255,255,0.09)' }}
            >
              <Menu size={19} />
            </button>
            {/* Breadcrumb */}
            <div className="flex items-center gap-3 min-w-0">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: activeCatMeta.dim, boxShadow: `0 0 16px ${activeCatMeta.glow}` }}
              >
                {activeItem && <activeItem.icon size={19} style={{ color: activeCatMeta.color }} strokeWidth={2.5} />}
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] leading-none" style={{ color: activeCatMeta.color }}>{activeItem?.category}</p>
                <p className="text-[16px] font-bold text-white leading-snug mt-0.5 truncate">{activeItem?.label}</p>
              </div>
            </div>
          </div>

          {/* Sağ: hata + bildirimler + kullanıcı */}
          <div className="flex items-center gap-3 shrink-0">
            {error && (
              <div className="hidden md:flex items-center gap-2 px-3 py-2 rounded-xl text-[12px] font-medium" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#FCA5A5' }}>
                <div className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                {error.length > 55 ? error.slice(0, 55) + '…' : error}
              </div>
            )}
            {firma && <NotificationCenter firma={firma} />}
            <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)' }}>
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center text-[13px] font-extrabold shrink-0"
                style={{ background: 'linear-gradient(135deg,rgba(59,130,246,0.35),rgba(99,102,241,0.35))', color: '#93C5FD' }}
                title={user.email}
              >
                {user.email?.charAt(0).toUpperCase() || 'U'}
              </div>
              <div className="hidden sm:block">
                <p className="text-[12px] font-semibold text-white leading-none">{profile?.ad_soyad?.split(' ')[0] || user.email?.split('@')[0]}</p>
                {profile?.rol && (
                  <p className="text-[11px] font-medium mt-0.5" style={{ color: roleColors[profile.rol] || '#94A3B8' }}>{roleLabels[profile.rol] ?? profile.rol}</p>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Renkli gradient çizgi */}
        <div className="topbar-accent shrink-0" />

        {/* ── Modül içeriği ── */}
        <main className="flex-1 overflow-auto" style={{ padding: '24px' }}>
          {firma ? (
            <div key={activeModule} className="module-enter">
              {renderModule(activeModule, firma, profile, setFirma)}
            </div>
          ) : (
            <div className="rounded-2xl p-6 text-sm glass" style={{ color: '#6B7280' }}>
              Firma bulunamadı.
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

// ── Modül renderer ────────────────────────────────────────────────────────────
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
    case 'satinalma':        return <SatinAlmaModule firma={firma} role={profile?.rol} />
    case 'genel-bakis':      return <OverviewModule firma={firma} />
    default:                 return (
      <div className="rounded-2xl p-6 glass">
        <p className="text-sm text-slate-400">Bu modül henüz aktif değil: <code className="text-blue-400">{moduleId}</code></p>
      </div>
    )
  }
}

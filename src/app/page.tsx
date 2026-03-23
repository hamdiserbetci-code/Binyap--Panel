'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Briefcase,
  BookUser,
  FileArchive,
  FileSpreadsheet,
  FolderKanban,
  History,
  KeyRound,
  Landmark,
  LayoutGrid,
  ListTodo,
  LogOut,
  ShieldCheck,
  TrendingUp,
  Users,
  Wallet,
  Menu,
  ChevronDown,
  ChevronRight,
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
  | 'genel-bakis'
  | 'projeler'
  | 'puantaj'
  | 'sgk-bildirimleri'
  | 'bankalar'
  | 'cari'
  | 'kasa'
  | 'vergi-sgk'
  | 'dokuman'
  | 'raporlar'
  | 'gorevler'
  | 'kullanicilar'
  | 'aktivite'

type ModuleConfig = {
  id: ModuleId
  category: string
  label: string
  shortLabel: string
  icon: LucideIcon
  accent: string
  title: string
  description: string
  allowedRoles: string[]
}

const iconRegistry: Record<string, LucideIcon> = {
  LayoutGrid, FolderKanban, TrendingUp, Users, BookUser, Landmark, Wallet, ShieldCheck, FileArchive, FileSpreadsheet, ListTodo, KeyRound, History
}

const defaultModules: ModuleConfig[] = [
  { id: 'genel-bakis', category: 'Operasyon', label: 'Genel Bakis', shortLabel: 'Panel', icon: LayoutGrid, accent: 'from-sky-500 to-cyan-400', title: 'Merkezi Operasyon Paneli', description: 'Sistemdeki aktif görevlerin, finansal yükümlülüklerin ve resmi süreçlerin konsolide özetini sunar.', allowedRoles: ['yonetici', 'muhasebe', 'santiye', 'izleme'] },
  { id: 'projeler', category: 'Operasyon', label: 'Projeler', shortLabel: 'Projeler', icon: FolderKanban, accent: 'from-blue-500 to-indigo-400', title: 'Proje Yönetimi', description: 'Kurum bünyesindeki tüm projelerin bütçe, lokasyon ve operasyonel yaşam döngülerinin yönetildiği merkez.', allowedRoles: ['yonetici', 'santiye', 'izleme'] },
  { id: 'gorevler', category: 'Operasyon', label: 'Yapilacak Isler', shortLabel: 'Gorevler', icon: ListTodo, accent: 'from-amber-500 to-orange-400', title: 'Gorev Yonetimi', description: 'Kurum içi iş süreçlerinin, önceliklendirme ve hatırlatma algoritmalarıyla takip edildiği operasyonel görev merkezi.', allowedRoles: ['yonetici', 'muhasebe', 'santiye', 'izleme'] },
  { id: 'cari', category: 'Finans', label: 'Cari Hesap', shortLabel: 'Cari', icon: BookUser, accent: 'from-cyan-500 to-teal-400', title: 'Cari Hesap Takibi', description: 'Alış/satış faturaları, tahsilat, ödeme ve çek hareketlerinin cari bazlı izlendiği modül.', allowedRoles: ['yonetici', 'muhasebe'] },
  { id: 'bankalar', category: 'Finans', label: 'Banka Hesapları', shortLabel: 'Banka', icon: Landmark, accent: 'from-indigo-500 to-blue-500', title: 'Banka ve Finans Yönetimi', description: 'Firma banka hesaplarının ve hesap hareketlerinin, ekstre aktarımlarıyla yönetildiği modül.', allowedRoles: ['yonetici', 'muhasebe'] },
  { id: 'kasa', category: 'Finans', label: 'Kasa', shortLabel: 'Kasa', icon: Wallet, accent: 'from-teal-500 to-cyan-400', title: 'Nakit Yonetimi', description: 'Nakit ve banka hesaplarındaki tüm finansal hareketlerin ve güncel likidite durumunun izlendiği kasa modülü.', allowedRoles: ['yonetici', 'muhasebe'] },
  { id: 'vergi-sgk', category: 'Operasyon', label: 'Vergi / SGK', shortLabel: 'Vergi', icon: ShieldCheck, accent: 'from-rose-500 to-orange-400', title: 'Resmi Surecler', description: 'Resmi kurumlarla yürütülen periyodik vergi ve SGK yükümlülüklerinin tahakkuk ve ödeme takibi.', allowedRoles: ['yonetici', 'muhasebe'] },
  { id: 'puantaj', category: 'Personel', label: 'Puantaj', shortLabel: 'Puantaj', icon: Users, accent: 'from-orange-500 to-amber-400', title: 'Personel Mesai Takibi', description: 'Saha ve ofis personeline ait mesai, izin ve günlük çalışma verilerinin proje bazlı izlendiği modül.', allowedRoles: ['yonetici', 'santiye'] },
  { id: 'sgk-bildirimleri', category: 'Personel', label: 'SGK Bildirimleri', shortLabel: 'SGK', icon: ShieldCheck, accent: 'from-cyan-500 to-sky-400', title: 'SGK Bildirimleri', description: 'İşçi giriş/çıkış bildirimleri, aylık prim bildirge tahakkukları, ödeme dekontları ve hizmet bildirimleri.', allowedRoles: ['yonetici', 'muhasebe'] },
  { id: 'dokuman', category: 'Arşiv & Rapor', label: 'Dokumanlar', shortLabel: 'Arsiv', icon: FileArchive, accent: 'from-slate-700 to-slate-500', title: 'Kurumsal Arsiv', description: 'Sisteme yüklenen tüm sözleşme, fatura ve resmi evrakların merkezi olarak arşivlendiği ve yönetildiği alan.', allowedRoles: ['yonetici', 'muhasebe', 'santiye', 'izleme'] },
  { id: 'raporlar', category: 'Arşiv & Rapor', label: 'Raporlar', shortLabel: 'Raporlar', icon: FileSpreadsheet, accent: 'from-indigo-500 to-blue-400', title: 'Raporlama ve Analiz', description: 'Tüm veri kaynaklarından derlenen operasyonel ve finansal metriklerin detaylı analiz ve dışa aktarım aracı.', allowedRoles: ['yonetici', 'muhasebe', 'izleme'] },
  { id: 'kullanicilar', category: 'Sistem', label: 'Kullanicilar', shortLabel: 'Yetkiler', icon: KeyRound, accent: 'from-slate-600 to-slate-400', title: 'Sistem Erisimi', description: 'Sistem erişim yetkilerinin, kullanıcı rollerinin ve kurumsal profil ayarlarının yapılandırıldığı güvenlik modülü.', allowedRoles: ['yonetici'] },
  { id: 'aktivite', category: 'Sistem', label: 'Aktivite Logu', shortLabel: 'Log', icon: History, accent: 'from-cyan-500 to-sky-400', title: 'Sistem Gunlugu', description: 'Platform üzerindeki tüm kritik kullanıcı hareketlerinin ve veri değişikliklerinin denetim amacıyla kaydedildiği izleme günlüğü.', allowedRoles: ['yonetici', 'muhasebe'] },
]

const roleLabels: Record<string, string> = {
  yonetici: 'Yonetici',
  muhasebe: 'Muhasebe',
  santiye: 'Santiye',
  izleme: 'Izleme',
}

function isMissingProfilesTable(message?: string) {
  const value = (message || '').toLowerCase()
  return value.includes('kullanici_profilleri') && (value.includes('schema cache') || value.includes('does not exist') || value.includes('could not find the table'))
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
    'Operasyon': true,
    'Finans': true,
    'Personel': true,
    'Arşiv & Rapor': true,
    'Sistem': false
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 1024)
      if (window.innerWidth < 1024) setIsSidebarOpen(false)
    }
    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  function toggleGroup(group: string) {
    setExpandedGroups(prev => ({
      ...prev,
      [group]: prev[group] !== undefined ? !prev[group] : false
    }))
  }

  useEffect(() => {
    let mounted = true

    async function bootstrap() {
      try {
        const { data: authData, error: authError } = await supabase.auth.getUser()
        if (authError) throw authError
        if (!authData.user) {
          window.location.href = '/login'
          return
        }
        if (!mounted) return
        setUser(authData.user)

        const firmaRes = await supabase.from('firmalar').select('*').limit(1)
        if (firmaRes.error) {
          throw new Error(`Firmalar tablosuna erişilemedi: ${firmaRes.error.message}`)
        }

        let activeFirma: FirmaRecord | null = null
        if (!firmaRes.data || firmaRes.data.length === 0) {
          const insertRes = await supabase.from('firmalar').insert({ ad: 'ETM' }).select('*').single()
          if (insertRes.error) {
            throw new Error(`Varsayılan firma oluşturulamadı: ${insertRes.error.message}`)
          }
          activeFirma = insertRes.data as FirmaRecord
        } else {
          activeFirma = firmaRes.data[0] as FirmaRecord
        }
        if (!mounted) return
        setFirma(activeFirma)

        let activeProfile: UserProfileRecord | null = null
        const profileRes = await supabase.from('kullanici_profilleri').select('*').eq('auth_user_id', authData.user.id).maybeSingle()

        if (profileRes.error) {
          if (isMissingProfilesTable(profileRes.error.message)) {
            activeProfile = {
              id: 'local-admin',
              auth_user_id: authData.user.id,
              firma_id: activeFirma.id,
              ad_soyad: authData.user.user_metadata?.full_name || null,
              email: authData.user.email || 'kullanici@etm.local',
              rol: 'yonetici',
              aktif: true,
              son_giris_at: new Date().toISOString(),
            }
            if (mounted) {
              setError('kullanici_profilleri tablosu bulunamadi. Panel gecici yonetici modu ile acildi.')
            }
          } else {
            throw profileRes.error
          }
        } else {
          activeProfile = profileRes.data as UserProfileRecord | null
          if (!activeProfile) {
            const insertProfile = await supabase
              .from('kullanici_profilleri')
              .insert({
                auth_user_id: authData.user.id,
                firma_id: activeFirma.id,
                email: authData.user.email || 'kullanici@etm.local',
                ad_soyad: authData.user.user_metadata?.full_name || null,
                aktif: true,
                son_giris_at: new Date().toISOString(),
              })
              .select('*')
              .single()

            if (insertProfile.error) throw insertProfile.error
            activeProfile = insertProfile.data as UserProfileRecord
          } else {
            const updateRes = await supabase
              .from('kullanici_profilleri')
              .update({ son_giris_at: new Date().toISOString() })
              .eq('id', activeProfile.id)
              .select('*')
              .single()

            if (!updateRes.error && updateRes.data) {
              activeProfile = updateRes.data as UserProfileRecord
            }
          }
        }

        if (activeProfile && !activeProfile.aktif) {
          if (mounted) {
            setError('Bu hesap pasif durumdadir. Lutfen yonetici ile iletisime gecin.')
            setLoading(false)
          }
          await supabase.auth.signOut()
          window.location.href = '/login'
          return
        }

        if (!mounted) return
        setProfile(activeProfile)

        // Dinamik menu yapisini veritabanindan cek (Eger veritabaninda yoksa default listeyi kullan)
        let loadedModules = defaultModules
        const modRes = await supabase.from('sistem_modulleri').select('*').eq('aktif', true).order('sira', { ascending: true })
        if (!modRes.error && modRes.data && modRes.data.length > 0) {
          const dbMods = modRes.data
            .filter((m: any) => m.id !== 'gelir-gider' && m.id !== 'finans') // DB'den gelse bile yoksay
            .map((m: any) => {
              const def = defaultModules.find(d => d.id === m.id)
              return {
                id: m.id as ModuleId,
                category: def?.category || 'Diğer',
                label: m.label,
                shortLabel: m.short_label,
                icon: iconRegistry[m.icon] || LayoutGrid,
                accent: m.accent,
                title: m.title,
                description: m.description,
                allowedRoles: m.izin_verilen_roller || ['yonetici']
              }
            })
            
          // Veritabaninda henuz olmayan lokal modulleri (bankalar vb.) otomatik menuye ekle
          defaultModules.forEach(dm => {
            if (!dbMods.find((m: any) => m.id === dm.id)) {
              dbMods.push(dm)
            }
          })
          loadedModules = dbMods
        }
        
        if (!mounted) return
        setModules(loadedModules)
        setLoading(false)

        if (activeProfile?.id !== 'local-admin') {
          void logActivity({
            firmaId: activeFirma.id,
            authUserId: authData.user.id,
            kullaniciProfilId: activeProfile?.id || null,
            modul: 'oturum',
            islemTuru: 'oturum_acildi',
            kayitTuru: 'kullanici_profili',
            kayitId: activeProfile?.id || null,
            aciklama: `${authData.user.email || 'Kullanici'} panel oturumu acti.`,
          })
        }
      } catch (err: any) {
        if (!mounted) return
        setError(err?.message || 'Panel baslatilirken bir hata olustu.')
        setLoading(false)
      }
    }

    bootstrap()
    return () => {
      mounted = false
    }
  }, [])

  const visibleModules = useMemo(() => {
    const currentRole = profile?.rol || 'izleme'
    return modules.filter((item) => item.allowedRoles.includes(currentRole))
  }, [modules, profile?.rol])

  const CATEGORY_ORDER = ['Operasyon', 'Finans', 'Personel', 'Arşiv & Rapor', 'Sistem', 'Diğer']
  const groupedModules = useMemo(() => {
    const groups: Record<string, ModuleConfig[]> = {}
    visibleModules.forEach(m => {
      const cat = m.category || 'Diğer'
      if (!groups[cat]) groups[cat] = []
      groups[cat].push(m)
    })
    return groups
  }, [visibleModules])

  useEffect(() => {
    if (!visibleModules.length) return
    if (!visibleModules.some((item) => item.id === activeModule)) {
      setActiveModule(visibleModules[0].id)
    }
  }, [activeModule, visibleModules])

  const activeItem = useMemo(() => visibleModules.find((item) => item.id === activeModule) ?? visibleModules[0], [activeModule, visibleModules])

  async function signOut() {
    if (firma && user && profile?.id !== 'local-admin') {
      void logActivity({
        firmaId: firma.id,
        authUserId: user.id,
        kullaniciProfilId: profile?.id || null,
        modul: 'oturum',
        islemTuru: 'oturum_kapandi',
        kayitTuru: 'kullanici_profili',
        kayitId: profile?.id || null,
        aciklama: `${user.email || 'Kullanici'} panel oturumunu kapatti.`,
      })
    }
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--page-bg)] text-slate-100">
        <div className="rounded-3xl border border-white/10 bg-white/5 px-6 py-5 text-sm text-slate-300 backdrop-blur">
          Panel yukleniyor...
        </div>
      </div>
    )
  }

  if (error && (!user || !activeItem || !firma)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--page-bg)] px-4 text-slate-100">
        <div className="w-full max-w-xl rounded-3xl border border-rose-300/20 bg-slate-950/80 p-6 shadow-[0_24px_60px_rgba(15,23,42,0.35)]">
          <p className="text-xs uppercase tracking-[0.24em] text-rose-300">Panel Hatasi</p>
          <h1 className="mt-3 text-2xl font-semibold text-white">Panel acilamadi</h1>
          <p className="mt-4 text-sm leading-7 text-slate-300">{error}</p>
          <button type="button" onClick={() => window.location.reload()} className="mt-5 rounded-2xl bg-white px-4 py-2.5 text-sm font-medium text-slate-900 transition hover:bg-slate-100">Sayfayi yenile</button>
        </div>
      </div>
    )
  }

  if (!user || !activeItem) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--page-bg)] text-slate-100">
        <div className="rounded-3xl border border-white/10 bg-white/5 px-6 py-5 text-sm text-slate-300 backdrop-blur">
          Kullanici bilgisi bekleniyor...
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen overflow-hidden text-slate-100" style={{ background: '#020617', fontFamily: '-apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", sans-serif' }}>

      {/* ── Arka plan efektleri ── */}
      <div className="fixed inset-0 -z-10" style={{ background: '#020617' }}>
        <div className="absolute top-0 right-0 w-1/2 h-1/2 rounded-full opacity-10 blur-[120px]" style={{ background: 'radial-gradient(circle, #6366f1, transparent)' }} />
        <div className="absolute bottom-0 left-0 w-1/2 h-1/2 rounded-full opacity-10 blur-[120px]" style={{ background: 'radial-gradient(circle, #0ea5e9, transparent)' }} />
      </div>

      {/* ══ SOL SIDEBAR ════════════════════════════════════════════════════════ */}
      {isMobile && isSidebarOpen && (
        <div className="fixed inset-0 bg-black/60 z-40 backdrop-blur-sm lg:hidden" onClick={() => setIsSidebarOpen(false)} />
      )}
      
      <aside className={`${isSidebarOpen ? 'translate-x-0 w-[240px]' : '-translate-x-full w-[240px] lg:translate-x-0 lg:w-[76px]'} absolute lg:relative shrink-0 flex flex-col h-screen z-50 transition-all duration-300 shadow-2xl lg:shadow-none`} style={{ background: '#0D1117', borderRight: '1px solid rgba(255,255,255,0.06)' }}>

        {/* Logo & Toggle */}
        <div className={`px-4 py-5 flex items-center ${isSidebarOpen ? 'justify-between' : 'justify-center'} shrink-0`} style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          {isSidebarOpen && (
            <div className="flex items-center gap-3 shrink-0 overflow-hidden">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 shadow-lg" style={{ background: 'linear-gradient(135deg, #3B82F6 0%, #6366F1 100%)' }}>
                <Briefcase size={15} strokeWidth={2.5} className="text-white" />
              </div>
              <div className="min-w-0">
                <p className="text-[9px] font-bold uppercase tracking-[0.18em] truncate" style={{ color: '#5B9FFF' }}>ETM · BİNYAPI</p>
                <p className="text-[12px] font-semibold leading-tight truncate" style={{ color: '#E8EAED' }}>ERP v2.2</p>
              </div>
            </div>
          )}
          <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors shrink-0 hidden lg:block" title="Menüyü Daralt/Genişlet">
            <Menu size={18} />
          </button>
        </div>

        {/* Navigasyon */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-3 [&::-webkit-scrollbar]:hidden">
          {Object.entries(groupedModules)
            .sort(([a], [b]) => {
              const idxA = CATEGORY_ORDER.indexOf(a)
              const idxB = CATEGORY_ORDER.indexOf(b)
              return (idxA === -1 ? 99 : idxA) - (idxB === -1 ? 99 : idxB)
            })
            .map(([group, items], idx) => {
              const isExpanded = expandedGroups[group] ?? true
              return (
                <div key={group} className="space-y-1">
                  {isSidebarOpen ? (
                    <button
              onClick={() => toggleGroup(group)}
              className="w-full flex items-center justify-between px-3 py-2 mb-1 text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400 hover:text-white hover:bg-white/[0.03] rounded-lg transition-colors"
                    >
                      {group}
                      {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                    </button>
                  ) : (
                    idx > 0 && <div className="w-8 h-px bg-white/10 mx-auto my-2" />
                  )}
                  
                  {(isExpanded || !isSidebarOpen) && items.map((item) => {
                    const Icon = item.icon
                    const isActive = item.id === activeModule
                    return (
                      <button
                        key={item.id}
                        type="button"
                onClick={() => {
                  setActiveModule(item.id)
                  if (isMobile) setIsSidebarOpen(false)
                }}
                        title={item.label}
                        className={`w-full flex items-center ${isSidebarOpen ? 'gap-3 justify-start' : 'justify-center'} rounded-xl transition-all duration-150 text-left`}
                        style={isActive
                          ? { background: 'rgba(91,159,255,0.12)', borderLeft: '2px solid #5B9FFF', padding: isSidebarOpen ? '9px 12px 9px 10px' : '10px 0' }
                          : { borderLeft: '2px solid transparent', padding: isSidebarOpen ? '9px 12px' : '10px 0' }}
                      >
                        <Icon size={18} style={{ color: isActive ? '#5B9FFF' : '#5F6368', flexShrink: 0 }} />
                        {isSidebarOpen && (
                          <span className="text-[13px] font-medium truncate" style={{ color: isActive ? '#E8EAED' : '#9AA0A6' }}>
                            {item.shortLabel}
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              )
            })}
        </nav>

        {/* Kullanıcı + Çıkış */}
        <div className="p-3 shrink-0" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          {isSidebarOpen ? (
            <div className="flex items-center gap-2.5 px-2 py-2 rounded-xl mb-1" style={{ background: 'rgba(255,255,255,0.03)' }}>
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0" style={{ background: '#1A2535', color: '#9AA0A6', border: '1px solid rgba(255,255,255,0.08)' }}>
                {user.email?.charAt(0).toUpperCase() || 'U'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-medium truncate" style={{ color: '#9AA0A6' }}>{user.email}</p>
                {profile?.rol && <p className="text-[9px] capitalize" style={{ color: '#5F6368' }}>{roleLabels[profile.rol] ?? profile.rol}</p>}
              </div>
            </div>
          ) : (
            <div className="w-8 h-8 mx-auto rounded-full flex items-center justify-center text-[12px] font-bold mb-2 cursor-help" style={{ background: '#1A2535', color: '#9AA0A6', border: '1px solid rgba(255,255,255,0.08)' }} title={user.email}>
              {user.email?.charAt(0).toUpperCase() || 'U'}
            </div>
          )}
          <button
            type="button"
            onClick={signOut}
            title="Güvenli Çıkış"
            className={`w-full flex items-center ${isSidebarOpen ? 'gap-2 px-3 justify-start' : 'justify-center'} py-2 rounded-xl text-[11px] font-medium transition-all duration-150 group`}
            style={{ color: '#5F6368' }}
            onMouseEnter={e => { e.currentTarget.style.color = '#EA4335'; e.currentTarget.style.background = 'rgba(234,67,53,0.08)' }}
            onMouseLeave={e => { e.currentTarget.style.color = '#5F6368'; e.currentTarget.style.background = 'transparent' }}
          >
            <LogOut size={16} />{isSidebarOpen && 'Güvenli Çıkış'}
          </button>
        </div>
      </aside>

      {/* ══ ANA İÇERİK ═════════════════════════════════════════════════════════ */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Üst bar: bildirimler + hata */}
        {(firma || error) && (
          <div className="shrink-0 flex items-center justify-between px-6 py-3 gap-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
            <div className="flex-1">
        <div className="flex items-center gap-3">
          <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden p-2 rounded-xl bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10 transition-colors shrink-0">
            <Menu size={18} />
          </button>
          {error && (
            <p className="rounded-xl px-4 py-2 text-xs" style={{ background: 'rgba(234,67,53,0.08)', border: '1px solid rgba(234,67,53,0.2)', color: '#EA4335' }}>{error}</p>
          )}
        </div>
            </div>
            <div className="shrink-0">
              {firma && <NotificationCenter firma={firma} />}
            </div>
          </div>
        )}

        {/* Modül içeriği */}
        <main className="flex-1 overflow-auto p-4 lg:p-5">
          {firma ? renderModule(activeModule, firma, profile, setFirma) : (
            <div className="rounded-2xl p-6 text-sm" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', color: '#9AA0A6' }}>
              Firma bulunamadı.
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

function renderModule(moduleId: ModuleId, firma: FirmaRecord, profile: UserProfileRecord | null, onFirmaUpdated: (firma: FirmaRecord) => void) {
  switch (moduleId) {
    case 'projeler':
      return <ProjectsModule firma={firma} role={profile?.rol} />
    case 'puantaj':
      return <TimesheetModule firma={firma} role={profile?.rol} />
    case 'sgk-bildirimleri':
      return <SgkModule firma={firma} role={profile?.rol} />
    case 'cari':
      return <CariHesapModule firma={firma} role={profile?.rol} />
    case 'bankalar':
      return <BankalarModule firma={firma} role={profile?.rol} />
    case 'kasa':
      return <CashModule firma={firma} role={profile?.rol} />
    case 'vergi-sgk':
      return <TaxModule firma={firma} role={profile?.rol} />
    case 'dokuman':
      return <DocumentsModule firma={firma} role={profile?.rol} />
    case 'raporlar':
      return <ReportsModule firma={firma} role={profile?.rol} />
    case 'gorevler':
      return <TasksModule firma={firma} role={profile?.rol} />
    case 'kullanicilar':
      return <UsersModule firma={firma} currentProfile={profile} role={profile?.rol} onFirmaUpdated={onFirmaUpdated} />
    case 'aktivite':
      return <ActivityLogModule firma={firma} role={profile?.rol} />
    case 'genel-bakis':
      return <OverviewModule firma={firma} />
    default:
      return <PlaceholderModule moduleId={moduleId} />
  }
}

function PlaceholderModule({ moduleId }: { moduleId: string }) {
  const items: Record<string, string[]> = {
    'genel-bakis': ['Yeni SQL semasi hazir', 'Projeler modulu baglandi', 'Finans modulu baglandi', 'Puantaj modulu baglandi'],
    kasa: ['Kasa ve banka hareket formu', 'Bagli islem kaydi mantigi', 'Gunluk bakiye ve hareket dokumu'],
    'vergi-sgk': ['Beyan donemi listesi', 'Durum ve sorumlu takibi', 'Tahakkuk ve dekont yukleme'],
    dokuman: ['Merkezi yukleme alani', 'Modul ve kategori filtreleri', 'Kayit bazli dokuman baglama'],
    raporlar: ['PDF ve Excel cikti sablonlari', 'Modul bazli filtreleme', 'Kaydedilebilir rapor yapisi'],
    gorevler: ['Gorev listesi ve durum akisi', 'Hatirlatma tarih ve saat alanlari', 'Erteleme dakikasi ve yeni hatirlatma zamani'],
    kullanicilar: ['Rol bazli menu gorunurlugu', 'Aktif pasif kullanici kontrolu', 'Firma bazli profil kayitlari'],
    aktivite: ['Oturum hareketlerini kaydet', 'Rol degisikliklerini izleme alani', 'Modul bazli filtrelenebilir log akisi'],
  }

  const displayItems = items[moduleId] || ['Bu modül devre dışı bırakılmış veya güncellenmektedir.']

  return (
    <div className="rounded-[32px] border border-white/[0.08] bg-white/[0.04] p-6 text-slate-200 shadow-2xl backdrop-blur-3xl ring-1 ring-white/10">
      <h3 className="text-2xl font-semibold text-white">Siradaki modul</h3>
      <p className="mt-3 text-sm leading-6 text-slate-400">Bu alan bir sonraki adimda ayni desenle calisan module donusecek. Hazirlanan kapsam:</p>
      <div className="mt-5 grid gap-3 md:grid-cols-2">
        {displayItems.map((item) => (
          <div key={item} className="rounded-2xl border border-white/10 bg-white/[0.05] p-4 text-sm text-slate-300">{item}</div>
        ))}
      </div>
    </div>
  )
}

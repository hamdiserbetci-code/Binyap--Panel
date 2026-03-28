'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  LayoutDashboard, ClipboardList, FileStack, Users2,
  BarChart2, Settings, LogOut, Menu, X,
  Bell, Building2, CalendarCheck, Wallet, TrendingUp,
  Clock, CheckCircle2, Landmark, CalendarClock,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { Firma, KullaniciProfil } from '@/types'
import dynamic from 'next/dynamic'

const Dashboard  = dynamic(() => import('@/modules/dashboard'),  { ssr: false })
const Musteriler = dynamic(() => import('@/modules/musteriler'), { ssr: false })
const Gorevler   = dynamic(() => import('@/modules/gorevler'),   { ssr: false })
const Bordro     = dynamic(() => import('@/modules/bordro'),     { ssr: false })
const Raporlar   = dynamic(() => import('@/modules/raporlar'),   { ssr: false })
const Ayarlar    = dynamic(() => import('@/modules/ayarlar'),    { ssr: false })
const Gunluk     = dynamic(() => import('@/modules/gunluk'),     { ssr: false })
const Kasa       = dynamic(() => import('@/modules/kasa'),       { ssr: false })
const KarZarar   = dynamic(() => import('@/modules/karzarar'),   { ssr: false })
const Evraklar   = dynamic(() => import('@/modules/evraklar'),   { ssr: false })
const Cekler     = dynamic(() => import('@/modules/cekler'),     { ssr: false })
const OdemePlani = dynamic(() => import('@/modules/odemeplani'), { ssr: false })

const NAV = [
  { id: 'dashboard',  label: 'Dashboard',      icon: LayoutDashboard, group: null },
  { id: 'musteriler', label: 'Müşteriler',      icon: Building2,       group: 'Yönetim' },
  { id: 'gorevler',   label: 'Periyodik İşler', icon: ClipboardList,   group: 'Yönetim' },
  { id: 'gunluk',     label: 'Günlük İşler',   icon: CalendarCheck,   group: 'Yönetim' },
  { id: 'kasa',       label: 'Kasa',            icon: Wallet,          group: 'Finans' },
  { id: 'cekler',     label: 'Çek Takibi',     icon: Landmark,        group: 'Finans' },
  { id: 'odemeplani', label: 'Odeme Plani',     icon: CalendarClock,   group: 'Finans' },
  { id: 'karzarar',   label: 'Kar / Zarar',     icon: TrendingUp,      group: 'Finans' },
  { id: 'evraklar',   label: 'Evrak Yönetimi',   icon: FileStack,       group: 'Yönetim' },
  { id: 'bordro',     label: 'Bordro Süreci',   icon: Users2,          group: 'Yönetim' },
  { id: 'raporlar',   label: 'Raporlar',         icon: BarChart2,       group: 'Analiz' },
  { id: 'ayarlar',    label: 'Ayarlar',          icon: Settings,        group: 'Analiz' },
] as const

type ModuleId = typeof NAV[number]['id']
export type AppCtx = { firma: Firma; profil: KullaniciProfil; navigate: (id: ModuleId) => void }

function AppContent() {
  const router = useRouter()
  const [firma, setFirma]       = useState<Firma | null>(null)
  const [profil, setProfil]     = useState<KullaniciProfil | null>(null)
  const [module, setModule]     = useState<ModuleId>('dashboard')
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState('')
  const searchParams = useSearchParams()
  const [sidebar, setSidebar]   = useState(false) // Mobile sidebar
  const [sidebarHover, setSidebarHover] = useState(false) // Desktop hover
  const [notifCount, setNotifCount] = useState(0)
  const [showNotifModal, setShowNotifModal] = useState(false)
  const [notifItems, setNotifItems] = useState<any[]>([])

  useEffect(() => {
    let mounted = true

    async function init() {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!mounted) return
        if (!session) {
          setLoading(false)
          router.replace('/login')
          return
        }

        const urlModule = searchParams.get('module') as ModuleId
        if (urlModule && NAV.some(n => n.id === urlModule)) setModule(urlModule)

        await loadApp(session.user.id)
      } catch {
        if (!mounted) return
        setError('Bağlantı kurulamadı. Sayfayı yenileyin.')
        setLoading(false)
      }
    }

    init()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return
      if (!session) {
        setLoading(false)
        router.replace('/login')
      }
    })

    return () => { mounted = false; subscription.unsubscribe() }
  }, [router, searchParams])

  async function loadApp(userId: string) {
    try {
      const { data: firmalar, error: fErr } = await supabase
        .from('firmalar').select('*').eq('aktif', true).order('ad').limit(1)
      if (fErr) throw fErr
      const f = firmalar?.[0] as Firma | undefined
      if (!f) { setLoading(false); setError('__no_firma__'); return }
      setFirma(f)

      const { data: pData } = await supabase
        .from('kullanici_profilleri').select('*')
        .eq('auth_user_id', userId).maybeSingle()
      let p = pData as KullaniciProfil | null
      if (!p) {
        const { data: ins, error: insErr } = await supabase
          .from('kullanici_profilleri')
          .insert({ auth_user_id: userId, firma_id: f.id, email: '', aktif: true, rol: 'yonetici' })
          .select('*').single()
        if (insErr) {
          const { data: existing } = await supabase.from('kullanici_profilleri').select('*').eq('auth_user_id', userId).single()
          p = existing as KullaniciProfil | null
        } else p = ins as KullaniciProfil
      } else {
        await supabase.from('kullanici_profilleri').update({ son_giris_at: new Date().toISOString() }).eq('id', p.id)
      }
      if (!p) throw new Error('Kullanıcı profili oluşturulamadı.')
      if (!p.aktif) { await supabase.auth.signOut(); router.replace('/login'); return }
      setProfil(p)

      await loadNotifs(f.id)

      setLoading(false)
    } catch (e: any) {
      setError(e?.message || 'Bağlantı hatası')
      setLoading(false)
    }
  }

  async function loadNotifs(firmaId: string) {
    const today = new Date().toISOString().split('T')[0]
    
    // Günlük
    const { data: g } = await supabase.from('gunluk_isler')
      .select('id, baslik, tarih, hatirlatici_tarihi, hatirlatici_saati').eq('firma_id', firmaId).eq('durum', 'bekliyor')
      
    // Periyodik
    const { data: p } = await supabase.from('is_takip')
      .select('id, tip, donem, hatirlatici_tarihi, hatirlatici_saati').eq('firma_id', firmaId).eq('durum', 'aktif')
      
    // Bordro
    const { data: b } = await supabase.from('bordro_surecler')
      .select('id, donem, hatirlatici_tarihi, hatirlatici_saati').eq('firma_id', firmaId).not('hatirlatici_tarihi', 'is', null)

    // Aylik maliyet
    const { data: m } = await supabase.from('maliyet_surecler')
      .select('id, donem, durum, hatirlatici_tarihi, hatirlatici_saati').eq('firma_id', firmaId).not('hatirlatici_tarihi', 'is', null)

    // Cekler
    const { data: c } = await supabase.from('cekler')
      .select('id, cek_no, durum, hatirlatici_tarihi, hatirlatici_saati')
      .eq('firma_id', firmaId)
      .eq('durum', 'bekliyor')
      .not('hatirlatici_tarihi', 'is', null)

    const { data: o } = await supabase.from('odeme_plani')
      .select('id, baslik, durum, hatirlatici_tarihi, hatirlatici_saati')
      .eq('firma_id', firmaId)
      .in('durum', ['bekliyor', 'ertelendi'])
      .not('hatirlatici_tarihi', 'is', null)

    const items: any[] = []
    
    g?.forEach(x => {
       const t = x.hatirlatici_tarihi || x.tarih
       if (t <= today) items.push({ id: x.id, baslik: x.baslik, module: 'gunluk', saat: x.hatirlatici_saati, tarih: t })
    })
    
    p?.forEach(x => {
       if (x.hatirlatici_tarihi && x.hatirlatici_tarihi <= today) items.push({ id: x.id, baslik: `Periyodik (${x.donem})`, module: 'gorevler', saat: x.hatirlatici_saati, tarih: x.hatirlatici_tarihi })
    })
    
    b?.forEach(x => {
       if (x.hatirlatici_tarihi && x.hatirlatici_tarihi <= today) items.push({ id: x.id, baslik: `Bordro (${x.donem})`, module: 'bordro', saat: x.hatirlatici_saati, tarih: x.hatirlatici_tarihi })
    })

    m?.forEach(x => {
       if (x.hatirlatici_tarihi && x.hatirlatici_tarihi <= today && x.durum !== 'tamamlandi') {
         items.push({ id: x.id, baslik: `Aylik Maliyet (${x.donem})`, module: 'gorevler', saat: x.hatirlatici_saati, tarih: x.hatirlatici_tarihi })
       }
    })

    c?.forEach(x => {
       if (x.hatirlatici_tarihi && x.hatirlatici_tarihi <= today && x.durum === 'bekliyor') {
         items.push({ id: x.id, baslik: `Cek (${x.cek_no})`, module: 'cekler', saat: x.hatirlatici_saati, tarih: x.hatirlatici_tarihi })
       }
    })

    o?.forEach(x => {
       if (x.hatirlatici_tarihi && x.hatirlatici_tarihi <= today) {
         items.push({ id: x.id, baslik: `Odeme (${x.baslik})`, module: 'odemeplani', saat: x.hatirlatici_saati, tarih: x.hatirlatici_tarihi })
       }
    })

    items.sort((a, b) => {
      const ta = new Date(`${a.tarih}T${a.saat || '00:00'}`).getTime()
      const tb = new Date(`${b.tarih}T${b.saat || '00:00'}`).getTime()
      return tb - ta // desc
    })

    setNotifItems(items)
    setNotifCount(items.length)
  }

  async function signOut() {
    await supabase.auth.signOut()
    router.replace('/login')
  }

  function navigate(id: ModuleId) {
    router.push(`/?module=${id}`)
    setModule(id); setSidebar(false)
  }

  if (loading) return (
    <div className="flex min-h-screen items-center justify-center bg-[#020617]">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center backdrop-blur-xl">
          <div className="w-6 h-6 border-b-2 border-r-2 border-blue-500 animate-spin rounded-full" />
        </div>
      </div>
    </div>
  )

  if (error === '__no_firma__') return <FirmaKurulum onDone={() => window.location.reload()} />

  if (error) return (
    <div className="flex min-h-screen items-center justify-center bg-[#020617] px-4">
      <div className="bg-slate-900/60 p-6 sm:p-8 rounded-3xl border border-white/10 backdrop-blur-2xl shadow-[0_0_40px_rgba(0,0,0,0.5)] max-w-sm w-full text-center">
        <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-4">
          <X size={20} className="text-red-400" />
        </div>
        <h2 className="font-semibold text-white mb-2 tracking-tight">Bağlantı Hatası</h2>
        <p className="text-sm text-slate-400 mb-6 leading-relaxed">{error}</p>
        <button onClick={() => window.location.reload()} className="w-full bg-white/10 text-white border border-white/10 py-2.5 rounded-xl font-medium hover:bg-white/20 transition-colors">Yeniden Dene</button>
      </div>
    </div>
  )

  if (!firma || !profil) return null

  const ctx: AppCtx = { firma, profil, navigate }
  const activeNav = NAV.find(n => n.id === module)
  const desktopSidebarWidth = sidebarHover ? 260 : 80
  const groups = ['Yönetim', 'Finans', 'Analiz']

  // Sidebar İçeriği (Hem Mobil hem Desktop için)
  const SidebarContent = ({ collapsed }: { collapsed?: boolean }) => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-4 pt-[calc(1.25rem+env(safe-area-inset-top))] pb-4 shrink-0 transition-all duration-300">
        <div className={`flex items-center gap-3 ${collapsed ? 'justify-center ml-1' : ''}`}>
          <div className="w-9 h-9 rounded-2xl flex items-center justify-center shrink-0"
            style={{ background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)', boxShadow: '0 4px 12px rgba(59, 130, 246, 0.4)' }}>
            <ClipboardList size={18} className="text-white" />
          </div>
          <div className={`min-w-0 whitespace-nowrap overflow-hidden transition-all duration-300 ${collapsed ? 'opacity-0 max-w-0' : 'opacity-100 max-w-[200px]'}`}>
            <p className="text-[15px] font-bold text-white truncate tracking-tight">{firma.kisa_ad || firma.ad}</p>
            <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">İş Takip Sistemi</p>
          </div>
        </div>
      </div>

      {/* Navigations */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden py-3 px-3 space-y-5 custom-scroll">
        <div className="space-y-1">
          {NAV.filter(n => !n.group).map(item => {
            const Icon = item.icon
            const isActive = module === item.id
            return (
              <button key={item.id} onClick={() => navigate(item.id)} title={collapsed ? item.label : undefined}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all group ${
                  isActive 
                    ? 'bg-blue-500/15 text-blue-400 border border-blue-500/20' 
                    : 'text-slate-400 hover:text-slate-100 hover:bg-white/5 border border-transparent'
                }`}>
                <Icon size={18} className={`shrink-0 transition-transform ${isActive ? 'scale-110' : 'group-hover:scale-110'}`} strokeWidth={isActive ? 2.5 : 2} />
                <span className={`flex-1 text-left whitespace-nowrap overflow-hidden transition-all duration-300 ${collapsed ? 'opacity-0 max-w-0' : 'opacity-100 max-w-[200px]'}`}>{item.label}</span>
              </button>
            )
          })}
        </div>
        {groups.map(group => (
          <div key={group}>
            <p className={`px-3 whitespace-nowrap overflow-hidden text-[10px] font-bold uppercase tracking-widest text-slate-500 transition-all duration-300 ${collapsed ? 'opacity-0 max-h-0 m-0' : 'opacity-100 max-h-10 mb-2'}`}>
              {group}
            </p>
            <div className="space-y-1">
              {NAV.filter(n => n.group === group).map(item => {
                const Icon = item.icon
                const isActive = module === item.id
                return (
                  <button key={item.id} onClick={() => navigate(item.id)} title={collapsed ? item.label : undefined}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all group ${
                      isActive 
                        ? 'bg-blue-500/15 text-blue-400 border border-blue-500/20' 
                        : 'text-slate-400 hover:text-slate-100 hover:bg-white/5 border border-transparent'
                    }`}>
                    <Icon size={18} className={`shrink-0 transition-transform ${isActive ? 'scale-110' : 'group-hover:scale-110'}`} strokeWidth={isActive ? 2.5 : 2} />
                    <span className={`flex-1 text-left whitespace-nowrap overflow-hidden transition-all duration-300 ${collapsed ? 'opacity-0 max-w-0' : 'opacity-100 max-w-[200px]'}`}>{item.label}</span>
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* User */}
      <div className="p-3 mt-auto border-t border-white/5 shrink-0">
        <div className={`flex items-center gap-3 p-2 rounded-xl transition-all ${collapsed ? 'justify-center' : 'hover:bg-white/5'}`}>
          <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-lg"
            style={{ background: 'linear-gradient(135deg, #3b82f6, #0ea5e9)' }}>
            {(profil.ad_soyad || profil.email)[0]?.toUpperCase() || 'U'}
          </div>
          <div className={`flex-1 min-w-0 whitespace-nowrap overflow-hidden transition-all duration-300 ${collapsed ? 'opacity-0 max-w-0' : 'opacity-100 max-w-[150px]'}`}>
            <p className="text-[13px] font-semibold text-slate-200 truncate tracking-tight">{profil.ad_soyad || profil.email.split('@')[0]}</p>
            <p className="text-[10px] capitalize text-slate-500 font-medium">{profil.rol}</p>
          </div>
          <button onClick={signOut} title="Çıkış"
            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all hover:bg-red-500/15 text-slate-500 hover:text-red-400 ${collapsed ? 'hidden' : 'block'}`}>
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </div>
  )

  const BOTTOM_NAV = [
    { id: 'dashboard',  label: 'Ana Sayfa', icon: LayoutDashboard },
    { id: 'gorevler',   label: 'İşler',     icon: ClipboardList   },
    { id: 'evraklar',   label: 'Evraklar',  icon: FileStack       },
    { id: 'kasa',       label: 'Kasa',      icon: Wallet          },
    { id: 'ayarlar',    label: 'Ayarlar',   icon: Settings        },
  ] as const

  return (
    <div className="flex h-[100dvh] overflow-hidden text-slate-200 w-full relative">
      
      {/* Desktop sidebar placeholder (pushes main content) */}
      <div
        className="hidden md:block shrink-0 transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]"
        style={{ width: `${desktopSidebarWidth}px` }}
      />
      
      {/* Desktop sidebar actual (fixed, hover to expand) */}
      <aside 
        className="hidden md:flex flex-col h-full fixed left-0 top-0 bottom-0 z-40 group transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]"
        onMouseEnter={() => setSidebarHover(true)}
        onMouseLeave={() => setSidebarHover(false)}
        style={{ 
          width: `${desktopSidebarWidth}px`,
          background: 'rgba(15, 23, 42, 0.45)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          borderRight: '1px solid rgba(255, 255, 255, 0.08)'
        }}>
        <SidebarContent collapsed={!sidebarHover} />
      </aside>

      {/* Mobile sidebar drawer */}
      {sidebar && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm transition-opacity" onClick={() => setSidebar(false)} />
          <aside className="relative w-[260px] h-full flex flex-col z-10 border-r border-white/10"
            style={{ background: 'rgba(15, 23, 42, 0.85)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)' }}>
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Main Container */}
      <div className="flex-1 flex flex-col min-w-0 relative h-full">
        {/* Glassmorphic Header */}
        <header className="shrink-0 flex items-center gap-3 px-5 sm:px-8 h-[72px] sticky top-0 z-30"
          style={{
            background: 'rgba(255, 255, 255, 0.02)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
          }}>
          <button onClick={() => setSidebar(true)}
            className="md:hidden w-10 h-10 flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 transition-colors border border-white/5 text-slate-300">
            <Menu size={18} />
          </button>
          <div className="flex-1 min-w-0 flex items-center gap-4">
            <h2 className="text-lg sm:text-xl font-bold tracking-tight text-white truncate">
              {activeNav?.label || 'Dashboard'}
            </h2>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <button onClick={() => { setShowNotifModal(true); loadNotifs(firma.id) }}
              className="relative w-10 h-10 flex items-center justify-center rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all text-slate-300 hover:text-white">
              <Bell size={18} strokeWidth={2} />
              {notifCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-[18px] h-[18px] rounded-full text-white font-bold flex items-center justify-center shadow-lg shadow-blue-500/50"
                  style={{ background: '#3b82f6', fontSize: '10px' }}>
                  {notifCount > 9 ? '9+' : notifCount}
                </span>
              )}
            </button>
            <div className="hidden sm:flex items-center gap-2.5 px-3 py-2 rounded-xl bg-white/5 border border-white/5 backdrop-blur-md">
              <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold"
                style={{ background: 'linear-gradient(135deg, #3b82f6, #0ea5e9)' }}>
                {(profil.ad_soyad || profil.email)[0]?.toUpperCase() || 'U'}
              </div>
              <span className="text-xs font-semibold text-slate-200">{profil.ad_soyad || profil.email.split('@')[0]}</span>
            </div>
          </div>
        </header>

        {/* Content Area */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden custom-scroll relative">
          <div className="w-full max-w-7xl mx-auto p-4 sm:p-6 md:p-8 pb-28 md:pb-8 ios-fade" key={module}>
            {module === 'dashboard'  && <Dashboard  {...ctx} />}
            {module === 'musteriler' && <Musteriler {...ctx} />}
            {module === 'gorevler'   && <Gorevler   {...ctx} />}
            {module === 'gunluk'     && <Gunluk     {...ctx} />}
            {module === 'kasa'       && <Kasa       {...ctx} />}
            {module === 'karzarar'   && <KarZarar   {...ctx} />}
            {module === 'evraklar'   && <Evraklar   {...ctx} />}
            {module === 'cekler'     && <Cekler     {...ctx} />}
            {module === 'odemeplani' && <OdemePlani {...ctx} />}
            {module === 'bordro'     && <Bordro     {...ctx} />}
            {module === 'raporlar'   && <Raporlar   {...ctx} />}
            {module === 'ayarlar'    && <Ayarlar    {...ctx} />}
          </div>
        </main>

        {/* Mobile Tab Bar */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 flex items-stretch pb-[env(safe-area-inset-bottom)]"
          style={{
            background: 'rgba(15, 23, 42, 0.75)',
            backdropFilter: 'blur(30px)',
            WebkitBackdropFilter: 'blur(30px)',
            borderTop: '1px solid rgba(255, 255, 255, 0.1)',
          }}>
          {BOTTOM_NAV.map(item => {
            const Icon = item.icon
            const isActive = module === item.id
            return (
              <button key={item.id} onClick={() => navigate(item.id)}
                className={`flex-1 flex flex-col items-center justify-center gap-1 py-3 transition-all ${
                  isActive ? 'text-blue-400' : 'text-slate-500 hover:text-slate-300'
                }`}>
                <div className="relative">
                  <Icon size={20} strokeWidth={isActive ? 2.5 : 2} className={isActive ? 'drop-shadow-[0_0_8px_rgba(59,130,246,0.5)]' : ''} />
                </div>
                <span className="text-[10px] font-semibold leading-none">{item.label}</span>
              </button>
            )
          })}
        </nav>
      </div>

      {/* ── Hatırlatıcılar Popover / Modal ────────────────────────────────────── */}
      {showNotifModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 sm:pt-24 px-4 bg-slate-950/60 backdrop-blur-sm transition-opacity" onClick={() => setShowNotifModal(false)}>
          <div className="w-full max-w-sm bg-slate-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[70vh]" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
              <h3 className="font-bold text-white flex items-center gap-2">
                <Bell size={16} className="text-blue-400" /> Hatırlatıcılar & İşler
              </h3>
              <button onClick={() => setShowNotifModal(false)} className="text-slate-400 hover:text-white transition-colors">
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {notifItems.length === 0 ? (
                <div className="p-8 text-center text-slate-500 text-sm font-medium">
                  Bekleyen bildirimiz yok.
                </div>
              ) : notifItems.map(item => (
                <button key={`${item.module}-${item.id}`} onClick={() => { setShowNotifModal(false); navigate(item.module as any) }}
                  className="w-full text-left p-3 mb-1 rounded-xl flex items-start gap-3 hover:bg-white/5 transition-all group">
                  <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0">
                    <Clock size={14} className="text-blue-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{item.baslik}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] uppercase font-bold text-blue-400 tracking-wider">
                        {item.module === 'gunluk' ? 'GÜNLÜK İŞ' : item.module === 'gorevler' ? 'PERİYODİK' : 'BORDRO'}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {new Date(item.tarih).toLocaleDateString('tr-TR')} {item.saat ? `· ${item.saat}` : ''}
                      </span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
            <div className="p-3 border-t border-white/10 text-center">
              <span className="text-xs text-slate-500 font-medium">Listelenenleri ilgili modüllerde erteleyebilir / tamamlayabilirsiniz.</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function FirmaKurulum({ onDone }: { onDone: () => void }) {
  const [ad, setAd] = useState('')
  const [kisaAd, setKisaAd] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  async function save() {
    if (!ad.trim()) { setErr('Firma adı zorunludur'); return }
    setSaving(true)
    const { error } = await supabase.from('firmalar').insert({ ad: ad.trim(), kisa_ad: kisaAd.trim() || null, aktif: true })
    if (error) { setErr(error.message); setSaving(false); return }
    onDone()
  }
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#020617] px-4">
      <div className="bg-slate-900/60 p-8 rounded-3xl border border-white/10 backdrop-blur-xl shadow-[0_0_40px_rgba(0,0,0,0.5)] max-w-sm w-full">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center mx-auto mb-6 shadow-xl shadow-blue-500/20">
          <Building2 size={24} className="text-white" />
        </div>
        <h2 className="text-xl font-bold text-white text-center mb-2 tracking-tight">Kurulum</h2>
        <p className="text-sm text-slate-400 text-center mb-8">Sisteme başlamak için şirket bilginizi girin.</p>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Firma Adı</label>
            <input className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-slate-500 outline-none focus:border-blue-500 focus:bg-white/10 transition-all font-medium" value={ad} onChange={e => setAd(e.target.value)} placeholder="Örn: ETM Muhasebe" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Kısa Ad</label>
            <input className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-slate-500 outline-none focus:border-blue-500 focus:bg-white/10 transition-all font-medium" value={kisaAd} onChange={e => setKisaAd(e.target.value)} placeholder="Örn: ETM" />
          </div>
          {err && <p className="text-xs text-red-400 font-medium pl-1">{err}</p>}
          <button onClick={save} disabled={saving} className="w-full bg-blue-600 text-white py-3 rounded-xl text-sm font-bold hover:bg-blue-500 transition-all shadow-lg shadow-blue-500/30 disabled:opacity-50 mt-4">
            {saving ? 'Oluşturuluyor...' : 'Devam Et'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <Suspense fallback={<div className="flex h-screen w-full bg-[#020617]" />}>
      <AppContent />
    </Suspense>
  )
}

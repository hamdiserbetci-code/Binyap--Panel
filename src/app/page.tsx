'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  LayoutDashboard, ClipboardList, FileStack, Users2,
  Archive, BarChart2, Settings, LogOut, Menu, X,
  Bell, Building2, CalendarCheck, Wallet, TrendingUp
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { Firma, KullaniciProfil } from '@/types'
import dynamic from 'next/dynamic'

const Dashboard  = dynamic(() => import('@/modules/dashboard'),  { ssr: false })
const Musteriler = dynamic(() => import('@/modules/musteriler'), { ssr: false })
const Gorevler   = dynamic(() => import('@/modules/gorevler'),   { ssr: false })
const Bordro     = dynamic(() => import('@/modules/bordro'),     { ssr: false })
const Arsiv      = dynamic(() => import('@/modules/arsiv'),      { ssr: false })
const Raporlar   = dynamic(() => import('@/modules/raporlar'),   { ssr: false })
const Ayarlar    = dynamic(() => import('@/modules/ayarlar'),    { ssr: false })
const Gunluk     = dynamic(() => import('@/modules/gunluk'),     { ssr: false })
const Kasa       = dynamic(() => import('@/modules/kasa'),       { ssr: false })
const KarZarar   = dynamic(() => import('@/modules/karzarar'),   { ssr: false })

const NAV = [
  { id: 'dashboard',  label: 'Dashboard',      icon: LayoutDashboard, group: null },
  { id: 'musteriler', label: 'Müşteriler',      icon: Building2,       group: 'Yönetim' },
  { id: 'gorevler',   label: 'Periyodik İşler', icon: ClipboardList,   group: 'Yönetim' },
  { id: 'gunluk',     label: 'Günlük İşler',   icon: CalendarCheck,   group: 'Yönetim' },
  { id: 'kasa',       label: 'Kasa',            icon: Wallet,          group: 'Yönetim' },
  { id: 'karzarar',   label: 'Kar / Zarar',     icon: TrendingUp,      group: 'Yönetim' },
  { id: 'bordro',     label: 'Bordro Süreci',   icon: Users2,          group: 'Yönetim' },
  { id: 'arsiv',      label: 'Dijital Arşiv',   icon: Archive,         group: 'Yönetim' },
  { id: 'raporlar',   label: 'Raporlar',         icon: BarChart2,       group: 'Analiz' },
  { id: 'ayarlar',    label: 'Ayarlar',          icon: Settings,        group: 'Analiz' },
] as const

type ModuleId = typeof NAV[number]['id']
export type AppCtx = { firma: Firma; profil: KullaniciProfil; navigate: (id: ModuleId) => void }

export default function App() {
  const router = useRouter()
  const [firma, setFirma]       = useState<Firma | null>(null)
  const [profil, setProfil]     = useState<KullaniciProfil | null>(null)
  const [module, setModule]     = useState<ModuleId>('dashboard')
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState('')
  const [sidebar, setSidebar]   = useState(false)
  const [notifCount, setNotifCount] = useState(0)

  useEffect(() => {
    let mounted = true

    async function init() {
      try {
        // Önce anlık session kontrolü yap
        const { data: { session } } = await supabase.auth.getSession()
        if (!mounted) return
        if (!session) {
          setLoading(false)
          router.replace('/login')
          return
        }
        await loadApp(session.user.id)
      } catch {
        if (!mounted) return
        setError('Bağlantı kurulamadı. Sayfayı yenileyin.')
        setLoading(false)
      }
    }

    init()

    // Oturum değişikliklerini dinle (logout vb.)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return
      if (!session) {
        setLoading(false)
        router.replace('/login')
      }
    })

    return () => { mounted = false; subscription.unsubscribe() }
  }, [])

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

      const bugun = new Date().toISOString().split('T')[0]
      const { count } = await supabase.from('gorevler')
        .select('id', { count: 'exact', head: true })
        .eq('firma_id', f.id).lte('son_tarih', bugun).neq('durum', 'tamamlandi').neq('durum', 'iptal')
      setNotifCount(count || 0)

      setLoading(false)
    } catch (e: any) {
      setError(e?.message || 'Bağlantı hatası')
      setLoading(false)
    }
  }

  async function signOut() {
    await supabase.auth.signOut()
    router.replace('/login')
  }

  function navigate(id: ModuleId) { setModule(id); setSidebar(false) }

  if (loading) return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
          <ClipboardList size={22} className="text-white" />
        </div>
        <div className="flex gap-1.5">
          {[0,1,2].map(i => <div key={i} className="w-2 h-2 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: `${i*0.15}s` }} />)}
        </div>
        <p className="text-xs text-slate-500">Yükleniyor...</p>
      </div>
    </div>
  )

  if (error === '__no_firma__') return <FirmaKurulum onDone={() => window.location.reload()} />

  if (error) return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
      <div className="bg-slate-800 p-8 rounded-2xl border border-slate-700/60 shadow-2xl max-w-sm w-full text-center">
        <div className="w-12 h-12 rounded-full bg-red-900/40 border border-red-700/40 flex items-center justify-center mx-auto mb-4">
          <X size={20} className="text-red-400" />
        </div>
        <h2 className="font-semibold text-white mb-2">Bağlantı Hatası</h2>
        <p className="text-sm text-slate-400 mb-5">{error}</p>
        <button onClick={() => window.location.reload()} className="w-full bg-blue-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-blue-500 transition-colors">Yeniden Dene</button>
      </div>
    </div>
  )

  if (!firma || !profil) return null

  const ctx: AppCtx = { firma, profil, navigate }
  const activeNav = NAV.find(n => n.id === module)
  const groups = ['Yönetim', 'Analiz']

  const SidebarContent = () => (
    <div className="flex flex-col h-full" style={{ background: '#1C1C1E' }}>
      {/* Logo */}
      <div className="px-4 pt-5 pb-4" style={{ borderBottom: '1px solid rgba(60,60,67,0.36)' }}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0"
            style={{ background: 'linear-gradient(135deg, #0A84FF, #5E5CE6)', boxShadow: '0 2px 8px rgba(10,132,255,0.35)' }}>
            <ClipboardList size={17} className="text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white truncate tracking-tight">{firma.kisa_ad || firma.ad}</p>
            <p className="text-[10px] leading-tight" style={{ color: 'rgba(235,235,245,0.4)' }}>İş Takip Sistemi</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-4">
        <div className="space-y-0.5">
          {NAV.filter(n => !n.group).map(item => {
            const Icon = item.icon
            const isActive = module === item.id
            return (
              <button key={item.id} onClick={() => navigate(item.id)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-[10px] text-sm font-medium transition-all"
                style={isActive
                  ? { background: 'rgba(10,132,255,0.18)', color: '#0A84FF' }
                  : { color: 'rgba(235,235,245,0.55)' }}>
                <Icon size={16} strokeWidth={isActive ? 2.5 : 2} />
                {item.label}
              </button>
            )
          })}
        </div>
        {groups.map(group => (
          <div key={group}>
            <p className="px-3 mb-1.5 text-[10px] font-bold uppercase tracking-widest"
              style={{ color: 'rgba(235,235,245,0.25)' }}>{group}</p>
            <div className="space-y-0.5">
              {NAV.filter(n => n.group === group).map(item => {
                const Icon = item.icon
                const isActive = module === item.id
                return (
                  <button key={item.id} onClick={() => navigate(item.id)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-[10px] text-sm font-medium transition-all"
                    style={isActive
                      ? { background: 'rgba(10,132,255,0.18)', color: '#0A84FF' }
                      : { color: 'rgba(235,235,245,0.55)' }}>
                    <Icon size={16} strokeWidth={isActive ? 2.5 : 2} />
                    {item.label}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Kullanıcı */}
      <div className="p-3" style={{ borderTop: '1px solid rgba(60,60,67,0.36)' }}>
        <div className="flex items-center gap-3 px-2 py-2 rounded-[10px] transition-colors hover:bg-[rgba(120,120,128,0.1)]">
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
            style={{ background: 'linear-gradient(135deg, #0A84FF, #5E5CE6)' }}>
            {(profil.ad_soyad || profil.email)[0]?.toUpperCase() || 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-white truncate">{profil.ad_soyad || profil.email.split('@')[0]}</p>
            <p className="text-[10px] capitalize" style={{ color: 'rgba(235,235,245,0.4)' }}>{profil.rol}</p>
          </div>
          <button onClick={signOut} title="Çıkış"
            className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors hover:bg-[rgba(255,69,58,0.15)]"
            style={{ color: 'rgba(235,235,245,0.35)' }}>
            <LogOut size={14} />
          </button>
        </div>
      </div>
    </div>
  )

  // Mobil alt nav
  const BOTTOM_NAV = [
    { id: 'dashboard',  label: 'Ana Sayfa', icon: LayoutDashboard },
    { id: 'gorevler',   label: 'Periyodik', icon: ClipboardList   },
    { id: 'gunluk',     label: 'Günlük',    icon: CalendarCheck   },
    { id: 'kasa',       label: 'Kasa',      icon: Wallet          },
    { id: 'ayarlar',    label: 'Ayarlar',   icon: Settings        },
  ] as const

  return (
    <div className="flex h-dvh overflow-hidden" style={{ background: '#000000' }}>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-56 shrink-0" style={{ borderRight: '1px solid rgba(60,60,67,0.36)' }}>
        <SidebarContent />
      </aside>

      {/* Mobile sidebar drawer */}
      {sidebar && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setSidebar(false)} />
          <aside className="relative w-64 h-full shadow-2xl flex flex-col z-10">
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* iOS Navigation Bar */}
        <header className="shrink-0 h-14 flex items-center gap-3 px-4"
          style={{
            background: 'rgba(28,28,30,0.85)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            borderBottom: '1px solid rgba(60,60,67,0.36)',
          }}>
          <button onClick={() => setSidebar(true)}
            className="md:hidden w-8 h-8 flex items-center justify-center rounded-full transition-colors"
            style={{ color: '#0A84FF' }}>
            <Menu size={20} />
          </button>
          <div className="flex-1 min-w-0">
            <span className="text-[15px] font-semibold text-white tracking-tight truncate">
              {activeNav?.label || 'Dashboard'}
            </span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button onClick={() => navigate('gorevler')}
              className="relative w-9 h-9 flex items-center justify-center rounded-full transition-colors"
              style={{ color: '#0A84FF' }}>
              <Bell size={20} strokeWidth={1.8} />
              {notifCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full text-white text-[9px] font-bold flex items-center justify-center"
                  style={{ background: '#FF453A', fontSize: '9px' }}>
                  {notifCount > 9 ? '9+' : notifCount}
                </span>
              )}
            </button>
            <div className="hidden sm:flex items-center gap-2 px-2.5 py-1.5 rounded-full"
              style={{ background: 'rgba(120,120,128,0.2)' }}>
              <div className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-bold"
                style={{ background: 'linear-gradient(135deg, #0A84FF, #5E5CE6)' }}>
                {(profil.ad_soyad || profil.email)[0]?.toUpperCase() || 'U'}
              </div>
              <span className="text-xs font-medium text-white">{profil.ad_soyad || profil.email.split('@')[0]}</span>
            </div>
          </div>
        </header>

        {/* İçerik */}
        <main className="flex-1 overflow-y-auto" style={{ background: '#000000' }}>
          <div className="p-3 md:p-5 pb-24 md:pb-6 ios-fade" key={module}>
            {module === 'dashboard'  && <Dashboard  {...ctx} />}
            {module === 'musteriler' && <Musteriler {...ctx} />}
            {module === 'gorevler'   && <Gorevler   {...ctx} />}
            {module === 'gunluk'     && <Gunluk     {...ctx} />}
            {module === 'kasa'       && <Kasa       {...ctx} />}
            {module === 'karzarar'   && <KarZarar   {...ctx} />}
            {module === 'bordro'     && <Bordro     {...ctx} />}
            {module === 'arsiv'      && <Arsiv      {...ctx} />}
            {module === 'raporlar'   && <Raporlar   {...ctx} />}
            {module === 'ayarlar'    && <Ayarlar    {...ctx} />}
          </div>
        </main>

        {/* iOS Tab Bar */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 flex items-stretch safe-area-pb"
          style={{
            background: 'rgba(28,28,30,0.92)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            borderTop: '1px solid rgba(60,60,67,0.36)',
          }}>
          {BOTTOM_NAV.map(item => {
            const Icon = item.icon
            const isActive = module === item.id
            return (
              <button key={item.id} onClick={() => navigate(item.id)}
                className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 transition-all"
                style={{ color: isActive ? '#0A84FF' : 'rgba(235,235,245,0.4)' }}>
                <div className="relative">
                  <Icon size={22} strokeWidth={isActive ? 2.5 : 1.8} />
                  {item.id === 'gorevler' && notifCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-white flex items-center justify-center"
                      style={{ background: '#FF453A', fontSize: '8px', fontWeight: 700 }}>
                      {notifCount > 9 ? '9+' : notifCount}
                    </span>
                  )}
                </div>
                <span className="text-[10px] font-medium leading-none">{item.label}</span>
              </button>
            )
          })}
        </nav>
      </div>
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
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
      <div className="bg-slate-800 p-8 rounded-2xl border border-slate-700/60 shadow-2xl max-w-sm w-full">
        <div className="w-12 h-12 rounded-xl bg-blue-600 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-500/30">
          <ClipboardList size={22} className="text-white" />
        </div>
        <h2 className="text-lg font-bold text-white text-center mb-1">Firma Kurulumu</h2>
        <p className="text-sm text-slate-400 text-center mb-6">Başlamak için firma bilgilerini girin.</p>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Firma Adı *</label>
            <input className="w-full bg-slate-700/80 border border-slate-600/60 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" value={ad} onChange={e => setAd(e.target.value)} placeholder="Örn: ETM Muhasebe" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Kısa Ad</label>
            <input className="w-full bg-slate-700/80 border border-slate-600/60 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" value={kisaAd} onChange={e => setKisaAd(e.target.value)} placeholder="Örn: ETM" />
          </div>
          {err && <p className="text-xs text-red-400">{err}</p>}
          <button onClick={save} disabled={saving} className="w-full bg-blue-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-blue-500 transition-colors disabled:opacity-50 mt-2">
            {saving ? 'Oluşturuluyor...' : 'Firmayı Oluştur ve Başla'}
          </button>
        </div>
      </div>
    </div>
  )
}

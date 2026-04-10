'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { LogOut, X, Bell, Building2, Clock, Menu, LayoutDashboard } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { Firma, KullaniciProfil } from '@/types'
import dynamic from 'next/dynamic'
import { NAV, type ModuleId } from './nav-config'
import DashboardHome from '@/components/dashboard/DashboardPage'

const Gorevler   = dynamic(() => import('@/modules/gorevler'),   { ssr: false })
const Bordro     = dynamic(() => import('@/modules/bordro'),     { ssr: false })
const Raporlar   = dynamic(() => import('@/modules/raporlar'),   { ssr: false })
const Ayarlar    = dynamic(() => import('@/modules/ayarlar'),    { ssr: false })
const Gunluk     = dynamic(() => import('@/modules/gunluk'),     { ssr: false })
const Kasa       = dynamic(() => import('@/modules/kasa'),       { ssr: false })
const KarZarar   = dynamic(() => import('@/modules/karzarar'),   { ssr: false })
const Cekler     = dynamic(() => import('@/modules/cekler'),     { ssr: false })
const OdemePlani = dynamic(() => import('@/modules/odemeplani'), { ssr: false })
const Yedek      = dynamic(() => import('@/modules/yedek'),      { ssr: false })
const Icra       = dynamic(() => import('@/modules/icra'),       { ssr: false })
const Projeler   = dynamic(() => import('@/modules/projeler'),   { ssr: false })
const Vergi      = dynamic(() => import('@/modules/vergi'),      { ssr: false })
const Cari       = dynamic(() => import('@/modules/cari'),       { ssr: false })

export type AppCtx = { firma: Firma; firmalar: Firma[]; firmaIds: string[]; profil: KullaniciProfil; navigate: (id: ModuleId) => void }

function AppContent() {
  const router = useRouter()
  const [firma, setFirma]       = useState<Firma | null>(null)
  const [profil, setProfil]     = useState<KullaniciProfil | null>(null)
  const [module, setModule]     = useState<ModuleId | null>(null) // null olduğunda Dashboard açılır
  const [loading, setLoading]   = useState(true)
  const [firmalarList, setFirmalarList] = useState<Firma[]>([])
  const [error, setError]       = useState('')
  const searchParams = useSearchParams()
  const [notifCount, setNotifCount] = useState(0)
  const [showNotifModal, setShowNotifModal] = useState(false)
  const [notifItems, setNotifItems] = useState<any[]>([])
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [authUserId, setAuthUserId] = useState<string>('')

  // Grupları otomatik belirleme (nav-config'den)
  const groups = Array.from(new Set(NAV.map(n => n.group)))

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

        setAuthUserId(session.user.id)
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
      // 1. Önce kullanıcının profilini al
      const { data: pData } = await supabase
        .from('kullanici_profilleri').select('*')
        .eq('auth_user_id', userId).maybeSingle()
      let p = pData as KullaniciProfil | null

      // 2. Kullanıcının KENDİ firmasını tespit et
      let f: Firma | undefined
      if (p && p.firma_id) {
        const { data: firmalar } = await supabase.from('firmalar').select('*').eq('id', p.firma_id).single()
        f = firmalar as Firma | undefined
      }
      
      // 3. Eğer kullanıcı yeni açıldıysa ve firması yoksa ilk firmayı yedek olarak al
      if (!f) {
        const { data: firmalar, error: fErr } = await supabase.from('firmalar').select('*').eq('aktif', true).order('ad').limit(1)
        if (fErr) throw fErr
        f = firmalar?.[0] as Firma | undefined
        if (!f) { setLoading(false); setError('__no_firma__'); return }
      }

      setFirma(f)

      // Her zaman tüm aktif firmaları yükle (birleşik görünüm için)
      const { data: allFirmalar } = await supabase.from('firmalar').select('*').eq('aktif', true).order('ad')
      if (allFirmalar) setFirmalarList(allFirmalar as Firma[])

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

  async function loadNotifs(firmaId: string, checkAlarms = false) {
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

    // Cekler
    const { data: c } = await supabase.from('cekler')
      .select('id, cek_no, durum, hatirlatici_tarihi, hatirlatici_saati')
      .eq('firma_id', firmaId)
      .eq('durum', 'bekliyor')
      .not('hatirlatici_tarihi', 'is', null)

    const { data: o } = await supabase.from('odeme_plani')
      .select('id, baslik, durum, hatirlatma')
      .eq('firma_id', firmaId)
      .in('durum', ['bekliyor', 'ertelendi'])
      .not('hatirlatma', 'is', null)

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
    c?.forEach(x => {
       if (x.hatirlatici_tarihi && x.hatirlatici_tarihi <= today && x.durum === 'bekliyor') items.push({ id: x.id, baslik: `Cek (${x.cek_no})`, module: 'cekler', saat: x.hatirlatici_saati, tarih: x.hatirlatici_tarihi })
    })
    o?.forEach(x => {
       if (x.hatirlatma) {
         const tDate = x.hatirlatma.split('T')[0]
         const tTime = x.hatirlatma.split('T')[1] || ''
         if (tDate <= today) items.push({ id: x.id, baslik: `Odeme (${x.baslik})`, module: 'odemeplani', saat: tTime, tarih: tDate })
       }
    })

    items.sort((a, b) => {
      const ta = new Date(`${a.tarih}T${a.saat || '00:00'}`).getTime()
      const tb = new Date(`${b.tarih}T${b.saat || '00:00'}`).getTime()
      return tb - ta
    })

    setNotifItems(items)
    setNotifCount(items.length)

    if (checkAlarms && 'Notification' in window && Notification.permission === 'granted') {
      const now = new Date()
      const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
      items.forEach(item => {
        if (item.tarih === today && item.saat === hhmm) {
          new Notification('ETM Panel Hatırlatıcı', { body: item.baslik, icon: '/favicon.ico' })
        }
      })
    }
  }

  async function signOut() {
    await supabase.auth.signOut()
    router.replace('/login')
  }

  function navigate(id: ModuleId | null) {
    if (id) {
      router.push(`/?module=${id}`)
    } else {
      router.push(`/`)
    }
    setModule(id)
    setSidebarOpen(false) // Mobil menü kapat
  }

useEffect(() => {
    if (!firma || loading) return;
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
    const timer = setInterval(() => {
      loadNotifs(firma.id, true);
    }, 60000);
    return () => clearInterval(timer);
  }, [firma, loading]);

  if (loading) return (
    <div className="flex min-h-screen items-center justify-center bg-[#DCEEFA]">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-blue-100 border border-blue-200 flex items-center justify-center shadow-sm">
          <div className="w-6 h-6 border-b-2 border-r-2 border-blue-500 animate-spin rounded-full" />
        </div>
        <span className="text-sm text-slate-500 font-medium">Yükleniyor...</span>
      </div>
    </div>
  )

  if (error === '__no_firma__') return <FirmaKurulum onDone={() => window.location.reload()} />

  if (error) return (
    <div className="flex min-h-screen items-center justify-center bg-[#DCEEFA] px-4">
      <div className="bg-white border border-blue-100 p-6 sm:p-8 rounded-3xl max-w-sm w-full text-center shadow-sm">
        <div className="w-12 h-12 rounded-full bg-red-50 border border-red-200 flex items-center justify-center mx-auto mb-4">
          <X size={20} className="text-red-500" />
        </div>
        <h2 className="font-semibold text-slate-800 mb-2 tracking-tight">Bağlantı Hatası</h2>
        <p className="text-sm text-slate-500 mb-6 leading-relaxed">{error}</p>
        <button onClick={() => window.location.reload()} className="w-full bg-blue-500 text-white py-2.5 rounded-xl font-medium hover:bg-blue-600 transition-colors">Yeniden Dene</button>
      </div>
    </div>
  )

  if (!firma || !profil) return null

  const firmaIds = firmalarList.length > 0 ? firmalarList.map(f => f.id) : [firma!.id]
  const ctx: AppCtx = { firma: firma!, firmalar: firmalarList, firmaIds, profil: profil!, navigate }
  const activeNav = module ? NAV.find(n => n.id === module) : null

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-[#DCEEFA] text-slate-800">

      {/* ── Sidebar (Kalıcı Sol Menü) ───────────────────────────────────────────────────────── */}
      <aside className={`fixed inset-y-0 left-0 z-40 w-64 border-r border-cyan-800/30 shadow-lg transform transition-transform duration-300 ease-in-out md:translate-x-0 md:static md:shrink-0 flex flex-col ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
        style={{ background: 'linear-gradient(180deg, #0E7490 0%, #0A6079 100%)' }}>

        {/* Logo Alanı */}
        <div className="h-16 flex items-center px-6 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-3 w-full">
            <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center shadow-sm flex-shrink-0">
              <Building2 size={16} className="text-white" />
            </div>
            <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-white tracking-tight truncate">
            {firmalarList.length > 1
              ? firmalarList.map(f => f.kisa_ad || f.ad).join(' & ')
              : (firma?.kisa_ad || firma?.ad)}
          </p>
              <p className="text-[10px] text-cyan-200/70 font-medium uppercase tracking-widest truncate">ETM PANEL</p>

            </div>
          </div>
        </div>

        {/* Navigasyon Linkleri */}
        <div className="flex-1 overflow-y-auto custom-scroll py-4 px-3 space-y-6">
          {/* Ana Sayfa Butonu */}
          <div>
            <button
              onClick={() => navigate(null)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 ${!module ? 'bg-white/20 text-white border border-white/30 shadow-sm' : 'text-cyan-100/80 hover:bg-white/10 hover:text-white'}`}
            >
              <LayoutDashboard size={18} className={!module ? 'text-white' : 'text-cyan-200/70'} />
              <span className="text-sm font-medium">Ana Ekran</span>
            </button>
          </div>

          {/* Dinamik Gruplar */}
          {groups.map(group => (
            <div key={group}>
              <p className="px-3 text-[10px] font-bold text-cyan-200/50 uppercase tracking-widest mb-2">{group}</p>
              <div className="space-y-0.5">
                {NAV.filter(n => n.group === group).map(app => {
                  const Icon = app.icon
                  const isActive = module === app.id
                  return (
                    <button
                      key={app.id}
                      onClick={() => navigate(app.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group ${isActive ? 'bg-white/20 text-white border border-white/30 shadow-sm' : 'text-cyan-100/80 hover:bg-white/10 hover:text-white'}`}
                    >
                      <Icon size={18} className={`transition-colors ${isActive ? 'text-white' : 'text-cyan-200/60 group-hover:text-cyan-100'}`} />
                      <span className="text-sm font-medium">{app.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Footer / Kullanıcı Profili Modülü */}
        <div className="p-4 border-t border-white/10 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/20 border border-white/30 flex items-center justify-center text-white text-sm font-bold shrink-0">
              {(profil.ad_soyad ?? profil.email ?? '')[0]?.toUpperCase() || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-white truncate">{profil.ad_soyad || (profil.email ?? '').split('@')[0]}</p>
              <p className="text-[10px] text-cyan-200/60 capitalize truncate">{profil.rol}</p>
            </div>
            <button onClick={signOut} className="w-8 h-8 flex items-center justify-center rounded-xl bg-white/10 text-white/70 border border-white/20 hover:bg-red-500/30 hover:text-white transition-all shrink-0">
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobil Sidebar Arkaplan Örtüsü */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-30 bg-slate-900/40 backdrop-blur-sm md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* ── Main Content Area ───────────────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col min-w-0 relative h-full">

        {/* Topbar */}
        <header className="h-16 shrink-0 flex items-center justify-between px-4 sm:px-6 z-10 bg-white border-b border-blue-100 shadow-sm sticky top-0">
          <div className="flex items-center gap-4">
            <button onClick={() => setSidebarOpen(true)} className="md:hidden w-10 h-10 flex items-center justify-center rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors border border-slate-200">
              <Menu size={20} />
            </button>
            <div className="hidden sm:flex items-center gap-2">
              {activeNav ? (
                <>
                  <LayoutDashboard size={14} className="text-slate-400" />
                  <span className="text-slate-400 text-sm font-medium">Modüller</span>
                  <span className="text-slate-300">/</span>
                  <span className="text-slate-800 text-sm font-semibold flex items-center gap-2">
                    <activeNav.icon size={14} className="text-blue-500" />
                    {activeNav.label}
                  </span>
                </>
              ) : (
                <span className="text-white text-sm font-semibold flex items-center gap-2">
                  <LayoutDashboard size={14} className="text-blue-400" /> Ana Lobi
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button onClick={() => { setShowNotifModal(true); loadNotifs(firma.id) }} className="relative w-10 h-10 flex items-center justify-center rounded-xl bg-slate-100 border border-slate-200 hover:bg-slate-200 transition-colors text-slate-600 hover:text-slate-800">
              <Bell size={18} />
              {notifCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white font-bold flex items-center justify-center text-[9px] border border-white shadow-sm animate-pulse">
                  {notifCount > 9 ? '9+' : notifCount}
                </span>
              )}
            </button>
          </div>
        </header>

        {/* Dynamic Page Content */}
        <div className="flex-1 overflow-y-auto custom-scroll relative p-4 lg:p-8 animate-fade-scale">
          {!module && <DashboardHome userId={authUserId} firma={firma!} firmaIds={firmaIds} onNavigate={navigate as any} />}
          {module === 'gorevler'   && <Gorevler   {...ctx} />}
          {module === 'gunluk'     && <Gunluk     {...ctx} />}
          {module === 'kasa'       && <Kasa       {...ctx} />}
          {module === 'karzarar'   && <KarZarar   {...ctx} />}
          {module === 'cekler'     && <Cekler     {...ctx} />}
          {module === 'odemeplani' && <OdemePlani {...ctx} />}
          {module === 'bordro'     && <Bordro     {...ctx} />}
          {module === 'raporlar'   && <Raporlar   {...ctx} />}
          {module === 'ayarlar'    && <Ayarlar    {...ctx} />}
          {module === 'yedek'      && <Yedek      {...ctx} />}
          {module === 'icra'       && <Icra       {...ctx} />}
          {module === 'projeler'   && <Projeler   {...ctx} />}
          {module === 'vergi'      && <Vergi      {...ctx} />}
          {module === 'cari'       && <Cari       {...ctx} />}
        </div>
      </main>

      {/* ── Hatırlatıcılar Modal / Slide-over ────────────────────────────────────── */}
      {showNotifModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-scale" onClick={() => setShowNotifModal(false)}>
          <div className="w-full max-w-md bg-white border border-blue-100 rounded-2xl shadow-xl flex flex-col max-h-[80vh] overflow-hidden animate-slide-down" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-white">
              <h3 className="text-base font-semibold text-slate-800 flex items-center gap-2">
                <Bell size={18} className="text-blue-500" /> Bildirim Merkezi
              </h3>
              <button onClick={() => setShowNotifModal(false)} className="w-8 h-8 flex items-center justify-center rounded-xl bg-slate-100 hover:bg-slate-200 transition-colors text-slate-500 hover:text-slate-800">
                <X size={16} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-3 custom-scroll bg-slate-50">
              {notifItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="w-16 h-16 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center mb-4">
                    <Clock size={24} className="text-blue-300" />
                  </div>
                  <p className="text-sm font-medium text-slate-700">Harika! Yaklaşan veya geciken göreviniz yok.</p>
                  <p className="text-xs text-slate-400 mt-1">İşler tıkırında gidiyor.</p>
                </div>
              ) : notifItems.map(item => (
                <button key={`${item.module}-${item.id}`} onClick={() => { setShowNotifModal(false); navigate(item.module as any) }}
                  className="w-full text-left p-3 mb-2 rounded-xl flex items-start gap-4 hover:bg-white transition-all group border border-slate-100 bg-white shadow-sm">
                  <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                    {item.module === 'odemeplani' || item.module === 'cekler' ? (
                      <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
                    ) : (
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-700 group-hover:text-slate-900 truncate">{item.baslik}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                        {item.module === 'gunluk' ? 'Günlük İş' : item.module === 'gorevler' ? 'Periyodik' : item.module === 'odemeplani' ? 'Ödeme' : item.module === 'cekler' ? 'Çek' : 'Bordro'}
                      </span>
                      <span className="text-slate-300 text-[10px]">•</span>
                      <span className="text-[11px] text-slate-500 font-medium">
                        {new Date(item.tarih).toLocaleDateString('tr-TR')} {item.saat ? `${item.saat}` : ''}
                      </span>
                    </div>
                  </div>
                </button>
              ))}
            </div>

            <div className="p-3 border-t border-slate-100 bg-white text-center">
              <span className="text-[11px] text-slate-400">İlgili modüllere giderek işlemleri tamamlayabilirsiniz.</span>
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
    <div className="flex min-h-screen items-center justify-center bg-[#EBF5FB] px-4">
      <div className="glass-panel p-8 rounded-3xl max-w-sm w-full animate-slide-down">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center mx-auto mb-6 shadow-xl shadow-blue-500/20">
          <Building2 size={24} className="text-white" />
        </div>
        <h2 className="text-xl font-bold text-white text-center mb-2 tracking-tight">Sisteme Hoş Geldiniz</h2>
        <p className="text-sm text-slate-400 text-center mb-8">Sisteme başlamak için şirket bilginizi girin.</p>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Firma Adı</label>
            <input className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-700 placeholder-slate-400 outline-none focus:border-blue-400 focus:bg-white transition-all font-medium" value={ad} onChange={e => setAd(e.target.value)} placeholder="Örn: ETM Muhasebe" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Kısa Ad</label>
            <input className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-700 placeholder-slate-400 outline-none focus:border-blue-400 focus:bg-white transition-all font-medium" value={kisaAd} onChange={e => setKisaAd(e.target.value)} placeholder="Örn: ETM" />
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
    <Suspense fallback={<div className="flex h-screen w-full bg-[#DCEEFA] animate-pulse" />}>
      <AppContent />
    </Suspense>
  )
}

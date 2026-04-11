'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { LogOut, X, Bell, Building2, Clock, Menu, LayoutDashboard } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { Firma, KullaniciProfil } from '@/types'
import dynamic from 'next/dynamic'
import { NAV, type ModuleId } from './nav-config'
import DashboardHome from '@/components/dashboard/DashboardPage'

const Ayarlar       = dynamic(() => import('@/modules/ayarlar'),       { ssr: false })
const OdemePlani    = dynamic(() => import('@/modules/odemeplan'),     { ssr: false })
const Payrolls      = dynamic(() => import('@/modules/payrolls'),      { ssr: false })
const Projeler      = dynamic(() => import('@/modules/projeler'),      { ssr: false })
const Vergiler      = dynamic(() => import('@/modules/vergiler'),      { ssr: false })
const SGK           = dynamic(() => import('@/modules/sgk'),           { ssr: false })

export type AppCtx = { 
  firma: Firma; 
  firmalar: Firma[]; 
  firmaIds: string[]; 
  profil: KullaniciProfil; 
  navigate: (id: ModuleId | null) => void 
}

function AppContent() {
  const router = useRouter()
  const [firma, setFirma] = useState<Firma | null>(null)
  const [profil, setProfil] = useState<KullaniciProfil | null>(null)
  const [module, setModule] = useState<ModuleId | null>(null)
  const [loading, setLoading] = useState(true)
  const [firmalarList, setFirmalarList] = useState<Firma[]>([])
  const [error, setError] = useState('')
  const searchParams = useSearchParams()
  const [notifCount, setNotifCount] = useState(0)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [authUserId, setAuthUserId] = useState<string>('')

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
      const { data: pData } = await supabase
        .from('kullanici_profilleri').select('*')
        .eq('auth_user_id', userId).maybeSingle()
      let p = pData as KullaniciProfil | null

      let f: Firma | undefined
      if (p && p.firma_id) {
        const { data: firmalar } = await supabase.from('firmalar').select('*').eq('id', p.firma_id).single()
        f = firmalar as Firma | undefined
      }
      
      if (!f) {
        const { data: firmalar, error: fErr } = await supabase.from('firmalar').select('*').eq('aktif', true).order('ad').limit(1)
        if (fErr) throw fErr
        f = firmalar?.[0] as Firma | undefined
        if (!f) { setLoading(false); setError('__no_firma__'); return }
      }

      setFirma(f)

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

  function navigate(id: ModuleId | null) {
    if (id) {
      router.push(`/?module=${id}`)
    } else {
      router.push(`/`)
    }
    setModule(id)
    setSidebarOpen(false)
  }

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
      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-40 w-64 border-r border-cyan-800/30 shadow-lg transform transition-transform duration-300 ease-in-out md:translate-x-0 md:static md:shrink-0 flex flex-col ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
        style={{ background: 'linear-gradient(180deg, #0E7490 0%, #0A6079 100%)' }}>

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

        <div className="flex-1 overflow-y-auto custom-scroll py-4 px-3 space-y-6">
          <div>
            <button
              onClick={() => navigate(null)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 ${!module ? 'bg-white/20 text-white border border-white/30 shadow-sm' : 'text-cyan-100/80 hover:bg-white/10 hover:text-white'}`}
            >
              <LayoutDashboard size={18} className={!module ? 'text-white' : 'text-cyan-200/70'} />
              <span className="text-sm font-medium">Ana Ekran</span>
            </button>
          </div>

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

      {sidebarOpen && (
        <div className="fixed inset-0 z-30 bg-slate-900/40 backdrop-blur-sm md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <main className="flex-1 flex flex-col min-w-0 relative h-full">
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
        </header>

        <div className="flex-1 overflow-y-auto custom-scroll relative p-4 lg:p-8 animate-fade-scale">
          {!module && <DashboardHome userId={authUserId} firma={firma!} firmaIds={firmaIds} onNavigate={navigate as any} />}
          {module === 'ayarlar'       && <Ayarlar       {...ctx} />}
          {module === 'odemeplani'    && <OdemePlani    {...ctx} />}
          {module === 'payrolls'      && <Payrolls      {...ctx} />}
          {module === 'projeler'      && <Projeler      {...ctx} />}
          {module === 'vergiler'      && <Vergiler      {...ctx} />}
          {module === 'sgk'           && <SGK           {...ctx} />}
        </div>
      </main>
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
            <input className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-700 placeholder:text-slate-400 outline-none focus:border-blue-400 focus:bg-white transition-all font-medium" value={ad} onChange={e => setAd(e.target.value)} placeholder="Örn: ETM Muhasebe" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Kısa Ad</label>
            <input className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-700 placeholder:text-slate-400 outline-none focus:border-blue-400 focus:bg-white transition-all font-medium" value={kisaAd} onChange={e => setKisaAd(e.target.value)} placeholder="Örn: ETM" />
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
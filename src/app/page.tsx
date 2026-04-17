'use client'
import React, { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Sidebar from '@/components/layout/Sidebar'
import type { Firma, ModuleId } from '@/types'
import { Spinner } from '@/components/ui'
import { Building2, Lock, Mail } from 'lucide-react'

// Modüller
import Dashboard   from '@/modules/dashboard'
import Gorevler    from '@/modules/gorevler'
import KasaModule  from '@/modules/kasa'
import OdemePlani  from '@/modules/odeme-plani'
import KarZarar    from '@/modules/kar-zarar'
import Projeler    from '@/modules/projeler'
import Ekipler     from '@/modules/ekipler'
import Personel    from '@/modules/personel'
import Bordro      from '@/modules/bordro'
import Arabulucu   from '@/modules/arabulucu'
import Icra        from '@/modules/icra'
import IsTakibi    from '@/modules/is-takibi'
import PoliceModule from '@/modules/police'
import Raporlar     from '@/modules/raporlar'
import Ayarlar      from '@/modules/ayarlar'
import CariModule   from '@/modules/cari'
import ArsivModule  from '@/modules/arsiv'

export interface AppCtx {
  firma: Firma
}

// ─── Login Formu ─────────────────────────────────────────────
function LoginPage({ onLogin }: { onLogin: () => void }) {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error: err } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (err) {
      setError('E-posta veya şifre hatalı.')
    } else {
      onLogin()
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <Building2 className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">ETM BİNYAPI</h1>
          <p className="text-slate-400 text-sm mt-1">Yönetim Paneli</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-8 shadow-2xl space-y-5">
          <h2 className="text-lg font-semibold text-gray-900 mb-1">Giriş Yap</h2>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">E-posta</label>
            <div className="relative">
              <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoFocus
                placeholder="ornek@etm.com"
                className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Şifre</label>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed text-sm"
          >
            {loading ? 'Giriş yapılıyor...' : 'Giriş Yap'}
          </button>
        </form>
      </div>
    </div>
  )
}

// ─── Ana Uygulama ─────────────────────────────────────────────
export default function App() {
  const [firmalar, setFirmalar]           = useState<Firma[]>([])
  const [activeFirmaId, setActiveFirmaId] = useState<string | null>(null)
  const [activeModule, setActiveModule]   = useState<ModuleId>('dashboard')
  const [loading, setLoading]             = useState(true)
  const [isLoggedIn, setIsLoggedIn]       = useState(false)

  async function loadApp() {
    setLoading(true)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setIsLoggedIn(false); setLoading(false); return }

    setIsLoggedIn(true)

    const { data: profil } = await supabase
      .from('kullanici_profilleri')
      .select('firma_id')
      .eq('auth_user_id', session.user.id)
      .single()

    const { data: list } = await supabase
      .from('firmalar')
      .select('*')
      .eq('aktif', true)
      .order('ad')

    const all = (list || []) as Firma[]
    setFirmalar(all)

    // Profilde firma varsa onu seç, yoksa ilk firmayı seç
    // setActiveFirmaId sadece ilk yüklemede (null iken) set edilir
    setActiveFirmaId(prev => {
      if (prev) return prev // Kullanıcı zaten bir firma seçmişse değiştirme
      return profil?.firma_id || all[0]?.id || null
    })
    setLoading(false)
  }

  useEffect(() => {
    loadApp()
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        setIsLoggedIn(false)
        setFirmalar([])
        setActiveFirmaId(null)
      }
      // TOKEN_REFRESHED, USER_UPDATED gibi olayları yoksay
      // Sadece gerçek ilk giriş (INITIAL_SESSION değil) için loadApp çağır
      // SIGNED_IN zaten ilk useEffect'teki loadApp() ile karşılanıyor
    })
    return () => subscription.unsubscribe()
  }, [])

  // Service Worker kayıt
  useEffect(() => {
    if (typeof window !== 'undefined') {
      import('@/lib/notifications').then(({ swKaydet }) => swKaydet())
    }
  }, [])

  if (loading) return (
    <div className="flex items-center justify-center h-screen bg-slate-900">
      <div className="text-center">
        <Spinner className="w-10 h-10 mx-auto mb-3 border-blue-500" />
        <p className="text-slate-400 text-sm">Yükleniyor...</p>
      </div>
    </div>
  )

  if (!isLoggedIn) return <LoginPage onLogin={loadApp} />

  // Profil veya firma bulunamadıysa uyarı göster
  if (!activeFirmaId || firmalar.length === 0) return (
    <div className="flex items-center justify-center h-screen bg-slate-50">
      <div className="text-center max-w-sm p-8 bg-white rounded-2xl shadow-sm border border-gray-200">
        <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <p className="font-semibold text-gray-800 mb-2">Firma bulunamadı</p>
        <p className="text-sm text-gray-500 mb-6">
          Hesabınıza bağlı aktif bir firma yok. Lütfen yönetici ile iletişime geçin.
        </p>
        <button
          onClick={() => supabase.auth.signOut()}
          className="text-sm text-blue-600 hover:underline"
        >
          Çıkış Yap
        </button>
      </div>
    </div>
  )

  const firma = firmalar.find(f => f.id === activeFirmaId)!

  const renderModule = () => {
    const ctx: AppCtx = { firma }
    switch (activeModule) {
      case 'dashboard':   return <Dashboard   {...ctx} onNavigate={setActiveModule} />
      case 'gorevler':    return <Gorevler    {...ctx} />
      case 'cari':        return <CariModule  {...ctx} />
      case 'kasa':        return <KasaModule  {...ctx} />
      case 'odeme-plani': return <OdemePlani  {...ctx} />
      case 'kar-zarar':   return <KarZarar    {...ctx} />
      case 'projeler':    return <Projeler    {...ctx} />
      case 'ekipler':     return <Ekipler     {...ctx} />
      case 'personel':    return <Personel    {...ctx} />
      case 'bordro':      return <Bordro      {...ctx} />
      case 'arabulucu':   return <Arabulucu   {...ctx} />
      case 'icra':        return <Icra        {...ctx} />
      case 'is-takibi':   return <IsTakibi    {...ctx} />
      case 'police':      return <PoliceModule {...ctx} />
      case 'arsiv':       return <ArsivModule  {...ctx} />
      case 'raporlar':    return <Raporlar    {...ctx} />
      case 'ayarlar':     return <Ayarlar     {...ctx} />
      default:            return <Dashboard   {...ctx} onNavigate={setActiveModule} />
    }
  }

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <Sidebar
        firmalar={firmalar}
        activeFirmaId={activeFirmaId}
        onFirmaChange={setActiveFirmaId}
        activeModule={activeModule}
        onModuleChange={setActiveModule}
      />
      <main className="flex-1 overflow-auto min-w-0">
        {/* Mobil üst boşluk (hamburger butonu için) */}
        <div className="md:hidden h-14" />
        <div className="p-3 md:p-6 max-w-7xl mx-auto main-content">
          {renderModule()}
        </div>
      </main>
    </div>
  )
}

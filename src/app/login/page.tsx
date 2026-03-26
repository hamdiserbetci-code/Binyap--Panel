'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ClipboardList } from 'lucide-react'
import { supabase } from '@/lib/supabase'

export default function Login() {
  const router = useRouter()
  const [mode, setMode]       = useState<'login' | 'reset'>('login')
  const [email, setEmail]     = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const [info, setInfo]       = useState('')

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError(''); setInfo('')
    setLoading(true)
    const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    setLoading(false)
    if (err) { setError(err.message); return }
    router.replace('/')
  }

  async function handleReset(e: React.FormEvent) {
    e.preventDefault()
    setError(''); setInfo('')
    setLoading(true)
    const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    setLoading(false)
    if (err) { setError(err.message); return }
    setInfo('Şifre sıfırlama bağlantısı e-posta adresinize gönderildi.')
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="bg-white w-full max-w-sm rounded-2xl border border-slate-200 shadow-sm p-8">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-blue-600 flex items-center justify-center mb-3">
            <ClipboardList size={22} className="text-white" />
          </div>
          <h1 className="text-lg font-bold text-slate-800">İş Takip Sistemi</h1>
          <p className="text-xs text-slate-400 mt-0.5">Muhasebe iş yönetim paneli</p>
        </div>

        {mode === 'login' ? (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1">E-posta</label>
              <input
                type="email" required autoFocus
                className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-50 transition-all"
                placeholder="ornek@sirket.com"
                value={email} onChange={e => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1">Parola</label>
              <input
                type="password" required
                className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-50 transition-all"
                placeholder="••••••••"
                value={password} onChange={e => setPassword(e.target.value)}
              />
            </div>
            {error && <p className="text-xs text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
            <button type="submit" disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 mt-1">
              {loading ? 'Giriş yapılıyor...' : 'Giriş Yap'}
            </button>
            <button type="button" onClick={() => { setMode('reset'); setError('') }}
              className="w-full text-center text-xs text-blue-600 hover:underline mt-2">
              Parolamı unuttum
            </button>
          </form>
        ) : (
          <form onSubmit={handleReset} className="space-y-4">
            <p className="text-sm text-slate-600">E-posta adresinizi girin, şifre sıfırlama bağlantısı göndereceğiz.</p>
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1">E-posta</label>
              <input
                type="email" required autoFocus
                className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-50 transition-all"
                placeholder="ornek@sirket.com"
                value={email} onChange={e => setEmail(e.target.value)}
              />
            </div>
            {error && <p className="text-xs text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
            {info && <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">{info}</p>}
            <button type="submit" disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50">
              {loading ? 'Gönderiliyor...' : 'Sıfırlama Bağlantısı Gönder'}
            </button>
            <button type="button" onClick={() => { setMode('login'); setError(''); setInfo('') }}
              className="w-full text-center text-xs text-slate-500 hover:text-slate-700">
              ← Giriş sayfasına dön
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

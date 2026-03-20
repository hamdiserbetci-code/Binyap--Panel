'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>('login')
  const [success, setSuccess] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError(''); setSuccess('')
    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setError('E-posta veya şifre hatalı.')
      else window.location.href = '/'
    } else if (mode === 'register') {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) setError(error.message)
      else setSuccess('Kayıt başarılı! E-postanızı doğrulayın.')
    } else {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      })
      if (error) setError(error.message)
      else setSuccess('Şifre sıfırlama bağlantısı e-posta adresinize gönderildi.')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-600 mb-4">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <path d="M4 8h24M4 16h24M4 24h16" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
            </svg>
          </div>
          <h1 className="text-2xl font-semibold text-white">ETM-BİNYAPI</h1>
          <p className="text-slate-400 text-sm mt-1">Yönetim Paneli</p>
        </div>

        <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6">
          {mode !== 'forgot' && (
            <div className="flex rounded-xl bg-slate-900 p-1 mb-5">
              <button onClick={() => setMode('login')} className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${mode === 'login' ? 'bg-slate-700 text-white' : 'text-slate-400'}`}>Giriş Yap</button>
              <button onClick={() => setMode('register')} className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${mode === 'register' ? 'bg-slate-700 text-white' : 'text-slate-400'}`}>Kayıt Ol</button>
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-medium text-slate-400 block mb-1">E-posta</label>
              <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-blue-500 transition-all placeholder:text-slate-600"
                placeholder="ornek@sirket.com" />
            </div>
            {mode !== 'forgot' && (
              <div>
                <label className="text-xs font-medium text-slate-400 block mb-1">Şifre</label>
                <input type="password" required value={password} onChange={e => setPassword(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-blue-500 transition-all"
                  placeholder="En az 6 karakter" minLength={6} />
              </div>
            )}
            {error && <p className="text-xs text-red-400 bg-red-900/30 px-3 py-2 rounded-lg">{error}</p>}
            {success && <p className="text-xs text-emerald-400 bg-emerald-900/30 px-3 py-2 rounded-lg">{success}</p>}

            {mode === 'login' && (
              <div className="text-right">
                <button
                  type="button"
                  onClick={() => { setMode('forgot'); setError(''); setSuccess('') }}
                  className="text-[12px] text-blue-400 hover:underline"
                >
                  Şifremi unuttum
                </button>
              </div>
            )}

            {mode === 'forgot' && (
              <div className="text-right">
                <button
                  type="button"
                  onClick={() => { setMode('login'); setError(''); setSuccess('') }}
                  className="text-[12px] text-slate-300 hover:underline"
                >
                  Girişe dön
                </button>
              </div>
            )}

            <button type="submit" disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium py-2.5 rounded-xl text-sm transition-all disabled:opacity-60 mt-2">
              {loading ? 'Yükleniyor...' : mode === 'login' ? 'Giriş Yap' : mode === 'register' ? 'Hesap Oluştur' : 'Bağlantıyı Gönder'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

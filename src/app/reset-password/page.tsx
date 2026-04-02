'use client'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [canUpdate, setCanUpdate] = useState(false)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const isValid = useMemo(() => password.length >= 6 && password === confirm, [password, confirm])

  useEffect(() => {
    let isMounted = true

    async function bootstrap() {
      try {
        const { data: userData } = await supabase.auth.getUser()
        if (!isMounted) return
        if (userData.user) setCanUpdate(true)
      } finally {
        if (!isMounted) return
        setLoading(false)
      }
    }

    bootstrap()

    const { data: authListener } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setCanUpdate(true)
        setLoading(false)
      }
    })

    return () => {
      isMounted = false
      authListener?.subscription?.unsubscribe?.()
    }
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (password.length < 6) {
      setError('Şifre en az 6 karakter olmalıdır.')
      return
    }
    if (password !== confirm) {
      setError('Şifreler eşleşmiyor.')
      return
    }

    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)

    if (error) {
      setError(error.message)
      return
    }

    setSuccess('Şifreniz güncellendi.')
    setTimeout(() => router.push('/'), 800)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-600 mb-4">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <path d="M4 8h24M4 16h24M4 24h16" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
          </div>
          <h1 className="text-2xl font-semibold text-white">Şifre Sıfırlama</h1>
          <p className="text-slate-400 text-sm mt-1">Yeni şifrenizi belirleyin</p>
        </div>

        <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6">
          {!canUpdate && loading && (
            <p className="text-sm text-slate-300">Bağlantı doğrulanıyor...</p>
          )}

          {canUpdate && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-slate-400 block mb-1">Yeni Şifre</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={6}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-blue-500 transition-all"
                  placeholder="En az 6 karakter"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-400 block mb-1">Şifre Tekrar</label>
                <input
                  type="password"
                  required
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  minLength={6}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-blue-500 transition-all"
                  placeholder="Tekrar girin"
                />
              </div>

              {error && <p className="text-xs text-red-400 bg-red-900/30 px-3 py-2 rounded-lg">{error}</p>}
              {success && <p className="text-xs text-emerald-400 bg-emerald-900/30 px-3 py-2 rounded-lg">{success}</p>}

              <button
                type="submit"
                disabled={loading || !isValid}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium py-2.5 rounded-xl text-sm transition-all disabled:opacity-60 mt-2"
              >
                {loading ? 'Güncelleniyor...' : 'Şifreyi Güncelle'}
              </button>
            </form>
          )}

          {!canUpdate && !loading && (
            <div className="text-sm text-slate-300 space-y-3">
              <p>Bu sayfa sadece şifre kurtarma bağlantısı ile açıldığında kullanılabilir.</p>
              <button
                type="button"
                onClick={() => router.push('/login')}
                className="w-full bg-slate-700 hover:bg-slate-600 text-white font-medium py-2.5 rounded-xl text-sm transition-all"
              >
                Giriş Sayfasına Dön
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}


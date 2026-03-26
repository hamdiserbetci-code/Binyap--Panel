'use client'

import { useEffect, useState } from 'react'
import { ClipboardList, CheckCircle2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'

export default function ResetPassword() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm]   = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const [done, setDone]         = useState(false)

  useEffect(() => {
    // Supabase redirects with #access_token in the URL; the client handles it automatically
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (password !== confirm) { setError('Parolalar eşleşmiyor'); return }
    if (password.length < 6) { setError('Parola en az 6 karakter olmalı'); return }
    setLoading(true)
    const { error: err } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (err) { setError(err.message); return }
    setDone(true)
    setTimeout(() => { window.location.href = '/' }, 2500)
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="bg-white w-full max-w-sm rounded-2xl border border-slate-200 shadow-sm p-8">
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-blue-600 flex items-center justify-center mb-3">
            <ClipboardList size={22} className="text-white" />
          </div>
          <h1 className="text-lg font-bold text-slate-800">Yeni Parola</h1>
        </div>

        {done ? (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <CheckCircle2 size={36} className="text-emerald-500" />
            <p className="text-sm font-semibold text-slate-700">Parolanız güncellendi!</p>
            <p className="text-xs text-slate-400">Yönlendiriliyorsunuz...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1">Yeni Parola</label>
              <input
                type="password" required autoFocus
                className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-50 transition-all"
                placeholder="En az 6 karakter"
                value={password} onChange={e => setPassword(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1">Parola Tekrar</label>
              <input
                type="password" required
                className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-50 transition-all"
                placeholder="••••••••"
                value={confirm} onChange={e => setConfirm(e.target.value)}
              />
            </div>
            {error && <p className="text-xs text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
            <button type="submit" disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50">
              {loading ? 'Kaydediliyor...' : 'Parolayı Güncelle'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

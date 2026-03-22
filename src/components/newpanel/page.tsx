'use client'

import { useState } from 'react'
import { Building2, KeyRound, Mail, ArrowRight, UserPlus, ShieldAlert } from 'lucide-react'

type ViewState = 'login' | 'register' | 'forgot_password'

export default function LoginPage() {
  const [view, setViewState] = useState<ViewState>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    // Supabase auth işlemleri buraya eklenecek
    setTimeout(() => setLoading(false), 1500)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-200 relative overflow-hidden">
      {/* Arka Plan Mimari Dekorları */}
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:32px_40px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)]"></div>
        <div className="absolute -top-[20%] -right-[10%] w-[50%] h-[50%] rounded-full bg-blue-600/20 blur-[120px]"></div>
        <div className="absolute -bottom-[20%] -left-[10%] w-[50%] h-[50%] rounded-full bg-cyan-600/10 blur-[120px]"></div>
      </div>

      <div className="relative z-10 w-full max-w-md px-6">
        <div className="text-center mb-10">
          <div className="mx-auto w-16 h-16 bg-gradient-to-br from-blue-500 to-cyan-400 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/20 mb-6">
            <Building2 size={32} className="text-white" strokeWidth={2} />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">İnşaat ERP Paneli</h1>
          <p className="mt-3 text-sm text-slate-400">Projeler, Finans, Satınalma ve İK Yönetimi</p>
        </div>

        <div className="bg-white/[0.03] border border-white/[0.08] p-8 rounded-[32px] shadow-2xl backdrop-blur-2xl ring-1 ring-white/10">
          <form onSubmit={handleSubmit} className="space-y-5">
            
            {view === 'register' && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider pl-1">Ad Soyad</label>
                <div className="relative">
                  <UserPlus className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                  <input type="text" required placeholder="Adınız Soyadınız" className="w-full bg-slate-900/50 border border-white/10 rounded-2xl py-3 pl-11 pr-4 text-sm text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-slate-600" />
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider pl-1">E-Posta Adresi</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ornek@firma.com" className="w-full bg-slate-900/50 border border-white/10 rounded-2xl py-3 pl-11 pr-4 text-sm text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-slate-600" />
              </div>
            </div>

            {view !== 'forgot_password' && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between pl-1 pr-2">
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Şifre</label>
                  {view === 'login' && (
                    <button type="button" onClick={() => setViewState('forgot_password')} className="text-xs font-medium text-blue-400 hover:text-blue-300">Şifremi Unuttum</button>
                  )}
                </div>
                <div className="relative">
                  <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                  <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="w-full bg-slate-900/50 border border-white/10 rounded-2xl py-3 pl-11 pr-4 text-sm text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-slate-600" />
                </div>
              </div>
            )}

            <button disabled={loading} type="submit" className="w-full relative group overflow-hidden rounded-2xl bg-blue-600 px-4 py-3.5 text-sm font-semibold text-white transition-all hover:bg-blue-500 disabled:opacity-70 mt-4">
              <div className="relative z-10 flex items-center justify-center gap-2">
                {loading ? 'İşleniyor...' : view === 'login' ? 'Sisteme Giriş Yap' : view === 'register' ? 'Kullanıcı Talebi Gönder' : 'Şifre Sıfırlama Bağlantısı Gönder'}
                {!loading && <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />}
              </div>
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-white/5 text-center flex flex-col gap-3">
            {view === 'login' ? (
              <p className="text-sm text-slate-400">
                Sistemde hesabınız yok mu?{' '}
                <button type="button" onClick={() => setViewState('register')} className="font-semibold text-white hover:text-blue-400 transition-colors">Hesap Talep Et</button>
              </p>
            ) : (
              <p className="text-sm text-slate-400">
                Zaten bir hesabınız var mı?{' '}
                <button type="button" onClick={() => setViewState('login')} className="font-semibold text-white hover:text-blue-400 transition-colors">Giriş Yap</button>
              </p>
            )}
          </div>
        </div>
        
        {view === 'register' && (
          <div className="mt-6 flex items-start gap-3 bg-amber-500/10 border border-amber-500/20 p-4 rounded-2xl text-amber-200/80 text-xs leading-relaxed">
            <ShieldAlert size={16} className="text-amber-400 shrink-0 mt-0.5" />
            <p>Hesap talebiniz sistem yöneticisine iletilecektir. Onaylandıktan sonra ve rol ataması yapıldığında panele erişebilirsiniz.</p>
          </div>
        )}
      </div>
    </div>
  )
}
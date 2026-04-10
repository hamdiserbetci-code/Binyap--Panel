'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useFirma } from '@/context/FirmaContext'
import { supabase } from '@/lib/supabase'
import { Firma } from '@/types'
import { Building2, Plus, LogOut, ChevronRight, X, Loader2 } from 'lucide-react'

export default function FirmaSecimPage() {
  const { firmalar, setFirma, loading, refresh } = useFirma()
  const router = useRouter()
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({ ad: '', vergi_no: '', adres: '', telefon: '' })
  const [saving, setSaving] = useState(false)
  const [userId, setUserId] = useState<string>('')
  const [error, setError] = useState('')
  const [userEmail, setUserEmail] = useState('')

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setUserId(data.user.id)
        setUserEmail(data.user.email ?? '')
      }
    })
  }, [])

  async function handleCreate() {
    if (!form.ad.trim()) return
    setSaving(true)
    setError('')
    const { data, error: insertErr } = await supabase.from('firmalar').insert({
      ad: form.ad, vergi_no: form.vergi_no, adres: form.adres,
      telefon: form.telefon
    }).select().single()
    if (insertErr || !data) {
      setError(insertErr?.message || 'Firma oluşturulamadı.')
      setSaving(false)
      return
    }
    void supabase.from('firma_kullanicilari').insert({
      firma_id: data.id, user_id: userId, rol: 'admin'
    })
    await refresh()
    setModal(false)
    setForm({ ad: '', vergi_no: '', adres: '', telefon: '' })
    handleSelect(data)
    setSaving(false)
  }

  function handleSelect(f: Firma) {
    setFirma(f)
    router.push(`/panel/${f.id}`)
  }

  async function signOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const initials = (name: string) =>
    name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()

  const COLORS = [
    'from-blue-600 to-blue-700',
    'from-violet-600 to-violet-700',
    'from-emerald-600 to-emerald-700',
    'from-amber-600 to-amber-700',
    'from-rose-600 to-rose-700',
    'from-cyan-600 to-cyan-700',
  ]

  return (
    <div className="min-h-screen bg-[#EBF5FB] flex flex-col">
      {/* Header */}
      <header className="border-b border-blue-100 px-6 py-4 flex items-center justify-between backdrop-blur-sm bg-white/95 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-700 rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/20">
            <Building2 size={15} className="text-slate-800" />
          </div>
          <span className="font-bold text-slate-800 text-base tracking-tight">ETM Panel</span>
        </div>
        <div className="flex items-center gap-4">
          {userEmail && (
            <span className="text-xs text-slate-500 hidden sm:block">{userEmail}</span>
          )}
          <button
            onClick={signOut}
            className="flex items-center gap-2 text-xs text-slate-400 hover:text-slate-700 border border-blue-100 hover:border-blue-200 rounded-lg px-3 py-1.5 transition-all"
          >
            <LogOut size={13} /> Çıkış
          </button>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 flex items-center justify-center px-4 py-16">
        <div className="w-full max-w-lg">
          {/* Hero */}
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500/20 to-blue-700/10 border border-blue-500/20 mb-5 shadow-xl shadow-blue-500/5">
              <Building2 size={28} className="text-blue-400" />
            </div>
            <h1 className="text-2xl font-bold text-slate-800 mb-2 tracking-tight">Firma Seçin</h1>
            <p className="text-sm text-slate-500">Yönetmek istediğiniz firmayı seçin veya yeni firma ekleyin.</p>
          </div>

          {loading ? (
            <div className="flex items-center justify-center gap-3 py-16 text-slate-500">
              <Loader2 size={18} className="animate-spin" />
              <span className="text-sm">Yükleniyor...</span>
            </div>
          ) : (
            <div className="space-y-2">
              {firmalar.map((f, i) => (
                <button
                  key={f.id}
                  onClick={() => handleSelect(f)}
                  className="w-full group relative bg-white hover:bg-slate-50 border border-blue-100 hover:border-blue-300 rounded-2xl p-4 flex items-center gap-4 transition-all duration-200 text-left hover:shadow-lg hover:shadow-blue-500/5"
                >
                  {/* Gradient orb */}
                  <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${COLORS[i % COLORS.length]} flex items-center justify-center flex-shrink-0 shadow-lg text-slate-800 text-sm font-bold`}>
                    {initials(f.ad)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-800 text-sm leading-tight">{f.ad}</p>
                    {f.vergi_no && (
                      <p className="text-[11px] text-slate-500 mt-0.5">VKN: {f.vergi_no}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] font-medium text-blue-400 bg-blue-500/10 border border-blue-500/20 rounded-full px-2.5 py-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      Giriş yap
                    </span>
                    <ChevronRight size={15} className="text-slate-600 group-hover:text-blue-400 transition-colors" />
                  </div>
                </button>
              ))}

              {/* Yeni firma */}
              <button
                onClick={() => setModal(true)}
                className="w-full mt-3 border border-dashed border-blue-100 hover:border-blue-500/40 rounded-2xl p-4 flex items-center justify-center gap-2.5 text-slate-500 hover:text-blue-400 hover:bg-blue-50 transition-all duration-200"
              >
                <div className="w-6 h-6 rounded-lg border border-current flex items-center justify-center">
                  <Plus size={13} />
                </div>
                <span className="text-sm font-medium">Yeni Firma Ekle</span>
              </button>
            </div>
          )}

          {/* Footer */}
          <p className="text-center text-[11px] text-slate-700 mt-10">
            ETM Panel &copy; {new Date().getFullYear()} — Tüm hakları saklıdır.
          </p>
        </div>
      </main>

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-blue-100 rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-base font-bold text-slate-800">Yeni Firma</h2>
                <p className="text-xs text-slate-500 mt-0.5">Firma bilgilerini girin</p>
              </div>
              <button
                onClick={() => setModal(false)}
                className="w-8 h-8 flex items-center justify-center rounded-xl border border-blue-100 text-slate-400 hover:text-slate-700 hover:border-blue-200 transition-all"
              >
                <X size={14} />
              </button>
            </div>

            <div className="space-y-3">
              {[
                { key: 'ad',       label: 'Firma Adı',  placeholder: 'ETM İnşaat Ltd. Şti.', required: true },
                { key: 'vergi_no', label: 'Vergi No',   placeholder: '1234567890' },
                { key: 'adres',    label: 'Adres',      placeholder: 'İstanbul' },
                { key: 'telefon',  label: 'Telefon',    placeholder: '0212 000 00 00' },
              ].map(field => (
                <div key={field.key}>
                  <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide block mb-1.5">
                    {field.label}{field.required && <span className="text-blue-400 ml-0.5">*</span>}
                  </label>
                  <input
                    className="w-full bg-slate-50 border border-blue-100 focus:border-blue-400 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 placeholder-slate-400 outline-none transition-colors"
                    placeholder={field.placeholder}
                    value={(form as any)[field.key]}
                    onChange={e => setForm(prev => ({ ...prev, [field.key]: e.target.value }))}
                  />
                </div>
              ))}
            </div>

            {error && (
              <p className="mt-4 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2.5">
                {error}
              </p>
            )}

            <div className="flex gap-2.5 mt-5">
              <button
                onClick={() => setModal(false)}
                className="flex-1 border border-blue-100 hover:border-blue-200 rounded-xl py-2.5 text-sm font-medium text-slate-400 hover:text-slate-700 transition-all"
              >
                İptal
              </button>
              <button
                onClick={handleCreate}
                disabled={saving || !form.ad.trim()}
                className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-slate-800 rounded-xl py-2.5 text-sm font-semibold transition-all flex items-center justify-center gap-2"
              >
                {saving ? <><Loader2 size={14} className="animate-spin" /> Kaydediliyor...</> : 'Firma Oluştur'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

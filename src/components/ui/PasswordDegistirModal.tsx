'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'

const inputCls = "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:border-blue-500 focus:ring-blue-500 outline-none bg-white text-slate-800 placeholder:text-slate-400"
const btnPrimary = "bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-xl text-sm font-medium disabled:opacity-50"
const btnSecondary = "bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-2 rounded-xl text-sm font-medium"

const FormField = ({ label, children, required }: { label: string, children: React.ReactNode, required?: boolean }) => (
  <div>
    <label className="block text-xs font-medium text-slate-600 mb-1.5">
      {label} {required && <span className="text-red-500">*</span>}
    </label>
    {children}
  </div>
)

const Modal = ({ title, onClose, children, footer }: { title: string, onClose: () => void, children: React.ReactNode, footer: React.ReactNode }) => (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <h3 className="font-bold text-slate-800 text-lg p-5 border-b border-slate-100">{title}</h3>
        <div className="p-5">{children}</div>
        <div className="flex justify-end gap-3 p-4 border-t border-slate-100 bg-slate-50 rounded-b-2xl">
          {footer}
        </div>
      </div>
    </div>
)
export default function PasswordDegistirModal({ onClose }: { onClose: () => void }) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  async function handleUpdate() {
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
    setTimeout(() => onClose(), 600)
  }

  return (
    <Modal
      title="Şifre Değiştir"
      onClose={onClose}
      footer={
        <>
          <button className={btnSecondary} onClick={onClose} disabled={loading}>İptal</button>
          <button className={btnPrimary} onClick={handleUpdate} disabled={loading || !password || !confirm}>
            {loading ? 'Güncelleniyor...' : 'Kaydet'}
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <FormField label="Yeni Şifre" required>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={6}
            className={inputCls}
            placeholder="En az 6 karakter"
          />
        </FormField>
        <FormField label="Şifre Tekrar" required>
          <input
            type="password"
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            minLength={6}
            className={inputCls}
            placeholder="Tekrar girin"
          />
        </FormField>

        {error && <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
        {success && <p className="text-xs text-emerald-600 bg-emerald-50 px-3 py-2 rounded-lg">{success}</p>}
      </div>
    </Modal>
  )
}

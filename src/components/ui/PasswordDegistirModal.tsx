'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import Modal, { FormField, inputCls, btnPrimary, btnSecondary } from '@/components/ui/Modal'

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


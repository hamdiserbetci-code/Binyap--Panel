'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Firma } from '@/types'
import { FormField, inputCls, btnPrimary } from '@/components/ui/Modal'
import { Save, Building2, Users } from 'lucide-react'

interface Props { firma: Firma; userId: string }

export default function AyarlarPage({ firma, userId }: Props) {
  const [firmaForm, setFirmaForm] = useState({ ad: firma.ad, vergi_no: firma.vergi_no || '', adres: (firma as any).adres || '', telefon: (firma as any).telefon || '' })
  const [kullanicilar, setKullanicilar] = useState<any[]>([])
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    supabase.from('firma_kullanicilari').select('*, user_id').eq('firma_id', firma.id).then(({ data }) => {
      setKullanicilar(data || [])
    })
  }, [firma.id])

  async function saveFirma() {
    setSaving(true)
    await supabase.from('firmalar').update(firmaForm).eq('id', firma.id)
    setSaving(false)
    setMsg('Firma bilgileri güncellendi.')
    setTimeout(() => setMsg(''), 3000)
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-lg font-bold text-slate-800">Ayarlar</h2>
        <p className="text-xs text-slate-400 mt-0.5">Firma bilgileri ve kullanıcı yönetimi</p>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Building2 size={16} className="text-blue-600"/>
          <h3 className="font-semibold text-slate-700 text-sm">Firma Bilgileri</h3>
        </div>
        <div className="space-y-3">
          <FormField label="Firma Adı" required>
            <input className={inputCls} value={firmaForm.ad} onChange={e => setFirmaForm(f => ({...f, ad: e.target.value}))}/>
          </FormField>
          <FormField label="Vergi No">
            <input className={inputCls} value={firmaForm.vergi_no} onChange={e => setFirmaForm(f => ({...f, vergi_no: e.target.value}))}/>
          </FormField>
          <FormField label="Adres">
            <input className={inputCls} value={firmaForm.adres} onChange={e => setFirmaForm(f => ({...f, adres: e.target.value}))}/>
          </FormField>
          <FormField label="Telefon">
            <input className={inputCls} value={firmaForm.telefon} onChange={e => setFirmaForm(f => ({...f, telefon: e.target.value}))}/>
          </FormField>
          {msg && <p className="text-xs text-emerald-600 font-medium">{msg}</p>}
          <button onClick={saveFirma} disabled={saving} className={btnPrimary + ' flex items-center gap-2'}>
            <Save size={13}/> {saving ? 'Kaydediliyor...' : 'Kaydet'}
          </button>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Users size={16} className="text-blue-600"/>
          <h3 className="font-semibold text-slate-700 text-sm">Kullanıcılar ({kullanicilar.length})</h3>
        </div>
        <div className="space-y-2 text-sm text-slate-500">
          {kullanicilar.map(k => (
            <div key={k.id} className="flex items-center justify-between py-2 border-b border-slate-50">
              <span className="text-slate-700 text-xs font-mono">{k.user_id}</span>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">{k.rol}</span>
            </div>
          ))}
          {kullanicilar.length === 0 && <p className="text-xs text-slate-300">Kullanıcı bulunamadı</p>}
        </div>
      </div>
    </div>
  )
}

'use client'
import React, { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Modal, Btn, Field, inputCls } from './index'
import { CheckSquare } from 'lucide-react'

interface Props {
  firmaId: string
  onClose: () => void
  // Otomatik doldurulacak alanlar
  baslik?: string
  aciklama?: string
  kategori?: string
}

const ONCELIKLER = [
  { v: 'dusuk',  l: 'Düşük'  },
  { v: 'normal', l: 'Normal' },
  { v: 'yuksek', l: 'Yüksek' },
  { v: 'kritik', l: 'Kritik' },
]

const KATEGORILER = [
  { v: 'genel',  l: 'Genel'  },
  { v: 'finans', l: 'Finans' },
  { v: 'ik',     l: 'İK'     },
  { v: 'hukuk',  l: 'Hukuk'  },
  { v: 'vergi',  l: 'Vergi'  },
  { v: 'proje',  l: 'Proje'  },
  { v: 'diger',  l: 'Diğer'  },
]

export default function GorevEklePrompt({ firmaId, onClose, baslik = '', aciklama = '', kategori = 'genel' }: Props) {
  const [form, setForm] = useState({
    baslik,
    aciklama,
    oncelik: 'normal',
    kategori,
    atanan_kisi: '',
    son_tarih: '',
    hatirlatma_tarihi: '',
    hatirlatma_saati: '09:00',
  })
  const [saving, setSaving] = useState(false)

  async function kaydet() {
    if (!form.baslik) return alert('Başlık zorunludur')
    setSaving(true)
    await supabase.from('gorevler').insert({
      firma_id:          firmaId,
      baslik:            form.baslik,
      aciklama:          form.aciklama || null,
      oncelik:           form.oncelik,
      kategori:          form.kategori,
      durum:             'bekliyor',
      atanan_kisi:       form.atanan_kisi || null,
      son_tarih:         form.son_tarih || null,
      hatirlatma_tarihi: form.hatirlatma_tarihi
        ? `${form.hatirlatma_tarihi}T${form.hatirlatma_saati}:00`
        : null,
    })
    setSaving(false)
    onClose()
  }

  return (
    <Modal
      title="Görev Takibine Ekle"
      onClose={onClose}
      size="md"
      footer={
        <>
          <Btn variant="secondary" onClick={onClose}>Atla</Btn>
          <Btn onClick={kaydet} disabled={saving}>
            {saving ? 'Ekleniyor...' : 'Göreve Ekle'}
          </Btn>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex items-center gap-2 p-3 bg-indigo-50 rounded-lg border border-indigo-100">
          <CheckSquare className="w-4 h-4 text-indigo-600 flex-shrink-0" />
          <p className="text-sm text-indigo-700">Bu işlemi görev takibine eklemek ister misiniz?</p>
        </div>

        <Field label="Başlık" required>
          <input type="text" value={form.baslik}
            onChange={e => setForm(p => ({ ...p, baslik: e.target.value }))}
            className={inputCls} />
        </Field>

        <Field label="Açıklama">
          <textarea rows={2} value={form.aciklama}
            onChange={e => setForm(p => ({ ...p, aciklama: e.target.value }))}
            className={inputCls} />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Öncelik">
            <select value={form.oncelik}
              onChange={e => setForm(p => ({ ...p, oncelik: e.target.value }))}
              className={inputCls}>
              {ONCELIKLER.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
            </select>
          </Field>
          <Field label="Kategori">
            <select value={form.kategori}
              onChange={e => setForm(p => ({ ...p, kategori: e.target.value }))}
              className={inputCls}>
              {KATEGORILER.map(k => <option key={k.v} value={k.v}>{k.l}</option>)}
            </select>
          </Field>
        </div>

        <Field label="Atanan Kişi">
          <input type="text" value={form.atanan_kisi}
            onChange={e => setForm(p => ({ ...p, atanan_kisi: e.target.value }))}
            className={inputCls} placeholder="İsim..." />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Son Tarih">
            <input type="date" value={form.son_tarih}
              onChange={e => setForm(p => ({ ...p, son_tarih: e.target.value }))}
              className={inputCls} />
          </Field>
          <Field label="Hatırlatma Tarihi">
            <input type="date" value={form.hatirlatma_tarihi}
              onChange={e => setForm(p => ({ ...p, hatirlatma_tarihi: e.target.value }))}
              className={inputCls} />
          </Field>
        </div>

        {form.hatirlatma_tarihi && (
          <Field label="Hatırlatma Saati">
            <input type="time" value={form.hatirlatma_saati}
              onChange={e => setForm(p => ({ ...p, hatirlatma_saati: e.target.value }))}
              className={inputCls} />
          </Field>
        )}
      </div>
    </Modal>
  )
}

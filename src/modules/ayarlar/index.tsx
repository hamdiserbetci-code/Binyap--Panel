'use client'
import React, { useEffect, useState } from 'react'
import {
  Settings, Save, Building2, Users, Plus, Edit,
  Trash2, Shield, Mail, CheckCircle, AlertTriangle,
  RefreshCw, UserPlus, Key
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { PageHeader, Card, Btn, Field, inputCls, Modal, ConfirmDialog, Badge } from '@/components/ui'
import type { AppCtx } from '@/app/page'
import type { Firma } from '@/types'

type Tab = 'firma' | 'kullanici' | 'sistem'

const ROLLER = [
  { v: 'admin',     l: 'Admin',     aciklama: 'Tüm yetkilere sahip',          renk: 'red'    as const },
  { v: 'muhasebe',  l: 'Muhasebe',  aciklama: 'Finans modüllerine erişim',    renk: 'blue'   as const },
  { v: 'ik',        l: 'İK',        aciklama: 'Personel ve bordro erişimi',   renk: 'green'  as const },
  { v: 'izleyici',  l: 'İzleyici',  aciklama: 'Sadece görüntüleme yetkisi',   renk: 'gray'   as const },
]

// ─── Ana Modül ────────────────────────────────────────────────
export default function AyarlarModule({ firma }: AppCtx) {
  const [tab, setTab] = useState<Tab>('firma')

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: 'firma',     label: 'Firma Yönetimi',    icon: Building2 },
    { id: 'kullanici', label: 'Kullanıcı Yönetimi', icon: Users     },
    { id: 'sistem',    label: 'Sistem',             icon: Settings  },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<Settings className="w-5 h-5 text-gray-600" />}
        title="Ayarlar"
        subtitle="Firma, kullanıcı ve sistem yönetimi"
        iconBg="bg-gray-50"
      />

      {/* Sekmeler */}
      <Card>
        <div className="flex border-b border-gray-200 overflow-x-auto">
          {tabs.map(t => {
            const Icon = t.icon
            return (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`flex items-center gap-2 px-4 sm:px-6 py-3.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${tab === t.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                <Icon className="w-4 h-4" />
                {t.label}
              </button>
            )
          })}
        </div>
        <div className="p-4 sm:p-6">
          {tab === 'firma'     && <FirmaYonetimi activeFirma={firma} />}
          {tab === 'kullanici' && <KullaniciYonetimi firma={firma} />}
          {tab === 'sistem'    && <SistemBilgisi firma={firma} />}
        </div>
      </Card>
    </div>
  )
}

// ─── Firma Yönetimi ───────────────────────────────────────────
function FirmaYonetimi({ activeFirma }: { activeFirma: Firma }) {
  const [firmalar, setFirmalar] = useState<Firma[]>([])
  const [loading, setLoading]   = useState(true)
  const [modal, setModal]       = useState(false)
  const [editing, setEditing]   = useState<Firma | null>(null)
  const [delId, setDelId]       = useState<string | null>(null)
  const [saving, setSaving]     = useState(false)
  const [form, setForm]         = useState({ ad: '', kisa_ad: '', vergi_no: '', aktif: true })
  const [msg, setMsg]           = useState('')

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('firmalar').select('*').order('ad')
    setFirmalar(data || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  function openNew() {
    setForm({ ad: '', kisa_ad: '', vergi_no: '', aktif: true })
    setEditing(null); setModal(true)
  }
  function openEdit(f: Firma) {
    setForm({ ad: f.ad, kisa_ad: f.kisa_ad || '', vergi_no: f.vergi_no || '', aktif: f.aktif })
    setEditing(f); setModal(true)
  }

  async function save() {
    if (!form.ad) return alert('Firma adı zorunludur')
    setSaving(true)
    const payload = { ad: form.ad, kisa_ad: form.kisa_ad || null, vergi_no: form.vergi_no || null, aktif: form.aktif }
    if (editing) {
      await supabase.from('firmalar').update(payload).eq('id', editing.id)
    } else {
      await supabase.from('firmalar').insert(payload)
    }
    setSaving(false); setModal(false); load()
    setMsg(editing ? 'Firma güncellendi.' : 'Firma eklendi.')
    setTimeout(() => setMsg(''), 3000)
  }

  async function deleteFirma(id: string) {
    if (id === activeFirma.id) return alert('Aktif firmayı silemezsiniz.')
    await supabase.from('firmalar').delete().eq('id', id)
    setDelId(null); load()
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-gray-900">Firmalar</h2>
        <Btn size="sm" icon={<Plus className="w-4 h-4" />} onClick={openNew}>Yeni Firma</Btn>
      </div>

      {msg && (
        <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
          <CheckCircle className="w-4 h-4" />{msg}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-8"><div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <div className="space-y-2">
          {firmalar.map(f => (
            <div key={f.id} className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all ${f.id === activeFirma.id ? 'border-blue-200 bg-blue-50/30' : 'border-gray-200 bg-white hover:border-gray-300'}`}>
              <div className="w-10 h-10 bg-slate-800 rounded-xl flex items-center justify-center flex-shrink-0">
                <span className="text-white font-bold text-sm">{(f.kisa_ad || f.ad)[0]}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-gray-900 text-sm">{f.ad}</span>
                  {f.kisa_ad && <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">{f.kisa_ad}</span>}
                  {f.id === activeFirma.id && <Badge label="Aktif Firma" variant="blue" />}
                  {!f.aktif && <Badge label="Pasif" variant="gray" />}
                </div>
                {f.vergi_no && <p className="text-xs text-gray-400 mt-0.5">VN: {f.vergi_no}</p>}
              </div>
              <div className="flex gap-1 flex-shrink-0">
                <button onClick={() => openEdit(f)} className="p-1.5 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-blue-50">
                  <Edit className="w-4 h-4" />
                </button>
                {f.id !== activeFirma.id && (
                  <button onClick={() => setDelId(f.id)} className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {modal && (
        <Modal title={editing ? 'Firma Düzenle' : 'Yeni Firma'} onClose={() => setModal(false)} size="sm"
          footer={<><Btn variant="secondary" onClick={() => setModal(false)}>İptal</Btn><Btn onClick={save} disabled={saving}>{saving ? 'Kaydediliyor...' : 'Kaydet'}</Btn></>}>
          <div className="space-y-4">
            <Field label="Firma Adı" required>
              <input type="text" value={form.ad} onChange={e => setForm(p => ({ ...p, ad: e.target.value }))} className={inputCls} placeholder="ETM Tünel Kalıp A.Ş." />
            </Field>
            <Field label="Kısa Ad">
              <input type="text" value={form.kisa_ad} onChange={e => setForm(p => ({ ...p, kisa_ad: e.target.value }))} className={inputCls} placeholder="ETM-TK" />
            </Field>
            <Field label="Vergi No">
              <input type="text" value={form.vergi_no} onChange={e => setForm(p => ({ ...p, vergi_no: e.target.value }))} className={inputCls} />
            </Field>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="aktif-firma" checked={form.aktif}
                onChange={e => setForm(p => ({ ...p, aktif: e.target.checked }))} className="w-4 h-4 text-blue-600 rounded" />
              <label htmlFor="aktif-firma" className="text-sm font-medium text-gray-700">Aktif Firma</label>
            </div>
          </div>
        </Modal>
      )}

      {delId && (
        <ConfirmDialog message="Bu firmayı silmek istediğinize emin misiniz? Tüm veriler silinecektir."
          onConfirm={() => deleteFirma(delId)} onCancel={() => setDelId(null)} />
      )}
    </div>
  )
}

// ─── Kullanıcı Yönetimi ───────────────────────────────────────
function KullaniciYonetimi({ firma }: { firma: Firma }) {
  const [kullanicilar, setKullanicilar] = useState<any[]>([])
  const [loading, setLoading]           = useState(true)
  const [modal, setModal]               = useState<'davet' | 'rol' | null>(null)
  const [secili, setSecili]             = useState<any | null>(null)
  const [saving, setSaving]             = useState(false)
  const [msg, setMsg]                   = useState('')
  const [davetForm, setDavetForm]       = useState({ email: '', ad_soyad: '', rol: 'izleyici', sifre: '' })
  const [rolForm, setRolForm]           = useState({ rol: 'izleyici', aktif: true })

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('kullanici_profilleri')
      .select('*')
      .eq('firma_id', firma.id)
      .order('ad_soyad')
    setKullanicilar(data || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [firma.id])

  async function davetEt() {
    if (!davetForm.email || !davetForm.sifre) return alert('E-posta ve şifre zorunludur')
    setSaving(true)
    try {
      // Supabase Admin API ile kullanıcı oluştur
      const { data: authData, error: authErr } = await supabase.auth.signUp({
        email: davetForm.email,
        password: davetForm.sifre,
        options: { data: { ad_soyad: davetForm.ad_soyad } }
      })
      if (authErr) throw authErr
      if (authData.user) {
        await supabase.from('kullanici_profilleri').insert({
          auth_user_id: authData.user.id,
          firma_id:     firma.id,
          ad_soyad:     davetForm.ad_soyad || null,
          email:        davetForm.email,
          rol:          davetForm.rol,
          aktif:        true,
        })
      }
      setMsg(`${davetForm.email} kullanıcısı eklendi.`)
      setTimeout(() => setMsg(''), 4000)
      setModal(null)
      setDavetForm({ email: '', ad_soyad: '', rol: 'izleyici', sifre: '' })
      load()
    } catch (err: any) {
      alert('Hata: ' + (err.message || err))
    } finally {
      setSaving(false)
    }
  }

  async function rolGuncelle() {
    if (!secili) return
    setSaving(true)
    await supabase.from('kullanici_profilleri').update({
      rol: rolForm.rol, aktif: rolForm.aktif
    }).eq('id', secili.id)
    setSaving(false); setModal(null); load()
    setMsg('Kullanıcı güncellendi.')
    setTimeout(() => setMsg(''), 3000)
  }

  async function kullaniciSil(id: string) {
    await supabase.from('kullanici_profilleri').delete().eq('id', id)
    load()
  }

  const rolRenk: Record<string, 'red'|'blue'|'green'|'gray'> = {
    admin: 'red', muhasebe: 'blue', ik: 'green', izleyici: 'gray'
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-gray-900">Kullanıcılar — {firma.ad}</h2>
        <Btn size="sm" icon={<UserPlus className="w-4 h-4" />} onClick={() => setModal('davet')}>
          Kullanıcı Ekle
        </Btn>
      </div>

      {msg && (
        <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
          <CheckCircle className="w-4 h-4" />{msg}
        </div>
      )}

      {/* Rol Açıklamaları */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {ROLLER.map(r => (
          <div key={r.v} className="bg-gray-50 rounded-lg p-3 border border-gray-200">
            <div className="flex items-center gap-1.5 mb-1">
              <Shield className="w-3.5 h-3.5 text-gray-500" />
              <span className="text-xs font-bold text-gray-700">{r.l}</span>
            </div>
            <p className="text-xs text-gray-500">{r.aciklama}</p>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-8"><div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>
      ) : kullanicilar.length === 0 ? (
        <div className="text-center py-8 text-gray-400 text-sm">Kullanıcı bulunamadı</div>
      ) : (
        <div className="space-y-2">
          {kullanicilar.map(k => {
            const rol = ROLLER.find(r => r.v === k.rol)
            return (
              <div key={k.id} className="flex items-center gap-3 p-4 rounded-xl border border-gray-200 bg-white hover:border-gray-300 transition-colors">
                <div className="w-10 h-10 bg-gradient-to-br from-slate-700 to-slate-900 rounded-xl flex items-center justify-center flex-shrink-0">
                  <span className="text-white font-bold text-sm">
                    {(k.ad_soyad || k.email || '?')[0].toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-gray-900 text-sm">{k.ad_soyad || 'İsimsiz'}</span>
                    <Badge label={rol?.l || k.rol} variant={rolRenk[k.rol] || 'gray'} />
                    {!k.aktif && <Badge label="Pasif" variant="gray" />}
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                    <Mail className="w-3 h-3" />{k.email || '-'}
                  </p>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <button
                    onClick={() => { setSecili(k); setRolForm({ rol: k.rol, aktif: k.aktif }); setModal('rol') }}
                    className="p-1.5 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-blue-50" title="Rol Düzenle">
                    <Key className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => { if (confirm(`${k.email} kullanıcısını kaldırmak istediğinize emin misiniz?`)) kullaniciSil(k.id) }}
                    className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50" title="Kaldır">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Kullanıcı Ekle Modal */}
      {modal === 'davet' && (
        <Modal title="Yeni Kullanıcı Ekle" onClose={() => setModal(null)} size="sm"
          footer={<><Btn variant="secondary" onClick={() => setModal(null)}>İptal</Btn><Btn onClick={davetEt} disabled={saving}>{saving ? 'Ekleniyor...' : 'Kullanıcı Ekle'}</Btn></>}>
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-700">
              Kullanıcı sisteme kayıt olacak ve bu firmaya erişim kazanacak.
            </div>
            <Field label="Ad Soyad">
              <input type="text" value={davetForm.ad_soyad}
                onChange={e => setDavetForm(p => ({ ...p, ad_soyad: e.target.value }))}
                className={inputCls} placeholder="Ad Soyad" />
            </Field>
            <Field label="E-posta" required>
              <input type="email" value={davetForm.email}
                onChange={e => setDavetForm(p => ({ ...p, email: e.target.value }))}
                className={inputCls} placeholder="kullanici@etm.com" />
            </Field>
            <Field label="Şifre" required>
              <input type="password" value={davetForm.sifre}
                onChange={e => setDavetForm(p => ({ ...p, sifre: e.target.value }))}
                className={inputCls} placeholder="En az 6 karakter" />
            </Field>
            <Field label="Rol">
              <select value={davetForm.rol}
                onChange={e => setDavetForm(p => ({ ...p, rol: e.target.value }))}
                className={inputCls}>
                {ROLLER.map(r => <option key={r.v} value={r.v}>{r.l} — {r.aciklama}</option>)}
              </select>
            </Field>
          </div>
        </Modal>
      )}

      {/* Rol Düzenle Modal */}
      {modal === 'rol' && secili && (
        <Modal title={`Rol Düzenle — ${secili.ad_soyad || secili.email}`} onClose={() => setModal(null)} size="sm"
          footer={<><Btn variant="secondary" onClick={() => setModal(null)}>İptal</Btn><Btn onClick={rolGuncelle} disabled={saving}>{saving ? 'Kaydediliyor...' : 'Kaydet'}</Btn></>}>
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
              <p className="text-xs text-gray-500">Kullanıcı</p>
              <p className="font-semibold text-gray-900">{secili.ad_soyad || 'İsimsiz'}</p>
              <p className="text-xs text-gray-400">{secili.email}</p>
            </div>
            <Field label="Rol">
              <select value={rolForm.rol}
                onChange={e => setRolForm(p => ({ ...p, rol: e.target.value }))}
                className={inputCls}>
                {ROLLER.map(r => (
                  <option key={r.v} value={r.v}>{r.l} — {r.aciklama}</option>
                ))}
              </select>
            </Field>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="kullanici-aktif" checked={rolForm.aktif}
                onChange={e => setRolForm(p => ({ ...p, aktif: e.target.checked }))} className="w-4 h-4 text-blue-600 rounded" />
              <label htmlFor="kullanici-aktif" className="text-sm font-medium text-gray-700">Aktif Kullanıcı</label>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ─── Sistem Bilgisi ───────────────────────────────────────────
function SistemBilgisi({ firma }: { firma: Firma }) {
  const [form, setForm] = useState({ ad: firma.ad, kisa_ad: firma.kisa_ad || '', vergi_no: firma.vergi_no || '' })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved]   = useState(false)

  async function save() {
    setSaving(true)
    await supabase.from('firmalar').update({
      ad: form.ad, kisa_ad: form.kisa_ad || null, vergi_no: form.vergi_no || null
    }).eq('id', firma.id)
    setSaving(false); setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  return (
    <div className="space-y-6">
      {/* Aktif Firma Bilgileri */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
          <Building2 className="w-4 h-4" />Aktif Firma Bilgileri
        </h3>
        <div className="space-y-4 max-w-md">
          <Field label="Firma Adı" required>
            <input type="text" value={form.ad} onChange={e => setForm(p => ({ ...p, ad: e.target.value }))} className={inputCls} />
          </Field>
          <Field label="Kısa Ad">
            <input type="text" value={form.kisa_ad} onChange={e => setForm(p => ({ ...p, kisa_ad: e.target.value }))} className={inputCls} placeholder="ETM" />
          </Field>
          <Field label="Vergi No">
            <input type="text" value={form.vergi_no} onChange={e => setForm(p => ({ ...p, vergi_no: e.target.value }))} className={inputCls} />
          </Field>
          <Btn onClick={save} disabled={saving} icon={<Save className="w-4 h-4" />}>
            {saving ? 'Kaydediliyor...' : saved ? '✓ Kaydedildi' : 'Kaydet'}
          </Btn>
        </div>
      </div>

      {/* Sistem Bilgisi */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Sistem Bilgisi</h3>
        <div className="bg-gray-50 rounded-xl border border-gray-200 divide-y divide-gray-200">
          {[
            { l: 'Uygulama',   v: 'ETM Binyapı ERP' },
            { l: 'Versiyon',   v: '2.0.0'            },
            { l: 'Firma ID',   v: firma.id, mono: true },
            { l: 'Ortam',      v: 'Production'        },
          ].map((s, i) => (
            <div key={i} className="flex items-center justify-between px-4 py-3">
              <span className="text-sm text-gray-600">{s.l}</span>
              <span className={`text-sm font-semibold ${s.mono ? 'font-mono text-xs text-gray-400' : 'text-gray-900'}`}>{s.v}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

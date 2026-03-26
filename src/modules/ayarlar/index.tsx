'use client'

import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, Save, User, Building2, Users, ClipboardList, Mail, ShieldCheck, ToggleLeft, ToggleRight } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Loading, ErrorMsg, Modal, Field, ConfirmModal, cls } from '@/components/ui'
import type { AppCtx } from '@/app/page'
import type { Firma, KullaniciProfil, IsSablonu, IsTip, Periyot, Oncelik } from '@/types'
import { TIP_LABEL, PERIYOT_LABEL } from '@/types'

type Tab = 'firma' | 'kullanici' | 'sablonlar' | 'profil'

const ROL_LABEL: Record<KullaniciProfil['rol'], string> = {
  yonetici: 'Yönetici',
  muhasebe: 'Muhasebe',
  izleme:   'İzleme',
}

const ROL_COLOR: Record<KullaniciProfil['rol'], string> = {
  yonetici: 'bg-purple-900/50 text-purple-300',
  muhasebe: 'bg-blue-900/50 text-blue-300',
  izleme:   'bg-slate-700 text-slate-400',
}

export default function Ayarlar({ firma: initFirma, profil: myProfil }: AppCtx) {
  const [tab, setTab] = useState<Tab>('kullanici')

  const tabs: { id: Tab; label: string; icon: React.ComponentType<any> }[] = [
    { id: 'kullanici', label: 'Kullanıcılar', icon: Users },
    { id: 'firma',     label: 'Firma',        icon: Building2 },
    { id: 'sablonlar', label: 'Şablonlar',    icon: ClipboardList },
    { id: 'profil',    label: 'Profilim',     icon: User },
  ]

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold text-white">Ayarlar</h1>
      <div className="flex gap-1 bg-slate-800/60 border border-slate-700/50 rounded-xl p-1 w-fit">
        {tabs.map(t => {
          const Icon = t.icon
          const isActive = tab === t.id
          return (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                isActive ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
              }`}>
              <Icon size={14} />
              {t.label}
            </button>
          )
        })}
      </div>

      {tab === 'firma'     && <FirmaTab firma={initFirma} />}
      {tab === 'kullanici' && <KullaniciTab firma={initFirma} myProfil={myProfil} />}
      {tab === 'sablonlar' && <SablonlarTab firma={initFirma} />}
      {tab === 'profil'    && <ProfilTab profil={myProfil} />}
    </div>
  )
}

/* ── Firma Tab ─────────────────────────────────────────────────────────────── */
function FirmaTab({ firma }: { firma: Firma }) {
  const [form, setForm] = useState({
    ad: firma.ad, kisa_ad: firma.kisa_ad || '',
    vergi_no: firma.vergi_no || '', yetkili: firma.yetkili || '',
    telefon: firma.telefon || '', email: firma.email || '',
  })
  const [saving, setSaving] = useState(false)
  const [ok, setOk] = useState(false)

  async function save() {
    setSaving(true)
    const { error } = await supabase.from('firmalar').update(form).eq('id', firma.id)
    setSaving(false)
    if (!error) { setOk(true); setTimeout(() => setOk(false), 2500) }
    else alert(error.message)
  }

  const FIELDS: { key: keyof typeof form; label: string; required?: boolean }[] = [
    { key: 'ad',       label: 'Firma Adı',  required: true },
    { key: 'kisa_ad',  label: 'Kısa Ad' },
    { key: 'vergi_no', label: 'Vergi No' },
    { key: 'yetkili',  label: 'Yetkili' },
    { key: 'telefon',  label: 'Telefon' },
    { key: 'email',    label: 'E-posta' },
  ]

  return (
    <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-6 max-w-lg space-y-4">
      <h2 className="text-sm font-semibold text-slate-300">Firma Bilgileri</h2>
      {FIELDS.map(f => (
        <Field key={f.key} label={f.label} required={f.required}>
          <input className={cls.input} value={form[f.key]}
            onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} />
        </Field>
      ))}
      <button onClick={save} disabled={saving} className={`${cls.btnPrimary} mt-2`}>
        <Save size={14} />
        {saving ? 'Kaydediliyor...' : ok ? 'Kaydedildi!' : 'Kaydet'}
      </button>
    </div>
  )
}

/* ── Kullanıcı Tab ─────────────────────────────────────────────────────────── */
function KullaniciTab({ firma, myProfil }: { firma: Firma; myProfil: KullaniciProfil }) {
  const [kullanicilar, setKullanicilar] = useState<KullaniciProfil[]>([])
  const [loading, setLoading]           = useState(true)
  const [editing, setEditing]           = useState<KullaniciProfil | null>(null)
  const [saving, setSaving]             = useState(false)

  // Yeni kullanıcı davet
  const [inviteModal, setInviteModal] = useState(false)
  const [invite, setInvite]           = useState({ email: '', ad_soyad: '', rol: 'muhasebe' as KullaniciProfil['rol'] })
  const [inviting, setInviting]       = useState(false)
  const [inviteErr, setInviteErr]     = useState('')
  const [inviteOk, setInviteOk]       = useState(false)

  useEffect(() => { load() }, [firma.id])

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('kullanici_profilleri').select('*')
      .eq('firma_id', firma.id).order('ad_soyad')
    setKullanicilar((data || []) as KullaniciProfil[])
    setLoading(false)
  }

  async function saveKullanici() {
    if (!editing) return
    setSaving(true)
    const { error } = await supabase.from('kullanici_profilleri')
      .update({ ad_soyad: editing.ad_soyad, rol: editing.rol, aktif: editing.aktif })
      .eq('id', editing.id)
    setSaving(false)
    if (error) { alert(error.message); return }
    setEditing(null)
    load()
  }

  async function sendInvite() {
    setInviteErr('')
    if (!invite.email.trim()) { setInviteErr('E-posta zorunludur'); return }
    setInviting(true)
    const res = await fetch('/api/invite-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...invite, firma_id: firma.id }),
    })
    const json = await res.json()
    setInviting(false)
    if (!res.ok) { setInviteErr(json.error || 'Hata oluştu'); return }
    setInviteOk(true)
    setTimeout(() => {
      setInviteOk(false)
      setInviteModal(false)
      setInvite({ email: '', ad_soyad: '', rol: 'muhasebe' })
      load()
    }, 1800)
  }

  if (loading) return <Loading />

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-200">Kullanıcılar</h2>
          <p className="text-xs text-slate-500 mt-0.5">{kullanicilar.length} kullanıcı · Davet ile yeni üye eklenebilir</p>
        </div>
        <button onClick={() => { setInvite({ email: '', ad_soyad: '', rol: 'muhasebe' }); setInviteErr(''); setInviteOk(false); setInviteModal(true) }}
          className={cls.btnPrimary}>
          <Plus size={14} /> Kullanıcı Davet Et
        </button>
      </div>

      {/* Rol Açıklamaları */}
      <div className="grid grid-cols-3 gap-3">
        {(Object.entries(ROL_LABEL) as [KullaniciProfil['rol'], string][]).map(([rol, label]) => (
          <div key={rol} className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-3">
            <div className="flex items-center gap-2 mb-1.5">
              <ShieldCheck size={14} className="text-slate-400" />
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${ROL_COLOR[rol]}`}>{label}</span>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              {rol === 'yonetici' && 'Tüm modüllere erişim, kullanıcı yönetimi ve ayarlar'}
              {rol === 'muhasebe' && 'İş takip, bordro, arşiv ve raporlara tam erişim'}
              {rol === 'izleme'   && 'Sadece okuma yetkisi, düzenleme yapamaz'}
            </p>
          </div>
        ))}
      </div>

      {/* Kullanıcı Listesi */}
      <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-700/50">
              <th className={cls.th}>Ad Soyad / E-posta</th>
              <th className={cls.th}>Rol</th>
              <th className={cls.th}>Durum</th>
              <th className={cls.th}></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/30">
            {kullanicilar.map(k => (
              <tr key={k.id} className="hover:bg-slate-700/20 transition-colors">
                <td className={cls.td}>
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center shrink-0">
                      <User size={14} className="text-slate-400" />
                    </div>
                    <div>
                      <p className="font-medium text-slate-200 text-sm">{k.ad_soyad || '—'}</p>
                      <p className="text-xs text-slate-500">{k.email}</p>
                    </div>
                  </div>
                </td>
                <td className={cls.td}>
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${ROL_COLOR[k.rol]}`}>
                    {ROL_LABEL[k.rol]}
                  </span>
                </td>
                <td className={cls.td}>
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${
                    k.aktif ? 'bg-emerald-900/50 text-emerald-300' : 'bg-slate-700 text-slate-500'
                  }`}>
                    {k.aktif ? 'Aktif' : 'Pasif'}
                  </span>
                </td>
                <td className={cls.td}>
                  {k.id !== myProfil.id && (
                    <button onClick={() => setEditing(k)}
                      className="w-7 h-7 rounded-lg hover:bg-slate-700 flex items-center justify-center text-slate-500 hover:text-blue-400 transition-colors">
                      <Pencil size={13} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Kullanıcı Düzenle Modal */}
      {editing && (
        <Modal title="Kullanıcı Düzenle" onClose={() => setEditing(null)} size="sm"
          footer={
            <>
              <button onClick={() => setEditing(null)} className={cls.btnSecondary}>İptal</button>
              <button onClick={saveKullanici} disabled={saving} className={cls.btnPrimary}>
                {saving ? 'Kaydediliyor...' : 'Kaydet'}
              </button>
            </>
          }>
          <div className="space-y-4">
            <Field label="E-posta">
              <input className={cls.input} value={editing.email} disabled />
            </Field>
            <Field label="Ad Soyad">
              <input className={cls.input} value={editing.ad_soyad || ''}
                onChange={e => setEditing(p => p && ({ ...p, ad_soyad: e.target.value }))} />
            </Field>
            <Field label="Rol">
              <select className={cls.input} value={editing.rol}
                onChange={e => setEditing(p => p && ({ ...p, rol: e.target.value as KullaniciProfil['rol'] }))}>
                <option value="yonetici">Yönetici</option>
                <option value="muhasebe">Muhasebe</option>
                <option value="izleme">İzleme</option>
              </select>
            </Field>
            <Field label="Durum">
              <div className="flex items-center gap-3">
                <button onClick={() => setEditing(p => p && ({ ...p, aktif: !p.aktif }))}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                    editing.aktif
                      ? 'bg-emerald-900/30 border-emerald-700/50 text-emerald-300'
                      : 'bg-slate-700/50 border-slate-600/50 text-slate-400'
                  }`}>
                  {editing.aktif ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                  {editing.aktif ? 'Aktif' : 'Pasif'}
                </button>
              </div>
            </Field>
          </div>
        </Modal>
      )}

      {/* Davet Modal */}
      {inviteModal && (
        <Modal title="Kullanıcı Davet Et" onClose={() => setInviteModal(false)} size="sm"
          footer={
            !inviteOk ? (
              <>
                <button onClick={() => setInviteModal(false)} className={cls.btnSecondary}>İptal</button>
                <button onClick={sendInvite} disabled={inviting} className={cls.btnPrimary}>
                  <Mail size={14} />
                  {inviting ? 'Gönderiliyor...' : 'Davet Gönder'}
                </button>
              </>
            ) : undefined
          }>
          {inviteOk ? (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <div className="w-12 h-12 rounded-full bg-emerald-900/40 border border-emerald-700/50 flex items-center justify-center">
                <Mail size={22} className="text-emerald-400" />
              </div>
              <p className="text-sm font-semibold text-emerald-300">Davet gönderildi!</p>
              <p className="text-xs text-slate-400">{invite.email} adresine davet e-postası iletildi.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <Field label="E-posta" required error={inviteErr}>
                <input className={cls.input} type="email" autoFocus placeholder="kullanici@ornek.com"
                  value={invite.email}
                  onChange={e => setInvite(p => ({ ...p, email: e.target.value }))} />
              </Field>
              <Field label="Ad Soyad">
                <input className={cls.input} placeholder="İsteğe bağlı"
                  value={invite.ad_soyad}
                  onChange={e => setInvite(p => ({ ...p, ad_soyad: e.target.value }))} />
              </Field>
              <Field label="Rol">
                <select className={cls.input} value={invite.rol}
                  onChange={e => setInvite(p => ({ ...p, rol: e.target.value as KullaniciProfil['rol'] }))}>
                  <option value="yonetici">Yönetici — Tam yetki</option>
                  <option value="muhasebe">Muhasebe — Düzenleme yetkisi</option>
                  <option value="izleme">İzleme — Sadece okuma</option>
                </select>
              </Field>
              <p className="text-xs text-slate-500">
                Kullanıcıya e-posta ile davet linki gönderilir. Linke tıklayarak şifresini oluşturur ve sisteme giriş yapar.
              </p>
            </div>
          )}
        </Modal>
      )}
    </div>
  )
}

/* ── Şablonlar Tab ─────────────────────────────────────────────────────────── */
function SablonlarTab({ firma }: { firma: Firma }) {
  const [sablonlar, setSablonlar]           = useState<IsSablonu[]>([])
  const [loading, setLoading]               = useState(true)
  const [editing, setEditing]               = useState<Partial<IsSablonu> | null>(null)
  const [deleting, setDeleting]             = useState<IsSablonu | null>(null)
  const [saving, setSaving]                 = useState(false)
  const [kullanicilar, setKullanicilar]     = useState<KullaniciProfil[]>([])

  useEffect(() => { load() }, [firma.id])

  async function load() {
    setLoading(true)
    const [{ data: s }, { data: k }] = await Promise.all([
      supabase.from('is_sablonlari').select('*').eq('firma_id', firma.id).order('ad'),
      supabase.from('kullanici_profilleri').select('*').eq('firma_id', firma.id).eq('aktif', true),
    ])
    setSablonlar((s || []) as IsSablonu[])
    setKullanicilar((k || []) as KullaniciProfil[])
    setLoading(false)
  }

  async function saveSablon() {
    if (!editing?.ad || !editing?.tip || !editing?.periyot) return
    setSaving(true)
    const payload = { ...editing, firma_id: firma.id }
    const { error } = editing.id
      ? await supabase.from('is_sablonlari').update(payload).eq('id', editing.id)
      : await supabase.from('is_sablonlari').insert(payload)
    setSaving(false)
    if (error) { alert(error.message); return }
    setEditing(null); load()
  }

  async function deleteSablon() {
    if (!deleting) return
    await supabase.from('is_sablonlari').delete().eq('id', deleting.id)
    setDeleting(null); load()
  }

  if (loading) return <Loading />

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-200">İş Şablonları</h2>
          <p className="text-xs text-slate-500 mt-0.5">{sablonlar.length} şablon</p>
        </div>
        <button onClick={() => setEditing({ oncelik: 'orta', periyot: 'aylik', tip: 'beyanname', hatirlat_gun: 3, aktif: true })}
          className={cls.btnPrimary}>
          <Plus size={14} /> Yeni Şablon
        </button>
      </div>

      <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl overflow-hidden">
        {sablonlar.length === 0 ? (
          <div className="py-12 text-center text-sm text-slate-500">Henüz şablon yok</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-700/50">
                <th className={cls.th}>Şablon Adı</th>
                <th className={cls.th}>Tip</th>
                <th className={cls.th}>Periyot</th>
                <th className={cls.th}>Hatırlat</th>
                <th className={cls.th}></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/30">
              {sablonlar.map(s => (
                <tr key={s.id} className="hover:bg-slate-700/20 transition-colors">
                  <td className={cls.td}><span className="font-medium text-slate-200">{s.ad}</span></td>
                  <td className={cls.td}><span className="text-xs text-slate-400">{TIP_LABEL[s.tip as keyof typeof TIP_LABEL] || s.tip}</span></td>
                  <td className={cls.td}><span className="text-xs text-slate-400">{PERIYOT_LABEL[s.periyot as keyof typeof PERIYOT_LABEL] || s.periyot}</span></td>
                  <td className={cls.td}><span className="text-xs text-slate-400">{s.hatirlat_gun} gün</span></td>
                  <td className={cls.td}>
                    <div className="flex gap-1 justify-end">
                      <button onClick={() => setEditing(s)}
                        className="w-7 h-7 rounded-lg hover:bg-slate-700 flex items-center justify-center text-slate-500 hover:text-blue-400 transition-colors">
                        <Pencil size={13} />
                      </button>
                      <button onClick={() => setDeleting(s)}
                        className="w-7 h-7 rounded-lg hover:bg-red-900/30 flex items-center justify-center text-slate-500 hover:text-red-400 transition-colors">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {editing && (
        <Modal title={editing.id ? 'Şablon Düzenle' : 'Yeni Şablon'} onClose={() => setEditing(null)} size="md"
          footer={
            <>
              <button onClick={() => setEditing(null)} className={cls.btnSecondary}>İptal</button>
              <button onClick={saveSablon} disabled={saving} className={cls.btnPrimary}>
                {saving ? 'Kaydediliyor...' : 'Kaydet'}
              </button>
            </>
          }>
          <div className="space-y-4">
            <Field label="Şablon Adı" required>
              <input className={cls.input} value={editing.ad || ''}
                onChange={e => setEditing(p => ({ ...p, ad: e.target.value }))} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Tip">
                <select className={cls.input} value={editing.tip || 'beyanname'}
                  onChange={e => setEditing(p => ({ ...p, tip: e.target.value as IsTip }))}>
                  {Object.entries(TIP_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </Field>
              <Field label="Periyot">
                <select className={cls.input} value={editing.periyot || 'aylik'}
                  onChange={e => setEditing(p => ({ ...p, periyot: e.target.value as Periyot }))}>
                  {Object.entries(PERIYOT_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Öncelik">
                <select className={cls.input} value={editing.oncelik || 'orta'}
                  onChange={e => setEditing(p => ({ ...p, oncelik: e.target.value as Oncelik }))}>
                  <option value="dusuk">Düşük</option>
                  <option value="orta">Orta</option>
                  <option value="yuksek">Yüksek</option>
                  <option value="kritik">Kritik</option>
                </select>
              </Field>
              <Field label="Hatırlat (gün önce)">
                <input type="number" className={cls.input} min={1} max={30}
                  value={editing.hatirlat_gun ?? 3}
                  onChange={e => setEditing(p => ({ ...p, hatirlat_gun: parseInt(e.target.value) }))} />
              </Field>
            </div>
            <Field label="Varsayılan Sorumlu">
              <select className={cls.input} value={editing.sorumlu_id || ''}
                onChange={e => setEditing(p => ({ ...p, sorumlu_id: e.target.value || undefined }))}>
                <option value="">Atanmamış</option>
                {kullanicilar.map(k => <option key={k.id} value={k.id}>{k.ad_soyad || k.email}</option>)}
              </select>
            </Field>
            <Field label="Açıklama">
              <input className={cls.input} value={editing.aciklama || ''}
                onChange={e => setEditing(p => ({ ...p, aciklama: e.target.value }))} />
            </Field>
          </div>
        </Modal>
      )}

      {deleting && (
        <ConfirmModal title="Şablonu Sil" message={`"${deleting.ad}" şablonu silinecek.`}
          danger onConfirm={deleteSablon} onCancel={() => setDeleting(null)} />
      )}
    </div>
  )
}

/* ── Profil Tab ────────────────────────────────────────────────────────────── */
function ProfilTab({ profil }: { profil: KullaniciProfil }) {
  const [adSoyad, setAdSoyad]   = useState(profil.ad_soyad || '')
  const [saving, setSaving]     = useState(false)
  const [ok, setOk]             = useState(false)
  const [pw, setPw]             = useState({ new1: '', new2: '' })
  const [pwSaving, setPwSaving] = useState(false)
  const [pwErr, setPwErr]       = useState('')
  const [pwOk, setPwOk]         = useState(false)

  async function saveProfil() {
    setSaving(true)
    const { error } = await supabase.from('kullanici_profilleri').update({ ad_soyad: adSoyad }).eq('id', profil.id)
    setSaving(false)
    if (!error) { setOk(true); setTimeout(() => setOk(false), 2500) }
    else alert(error.message)
  }

  async function changePassword() {
    setPwErr('')
    if (pw.new1 !== pw.new2) { setPwErr('Parolalar eşleşmiyor'); return }
    if (pw.new1.length < 6)  { setPwErr('Parola en az 6 karakter olmalı'); return }
    setPwSaving(true)
    const { error } = await supabase.auth.updateUser({ password: pw.new1 })
    setPwSaving(false)
    if (error) { setPwErr(error.message); return }
    setPw({ new1: '', new2: '' })
    setPwOk(true); setTimeout(() => setPwOk(false), 2500)
  }

  return (
    <div className="space-y-4 max-w-md">
      <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-6 space-y-4">
        <h2 className="text-sm font-semibold text-slate-300">Profil Bilgileri</h2>
        <Field label="E-posta">
          <input className={cls.input} value={profil.email} disabled />
        </Field>
        <Field label="Ad Soyad">
          <input className={cls.input} value={adSoyad} onChange={e => setAdSoyad(e.target.value)} />
        </Field>
        <Field label="Rol">
          <input className={cls.input} value={ROL_LABEL[profil.rol]} disabled />
        </Field>
        <button onClick={saveProfil} disabled={saving} className={cls.btnPrimary}>
          <Save size={14} />
          {saving ? 'Kaydediliyor...' : ok ? 'Kaydedildi!' : 'Kaydet'}
        </button>
      </div>

      <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-6 space-y-4">
        <h2 className="text-sm font-semibold text-slate-300">Parola Değiştir</h2>
        <Field label="Yeni Parola">
          <input type="password" className={cls.input} value={pw.new1}
            onChange={e => setPw(p => ({ ...p, new1: e.target.value }))} />
        </Field>
        <Field label="Yeni Parola (Tekrar)">
          <input type="password" className={cls.input} value={pw.new2}
            onChange={e => setPw(p => ({ ...p, new2: e.target.value }))} />
        </Field>
        {pwErr && <p className="text-xs text-red-400">{pwErr}</p>}
        {pwOk  && <p className="text-xs text-emerald-400">Parola değiştirildi!</p>}
        <button onClick={changePassword} disabled={pwSaving} className={cls.btnPrimary}>
          {pwSaving ? 'Değiştiriliyor...' : 'Parolayı Değiştir'}
        </button>
      </div>
    </div>
  )
}

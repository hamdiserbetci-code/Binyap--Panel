'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Building2, KeyRound, Pencil, Plus, ShieldCheck, Trash2, UserCog } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { can } from '@/lib/permissions'
import Modal, { FormField, btnPrimary, btnSecondary, inputCls } from '@/components/ui/Modal'
import { logActivity } from '@/lib/activityLog'
import type { FirmaRecord } from '@/components/newpanel/ProjectsModule'

export interface UserProfileRecord {
  id: string
  auth_user_id: string | null
  firma_id: string | null
  ad_soyad: string | null
  email: string
  rol: string
  aktif: boolean
  son_giris_at: string | null
  created_at?: string
}

interface Props {
  firma: FirmaRecord
  currentProfile: UserProfileRecord | null
  role?: string | null
  onFirmaUpdated?: (firma: FirmaRecord) => void
}

const roleLabels: Record<string, string> = {
  yonetici: 'Yonetici',
  muhasebe: 'Muhasebe',
  santiye: 'Santiye',
  izleme: 'Izleme',
}

const emptyUserForm = {
  ad_soyad: '',
  email: '',
  rol: 'izleme',
  aktif: true,
}

const emptyFirmaForm = {
  ad: '',
  kisa_ad: '',
  vergi_no: '',
  mersis_no: '',
  yetkili: '',
  telefon: '',
  email: '',
  adres: '',
  aktif: true,
}

function parseMissingCompanyColumn(message?: string) {
  const match = (message || '').match(/'([^']+)' column of 'firmalar'/i)
  return match?.[1] || null
}

function isMissingProfilesTable(message?: string) {
  const value = (message || '').toLowerCase()
  return value.includes('kullanici_profilleri') && (value.includes('schema cache') || value.includes('does not exist') || value.includes('could not find the table'))
}

export default function UsersModule({ firma, currentProfile, role, onFirmaUpdated }: Props) {
  const [users, setUsers] = useState<UserProfileRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [savingCompany, setSavingCompany] = useState(false)
  const [error, setError] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<UserProfileRecord | null>(null)
  const [form, setForm] = useState(emptyUserForm)
  const [companyModalOpen, setCompanyModalOpen] = useState(false)
  const [companyForm, setCompanyForm] = useState(emptyFirmaForm)
  const [profilesSupported, setProfilesSupported] = useState(true)

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase.from('kullanici_profilleri').select('*').eq('firma_id', firma.id).order('email')
    if (error) {
      if (isMissingProfilesTable(error.message)) {
        setProfilesSupported(false)
        setError('kullanici_profilleri tablosu bulunamadi. Kullanici yonetimi bu veritabaninda pasif durumda.')
        setUsers(currentProfile ? [currentProfile] : [])
        setLoading(false)
        return
      }
      setError(error.message)
      setUsers([])
      setLoading(false)
      return
    }
    setProfilesSupported(true)
    setError('')
    setUsers((data as UserProfileRecord[]) || [])
    setLoading(false)
  }, [currentProfile, firma.id])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  useEffect(() => {
    setCompanyForm({
      ad: firma.ad || '',
      kisa_ad: firma.kisa_ad || '',
      vergi_no: firma.vergi_no || '',
      mersis_no: firma.mersis_no || '',
      yetkili: firma.yetkili || '',
      telefon: firma.telefon || '',
      email: firma.email || '',
      adres: firma.adres || '',
      aktif: typeof firma.aktif === 'boolean' ? firma.aktif : true,
    })
  }, [firma])

  const summary = useMemo(() => ({
    total: users.length,
    active: users.filter((user) => user.aktif).length,
    admins: users.filter((user) => user.rol === 'yonetici').length,
  }), [users])

  function openCreate() {
    if (!can(role, 'manage_users') || !profilesSupported) return
    setEditing(null)
    setForm(emptyUserForm)
    setModalOpen(true)
  }

  function openEdit(user: UserProfileRecord) {
    if (!can(role, 'manage_users') || !profilesSupported) return
    setEditing(user)
    setForm({ ad_soyad: user.ad_soyad || '', email: user.email, rol: user.rol, aktif: user.aktif })
    setModalOpen(true)
  }

  function openCompanyModal() {
    if (!can(role, 'manage_users')) return
    setCompanyForm({
      ad: firma.ad || '',
      kisa_ad: firma.kisa_ad || '',
      vergi_no: firma.vergi_no || '',
      mersis_no: firma.mersis_no || '',
      yetkili: firma.yetkili || '',
      telefon: firma.telefon || '',
      email: firma.email || '',
      adres: firma.adres || '',
      aktif: typeof firma.aktif === 'boolean' ? firma.aktif : true,
    })
    setCompanyModalOpen(true)
  }

  async function saveCompany() {
    if (!can(role, 'manage_users')) return
    if (!companyForm.ad.trim()) {
      setError('Firma adi zorunludur.')
      return
    }

    setSavingCompany(true)
    setError('')

    const payload: Record<string, any> = {
      ad: companyForm.ad.trim(),
      kisa_ad: companyForm.kisa_ad || null,
      vergi_no: companyForm.vergi_no || null,
      mersis_no: companyForm.mersis_no || null,
      yetkili: companyForm.yetkili || null,
      telefon: companyForm.telefon || null,
      email: companyForm.email || null,
      adres: companyForm.adres || null,
      aktif: companyForm.aktif,
    }

    let workingPayload = { ...payload }
    let response

    while (true) {
      response = firma.id
        ? await supabase.from('firmalar').update(workingPayload).eq('id', firma.id).select('*').single()
        : await supabase.from('firmalar').insert(workingPayload).select('*').single()

      if (!response.error) break

      const missingColumn = parseMissingCompanyColumn(response.error.message)
      if (!missingColumn || !(missingColumn in workingPayload) || Object.keys(workingPayload).length <= 1) {
        break
      }

      delete workingPayload[missingColumn]
      setError(`firmalar tablosunda ${missingColumn} alani yok. Kayit mevcut alanlarla devam ettirildi.`)
    }

    if (!response || response.error) {
      setError(response?.error?.message || 'Firma kaydi yapilamadi.')
      setSavingCompany(false)
      return
    }

    const nextFirma = { ...firma, ...(response.data as FirmaRecord) }
    onFirmaUpdated?.(nextFirma)
    await logActivity({
      firmaId: nextFirma.id,
      authUserId: currentProfile?.auth_user_id || null,
      kullaniciProfilId: currentProfile?.id || null,
      modul: 'kullanicilar',
      islemTuru: firma.id ? 'firma_duzenlendi' : 'firma_olusturuldu',
      kayitTuru: 'firma',
      kayitId: nextFirma.id,
      aciklama: nextFirma.ad + ' firma bilgileri ' + (firma.id ? 'guncellendi.' : 'olusturuldu.'),
      meta: { alanlar: Object.keys(workingPayload) },
    })
    setCompanyModalOpen(false)
    setSavingCompany(false)
  }

  async function saveUser() {
    if (!can(role, 'manage_users') || !profilesSupported) return
    if (!form.email.trim()) {
      setError('E-posta zorunludur.')
      return
    }
    const payload = { firma_id: firma.id, ad_soyad: form.ad_soyad || null, email: form.email.trim().toLowerCase(), rol: form.rol, aktif: form.aktif }
    const response = editing ? await supabase.from('kullanici_profilleri').update(payload).eq('id', editing.id) : await supabase.from('kullanici_profilleri').insert(payload)
    if (response.error) {
      setError(response.error.message)
      return
    }
    await logActivity({ firmaId: firma.id, authUserId: currentProfile?.auth_user_id || null, kullaniciProfilId: currentProfile?.id || null, modul: 'kullanicilar', islemTuru: editing ? 'duzenlendi' : 'olusturuldu', kayitTuru: 'kullanici_profili', kayitId: editing?.id || null, aciklama: payload.email + ' kullanici profili ' + (editing ? 'guncellendi.' : 'olusturuldu.'), meta: { rol: payload.rol, aktif: payload.aktif } })
    setModalOpen(false)
    fetchUsers()
  }

  async function toggleActive(user: UserProfileRecord) {
    if (!can(role, 'manage_users') || !profilesSupported) return
    const { error } = await supabase.from('kullanici_profilleri').update({ aktif: !user.aktif }).eq('id', user.id)
    if (error) {
      setError(error.message)
      return
    }
    await logActivity({ firmaId: firma.id, authUserId: currentProfile?.auth_user_id || null, kullaniciProfilId: currentProfile?.id || null, modul: 'kullanicilar', islemTuru: user.aktif ? 'pasif_yapildi' : 'aktif_yapildi', kayitTuru: 'kullanici_profili', kayitId: user.id, aciklama: user.email + ' kullanicisinin durumu ' + (user.aktif ? 'pasif' : 'aktif') + ' yapildi.', meta: { oncekiDurum: user.aktif, yeniDurum: !user.aktif } })
    fetchUsers()
  }

  async function deleteUser(user: UserProfileRecord) {
    if (!can(role, 'manage_users') || !profilesSupported) return
    if (user.id === currentProfile?.id) {
      setError('Aktif kullaniciyi bu ekrandan silemezsiniz.')
      return
    }
    if (!confirm(`"${user.email}" kaydini silmek istediginize emin misiniz?`)) return
    const { error } = await supabase.from('kullanici_profilleri').delete().eq('id', user.id)
    if (error) {
      setError(error.message)
      return
    }
    await logActivity({ firmaId: firma.id, authUserId: currentProfile?.auth_user_id || null, kullaniciProfilId: currentProfile?.id || null, modul: 'kullanicilar', islemTuru: 'silindi', kayitTuru: 'kullanici_profili', kayitId: user.id, aciklama: user.email + ' kullanici profili silindi.' })
    fetchUsers()
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-3">
        <SummaryCard label="Toplam Kullanici" value={String(summary.total)} note="Firma profilleri" />
        <SummaryCard label="Aktif" value={String(summary.active)} note="Panele erisebilenler" />
        <SummaryCard label="Yonetici" value={String(summary.admins)} note="Tam yetkili hesaplar" />
      </div>

      <div className="rounded-[32px] border border-white/[0.04] bg-white/[0.02] p-6 text-slate-200 shadow-2xl backdrop-blur-3xl ring-1 ring-white/5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400/80">Kurumsal Profil</p>
            <h3 className="mt-2 text-2xl font-bold tracking-tight text-white">Firma Master Veri Ayarlari</h3>
            <p className="mt-2 text-sm text-slate-400">Vergi, MERSIS numaralari, iletisim ve yasal muhataplarin tanimlandigi global profil bolumu.</p>
          </div>
          <button type="button" onClick={openCompanyModal} disabled={!can(role, 'manage_users')} className="inline-flex items-center gap-2 rounded-2xl bg-white/10 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-white/20 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50 border border-white/5">
            <Building2 size={16} />
            {firma.id ? 'Firma bilgileri' : 'Firma ekle'}
          </button>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <InfoCard label="Firma" value={firma.ad || '-'} />
          <InfoCard label="Kisa Ad" value={firma.kisa_ad || '-'} />
          <InfoCard label="Vergi No" value={firma.vergi_no || '-'} />
          <InfoCard label="Yetkili" value={firma.yetkili || '-'} />
          <InfoCard label="Telefon" value={firma.telefon || '-'} />
          <InfoCard label="E-posta" value={firma.email || '-'} />
          <InfoCard label="MERSIS" value={firma.mersis_no || '-'} />
          <InfoCard label="Durum" value={typeof firma.aktif === 'boolean' ? (firma.aktif ? 'Aktif' : 'Pasif') : 'Aktif'} />
        </div>
        <div className="mt-4 rounded-3xl border border-white/[0.05] bg-white/[0.01] shadow-inner p-4 text-sm text-slate-400">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">Merkez Adres</p>
          <p className="mt-2 leading-relaxed">{firma.adres || 'Lokasyon kaydi bulunmamaktadir.'}</p>
        </div>
      </div>

      <div className="rounded-[32px] border border-white/[0.04] bg-white/[0.02] p-6 text-slate-200 shadow-2xl backdrop-blur-3xl ring-1 ring-white/5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400/80">Erisim ve Guvenlik</p>
            <h3 className="mt-2 text-2xl font-bold tracking-tight text-white">Sistem Yetkilendirme Kontrolu</h3>
            <p className="mt-2 text-sm text-slate-400">Auth servisi entegrasyonu ile eslesen profillerin moduler erisim ve gorev dagilimi konfigurasyonu.</p>
          </div>
          <button type="button" onClick={openCreate} disabled={!can(role, 'manage_users') || !profilesSupported} className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">
            <Plus size={16} />
            Yeni kullanici
          </button>
        </div>

        {error && <p className="mt-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}

        {!profilesSupported ? (
          <div className="mt-6 rounded-2xl border border-dashed border-white/10 bg-white/5 p-10 text-center text-sm text-slate-400">Bu veritabaninda `kullanici_profilleri` tablosu yok. Kullanici yonetimi yeni SQL semasi uygulandiginda aktif olacak.</div>
        ) : loading ? (
          <div className="mt-6 rounded-2xl border border-dashed border-white/10 bg-white/5 p-10 text-center text-sm text-slate-400">Kullanici listesi yukleniyor...</div>
        ) : users.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-white/10 bg-white/5 p-10 text-center"><UserCog size={28} className="mx-auto text-slate-400" /><p className="mt-3 text-sm text-slate-400">Henuz kullanici profili yok.</p></div>
        ) : (
          <div className="mt-6 grid gap-3">
            {users.map((user) => (
              <div key={user.id} className="rounded-3xl border border-white/[0.05] bg-white/[0.02] hover:bg-white/[0.04] transition-colors p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="text-lg font-bold text-slate-100">{user.ad_soyad || 'Tanimlanmamis Profil'}</h4>
                      <span className="rounded-full bg-slate-700/50 border border-slate-600/50 px-2.5 py-1 text-[10px] font-semibold text-slate-300 uppercase tracking-widest">{roleLabels[user.rol] || user.rol}</span>
                      <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest ${user.aktif ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'}`}>{user.aktif ? 'Aktif Hesap' : 'Pasife Alinmis'}</span>
                      {user.id === currentProfile?.id && <span className="rounded-full bg-blue-500/20 border border-blue-500/30 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest text-blue-300">Gecerli Oturum</span>}
                    </div>
                    <p className="mt-2 text-sm text-slate-400 font-medium">{user.email}</p>
                    <p className="mt-1 text-[11px] text-slate-500 font-medium">Son sisteme erisim: {user.son_giris_at ? new Date(user.son_giris_at).toLocaleString('tr-TR') : '-'}</p>
                  </div>

                  {can(role, 'manage_users') && (
                    <div className="flex flex-wrap items-center gap-2">
                      <button type="button" onClick={() => openEdit(user)} disabled={!profilesSupported} className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-slate-300 transition hover:bg-white/10 disabled:opacity-50"><Pencil size={14} />Duzenle</button>
                      <button type="button" onClick={() => toggleActive(user)} disabled={!profilesSupported} className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-slate-300 transition hover:bg-white/10 disabled:opacity-50"><ShieldCheck size={14} />{user.aktif ? 'Pasif yap' : 'Aktif yap'}</button>
                      <button type="button" onClick={() => deleteUser(user)} disabled={!profilesSupported} className="inline-flex items-center gap-1.5 rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-xs font-medium text-rose-400 transition hover:bg-rose-500/20 disabled:opacity-50"><Trash2 size={14} />Sil</button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {companyModalOpen && can(role, 'manage_users') && (
        <Modal title={firma.id ? 'Firma bilgilerini duzenle' : 'Yeni firma ekle'} onClose={() => setCompanyModalOpen(false)} footer={<><button className={btnSecondary} onClick={() => setCompanyModalOpen(false)}>Iptal</button><button className={btnPrimary} onClick={saveCompany} disabled={savingCompany}>{savingCompany ? 'Kaydediliyor...' : 'Kaydet'}</button></>}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Firma Adi" required><input className={inputCls} value={companyForm.ad} onChange={(e) => setCompanyForm({ ...companyForm, ad: e.target.value })} /></FormField>
              <FormField label="Kisa Ad"><input className={inputCls} value={companyForm.kisa_ad} onChange={(e) => setCompanyForm({ ...companyForm, kisa_ad: e.target.value })} /></FormField>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Vergi No"><input className={inputCls} value={companyForm.vergi_no} onChange={(e) => setCompanyForm({ ...companyForm, vergi_no: e.target.value })} /></FormField>
              <FormField label="MERSIS No"><input className={inputCls} value={companyForm.mersis_no} onChange={(e) => setCompanyForm({ ...companyForm, mersis_no: e.target.value })} /></FormField>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Yetkili"><input className={inputCls} value={companyForm.yetkili} onChange={(e) => setCompanyForm({ ...companyForm, yetkili: e.target.value })} /></FormField>
              <FormField label="Telefon"><input className={inputCls} value={companyForm.telefon} onChange={(e) => setCompanyForm({ ...companyForm, telefon: e.target.value })} /></FormField>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormField label="E-posta"><input type="email" className={inputCls} value={companyForm.email} onChange={(e) => setCompanyForm({ ...companyForm, email: e.target.value })} /></FormField>
              <FormField label="Durum"><select className={inputCls} value={companyForm.aktif ? 'aktif' : 'pasif'} onChange={(e) => setCompanyForm({ ...companyForm, aktif: e.target.value === 'aktif' })}><option value="aktif">Aktif</option><option value="pasif">Pasif</option></select></FormField>
            </div>
            <FormField label="Adres"><textarea className={inputCls} rows={3} value={companyForm.adres} onChange={(e) => setCompanyForm({ ...companyForm, adres: e.target.value })} /></FormField>
          </div>
        </Modal>
      )}

      {modalOpen && can(role, 'manage_users') && profilesSupported && (
        <Modal title={editing ? 'Kullaniciyi duzenle' : 'Yeni kullanici profili'} onClose={() => setModalOpen(false)} footer={<><button className={btnSecondary} onClick={() => setModalOpen(false)}>Iptal</button><button className={btnPrimary} onClick={saveUser}>Kaydet</button></>}>
          <div className="space-y-4">
            <FormField label="Ad Soyad"><input className={inputCls} value={form.ad_soyad} onChange={(e) => setForm({ ...form, ad_soyad: e.target.value })} /></FormField>
            <FormField label="E-posta" required><input type="email" className={inputCls} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></FormField>
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Rol"><select className={inputCls} value={form.rol} onChange={(e) => setForm({ ...form, rol: e.target.value })}><option value="yonetici">Yonetici</option><option value="muhasebe">Muhasebe</option><option value="santiye">Santiye</option><option value="izleme">Izleme</option></select></FormField>
              <FormField label="Durum"><select className={inputCls} value={form.aktif ? 'aktif' : 'pasif'} onChange={(e) => setForm({ ...form, aktif: e.target.value === 'aktif' })}><option value="aktif">Aktif</option><option value="pasif">Pasif</option></select></FormField>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

function SummaryCard({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="rounded-[28px] border border-white/10 bg-slate-950/85 p-5 text-white shadow-[0_24px_60px_rgba(15,23,42,0.22)]">
      <div className="flex items-center justify-between gap-3"><p className="text-xs uppercase tracking-[0.24em] text-slate-400">{label}</p><KeyRound size={16} className="text-slate-400" /></div>
      <p className="mt-3 text-2xl font-semibold text-sky-300">{value}</p>
      <p className="mt-1 text-xs text-slate-400">{note}</p>
    </div>
  )
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl border border-white/[0.05] bg-white/[0.01] shadow-inner p-4 hover:bg-white/[0.03] transition-colors">
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">{label}</p>
      <p className="mt-2 text-sm font-bold text-slate-200 break-words">{value}</p>
    </div>
  )
}

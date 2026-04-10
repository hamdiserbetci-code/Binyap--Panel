'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, CheckCircle2, FileSpreadsheet, FileText, Plus, UserCheck, UserMinus, Users, X, Trash2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { cls, ErrorMsg, Loading } from '@/components/ui'
import type { AppCtx } from '@/app/page'
import type { BordroSurec, Dokuman, Ekip, IkPersonel, Proje } from '@/types'

// ── Config ─────────────────────────────────────────────────────────────────
const ADIMLAR: {
  key: keyof BordroSurec
  tarihKey: keyof BordroSurec
  label: string
  accent: string
}[] = [
  { key: 'puantaj_durum', tarihKey: 'puantaj_tarihi', label: 'Puantaj',  accent: 'blue'    },
  { key: 'bordro_durum',  tarihKey: 'bordro_tarihi',  label: 'Bordro',   accent: 'violet'  },
  { key: 'teyit_durum',   tarihKey: 'teyit_tarihi',   label: 'Teyit',    accent: 'cyan'    },
  { key: 'odeme_durum',   tarihKey: 'odeme_tarihi',   label: 'Ödeme',    accent: 'emerald' },
  { key: 'santiye_durum', tarihKey: 'santiye_tarihi', label: 'Şantiye',  accent: 'amber'   },
]

const AYLAR     = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara']
const AYLAR_TAM = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık']

// Pre-defined accent classes so Tailwind JIT includes them
const ACCENT: Record<string, { dot: string; text: string }> = {
  blue:    { dot: 'bg-blue-400',    text: 'text-blue-300'    },
  violet:  { dot: 'bg-violet-400',  text: 'text-violet-300'  },
  cyan:    { dot: 'bg-cyan-400',    text: 'text-cyan-300'    },
  emerald: { dot: 'bg-emerald-400', text: 'text-emerald-300' },
  amber:   { dot: 'bg-amber-400',   text: 'text-amber-300'   },
}

// Adımlar içinden yalnızca dosya yüklenebilecek olanlar
const DOC_ADIMLAR = ['puantaj', 'bordro', 'odeme'] as const
type DocAdim = (typeof DOC_ADIMLAR)[number]

const DOC_ADIM_LABELS: Record<DocAdim, string> = {
  puantaj: 'Puantaj',
  bordro:  'Bordro',
  odeme:   'Ödeme',
}

const ACCEPTED = '.xlsx,.xls,.pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,application/pdf'

// ── Helpers ─────────────────────────────────────────────────────────────────
const pad = (n: number) => String(n).padStart(2, '0')

function isExcel(doc: Dokuman) {
  return doc.mime_type?.includes('sheet') || doc.mime_type?.includes('excel') || /\.xlsx?$/i.test(doc.dosya_adi)
}

function getCellStatus(
  surec: BordroSurec | undefined,
  key: keyof BordroSurec,
): 'none' | 'partial' | 'done' {
  if (!surec) return 'none'
  if ((surec[key] as string) === 'tamamlandi') return 'done'
  return 'partial' // record exists but this step not yet done
}

// ── BordroCell (standalone to avoid re-mount on each render) ────────────────
function BordroCell({
  status, isActive, isCurrent, disabled, onClick,
}: {
  status: 'none' | 'partial' | 'done'
  isActive: boolean; isCurrent: boolean; disabled: boolean; onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={[
        'group w-full h-7 rounded-md border transition-all flex items-center justify-center select-none',
        isActive
          ? 'ring-2 ring-blue-400/50 border-blue-400 bg-blue-100'
          : status === 'done'
          ? 'border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/16'
          : status === 'partial'
          ? 'border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/16'
          : isCurrent
          ? 'border-blue-200 bg-blue-50/30 hover:bg-blue-50'
          : 'border-slate-100 hover:border-slate-300 hover:bg-slate-50',
      ].join(' ')}
    >
      {status === 'done'    && <CheckCircle2 size={13} className="text-emerald-400 pointer-events-none" />}
      {status === 'partial' && <div className="w-3 h-3 rounded-full border-2 border-amber-400 bg-amber-400/25 pointer-events-none" />}
      {status === 'none'    && <Plus size={11} className="text-[rgba(255,255,255,0)] group-hover:text-[rgba(255,255,255,0.35)] transition-colors pointer-events-none" />}
    </button>
  )
}

// ── Section Label Row ────────────────────────────────────────────────────────
function SectionRow({ label }: { label: string }) {
  return (
    <tr>
      <td
        colSpan={13}
        className="sticky left-0 px-4 py-1 bg-slate-100 border-t border-b border-slate-100"
      >
        <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
          {label}
        </span>
      </td>
    </tr>
  )
}

// ── Main Component ──────────────────────────────────────────────────────────
export default function BordroV2({ firma, firmaIds, profil }: AppCtx) {
  const todayYil = new Date().getFullYear()
  const todayAy  = new Date().getMonth() // 0-based
  let targetAy = todayAy - 1; let targetYil = todayYil;
  if (targetAy < 0) { targetAy = 11; targetYil--; }

  const [projeler, setProjeler]   = useState<Proje[]>([])
  const [ekipler, setEkipler]     = useState<Ekip[]>([])
  const [surecler, setSurecler]   = useState<BordroSurec[]>([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState('')

  const [yil, setYil]             = useState(targetYil)
  const [selProjeId, setSelProjeId] = useState('')
  const [selEkipId, setSelEkipId]   = useState('')

  const [ikPersoneller, setIkPersoneller] = useState<IkPersonel[]>([])
  const [showPersonel, setShowPersonel] = useState(false)
  const [dosyaMap, setDosyaMap]   = useState<Record<string, Dokuman[]>>({})
  const [selCell, setSelCell]     = useState<{ donem: string; adim: keyof BordroSurec } | null>(null)
  const [notVal, setNotVal]       = useState('')
  const [saving, setSaving]       = useState(false)
  const [deleting, setDeleting]   = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadingItem, setUploadingItem] = useState<{ recordId: string; cat: DocAdim } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => { void load() }, [firmaIds.join(',')])

  async function load() {
    setLoading(true); setError('')
    const [{ data: p, error: pe }, { data: e, error: ee }, { data: s, error: se }, { data: docs, error: de }, { data: ikp }] =
      await Promise.all([
        supabase.from('projeler').select('*').in('firma_id', firmaIds).order('ad'),
        supabase.from('ekipler').select('*').in('firma_id', firmaIds).order('ad'),
        supabase.from('bordro_surecler').select('*').in('firma_id', firmaIds),
        supabase.from('dokumanlar').select('*').in('firma_id', firmaIds).eq('bagli_tablo', 'bordro_surecler'),
        supabase.from('ik_personel').select('*').in('firma_id', firmaIds).order('ad_soyad'),
      ])
    const err = pe || ee || se || de
    if (err) { setError(err.message); setLoading(false); return }
    const rows = (p || []) as Proje[]
    setProjeler(rows)
    setEkipler((e || []) as Ekip[])
    setSurecler((s || []) as BordroSurec[])
    setIkPersoneller((ikp || []) as IkPersonel[])
    const map: Record<string, Dokuman[]> = {}
    ;(docs || []).forEach(doc => {
      const key = `${doc.bagli_kayit_id}_${doc.kategori}`
      if (!map[key]) map[key] = []
      map[key].push(doc as Dokuman)
    })
    setDosyaMap(map)

    // Auto-select first project
    if (!selProjeId && rows.length > 0) {
      setSelProjeId(rows[0].id)
    }
    setLoading(false)
  }

  // ── Derived selections ────────────────────────────────────────────────────

  const ekiplerForProje = useMemo(
    () => ekipler.filter(e => e.proje_id === selProjeId),
    [ekipler, selProjeId],
  )

  // Auto-select first ekip when project changes
  useEffect(() => {
    setSelEkipId(ekiplerForProje[0]?.id ?? '')
    setSelCell(null)
  }, [selProjeId, ekipler])

  const getSurec = (donem: string): BordroSurec | undefined =>
    surecler.find(s =>
      s.proje_id === selProjeId &&
      (selEkipId ? s.ekip_id === selEkipId : !s.ekip_id) &&
      s.donem === donem,
    )

  // ── Progress ──────────────────────────────────────────────────────────────
  const progress = useMemo(() => {
    let total = 0, done = 0
    for (let mi = 0; mi < 12; mi++) {
      const donem = `${yil}-${pad(mi + 1)}`
      const surec = surecler.find(s =>
        s.proje_id === selProjeId &&
        (selEkipId ? s.ekip_id === selEkipId : !s.ekip_id) &&
        s.donem === donem,
      )
      if (!surec) continue
      for (const a of ADIMLAR) {
        total++
        if ((surec[a.key] as string) === 'tamamlandi') done++
      }
    }
    return { total, done, pct: total ? Math.round((done / total) * 100) : 0 }
  }, [surecler, selProjeId, selEkipId, yil])

  // ── Actions ───────────────────────────────────────────────────────────────
  async function syncSgkIsTakip(fId: string, donem: string) {
    const { data: sureclerRows } = await supabase.from('bordro_surecler').select('*').eq('firma_id', fId).eq('donem', donem)
    if (!sureclerRows || sureclerRows.length === 0) return

    // Eğer o aya ait tüm projelerin Bordro (Tahakkuk) veya Ödeme işlemleri bittiyse tespit et
    const allBordroDone = sureclerRows.every(s => s.bordro_durum === 'tamamlandi')
    const allOdemeDone = sureclerRows.every(s => s.odeme_durum === 'tamamlandi')

    const { data: existing } = await supabase.from('is_takip')
      .select('*').eq('firma_id', fId).eq('tip', 'sgk_proje').eq('donem', donem).maybeSingle()

    const today = new Date().toISOString().split('T')[0]
    const updates: any = {}

    if (allBordroDone) {
      updates.adim1_durum = 'tamamlandi'
      if (!existing?.adim1_tarihi) updates.adim1_tarihi = today
    } else { updates.adim1_durum = 'bekliyor'; updates.adim1_tarihi = null }

    if (allOdemeDone) {
      updates.adim2_durum = 'tamamlandi'
      if (!existing?.adim2_tarihi) updates.adim2_tarihi = today
    } else { updates.adim2_durum = 'bekliyor'; updates.adim2_tarihi = null }

    updates.durum = (updates.adim1_durum === 'tamamlandi' && updates.adim2_durum === 'tamamlandi') ? 'tamamlandi' : 'aktif'

    if (existing) await supabase.from('is_takip').update(updates).eq('id', existing.id)
    else await supabase.from('is_takip').insert({ firma_id: fId, tip: 'sgk_proje', donem, ...updates })
  }

  async function handleCell(adim: keyof BordroSurec, donem: string) {
    if (!selProjeId) return
    let surec = getSurec(donem)
    if (!surec) {
      setSaving(true)
      const { data, error: e } = await supabase
        .from('bordro_surecler')
        .insert({ firma_id: firma.id, proje_id: selProjeId, ekip_id: selEkipId || null, donem })
        .select()
        .single()
      setSaving(false)
      if (e) { alert(e.message); return }
      if (data) {
        surec = data as BordroSurec
        setSurecler(prev => [...prev, surec!])
      }
    }
    setSelCell({ donem, adim })
    setNotVal(surec?.notlar ?? '')
  }

  async function toggleAdim(adim: typeof ADIMLAR[number]) {
    const surec = selCell ? getSurec(selCell.donem) : null
    if (!surec) return
    const cur  = (surec[adim.key] as string)
    const next = cur === 'tamamlandi' ? 'bekliyor' : 'tamamlandi'
    const tarih = next === 'tamamlandi' ? new Date().toISOString().slice(0, 10) : null
    const patch = { [adim.key]: next, [adim.tarihKey]: tarih }
    const { error: e } = await supabase.from('bordro_surecler').update(patch).eq('id', surec.id)
    if (e) { alert(e.message); return }
    setSurecler(prev => prev.map(s => s.id === surec.id ? { ...s, ...patch } : s))

    // SGK İş Takibi (GorevlerV2) ile Senkronizasyon
    if (adim.key === 'bordro_durum' || adim.key === 'odeme_durum') {
      await syncSgkIsTakip(surec.firma_id, surec.donem)
    }
  }

  async function saveNot() {
    const surec = selCell ? getSurec(selCell.donem) : null
    if (!surec) return
    setSaving(true)
    const { error: e } = await supabase
      .from('bordro_surecler').update({ notlar: notVal || null }).eq('id', surec.id)
    setSaving(false)
    if (e) { alert(e.message); return }
    setSurecler(prev => prev.map(s => s.id === surec.id ? { ...s, notlar: notVal || null } : s))
  }

  async function deleteRecord() {
    const surec = selCell ? getSurec(selCell.donem) : null
    if (!surec) return
    setDeleting(true)
    const { error: e } = await supabase.from('bordro_surecler').delete().eq('id', surec.id)
    setDeleting(false)
    if (e) { alert(e.message); return }
    setSurecler(prev => prev.filter(s => s.id !== surec.id))
    setSelCell(null)
  }

  async function uploadFile(event: React.ChangeEvent<HTMLInputElement>) {
    const files = event.target.files
    if (!files?.length || !uploadingItem) return
    const { recordId, cat } = uploadingItem
    setUploading(true)
    for (const file of Array.from(files)) {
      const isPdf      = file.type === 'application/pdf' || /\.pdf$/i.test(file.name)
      const isExcelFile = file.type.includes('sheet') || file.type.includes('excel') || /\.xlsx?$/i.test(file.name)
      if (!isPdf && !isExcelFile) { alert(`${file.name} sadece PDF veya Excel olabilir.`); continue }
      const safeName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
      const path = `bordro/${firma.id}/${recordId}/${cat}/${safeName}`
      const { error: sErr } = await supabase.storage.from('arsiv').upload(path, file, { upsert: false })
      if (sErr) { alert(sErr.message); continue }
      const { data: urlData } = supabase.storage.from('arsiv').getPublicUrl(path)
      const { data: doc, error: dErr } = await supabase.from('dokumanlar').insert({
        firma_id: firma.id,
        yukleyen_id: profil.auth_user_id,
        modul: 'rapor' as const,
        kategori: cat,
        bagli_tablo: 'bordro_surecler',
        bagli_kayit_id: recordId,
        dosya_adi: file.name,
        dosya_url: urlData.publicUrl,
        mime_type: file.type || null,
        dosya_boyutu: file.size || null,
      }).select().single()
      if (dErr) { alert(dErr.message); continue }
      if (doc) {
        const key = `${recordId}_${cat}`
        setDosyaMap(prev => ({ ...prev, [key]: [...(prev[key] || []), doc as Dokuman] }))
      }
    }
    setUploading(false)
    setUploadingItem(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  async function deleteDoc(doc: Dokuman) {
    const { error: e } = await supabase.from('dokumanlar').delete().eq('id', doc.id)
    if (e) { alert(e.message); return }
    const key = `${doc.bagli_kayit_id}_${doc.kategori}`
    setDosyaMap(prev => ({ ...prev, [key]: (prev[key] || []).filter(d => d.id !== doc.id) }))
  }

  if (loading) return <Loading />
  if (error)   return <ErrorMsg message={error} onRetry={load} />

  const selSurec = selCell ? getSurec(selCell.donem) : null
  const selAyIdx = selCell ? Number(selCell.donem.split('-')[1]) - 1 : -1
  const selProje = projeler.find(p => p.id === selProjeId) ?? null
  const selEkip  = ekipler.find(e => e.id === selEkipId) ?? null

  return (
    <div className="space-y-5">
      <input ref={fileRef} type="file" multiple accept={ACCEPTED} className="hidden" onChange={uploadFile} />

      {/* ── Proje Sekmeleri ── */}
      {projeler.length > 0 && (
        <div className="flex gap-1.5 overflow-x-auto pb-0.5" style={{ scrollbarWidth: 'none' }}>
          {projeler.map(p => (
            <button
              key={p.id}
              onClick={() => { setSelProjeId(p.id); setSelEkipId(''); setSelCell(null) }}
              className={[
                'shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors whitespace-nowrap',
                selProjeId === p.id
                  ? 'border-blue-300 bg-blue-50 text-blue-600'
                  : 'border-blue-100 text-slate-500 hover:text-slate-900 hover:border-slate-300',
              ].join(' ')}
            >
              {p.ad}
            </button>
          ))}
        </div>
      )}

      {/* ── Ekip Sekmeleri ── */}
      {selProjeId && ekiplerForProje.length > 0 && (
        <div className="flex gap-1.5 overflow-x-auto pb-0.5" style={{ scrollbarWidth: 'none' }}>
          {ekiplerForProje.map(e => (
            <button
              key={e.id}
              onClick={() => { setSelEkipId(e.id); setSelCell(null) }}
              className={[
                'shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors whitespace-nowrap',
                selEkipId === e.id
                  ? 'border-slate-300 bg-slate-100 text-slate-800'
                  : 'border-blue-100 text-slate-500 hover:text-slate-900 hover:border-slate-300',
              ].join(' ')}
            >
              {e.ad}
            </button>
          ))}
        </div>
      )}

      {/* ── Yıl Navigasyonu ── */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setYil(y => y - 1)}
            className="w-8 h-8 rounded-lg border border-slate-200 grid place-items-center hover:bg-slate-100 transition"
          >
            <ChevronLeft size={14} className="text-slate-600" />
          </button>
          <span className="text-xl font-bold text-slate-800 w-16 text-center tabular-nums">{yil}</span>
          <button
            onClick={() => setYil(y => y + 1)}
            className="w-8 h-8 rounded-lg border border-slate-200 grid place-items-center hover:bg-slate-100 transition"
          >
            <ChevronRight size={14} className="text-slate-600" />
          </button>
          {yil !== targetYil && (
            <button
              onClick={() => setYil(targetYil)}
              className="text-xs text-blue-500 hover:text-slate-900 transition px-2 py-1 rounded-lg hover:bg-blue-50"
            >
              Bu Dönem
            </button>
          )}
        </div>

        {progress.total > 0 && (
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-500">
              {progress.done}/{progress.total} adım
            </span>
            <div className="w-28 h-1.5 rounded-full bg-slate-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-emerald-400 transition-[width] duration-500"
                style={{ width: `${progress.pct}%` }}
              />
            </div>
            <span className="text-xs font-bold text-emerald-300 w-8 tabular-nums">{progress.pct}%</span>
          </div>
        )}
      </div>

      {/* ── Bordro Matrisi ── */}
      {!selProjeId ? (
        <div className={`${cls.card} p-8 text-center`}>
          <p className="text-sm text-slate-500">Bir proje seçin</p>
        </div>
      ) : (
        <div className={`${cls.card} overflow-hidden`}>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse" style={{ minWidth: 800 }}>
              <colgroup>
                <col style={{ width: 172 }} />
                {Array.from({ length: 12 }, (_, i) => <col key={i} style={{ width: 52 }} />)}
              </colgroup>
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="sticky left-0 z-10 bg-slate-50 text-left px-4 py-2">
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                      Adım
                    </span>
                  </th>
                  {AYLAR.map((ay, i) => (
                    <th
                      key={i}
                      className={[
                        'text-center py-2 text-[11px] font-semibold',
                        i === targetAy && yil === targetYil
                          ? 'text-blue-600'
                          : 'text-slate-400',
                      ].join(' ')}
                    >
                      {ay}
                      {i === targetAy && yil === targetYil && (
                        <div className="w-1 h-1 rounded-full bg-blue-500 mx-auto mt-0.5" title="İşlem Ayı (Önceki Ay)" />
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <SectionRow label={`${selProje?.ad ?? ''}${selEkip ? ` · ${selEkip.ad}` : ' · Proje Geneli'}`} />
                {ADIMLAR.map((adim, ri, arr) => {
                  const ac = ACCENT[adim.accent]
                  return (
                    <tr
                      key={String(adim.key)}
                      className={[
                        'transition-colors hover:bg-slate-50',
                        ri < arr.length - 1 ? 'border-b border-slate-100' : '',
                      ].join(' ')}
                    >
                      <td className="sticky left-0 z-10 bg-slate-50 px-4 py-1">
                        <div className="flex items-center gap-2">
                          <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${ac.dot}`} />
                          <span className={`text-xs font-semibold ${ac.text}`}>{adim.label}</span>
                        </div>
                      </td>
                      {Array.from({ length: 12 }, (_, mi) => {
                        const donem = `${yil}-${pad(mi + 1)}`
                        const surec = getSurec(donem)
                        return (
                          <td key={mi} className="px-1 py-1">
                            <BordroCell
                              status={getCellStatus(surec, adim.key)}
                              isActive={selCell?.adim === adim.key && selCell.donem === donem}
                              isCurrent={yil === targetYil && mi === targetAy}
                              disabled={saving}
                              onClick={() => handleCell(adim.key, donem)}
                            />
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Gösterge */}
          <div className="border-t border-slate-100 px-4 py-2.5 flex items-center gap-5 flex-wrap">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 size={12} className="text-emerald-400" />
              <span className="text-[11px] text-slate-500">Tamamlandı</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full border-2 border-amber-400 bg-amber-400/25" />
              <span className="text-[11px] text-slate-500">Dönem açık, adım bekliyor</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full border border-slate-200" />
              <span className="text-[11px] text-slate-500">Kayıt yok — tıkla başlat</span>
            </div>
          </div>
        </div>
      )}

      {/* ── IK Personel Paneli ── */}
      {selProjeId && (
        <div className={cls.card}>
          <button
            onClick={() => setShowPersonel(v => !v)}
            className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition"
          >
            <div className="flex items-center gap-2">
              <Users size={14} className="text-blue-500" />
              <span className="text-sm font-semibold text-slate-800">
                {selEkipId
                  ? `${ekipler.find(e => e.id === selEkipId)?.ad ?? 'Ekip'} — Personel`
                  : 'Proje Personeli'}
              </span>
              {(() => {
                const liste = selEkipId
                  ? ikPersoneller.filter(p => p.ekip_id === selEkipId)
                  : ikPersoneller.filter(p => p.proje_id === selProjeId)
                const aktif = liste.filter(p => p.durum === 'aktif').length
                return (
                  <span className="text-[11px] text-slate-500">
                    {aktif} aktif · {liste.length - aktif} ayrılan
                  </span>
                )
              })()}
            </div>
            <ChevronRight size={14} className={`text-slate-500 transition-transform ${showPersonel ? 'rotate-90' : ''}`} />
          </button>

          {showPersonel && (() => {
            const liste = selEkipId
              ? ikPersoneller.filter(p => p.ekip_id === selEkipId)
              : ikPersoneller.filter(p => p.proje_id === selProjeId)

            if (liste.length === 0) {
              return (
                <div className="px-4 pb-4 pt-1 text-sm text-slate-400 italic">
                  {selEkipId
                    ? 'Bu ekipte IK kaydı olan personel yok. IK modülünden personele ekip atayın.'
                    : 'Bu projeye bağlı IK personel kaydı yok.'}
                </div>
              )
            }

            const aktifler  = liste.filter(p => p.durum === 'aktif')
            const ayrilanlar = liste.filter(p => p.durum === 'ayrildi')

            return (
              <div className="border-t border-slate-100 px-4 pb-4 pt-3 space-y-4">
                {aktifler.length > 0 && (
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-400/60 mb-2">Aktif ({aktifler.length})</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                      {aktifler.map(p => <IkPersonelKart key={p.id} personel={p} />)}
                    </div>
                  </div>
                )}
                {ayrilanlar.length > 0 && (
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-rose-400/60 mb-2">Ayrılanlar ({ayrilanlar.length})</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                      {ayrilanlar.map(p => <IkPersonelKart key={p.id} personel={p} />)}
                    </div>
                  </div>
                )}
              </div>
            )
          })()}
        </div>
      )}

      {/* ── Detay Paneli ── */}
      {selCell && selSurec !== undefined && (
        <div className={`${cls.card} p-5`}>
          <div className="flex items-start justify-between gap-4 mb-5">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-xs text-slate-400">
                  {selProje?.ad ?? ''}{selEkip ? ` · ${selEkip.ad}` : ''}
                </span>
              </div>
              <p className="text-lg font-bold text-slate-800 leading-tight">
                {selAyIdx >= 0 ? AYLAR_TAM[selAyIdx] : ''} {yil}
              </p>
              <p className="text-xs text-slate-500 mt-1">5 adımlık bordro süreci</p>
            </div>
            <button
              onClick={() => setSelCell(null)}
              className="p-1.5 rounded-lg hover:bg-slate-100 transition shrink-0"
            >
              <X size={14} className="text-slate-500" />
            </button>
          </div>

          {selSurec ? (
            <div className="space-y-4">
              {/* 5 Adım Toggleları */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {ADIMLAR.map(adim => {
                  const done  = (selSurec[adim.key] as string) === 'tamamlandi'
                  const tarih = selSurec[adim.tarihKey] as string | null
                  const ac    = ACCENT[adim.accent]
                  return (
                    <button
                      key={String(adim.key)}
                      onClick={() => toggleAdim(adim)}
                      className={[
                        'flex items-center gap-3 px-4 py-3 rounded-xl border text-sm font-semibold transition-all text-left',
                        done
                          ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-200 hover:bg-emerald-500/14'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-300 hover:text-slate-900',
                      ].join(' ')}
                    >
                      <div className={[
                        'w-5 h-5 rounded-full border-2 grid place-items-center shrink-0',
                        done ? 'border-emerald-400 bg-emerald-400/15' : `border-current opacity-40`,
                      ].join(' ')}>
                        {done && <div className="w-2 h-2 rounded-full bg-emerald-400" />}
                        {!done && <div className={`w-1.5 h-1.5 rounded-full ${ac.dot} opacity-60`} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className={done ? '' : ac.text}>{adim.label}</div>
                        {done && tarih && (
                          <div className="text-[11px] text-emerald-300/55 font-normal mt-0.5">{tarih}</div>
                        )}
                      </div>
                      {done && <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />}
                    </button>
                  )
                })}
              </div>

              {/* ── Dosyalar ── */}
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2">Dosyalar (PDF / Excel)</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {DOC_ADIMLAR.map(cat => {
                    const docs = selSurec ? (dosyaMap[`${selSurec.id}_${cat}`] || []) : []
                    return (
                      <div key={cat} className="rounded-xl border border-slate-100 bg-slate-50 p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-semibold text-slate-500">{DOC_ADIM_LABELS[cat]}</span>
                          <button
                            onClick={() => { setUploadingItem({ recordId: selSurec!.id, cat }); fileRef.current?.click() }}
                            disabled={uploading || !selSurec}
                            className="w-6 h-6 rounded-md flex items-center justify-center bg-blue-50 hover:bg-blue-100 transition disabled:opacity-40"
                          >
                            {uploading && uploadingItem?.cat === cat
                              ? <div className="w-3 h-3 rounded-full border-2 border-blue-400 border-t-transparent animate-spin" />
                              : <Plus size={11} className="text-blue-600" />
                            }
                          </button>
                        </div>
                        {docs.length === 0
                          ? <p className="text-[10px] text-slate-400 italic">Dosya yükle</p>
                          : <div className="space-y-1.5">
                              {docs.map(doc => (
                                <div key={doc.id} className="flex items-center gap-1.5 group/doc">
                                  {isExcel(doc)
                                    ? <FileSpreadsheet size={10} className="text-emerald-400 shrink-0" />
                                    : <FileText        size={10} className="text-rose-400    shrink-0" />
                                  }
                                  <a href={doc.dosya_url} target="_blank" rel="noreferrer"
                                    className="flex-1 min-w-0 text-[10px] text-blue-500 hover:text-slate-900 truncate transition">
                                    {doc.dosya_adi}
                                  </a>
                                  <span className="text-[9px] text-slate-400 shrink-0">
                                    {isExcel(doc) ? 'Excel' : 'PDF'}
                                  </span>
                                  <button onClick={() => deleteDoc(doc)}
                                    className="shrink-0 opacity-0 group-hover/doc:opacity-100 text-rose-400/50 hover:text-rose-400 transition">
                                    <X size={10} />
                                  </button>
                                </div>
                              ))}
                            </div>
                        }
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Notlar */}
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                  Notlar
                </label>
                <textarea
                  className={`${cls.input} min-h-[72px]`}
                  placeholder="Bu dönem için not ekleyin..."
                  value={notVal}
                  onChange={e => setNotVal(e.target.value)}
                />
              </div>

              {/* Aksiyonlar */}
              <div className="flex items-center justify-between">
                <button
                  onClick={deleteRecord}
                  disabled={deleting}
                  className="flex items-center gap-1.5 text-xs text-rose-400/55 hover:text-rose-400 transition-colors px-2 py-1.5 rounded-lg hover:bg-rose-500/8 disabled:opacity-40"
                >
                  <Trash2 size={12} />
                  {deleting ? 'Siliniyor...' : 'Dönem Kaydını Sil'}
                </button>
                <button onClick={saveNot} disabled={saving} className={cls.btnSecondary}>
                  {saving ? 'Kaydediliyor...' : 'Notu Kaydet'}
                </button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-500 py-2">Kayıt yükleniyor...</p>
          )}
        </div>
      )}
    </div>
  )
}

// ── IK Personel Kart (Bordro içi) ───────────────────────────────────────────
function IkPersonelKart({ personel: p }: { personel: IkPersonel }) {
  const dateFmt = (d?: string | null) =>
    d ? new Date(d + 'T00:00:00').toLocaleDateString('tr-TR') : '—'

  return (
    <div className="flex items-center gap-2.5 bg-white border border-slate-100 rounded-xl px-3 py-2">
      <div className={`w-7 h-7 rounded-lg grid place-items-center shrink-0 ${p.durum === 'aktif' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
        {p.durum === 'aktif' ? <UserCheck size={13} /> : <UserMinus size={13} />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-slate-800 truncate">{p.ad_soyad}</p>
        <div className="flex items-center gap-2 flex-wrap">
          {p.gorev && <span className="text-[10px] text-slate-500 truncate">{p.gorev}</span>}
          <span className="text-[10px] text-slate-400">
            {p.durum === 'aktif' ? `Giriş: ${dateFmt(p.ise_giris_tarihi)}` : `Çıkış: ${dateFmt(p.isten_cikis_tarihi)}`}
          </span>
        </div>
      </div>
    </div>
  )
}

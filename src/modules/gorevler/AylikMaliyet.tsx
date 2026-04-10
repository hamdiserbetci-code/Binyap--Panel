'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, CheckCircle2, FileSpreadsheet, FileText, Plus, X, Trash2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { ErrorMsg, Loading } from '@/components/ui'
import type { AppCtx } from '@/app/page'
import type { Dokuman, MaliyetSureci as MaliyetSureciBase } from '@/types'

// ── Types ──────────────────────────────────────────────────────────────────
interface MaliyetSureci extends MaliyetSureciBase {
  musteri_id?: string | null
}

// ── Config ─────────────────────────────────────────────────────────────────
const RAPOR_TIPLERI = [
  { key: 'efatura', label: 'E-Fatura Alış Raporu',     accent: 'blue'    },
  { key: 'earsiv',  label: 'E-Arşiv Fatura Raporu',    accent: 'emerald' },
  { key: 'utts',    label: 'UTTS Alış Raporu',          accent: 'amber'   },
  { key: 'bordro',  label: 'Aylık Bordro İcmal Raporu', accent: 'violet'  },
  { key: 'satis',   label: 'Aylık Satış Raporu',        accent: 'rose'    },
] as const

type RaporKey = (typeof RAPOR_TIPLERI)[number]['key']

const AYLAR     = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara']
const AYLAR_TAM = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık']

const ACCENT: Record<string, { dot: string; text: string; bg: string }> = {
  blue:    { dot: 'bg-blue-400',    text: 'text-blue-600',    bg: 'bg-blue-50'    },
  emerald: { dot: 'bg-emerald-400', text: 'text-emerald-600', bg: 'bg-emerald-50' },
  amber:   { dot: 'bg-amber-400',   text: 'text-amber-600',   bg: 'bg-amber-50'   },
  violet:  { dot: 'bg-violet-400',  text: 'text-violet-600',  bg: 'bg-violet-50'  },
  rose:    { dot: 'bg-rose-400',    text: 'text-rose-600',    bg: 'bg-rose-50'    },
}

const ACCEPTED = '.xlsx,.xls,.pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,application/pdf'

// ── Helpers ─────────────────────────────────────────────────────────────────
const pad = (n: number) => String(n).padStart(2, '0')

function getCellStatus(surec: MaliyetSureci | undefined, rapor: RaporKey): 'none' | 'partial' | 'done' {
  if (!surec) return 'none'
  const kontrol = Boolean(surec[`${rapor}_kontrol` as keyof MaliyetSureci])
  const luca    = Boolean(surec[`${rapor}_luca`    as keyof MaliyetSureci])
  if (kontrol && luca) return 'done'
  if (kontrol || luca) return 'partial'
  return 'none'
}

function isExcel(doc: Dokuman) {
  return doc.mime_type?.includes('sheet') || doc.mime_type?.includes('excel') || /\.xlsx?$/i.test(doc.dosya_adi)
}

// ── MaliyetCell ──────────────────────────────────────────────────────────────
function MaliyetCell({ status, isActive, isCurrent, disabled, onClick }: {
  status: 'none' | 'partial' | 'done'
  isActive: boolean; isCurrent: boolean; disabled: boolean; onClick: () => void
}) {
  return (
    <button onClick={onClick} disabled={disabled}
      className={['group w-full h-7 rounded-md border transition-all flex items-center justify-center select-none',
        isActive
          ? 'ring-2 ring-blue-400/50 border-blue-400 bg-blue-50'
          : status === 'done'    ? 'border-emerald-300 bg-emerald-50 hover:bg-emerald-100'
          : status === 'partial' ? 'border-amber-300 bg-amber-50 hover:bg-amber-100'
          : isCurrent            ? 'border-blue-200 bg-blue-50/50 hover:bg-blue-50'
          :                        'border-slate-200 hover:border-slate-300 hover:bg-slate-50',
      ].join(' ')}
    >
      {status === 'done'    && <CheckCircle2 size={13} className="text-emerald-500 pointer-events-none" />}
      {status === 'partial' && <div className="w-3 h-3 rounded-full border-2 border-amber-400 bg-amber-100 pointer-events-none" />}
      {status === 'none'    && <Plus size={11} className="text-transparent group-hover:text-slate-400 transition-colors pointer-events-none" />}
    </button>
  )
}

// ── Main Component ──────────────────────────────────────────────────────────
export default function AylikMaliyet({
  firma, firmalar, firmaIds, profil,
}: AppCtx) {
  const todayYil = new Date().getFullYear()
  const todayAy  = new Date().getMonth()
  let targetAy = todayAy - 1; let targetYil = todayYil;
  if (targetAy < 0) { targetAy = 11; targetYil--; }

  const [yil, setYil]           = useState(targetYil)
  const [selFirmaId, setSelFirmaId] = useState(firma.id)
  const [surecler, setSurecler] = useState<MaliyetSureci[]>([])
  const [dosyaMap, setDosyaMap] = useState<Record<string, Dokuman[]>>({})
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState('')
  const [selCell, setSelCell]   = useState<{ donem: string; rapor: RaporKey } | null>(null)
  const [notVal, setNotVal]     = useState('')
  const [saving, setSaving]     = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [uploading, setUploading]   = useState(false)
  const [uploadingItem, setUploadingItem] = useState<{ recordId: string; raporKey: RaporKey } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => { void load() }, [firmaIds.join(',')])

  async function load() {
    setLoading(true); setError('')
    const [{ data: s, error: se }, { data: docs, error: de }] = await Promise.all([
      supabase.from('maliyet_surecler').select('*').in('firma_id', firmaIds),
      supabase.from('dokumanlar').select('*').in('firma_id', firmaIds).eq('bagli_tablo', 'maliyet_surecler'),
    ])
    if (se || de) { setError(se?.message || de?.message || 'Veri hatası'); setLoading(false); return }
    setSurecler((s || []) as MaliyetSureci[])
    const map: Record<string, Dokuman[]> = {}
    ;(docs || []).forEach(doc => {
      const key = `${doc.bagli_kayit_id}_${doc.kategori}`
      if (!map[key]) map[key] = []
      map[key].push(doc as Dokuman)
    })
    setDosyaMap(map)
    setLoading(false)
  }

  const getSurec = (donem: string): MaliyetSureci | undefined =>
    surecler.find(s => s.firma_id === selFirmaId && s.donem === donem)

  const progress = useMemo(() => {
    let total = 0, done = 0
    for (let m = 0; m < 12; m++) {
      const donem = `${yil}-${pad(m + 1)}`
      const surec = surecler.find(s => s.firma_id === selFirmaId && s.donem === donem)
      if (!surec) continue
      for (const r of RAPOR_TIPLERI) { total++; if (getCellStatus(surec, r.key) === 'done') done++ }
    }
    return { total, done, pct: total ? Math.round((done / total) * 100) : 0 }
  }, [surecler, yil])

  async function handleCell(rapor: RaporKey, donem: string) {
    let surec = getSurec(donem)
    if (!surec) {
      setSaving(true)
      const { data, error: e } = await supabase
        .from('maliyet_surecler')
        .insert({ firma_id: selFirmaId, donem })
        .select().single()
      setSaving(false)
      if (e) { alert(e.message); return }
      if (data) { surec = data as MaliyetSureci; setSurecler(prev => [...prev, surec!]) }
    }
    setSelCell({ donem, rapor })
    setNotVal(surec?.notlar ?? '')
  }

  async function toggleField(field: keyof MaliyetSureci) {
    const surec = selCell ? getSurec(selCell.donem) : null
    if (!surec) return
    const nextVal = !Boolean(surec[field])
    const { error: e } = await supabase.from('maliyet_surecler').update({ [field]: nextVal }).eq('id', surec.id)
    if (e) { alert(e.message); return }
    setSurecler(prev => prev.map(s => s.id === surec.id ? { ...s, [field]: nextVal } : s))
  }

  async function saveNot() {
    const surec = selCell ? getSurec(selCell.donem) : null
    if (!surec) return
    setSaving(true)
    const { error: e } = await supabase.from('maliyet_surecler').update({ notlar: notVal || null }).eq('id', surec.id)
    setSaving(false)
    if (e) { alert(e.message); return }
    setSurecler(prev => prev.map(s => s.id === surec.id ? { ...s, notlar: notVal || null } : s))
  }

  async function deleteRecord() {
    const surec = selCell ? getSurec(selCell.donem) : null
    if (!surec) return
    setDeleting(true)
    const { error: e } = await supabase.from('maliyet_surecler').delete().eq('id', surec.id)
    setDeleting(false)
    if (e) { alert(e.message); return }
    setSurecler(prev => prev.filter(s => s.id !== surec.id))
    setSelCell(null)
  }

  async function uploadFile(event: React.ChangeEvent<HTMLInputElement>) {
    const files = event.target.files
    if (!files?.length || !uploadingItem) return
    const { recordId, raporKey } = uploadingItem
    setUploading(true)
    for (const file of Array.from(files)) {
      const isPdf   = file.type === 'application/pdf' || /\.pdf$/i.test(file.name)
      const isExcelFile = file.type.includes('sheet') || file.type.includes('excel') || /\.xlsx?$/i.test(file.name)
      if (!isPdf && !isExcelFile) { alert(`${file.name} sadece PDF veya Excel olabilir.`); continue }
      const safeName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
      const path = `maliyetler/${selFirmaId}/${recordId}/${raporKey}/${safeName}`
      const { error: sErr } = await supabase.storage.from('dokumanlar').upload(path, file, { upsert: false })
      if (sErr) { alert(sErr.message); continue }
      const { data: urlData } = supabase.storage.from('dokumanlar').getPublicUrl(path)
      const { data: doc, error: dErr } = await supabase.from('dokumanlar').insert({
        firma_id: selFirmaId,
        yukleyen_id: profil.auth_user_id,
        modul: 'rapor' as const,
        kategori: raporKey,
        bagli_tablo: 'maliyet_surecler',
        bagli_kayit_id: recordId,
        dosya_adi: file.name,
        dosya_url: urlData.publicUrl,
        mime_type: file.type || null,
        dosya_boyutu: file.size || null,
      }).select().single()
      if (dErr) { alert(dErr.message); continue }
      if (doc) {
        const key = `${recordId}_${raporKey}`
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
  const selRapor = selCell ? RAPOR_TIPLERI.find(r => r.key === selCell.rapor) ?? null : null
  const selAyIdx = selCell ? Number(selCell.donem.split('-')[1]) - 1 : -1
  const selYil   = selCell ? selCell.donem.split('-')[0] : yil

  return (
    <div className="space-y-5">
      <input ref={fileRef} type="file" multiple accept={ACCEPTED} className="hidden" onChange={uploadFile} />

      {/* ── Yıl Navigasyonu ── */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          {firmalar.length > 1 && (
            <select
              className="bg-white border border-slate-200 text-slate-700 text-xs rounded-lg px-2 py-1.5 outline-none focus:border-blue-400 shadow-sm mr-2"
              value={selFirmaId}
              onChange={e => setSelFirmaId(e.target.value)}
            >
              {firmalar.map(f => <option key={f.id} value={f.id}>{f.kisa_ad || f.ad}</option>)}
            </select>
          )}
          <button onClick={() => setYil(y => y - 1)} className="w-8 h-8 rounded-lg border border-slate-200 bg-white grid place-items-center hover:bg-slate-50 transition shadow-sm">
            <ChevronLeft size={14} className="text-slate-600" />
          </button>
          <span className="text-xl font-bold text-slate-800 w-16 text-center tabular-nums">{yil}</span>
          <button onClick={() => setYil(y => y + 1)} className="w-8 h-8 rounded-lg border border-slate-200 bg-white grid place-items-center hover:bg-slate-50 transition shadow-sm">
            <ChevronRight size={14} className="text-slate-600" />
          </button>
          {yil !== targetYil && (
            <button onClick={() => setYil(targetYil)} className="text-xs text-blue-600 hover:text-blue-800 transition px-2 py-1 rounded-lg hover:bg-blue-50 border border-blue-100">
              Bu Dönem
            </button>
          )}
        </div>
        {progress.total > 0 && (
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-500">{progress.done}/{progress.total} rapor</span>
            <div className="w-28 h-2 rounded-full bg-slate-200 overflow-hidden">
              <div className="h-full rounded-full bg-emerald-400 transition-[width] duration-500" style={{ width: `${progress.pct}%` }} />
            </div>
            <span className="text-xs font-bold text-emerald-600 w-8 tabular-nums">{progress.pct}%</span>
          </div>
        )}
      </div>

      {/* ── Maliyet Matrisi ── */}
      <div className="rounded-xl border border-blue-100 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse" style={{ minWidth: 800 }}>
            <colgroup>
              <col style={{ width: 172 }} />
              {Array.from({ length: 12 }, (_, i) => <col key={i} style={{ width: 52 }} />)}
            </colgroup>
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="sticky left-0 z-10 bg-slate-50 text-left px-4 py-2.5">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Rapor Tipi</span>
                </th>
                {AYLAR.map((ay, i) => (
                  <th key={i} className={['text-center py-2.5 text-[11px] font-semibold', i === targetAy && yil === targetYil ? 'text-blue-600' : 'text-slate-400'].join(' ')}>
                    {ay}
                    {i === targetAy && yil === targetYil && <div className="w-1 h-1 rounded-full bg-blue-500 mx-auto mt-0.5" title="İşlem Ayı (Önceki Ay)" />}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {RAPOR_TIPLERI.map((rapor, ri, arr) => {
                const ac = ACCENT[rapor.accent]
                return (
                  <tr key={rapor.key} className={['transition-colors hover:bg-slate-50/80', ri < arr.length - 1 ? 'border-b border-slate-100' : ''].join(' ')}>
                    <td className="sticky left-0 z-10 bg-white px-4 py-1.5">
                      <div className="flex items-center gap-2">
                        <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${ac.dot}`} />
                        <span className={`text-xs font-semibold ${ac.text}`}>{rapor.label}</span>
                      </div>
                    </td>
                    {Array.from({ length: 12 }, (_, mi) => {
                      const donem = `${yil}-${pad(mi + 1)}`
                      const surec = getSurec(donem)
                      return (
                        <td key={mi} className="px-1 py-1">
                          <MaliyetCell
                            status={getCellStatus(surec, rapor.key)}
                            isActive={selCell?.rapor === rapor.key && selCell.donem === donem}
                            isCurrent={yil === targetYil && mi === targetAy}
                            disabled={saving}
                            onClick={() => handleCell(rapor.key, donem)}
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
        <div className="border-t border-slate-100 bg-slate-50 px-4 py-2.5 flex items-center gap-5 flex-wrap">
          <div className="flex items-center gap-1.5"><CheckCircle2 size={12} className="text-emerald-500" /><span className="text-[11px] text-slate-500">Tamamlandı (Kontrol + Luca)</span></div>
          <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full border-2 border-amber-400 bg-amber-100" /><span className="text-[11px] text-slate-500">Devam Ediyor</span></div>
          <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full border border-slate-300" /><span className="text-[11px] text-slate-500">Kayıt Yok — tıkla başlat</span></div>
        </div>
      </div>

      {/* ── Detay Paneli ── */}
      {selCell && selRapor && (
        <div className="rounded-xl border border-blue-100 bg-white shadow-sm p-5">
          <div className="flex items-start justify-between gap-4 mb-5">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <div className={`w-2 h-2 rounded-full ${ACCENT[selRapor.accent].dot}`} />
                <span className={`text-xs font-bold uppercase tracking-wider ${ACCENT[selRapor.accent].text}`}>{selRapor.label}</span>
              </div>
              <p className="text-lg font-bold text-slate-800 leading-tight">{selAyIdx >= 0 ? AYLAR_TAM[selAyIdx] : ''} {selYil}</p>
            </div>
            <button onClick={() => setSelCell(null)} className="p-1.5 rounded-lg hover:bg-slate-100 transition shrink-0">
              <X size={14} className="text-slate-400" />
            </button>
          </div>

          {selSurec ? (
            <div className="space-y-5">
              {/* Kontrol + Luca Adımları */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {([
                  { field: `${selCell.rapor}_kontrol` as keyof MaliyetSureci, label: 'Kontrol Edildi'    },
                  { field: `${selCell.rapor}_luca`    as keyof MaliyetSureci, label: "Luca'ya Yüklendi" },
                ]).map(({ field, label }) => {
                  const done = Boolean(selSurec[field])
                  return (
                    <button key={String(field)} onClick={() => toggleField(field)}
                      className={['flex items-center gap-3 px-4 py-3.5 rounded-xl border text-sm font-semibold transition-all text-left',
                        done ? 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'
                             : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-300 hover:text-slate-800',
                      ].join(' ')}
                    >
                      <div className={['w-6 h-6 rounded-full border-2 grid place-items-center shrink-0', done ? 'border-emerald-400 bg-emerald-100' : 'border-slate-300'].join(' ')}>
                        {done && <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />}
                      </div>
                      <div className="flex-1 min-w-0">{label}</div>
                      {done && <CheckCircle2 size={15} className="text-emerald-500 shrink-0" />}
                    </button>
                  )
                })}
              </div>

              {/* ── Dosyalar ── */}
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2">Dosyalar (PDF / Excel)</p>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-slate-500">{selRapor.label}</span>
                    <button
                      onClick={() => { setUploadingItem({ recordId: selSurec.id, raporKey: selCell.rapor }); fileRef.current?.click() }}
                      disabled={uploading}
                      className="flex items-center gap-1 text-[10px] font-semibold text-blue-600 hover:text-blue-800 transition disabled:opacity-40"
                    >
                      {uploading && uploadingItem?.raporKey === selCell.rapor
                        ? <div className="w-3 h-3 rounded-full border-2 border-blue-400 border-t-transparent animate-spin" />
                        : <Plus size={11} />
                      }
                      Dosya Ekle
                    </button>
                  </div>

                  {(() => {
                    const docs = dosyaMap[`${selSurec.id}_${selCell.rapor}`] || []
                    if (docs.length === 0) return (
                      <p className="text-[10px] text-slate-400 italic">Henüz dosya yüklenmedi</p>
                    )
                    return (
                      <div className="space-y-1.5">
                        {docs.map(doc => (
                          <div key={doc.id} className="flex items-center gap-2 group/doc">
                            {isExcel(doc)
                              ? <FileSpreadsheet size={11} className="text-emerald-500 shrink-0" />
                              : <FileText        size={11} className="text-rose-500    shrink-0" />
                            }
                            <a href={doc.dosya_url} target="_blank" rel="noreferrer"
                              className="flex-1 min-w-0 text-[11px] text-blue-600 hover:text-blue-800 truncate transition">
                              {doc.dosya_adi}
                            </a>
                            <span className="text-[9px] text-slate-400 shrink-0">
                              {isExcel(doc) ? 'Excel' : 'PDF'}
                            </span>
                            <button onClick={() => deleteDoc(doc)}
                              className="shrink-0 opacity-0 group-hover/doc:opacity-100 text-rose-400 hover:text-rose-600 transition">
                              <X size={11} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )
                  })()}
                </div>
              </div>

              {/* Notlar */}
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Notlar</label>
                <textarea
                  className="w-full rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400/20 transition-all resize-none min-h-[72px]"
                  placeholder="Bu dönem için not ekleyin..." value={notVal} onChange={e => setNotVal(e.target.value)} />
              </div>

              {/* Aksiyonlar */}
              <div className="flex items-center justify-between">
                <button onClick={deleteRecord} disabled={deleting}
                  className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-600 transition-colors px-2 py-1.5 rounded-lg hover:bg-red-50 disabled:opacity-40">
                  <Trash2 size={12} />
                  {deleting ? 'Siliniyor...' : 'Dönem Kaydını Sil'}
                </button>
                <button onClick={saveNot} disabled={saving}
                  className="flex items-center justify-center gap-1.5 bg-white hover:bg-slate-50 text-slate-700 px-3.5 py-1.5 rounded-lg text-sm font-semibold transition-all border border-slate-200">
                  {saving ? 'Kaydediliyor...' : 'Notu Kaydet'}
                </button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-400 py-2">Kayıt yükleniyor...</p>
          )}
        </div>
      )}
    </div>
  )
}

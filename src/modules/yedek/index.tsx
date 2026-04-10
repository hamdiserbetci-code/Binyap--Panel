'use client'

import { useState } from 'react'
import {
  HardDrive, Download, FileSpreadsheet, CheckCircle2,
  AlertCircle, Loader2, Database, RefreshCw,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { AppCtx } from '@/app/page'

// ── Yedeklenecek tablolar ─────────────────────────────────────────────────────
const TABLES = [
  { key: 'projeler',         label: 'Projeler',           group: 'Yönetim' },
  { key: 'gorevler',         label: 'Periyodik İşler',    group: 'Yönetim' },
  { key: 'ekipler',          label: 'Ekipler',            group: 'Yönetim' },
  { key: 'kasa_hareketleri', label: 'Kasa Hareketleri',  group: 'Finans'  },
  { key: 'cekler',           label: 'Çek Takibi',        group: 'Finans'  },
  { key: 'odeme_plani',      label: 'Ödeme Planı',       group: 'Finans'  },
  { key: 'kar_zarar_donem',  label: 'Kar / Zarar',        group: 'Finans'  },
  { key: 'bordro_surecler',  label: 'Bordro Süreçleri',  group: 'Bordro'  },
  { key: 'bordro_dosyalar',  label: 'Bordro Dosyaları',  group: 'Bordro'  },
] as const
type TableKey = typeof TABLES[number]['key']

type TableStatus = {
  count: number
  status: 'idle' | 'loading' | 'done' | 'error'
  error?: string
}

function cleanTr(text: string) {
  return String(text ?? '')
    .replace(/İ/g, 'I').replace(/ı/g, 'i')
    .replace(/Ş/g, 'S').replace(/ş/g, 's')
    .replace(/Ğ/g, 'G').replace(/ğ/g, 'g')
    .replace(/Ü/g, 'U').replace(/ü/g, 'u')
    .replace(/Ö/g, 'O').replace(/ö/g, 'o')
    .replace(/Ç/g, 'C').replace(/ç/g, 'c')
}

export default function YedekModule({ firma, firmaIds }: AppCtx) {
  const [statuses, setStatuses] = useState<Record<string, TableStatus>>({})
  const [selected, setSelected] = useState<Set<TableKey>>(
    new Set(TABLES.map(t => t.key))
  )
  const [running, setRunning]   = useState(false)
  const [lastBackup, setLastBackup] = useState<string | null>(null)

  function setStatus(key: string, patch: Partial<TableStatus>) {
    setStatuses(prev => ({
      ...prev,
      [key]: { ...{ count: 0, status: 'idle' as const }, ...prev[key], ...patch },
    }))
  }

  function toggleAll(checked: boolean) {
    setSelected(checked ? new Set(TABLES.map(t => t.key)) : new Set())
  }

  function toggle(key: TableKey) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  async function fetchTable(key: string): Promise<{ key: string; rows: any[] }> {
    const { data, error } = await supabase
      .from(key as any)
      .select('*')
      .in('firma_id', firmaIds)
      .order('created_at', { ascending: true })

    if (error) throw new Error(error.message)
    return { key, rows: data || [] }
  }

  async function runBackup(format: 'json' | 'excel') {
    if (selected.size === 0) return
    setRunning(true)

    const targets = TABLES.filter(t => selected.has(t.key))
    const results: Record<string, any[]> = {}

    // Paralel fetch — tablo tablo durum güncelle
    await Promise.all(
      targets.map(async (t) => {
        setStatus(t.key, { status: 'loading' })
        try {
          const { rows } = await fetchTable(t.key)
          results[t.key] = rows
          setStatus(t.key, { status: 'done', count: rows.length })
        } catch (e: any) {
          setStatus(t.key, { status: 'error', error: e.message })
          results[t.key] = []
        }
      })
    )

    const ts = new Date().toISOString().slice(0, 16).replace('T', '_').replace(':', '-')
    const fileName = `Yedek_${cleanTr(firma.ad || 'Firma')}_${ts}`

    if (format === 'json') {
      const payload = {
        meta: {
          firma_id:   firma.id,
          firma_ad:   firma.ad,
          tarih:      new Date().toISOString(),
          tablolar:   Object.keys(results),
          versiyon:   '1.0',
        },
        data: results,
      }
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = `${fileName}.json`
      a.click()
      URL.revokeObjectURL(url)
    }

    if (format === 'excel') {
      const XLSX = await import('xlsx-js-style')
      const wb   = XLSX.utils.book_new()

      // ── Özet sayfası ─────────────────────────────────────────────────────
      type S = Record<string, any>
      const sc = (v: any, t: string, s: S = {}) => ({ v, t, s })
      const border = () => ({
        top:    { style: 'thin', color: { rgb: 'E2E8F0' } },
        bottom: { style: 'thin', color: { rgb: 'E2E8F0' } },
        left:   { style: 'thin', color: { rgb: 'E2E8F0' } },
        right:  { style: 'thin', color: { rgb: 'E2E8F0' } },
      })

      const hdr = (v: string): S => sc(v, 's', {
        font:      { bold: true, sz: 14, color: { rgb: 'FFFFFF' }, name: 'Calibri' },
        fill:      { fgColor: { rgb: '0F172A' } },
        alignment: { horizontal: 'center', vertical: 'center' },
      })
      const sub = (v: string): S => sc(v, 's', {
        font:      { sz: 10, color: { rgb: '94A3B8' }, name: 'Calibri' },
        fill:      { fgColor: { rgb: '1E293B' } },
        alignment: { horizontal: 'center', vertical: 'center' },
      })
      const colH = (v: string): S => sc(v, 's', {
        font:      { bold: true, sz: 10, color: { rgb: 'FFFFFF' }, name: 'Calibri' },
        fill:      { fgColor: { rgb: '334155' } },
        alignment: { horizontal: 'left', vertical: 'center' },
        border:    border(),
      })
      const cell = (v: string, align: 'left' | 'center' | 'right' = 'left'): S => sc(v, 's', {
        font:      { sz: 10, name: 'Calibri' },
        alignment: { horizontal: align, vertical: 'center' },
        border:    border(),
      })
      const numCell = (v: number): S => sc(v, 'n', {
        font:      { sz: 10, bold: true, name: 'Calibri' },
        alignment: { horizontal: 'center', vertical: 'center' },
        border:    border(),
      })
      const okCell = (ok: boolean): S => sc(ok ? 'Basarili' : 'Hata', 's', {
        font:      { sz: 10, bold: true, color: { rgb: ok ? '15803D' : 'B91C1C' }, name: 'Calibri' },
        fill:      { fgColor: { rgb: ok ? 'DCFCE7' : 'FEE2E2' } },
        alignment: { horizontal: 'center', vertical: 'center' },
        border:    border(),
      })

      const ozet: any[][] = [
        [hdr(cleanTr(firma.ad || 'Firma')), sc('', 's', { fill: { fgColor: { rgb: '0F172A' } } }), sc('', 's', { fill: { fgColor: { rgb: '0F172A' } } }), sc('', 's', { fill: { fgColor: { rgb: '0F172A' } } })],
        [sub(`VERI YEDEGI  |  ${new Date().toLocaleString('tr-TR')}`), sub(''), sub(''), sub('')],
        [sc('', 's'), sc('', 's'), sc('', 's'), sc('', 's')],
        [colH('Tablo'), colH('Grup'), colH('Kayit Sayisi'), colH('Durum')],
        ...targets.map(t => [
          cell(cleanTr(t.label)),
          cell(cleanTr(t.group)),
          numCell(results[t.key]?.length ?? 0),
          okCell(!statuses[t.key]?.error),
        ]),
      ]

      const wsOzet = XLSX.utils.aoa_to_sheet(ozet)
      wsOzet['!cols']   = [{ wch: 28 }, { wch: 16 }, { wch: 16 }, { wch: 14 }]
      wsOzet['!rows']   = [{ hpt: 30 }, { hpt: 18 }, { hpt: 6 }, { hpt: 22 }]
      wsOzet['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 3 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: 3 } },
        { s: { r: 2, c: 0 }, e: { r: 2, c: 3 } },
      ]
      XLSX.utils.book_append_sheet(wb, wsOzet, 'Ozet')

      // ── Her tablo için ayrı sayfa ────────────────────────────────────────
      for (const t of targets) {
        const rows = results[t.key]
        if (!rows || rows.length === 0) {
          const wsEmpty = XLSX.utils.aoa_to_sheet([[sc(`${cleanTr(t.label)} — Kayit bulunamadi`, 's', {
            font: { sz: 11, italic: true, color: { rgb: '94A3B8' } },
            alignment: { horizontal: 'center', vertical: 'center' },
          })]])
          XLSX.utils.book_append_sheet(wb, wsEmpty, cleanTr(t.label).slice(0, 31))
          continue
        }

        const keys    = Object.keys(rows[0])
        const headRow = keys.map(k => sc(k, 's', {
          font:      { bold: true, sz: 9, color: { rgb: 'FFFFFF' }, name: 'Calibri' },
          fill:      { fgColor: { rgb: '0F172A' } },
          alignment: { horizontal: 'left', vertical: 'center' },
          border:    border(),
        }))
        const dataRows = rows.map(row =>
          keys.map(k => {
            const v = row[k]
            if (v === null || v === undefined) return sc('', 's', { font: { sz: 9 }, border: border() })
            if (typeof v === 'number') return sc(v, 'n', { font: { sz: 9 }, alignment: { horizontal: 'right' }, border: border() })
            if (typeof v === 'boolean') return sc(v ? 'Evet' : 'Hayir', 's', { font: { sz: 9 }, alignment: { horizontal: 'center' }, border: border() })
            return sc(String(v), 's', { font: { sz: 9 }, alignment: { wrapText: false }, border: border() })
          })
        )

        const ws = XLSX.utils.aoa_to_sheet([headRow, ...dataRows])
        ws['!cols'] = keys.map(() => ({ wch: 22 }))
        ws['!freeze'] = { xSplit: 0, ySplit: 1 }
        ws['!autofilter'] = { ref: `A1:${String.fromCharCode(65 + keys.length - 1)}${rows.length + 1}` }
        XLSX.utils.book_append_sheet(wb, ws, cleanTr(t.label).slice(0, 31))
      }

      XLSX.writeFile(wb, `${fileName}.xlsx`)
    }

    setLastBackup(new Date().toLocaleString('tr-TR'))
    setRunning(false)
  }

  const allSelected = selected.size === TABLES.length
  const groups = Array.from(new Set(TABLES.map(t => t.group)))
  const totalSelected = TABLES.filter(t => selected.has(t.key))
    .reduce((s, t) => s + (statuses[t.key]?.count || 0), 0)
  const doneCount = TABLES.filter(t => selected.has(t.key) && statuses[t.key]?.status === 'done').length

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="rounded-[24px] border border-blue-100 bg-white/5 p-5 shadow-2xl backdrop-blur-2xl relative overflow-hidden">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-blue-500/30 bg-blue-500/15 text-blue-300">
              <HardDrive size={20} />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white">Veri Yedekleme</h1>
              <p className="text-sm text-slate-400">Firma verilerinizi JSON veya Excel formatında indirin.</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {lastBackup && (
              <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-400">
                Son yedek: {lastBackup}
              </span>
            )}
            <button
              onClick={() => runBackup('json')}
              disabled={running || selected.size === 0}
              className="group flex items-center gap-2 px-1.5 py-1.5 pr-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-blue-100 transition-all duration-300 disabled:opacity-50"
            >
              <div className="w-8 h-8 rounded-[10px] flex items-center justify-center shadow-lg border border-slate-200 bg-gradient-to-b from-amber-500 to-orange-600 relative overflow-hidden">
                 <div className="absolute inset-0 bg-gradient-to-b from-white/30 to-transparent opacity-50 pointer-events-none" />
                 <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/20 to-white/0 opacity-0 group-hover:opacity-100 transition-opacity" />
                 {running ? <Loader2 size={14} className="animate-spin text-white drop-shadow-md relative z-10" /> : <Download size={14} className="text-white drop-shadow-md relative z-10" />}
              </div>
              <span className="text-xs font-semibold text-amber-400 tracking-wide">JSON</span>
            </button>
            <button
              onClick={() => runBackup('excel')}
              disabled={running || selected.size === 0}
              className="group flex items-center gap-2 px-1.5 py-1.5 pr-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-blue-100 transition-all duration-300 disabled:opacity-50"
            >
              <div className="w-8 h-8 rounded-[10px] flex items-center justify-center shadow-lg border border-slate-200 bg-gradient-to-b from-emerald-500 to-green-600 relative overflow-hidden">
                 <div className="absolute inset-0 bg-gradient-to-b from-white/30 to-transparent opacity-50 pointer-events-none" />
                 <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/20 to-white/0 opacity-0 group-hover:opacity-100 transition-opacity" />
                 {running ? <Loader2 size={14} className="animate-spin text-white drop-shadow-md relative z-10" /> : <FileSpreadsheet size={14} className="text-white drop-shadow-md relative z-10" />}
              </div>
              <span className="text-xs font-semibold text-emerald-400 tracking-wide">Excel</span>
            </button>
          </div>
        </div>
      </div>

      {/* Progress bar */}
      {running && (
        <div className="overflow-hidden rounded-2xl border border-blue-100 bg-white/90 px-5 py-4">
          <div className="mb-2 flex items-center justify-between text-xs text-slate-400">
            <span>Yedekleniyor...</span>
            <span>{doneCount} / {selected.size} tablo</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-blue-500 transition-all duration-300"
              style={{ width: `${selected.size > 0 ? (doneCount / selected.size) * 100 : 0}%` }}
            />
          </div>
        </div>
      )}

      {/* Table selection */}
      <div className="overflow-hidden rounded-[24px] border border-blue-100 bg-white/5 shadow-2xl backdrop-blur-2xl relative">
        {/* Topbar */}
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-3">
            <Database size={16} className="text-slate-400" />
            <span className="text-sm font-semibold text-white">Yedeklenecek Tablolar</span>
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-slate-400">
              {selected.size} / {TABLES.length} seçili
            </span>
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-400 hover:text-white">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={e => toggleAll(e.target.checked)}
              className="accent-blue-500"
            />
            Tümünü Seç
          </label>
        </div>

        {/* Groups */}
        <div className="divide-y divide-white/5">
          {groups.map(group => (
            <div key={group} className="p-4">
              <p className="mb-3 text-[11px] font-bold uppercase tracking-widest text-slate-500">{group}</p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {TABLES.filter(t => t.group === group).map(t => {
                  const st = statuses[t.key]
                  const isSelected = selected.has(t.key)
                  return (
                    <label
                      key={t.key}
                      className={`flex cursor-pointer items-center gap-3 rounded-2xl border p-4 transition-all ${
                        isSelected
                          ? 'border-blue-500/30 bg-blue-500/10'
                          : 'border-slate-100 bg-white/5 opacity-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggle(t.key)}
                        className="accent-blue-500"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-white">{t.label}</p>
                        <p className="text-[11px] text-slate-500 font-mono">{t.key}</p>
                      </div>
                      <div className="shrink-0">
                        {!st && <span className="text-[10px] text-slate-600">—</span>}
                        {st?.status === 'loading' && <Loader2 size={14} className="animate-spin text-blue-400" />}
                        {st?.status === 'done'    && (
                          <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-400">
                            <CheckCircle2 size={12} /> {st.count}
                          </span>
                        )}
                        {st?.status === 'error'   && (
                          <span className="flex items-center gap-1 text-[11px] text-rose-400" title={st.error}>
                            <AlertCircle size={12} /> Hata
                          </span>
                        )}
                      </div>
                    </label>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Footer stats — after backup */}
        {doneCount > 0 && !running && (
          <div className="border-t border-slate-100 px-5 py-4">
            <div className="flex flex-wrap items-center gap-6">
              <div className="flex items-center gap-2">
                <RefreshCw size={14} className="text-emerald-400" />
                <span className="text-sm text-slate-300">
                  <span className="font-bold text-white">{totalSelected.toLocaleString('tr-TR')}</span> kayıt yedeklendi
                </span>
              </div>
              {TABLES.filter(t => selected.has(t.key) && statuses[t.key]?.status === 'error').map(t => (
                <span key={t.key} className="text-xs text-rose-400">{t.label}: {statuses[t.key]?.error}</span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Info box */}
      <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 px-5 py-4 text-sm text-slate-400">
        <p className="font-semibold text-blue-300 mb-1">Yedek hakkında</p>
        <ul className="space-y-1 text-xs list-disc list-inside">
          <li>Yedek dosyası sadece mevcut firmaya ait verileri içerir.</li>
          <li>JSON formatı tüm alanları korur, geri yükleme için uygundur.</li>
          <li>Excel formatı her tablo için ayrı sayfa oluşturur, inceleme için uygundur.</li>
          <li>Dosya adı otomatik olarak tarih ve saat içerir.</li>
        </ul>
      </div>
    </div>
  )
}

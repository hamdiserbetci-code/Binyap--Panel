'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Activity, AlertTriangle, Download, Filter, History, ShieldCheck } from 'lucide-react'
import * as XLSX from 'xlsx-js-style'
import { supabase } from '@/lib/supabase'
import { can } from '@/lib/permissions'
import type { FirmaRecord } from '@/components/newpanel/ProjectsModule'

interface ActivityLogRecord {
  id: string
  firma_id: string
  auth_user_id: string | null
  kullanici_profil_id: string | null
  modul: string
  islem_turu: string
  kayit_turu: string | null
  kayit_id: string | null
  aciklama: string
  meta: Record<string, unknown> | null
  created_at: string
}

interface UserProfileOption {
  id: string
  ad_soyad: string | null
  email: string | null
  auth_user_id: string | null
}

interface Props {
  firma: FirmaRecord
  role?: string | null
}

type QuickFilter = 'all' | 'critical' | 'today'

const moduleLabels: Record<string, string> = {
  oturum: 'Oturum',
  kullanicilar: 'Kullanicilar',
  projeler: 'Projeler',
  finans: 'Gelir / Gider',
  puantaj: 'Puantaj',
  odeme: 'Odeme Plani',
  kasa: 'Kasa',
  vergi_sgk: 'Vergi / SGK',
  dokumanlar: 'Dokumanlar',
  gorevler: 'Gorevler',
}

const criticalActions = new Set(['silindi', 'durum_degisti', 'tamamlandi', 'surec_silindi', 'oturum_kapandi'])

function todayLocal() {
  return new Date().toLocaleDateString('en-CA')
}

function formatUserLabel(profile?: UserProfileOption) {
  if (!profile) return '-'
  return profile.ad_soyad || profile.email || (profile.auth_user_id ? profile.auth_user_id.slice(0, 8) + '...' : '-')
}

function safeName(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, '_')
}

function isCriticalLog(log: ActivityLogRecord) {
  return criticalActions.has(log.islem_turu) || log.islem_turu.includes('sil') || log.islem_turu.includes('iptal')
}

export default function ActivityLogModule({ firma, role }: Props) {
  const [logs, setLogs] = useState<ActivityLogRecord[]>([])
  const [profiles, setProfiles] = useState<UserProfileOption[]>([])
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState('')
  const [selectedModule, setSelectedModule] = useState('')
  const [selectedAction, setSelectedAction] = useState('')
  const [selectedUserId, setSelectedUserId] = useState('')
  const [startDate, setStartDate] = useState(todayLocal())
  const [endDate, setEndDate] = useState(todayLocal())
  const [quickFilter, setQuickFilter] = useState<QuickFilter>('all')

  const fetchProfiles = useCallback(async () => {
    if (!can(role, 'report')) return
    const { data, error } = await supabase
      .from('kullanici_profilleri')
      .select('id, ad_soyad, email, auth_user_id')
      .eq('firma_id', firma.id)
      .order('ad_soyad', { ascending: true })

    if (error) {
      setError(error.message)
      return
    }

    setProfiles((data as UserProfileOption[]) || [])
  }, [firma.id, role])

  const fetchLogs = useCallback(async () => {
    if (!can(role, 'report')) {
      setLogs([])
      setLoading(false)
      return
    }

    setLoading(true)
    let query = supabase.from('aktivite_loglari').select('*').eq('firma_id', firma.id)
    if (selectedModule) query = query.eq('modul', selectedModule)
    if (selectedAction) query = query.eq('islem_turu', selectedAction)
    if (selectedUserId) query = query.eq('kullanici_profil_id', selectedUserId)
    if (startDate) query = query.gte('created_at', `${startDate}T00:00:00`)
    if (endDate) query = query.lte('created_at', `${endDate}T23:59:59`)

    const { data, error } = await query.order('created_at', { ascending: false }).limit(500)
    if (error) {
      setError(error.message)
      setLogs([])
      setLoading(false)
      return
    }

    setError('')
    setLogs((data as ActivityLogRecord[]) || [])
    setLoading(false)
  }, [endDate, firma.id, role, selectedAction, selectedModule, selectedUserId, startDate])

  useEffect(() => {
    fetchProfiles()
  }, [fetchProfiles])

  useEffect(() => {
    fetchLogs()
  }, [fetchLogs])

  const profileMap = useMemo(() => {
    return profiles.reduce<Record<string, UserProfileOption>>((acc, profile) => {
      acc[profile.id] = profile
      return acc
    }, {})
  }, [profiles])

  const filteredLogs = useMemo(() => {
    if (quickFilter === 'critical') return logs.filter((item) => isCriticalLog(item))
    if (quickFilter === 'today') return logs.filter((item) => item.created_at?.slice(0, 10) === todayLocal())
    return logs
  }, [logs, quickFilter])

  const summary = useMemo(() => ({
    total: filteredLogs.length,
    today: logs.filter((item) => item.created_at?.slice(0, 10) === todayLocal()).length,
    userActions: filteredLogs.filter((item) => item.modul === 'kullanicilar').length,
    uniqueUsers: new Set(filteredLogs.map((item) => item.kullanici_profil_id).filter(Boolean)).size,
    critical: logs.filter((item) => isCriticalLog(item)).length,
  }), [filteredLogs, logs])

  const moduleOptions = useMemo(() => Array.from(new Set([...Object.keys(moduleLabels), ...logs.map((item) => item.modul).filter(Boolean)])).sort(), [logs])
  const actionOptions = useMemo(() => Array.from(new Set(logs.map((item) => item.islem_turu).filter(Boolean))).sort(), [logs])
  const moduleSummary = useMemo(() => {
    return Object.entries(
      filteredLogs.reduce<Record<string, number>>((acc, item) => {
        acc[item.modul] = (acc[item.modul] || 0) + 1
        return acc
      }, {}),
    )
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
  }, [filteredLogs])

  async function downloadExcel() {
    if (!can(role, 'report')) {
      setError('Bu rol icin aktivite logu disa aktarma yetkisi yok.')
      return
    }

    if (filteredLogs.length === 0) {
      setError('Excel cikti icin uygun aktivite kaydi bulunmuyor.')
      return
    }

    setExporting(true)
    setError('')

    try {
      const rows = filteredLogs.map((log) => ({
        Tarih: new Date(log.created_at).toLocaleString('tr-TR'),
        Modul: moduleLabels[log.modul] || log.modul,
        Islem: log.islem_turu,
        KayitTuru: log.kayit_turu || '',
        KayitID: log.kayit_id || '',
        Kullanici: formatUserLabel(profileMap[log.kullanici_profil_id || '']),
        Kritik: isCriticalLog(log) ? 'Evet' : 'Hayir',
        Aciklama: log.aciklama,
      }))

      const worksheet = XLSX.utils.json_to_sheet(rows)
      const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1')
      for (let col = range.s.c; col <= range.e.c; col += 1) {
        const headerCell = XLSX.utils.encode_cell({ r: 0, c: col })
        if (worksheet[headerCell]) {
          worksheet[headerCell].s = {
            font: { bold: true, color: { rgb: 'FFFFFF' } },
            fill: { fgColor: { rgb: '0F172A' } },
            alignment: { horizontal: 'center' },
          }
        }
      }
      worksheet['!cols'] = Object.keys(rows[0]).map((key) => ({ wch: Math.max(key.length + 4, key === 'Aciklama' ? 36 : 18) }))
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Aktivite')
      XLSX.writeFile(workbook, `ETM_Aktivite_${safeName(startDate || 'tum')}_${safeName(endDate || 'tum')}_${quickFilter}.xlsx`)
    } catch (err: any) {
      setError(err.message || 'Excel olusturulamadi.')
    }

    setExporting(false)
  }

  if (!can(role, 'report')) {
    return <div className="rounded-[32px] border border-white/[0.04] bg-white/[0.02] p-6 text-sm text-slate-400 shadow-2xl backdrop-blur-3xl ring-1 ring-white/5">Bu rol icin aktivite logu goruntuleme yetkisi yok.</div>
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-5">
        <SummaryCard label="Toplam Kayit" value={String(summary.total)} note="Secili filtre sonucu" icon={History} />
        <SummaryCard label="Bugun" value={String(summary.today)} note="Bugunku islemler" icon={Activity} />
        <SummaryCard label="Kullanici Islemleri" value={String(summary.userActions)} note="Rol ve profil degisiklikleri" icon={ShieldCheck} />
        <SummaryCard label="Aktif Kullanici" value={String(summary.uniqueUsers)} note="Logda gorunen farkli kullanicilar" icon={Filter} />
        <SummaryCard label="Kritik Islem" value={String(summary.critical)} note="Silme ve durum degisiklikleri" icon={AlertTriangle} />
      </div>

      <div className="rounded-[32px] border border-white/[0.04] bg-white/[0.02] p-6 text-slate-200 shadow-2xl backdrop-blur-3xl ring-1 ring-white/5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-400/80">Denetim Merkezi</p>
            <h3 className="mt-2 text-2xl font-bold tracking-tight text-white">Sistem ve Kullanici Hareketleri</h3>
            <p className="mt-2 text-sm text-slate-400">Platform uzerindeki tum gerceklesen islemlerin tarihsel dokumu ve guvenlik denetimi.</p>
          </div>
          <button type="button" onClick={downloadExcel} disabled={exporting || loading || !can(role, 'report')} className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"><Download size={16} />{exporting ? 'Hazirlaniyor...' : 'Excel indir'}</button>
        </div>

        {error && <p className="mt-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}

        <div className="mt-6 flex flex-wrap gap-2">
          <button type="button" onClick={() => setQuickFilter('all')} className={`rounded-2xl px-3 py-2 text-sm font-medium transition-colors ${quickFilter === 'all' ? 'bg-white/10 text-white' : 'bg-transparent text-slate-400 hover:bg-white/5 hover:text-slate-200'}`}>Tum Kayitlar</button>
          <button type="button" onClick={() => setQuickFilter('today')} className={`rounded-2xl px-3 py-2 text-sm font-medium transition-colors ${quickFilter === 'today' ? 'bg-sky-500/20 text-sky-300' : 'bg-transparent text-slate-400 hover:bg-white/5 hover:text-slate-200'}`}>Bugun</button>
          <button type="button" onClick={() => setQuickFilter('critical')} className={`rounded-2xl px-3 py-2 text-sm font-medium transition-colors ${quickFilter === 'critical' ? 'bg-rose-500/20 text-rose-300' : 'bg-transparent text-slate-400 hover:bg-white/5 hover:text-slate-200'}`}>Kritik Islemler</button>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {moduleSummary.length === 0 ? <div className="rounded-3xl border border-dashed border-white/10 bg-white/5 p-5 text-sm text-slate-400">Secili filtre icin modul ozeti yok.</div> : moduleSummary.map(([moduleKey, count]) => (
            <button key={moduleKey} type="button" onClick={() => setSelectedModule(moduleKey)} className="rounded-3xl border border-white/[0.05] bg-white/[0.02] p-5 text-left transition hover:bg-white/[0.04] hover:border-white/10">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">Modul</p>
              <p className="mt-2 text-lg font-bold text-slate-200">{moduleLabels[moduleKey] || moduleKey}</p>
              <p className="mt-1 text-xs font-medium text-slate-400">{count} operasyon kaydi</p>
            </button>
          ))}
        </div>

        <div className="mt-6 grid gap-3 xl:grid-cols-5">
          <select className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-slate-200 outline-none focus:border-cyan-500/50" value={selectedModule} onChange={(e) => setSelectedModule(e.target.value)}>
            <option value="">Tum moduller</option>
            {moduleOptions.map((item) => <option key={item} value={item}>{moduleLabels[item] || item}</option>)}
          </select>
          <select className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-slate-200 outline-none focus:border-cyan-500/50" value={selectedAction} onChange={(e) => setSelectedAction(e.target.value)}>
            <option value="">Tum islemler</option>
            {actionOptions.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
          <select className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-slate-200 outline-none focus:border-cyan-500/50" value={selectedUserId} onChange={(e) => setSelectedUserId(e.target.value)}>
            <option value="">Tum kullanicilar</option>
            {profiles.map((profile) => <option key={profile.id} value={profile.id}>{formatUserLabel(profile)}</option>)}
          </select>
          <input type="date" className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-slate-200 outline-none focus:border-cyan-500/50" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          <input type="date" className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-slate-200 outline-none focus:border-cyan-500/50" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </div>

        <div className="mt-6 space-y-3">
          {loading ? (
            <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 p-10 text-center text-sm text-slate-400">Aktivite kayitlari yukleniyor...</div>
          ) : filteredLogs.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 p-10 text-center text-sm text-slate-400">Bu filtrede aktivite kaydi yok.</div>
          ) : (
            filteredLogs.map((log) => {
              const profile = profileMap[log.kullanici_profil_id || '']
              return (
                <div key={log.id} className={`rounded-3xl border p-5 transition-colors ${isCriticalLog(log) ? 'border-rose-500/20 bg-rose-500/10 hover:bg-rose-500/20' : 'border-white/[0.05] bg-white/[0.02] hover:bg-white/[0.04]'}`}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-sky-500/20 px-2.5 py-1 text-[10px] font-semibold text-sky-300">{moduleLabels[log.modul] || log.modul}</span>
                        <span className="rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-semibold text-slate-300">{log.islem_turu}</span>
                        {log.kayit_turu && <span className="rounded-full bg-amber-500/20 px-2.5 py-1 text-[10px] font-semibold text-amber-300">{log.kayit_turu}</span>}
                        {isCriticalLog(log) && <span className="rounded-full bg-rose-500/20 px-2.5 py-1 text-[10px] font-semibold text-rose-300">Kritik Islem</span>}
                      </div>
                      <p className="mt-3 text-sm font-medium text-slate-200">{log.aciklama}</p>
                      <p className="mt-2 text-[11px] text-slate-500 font-medium">{new Date(log.created_at).toLocaleString('tr-TR')}</p>
                      {log.kayit_id && <p className="mt-1 text-[11px] text-slate-500 font-medium">Kayit ID: {log.kayit_id}</p>}
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-[11px] font-medium text-slate-400">
                      Kullanici: {formatUserLabel(profile)}
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}

function SummaryCard({ label, value, note, icon: Icon }: { label: string; value: string; note: string; icon: typeof History }) {
  return (
    <div className="rounded-[28px] border border-white/10 bg-slate-950/85 p-5 text-white shadow-[0_24px_60px_rgba(15,23,42,0.22)]">
      <div className="flex items-center justify-between gap-3"><p className="text-xs uppercase tracking-[0.24em] text-slate-400">{label}</p><Icon size={16} className="text-slate-400" /></div>
      <p className="mt-3 text-2xl font-semibold text-sky-300">{value}</p>
      <p className="mt-1 text-xs text-slate-400">{note}</p>
    </div>
  )
}

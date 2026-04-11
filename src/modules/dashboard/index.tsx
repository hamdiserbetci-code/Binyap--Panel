'use client'

import { useEffect, useState, useMemo } from 'react'
import { AlertTriangle, TrendingUp, Clock, FileText, DollarSign, Users, Calendar, Receipt, FolderOpen } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { AppCtx } from '@/app/page'

export default function Dashboard({ firma, firmaIds, onNavigate }: AppCtx & { onNavigate: (id: string) => void }) {
  const [stats, setStats] = useState<any>({})
  const [alerts, setAlerts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  async function loadDashboard() {
    setLoading(true)

    // Ödeme Planı Stats
    const { data: payments } = await supabase
      .from('odeme_plani')
      .select('*')
      .eq('firma_id', firma.id)

    const paymentStats = {
      total: payments?.reduce((sum, p) => sum + (p.tutar || 0), 0) || 0,
      pending: payments?.filter(p => p.durum === 'bekliyor').length || 0,
      overdue: payments?.filter(p => p.durum === 'gecikti').length || 0,
      paid: payments?.filter(p => p.durum === 'ödendi').reduce((sum, p) => sum + (p.tutar || 0), 0) || 0,
    }

    // Vergi Stats
    const { data: taxes } = await supabase
      .from('vergi_surecleri')
      .select('*')
      .eq('firma_id', firma.id)

    const taxStats = {
      total: taxes?.reduce((sum, t) => sum + (t.tutar || 0), 0) || 0,
      pending: taxes?.filter(t => t.durum === 'bekliyor').length || 0,
      overdue: taxes?.filter(t => t.durum === 'gecikti').length || 0,
    }

    // SGK Stats
    const { data: sgk } = await supabase
      .from('sgk_entegrasyon')
      .select('*')
      .eq('firma_id', firma.id)

    const sgkStats = {
      total: sgk?.reduce((sum, s) => sum + (s.prim_tutarı || 0), 0) || 0,
      pending: sgk?.filter(s => s.durum === 'bekliyor').length || 0,
      overdue: sgk?.filter(s => s.durum === 'gecikti').length || 0,
      employees: sgk?.reduce((sum, s) => sum + (s.çalışan_sayısı || 0), 0) || 0,
    }

    // Bordro Stats
    const { data: payroll } = await supabase
      .from('bordro_donemleri')
      .select('*')
      .eq('firma_id', firma.id)

    const payrollStats = {
      total: payroll?.length || 0,
      completed: payroll?.filter(p => new Date(p.bitiş_tarihi) < new Date()).length || 0,
    }

    // Projeler Stats
    const { data: projects } = await supabase
      .from('projeler_conf')
      .select('*')
      .eq('firma_id', firma.id)

    const projectStats = {
      total: projects?.length || 0,
      active: projects?.filter(p => p.durum === 'devam').length || 0,
      budget: projects?.reduce((sum, p) => sum + (p.bütçe || 0), 0) || 0,
    }

    setStats({
      payments: paymentStats,
      taxes: taxStats,
      sgk: sgkStats,
      payroll: payrollStats,
      projects: projectStats,
    })

    // Collect alerts
    const alertsList = []

    // Overdue payments
    if (paymentStats.overdue > 0) {
      alertsList.push({
        type: 'warning',
        title: 'Gecikmiş Ödemeler',
        description: `${paymentStats.overdue} adet ödeme vadesi geçmiştir`,
        module: 'odemeplani',
        icon: AlertTriangle,
      })
    }

    // Overdue taxes
    if (taxStats.overdue > 0) {
      alertsList.push({
        type: 'warning',
        title: 'Gecikmiş Vergiler',
        description: `${taxStats.overdue} adet vergi vadesi geçmiştir`,
        module: 'vergiler',
        icon: AlertTriangle,
      })
    }

    // Overdue SGK
    if (sgkStats.overdue > 0) {
      alertsList.push({
        type: 'warning',
        title: 'Gecikmiş SGK Primleri',
        description: `${sgkStats.overdue} adet SGK priminin vadesi geçmiştir`,
        module: 'sgk',
        icon: AlertTriangle,
      })
    }

    // Pending payments
    if (paymentStats.pending > 0) {
      alertsList.push({
        type: 'info',
        title: 'Beklemede olan Ödemeler',
        description: `${paymentStats.pending} adet ödeme yapılmayı beklemektedir`,
        module: 'odemeplani',
        icon: Clock,
      })
    }

    setAlerts(alertsList)
    setLoading(false)
  }

  useEffect(() => {
    loadDashboard()
  }, [firma.id])

  const StatCard = ({ icon: Icon, title, value, subtitle, color, onClick }: any) => (
    <div onClick={onClick} className={`bg-white rounded-lg border border-slate-200 p-4 cursor-pointer hover:shadow-md transition-shadow ${color}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-slate-600 mb-1">{title}</p>
          <p className="text-2xl font-bold text-slate-900">{value}</p>
          {subtitle && <p className="text-xs text-slate-500 mt-1">{subtitle}</p>}
        </div>
        <Icon className="w-5 h-5 text-slate-400" />
      </div>
    </div>
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center h-60">
        <p className="text-slate-500">Veriler yükleniyor...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="bg-gradient-to-r from-blue-500 to-cyan-500 rounded-lg p-6 text-white">
        <h1 className="text-3xl font-bold mb-2">Hoş Geldiniz</h1>
        <p className="text-blue-50">{firma.ad} • {new Date().toLocaleDateString('tr-TR')}</p>
      </div>

      {/* Critical Alerts */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">Önemli Uyarılar</h2>
          <div className="grid grid-cols-1 gap-2">
            {alerts.map((alert, i) => (
              <div
                key={i}
                onClick={() => onNavigate(alert.module)}
                className={`p-4 rounded-lg border cursor-pointer hover:shadow-md transition-all ${
                  alert.type === 'warning'
                    ? 'bg-red-50 border-red-200'
                    : 'bg-blue-50 border-blue-200'
                }`}
              >
                <div className="flex items-start gap-3">
                  <alert.icon className={`w-5 h-5 flex-shrink-0 ${alert.type === 'warning' ? 'text-red-600' : 'text-blue-600'}`} />
                  <div className="flex-1 min-w-0">
                    <p className={`font-semibold ${alert.type === 'warning' ? 'text-red-900' : 'text-blue-900'}`}>
                      {alert.title}
                    </p>
                    <p className={`text-sm ${alert.type === 'warning' ? 'text-red-700' : 'text-blue-700'}`}>
                      {alert.description}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Finance Overview */}
      <div>
        <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
          <DollarSign className="w-5 h-5" />
          Finansal Özet
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatCard
            icon={DollarSign}
            title="Ödemeler"
            value={`₺${(stats.payments.total || 0).toLocaleString('tr-TR', { maximumFractionDigits: 0 })}`}
            subtitle={`${stats.payments.pending} beklemede, ${stats.payments.overdue} gecikmiş`}
            onClick={() => onNavigate('odemeplani')}
          />
          <StatCard
            icon={Receipt}
            title="Vergiler"
            value={`₺${(stats.taxes.total || 0).toLocaleString('tr-TR', { maximumFractionDigits: 0 })}`}
            subtitle={`${stats.taxes.pending} beklemede, ${stats.taxes.overdue} gecikmiş`}
            onClick={() => onNavigate('vergiler')}
          />
          <StatCard
            icon={FileText}
            title="SGK Primleri"
            value={`₺${(stats.sgk.total || 0).toLocaleString('tr-TR', { maximumFractionDigits: 0 })}`}
            subtitle={`${stats.sgk.employees} çalışan, ${stats.sgk.overdue} gecikmiş`}
            onClick={() => onNavigate('sgk')}
          />
        </div>
      </div>

      {/* Operations Overview */}
      <div>
        <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
          <TrendingUp className="w-5 h-5" />
          Operasyonlar
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <StatCard
            icon={Calendar}
            title="Bordro Dönemleri"
            value={stats.payroll.total}
            subtitle={`${stats.payroll.completed} tamamlandı`}
            onClick={() => onNavigate('payrolls')}
          />
          <StatCard
            icon={FolderOpen}
            title="Projeler"
            value={stats.projects.total}
            subtitle={`${stats.projects.active} aktif, ₺${(stats.projects.budget || 0).toLocaleString('tr-TR', { maximumFractionDigits: 0 })} bütçe`}
            onClick={() => onNavigate('projeler')}
          />
        </div>
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-lg font-bold text-slate-900 mb-4">Hızlı İşlemler</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <button
            onClick={() => onNavigate('odemeplani')}
            className="p-4 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors text-center"
          >
            <DollarSign className="w-6 h-6 text-amber-600 mx-auto mb-2" />
            <p className="text-xs font-semibold text-slate-900">Ödeme Ekle</p>
          </button>
          <button
            onClick={() => onNavigate('projeler')}
            className="p-4 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors text-center"
          >
            <FolderOpen className="w-6 h-6 text-purple-600 mx-auto mb-2" />
            <p className="text-xs font-semibold text-slate-900">Proje Ekle</p>
          </button>
          <button
            onClick={() => onNavigate('vergiler')}
            className="p-4 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors text-center"
          >
            <FileText className="w-6 h-6 text-red-600 mx-auto mb-2" />
            <p className="text-xs font-semibold text-slate-900">Vergi Ekle</p>
          </button>
          <button
            onClick={() => onNavigate('sgk')}
            className="p-4 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors text-center"
          >
            <Users className="w-6 h-6 text-green-600 mx-auto mb-2" />
            <p className="text-xs font-semibold text-slate-900">SGK Ekle</p>
          </button>
        </div>
      </div>
    </div>
  )
}

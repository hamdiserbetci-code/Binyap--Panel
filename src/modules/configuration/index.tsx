'use client'

import { useEffect, useState } from 'react'
import { Settings, Save, AlertCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { AppCtx } from '@/app/page'

export default function ModuleConfiguration({ firma }: AppCtx) {
  const [configs, setConfigs] = useState<any>({})
  const [workflows, setWorkflows] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'odemeplan' | 'vergiler' | 'sgk' | 'bordro' | 'projeler'>('odemeplan')
  const [saving, setSaving] = useState(false)

  async function fetchConfigs() {
    setLoading(true)
    const { data } = await supabase
      .from('module_settings')
      .select('*')
      .eq('firma_id', firma.id)

    const configMap = {}
    data?.forEach((item: any) => {
      configMap[item.module_id] = item.config || {}
    })
    setConfigs(configMap)
    setLoading(false)
  }

  async function fetchWorkflows() {
    const { data } = await supabase
      .from('workflow_rules')
      .select('*')
      .eq('firma_id', firma.id)

    setWorkflows(data || [])
  }

  async function saveConfig(moduleId: string, config: any) {
    setSaving(true)
    const { error } = await supabase
      .from('module_settings')
      .upsert({
        firma_id: firma.id,
        module_id: moduleId,
        config: config
      })

    if (!error) {
      setConfigs({...configs, [moduleId]: config})
    }
    setSaving(false)
  }

  useEffect(() => {
    fetchConfigs()
    fetchWorkflows()
  }, [firma.id])

  const moduleConfigs = {
    odemeplan: {
      label: 'Ödeme Planı',
      settings: [
        { key: 'enable_notifications', label: 'Ödeme Bildirimleri', type: 'boolean', description: 'Vade yaklaşan ödemeleri bildir' },
        { key: 'reminder_days', label: 'Hatırlatıcı Günü', type: 'number', description: 'Vade tarihinden kaç gün öncesi hatırlatsın' },
        { key: 'auto_schedule', label: 'Otomatik Planlama', type: 'boolean', description: 'Tekrarlayan ödemeleri otomatik planla' },
        { key: 'payment_methods', label: 'Ödeme Yöntemleri', type: 'array', description: 'Kullanılacak ödeme yöntemleri' },
      ]
    },
    vergiler: {
      label: 'Vergi Takibi',
      settings: [
        { key: 'track_kdv', label: 'KDV Takibi', type: 'boolean' },
        { key: 'track_muhsgk', label: 'MUHSGK Takibi', type: 'boolean' },
        { key: 'track_edefter', label: 'e-Defter Takibi', type: 'boolean' },
        { key: 'auto_calculate', label: 'Otomatik Hesaplama', type: 'boolean', description: 'Vergi tutarlarını otomatik hesapla' },
        { key: 'late_alert_days', label: 'Gecikme Uyarısı (Gün)', type: 'number' },
      ]
    },
    sgk: {
      label: 'SGK Takibi',
      settings: [
        { key: 'track_types', label: 'SGK Türleri', type: 'array', description: 'Takip edilecek SGK türleri' },
        { key: 'employee_tracking', label: 'Çalışan Takibi', type: 'boolean' },
        { key: 'auto_reminders', label: 'Otomatik Hatırlatıcılar', type: 'boolean' },
      ]
    },
    bordro: {
      label: 'Bordro Takibi',
      settings: [
        { key: 'payroll_day', label: 'Bordro Ödeme Günü', type: 'number', description: '1-31 arasında gün numarası' },
        { key: 'auto_process', label: 'Otomatik İşleme', type: 'boolean' },
        { key: 'deduction_rules', label: 'Kesinti Kuralları', type: 'array' },
      ]
    },
    projeler: {
      label: 'Proje Takibi',
      settings: [
        { key: 'track_budget', label: 'Bütçe Takibi', type: 'boolean' },
        { key: 'budget_alert_percent', label: 'Bütçe Uyarı Yüzdesi', type: 'number', description: 'Bütçenin yüzde kaçına ulaştığında uyar' },
        { key: 'auto_status_update', label: 'Otomatik Durum Güncellemesi', type: 'boolean' },
      ]
    }
  }

  if (loading) return <div className="p-4">Yükleniyor...</div>

  const currentModule = moduleConfigs[activeTab]
  const currentConfig = configs[activeTab] || {}

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-slate-500/20 flex items-center justify-center">
          <Settings className="w-6 h-6 text-slate-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Modül Yapılandırması</h1>
          <p className="text-sm text-slate-500">Modülleri şirketinize göre özelleştirin</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-1 p-1 bg-slate-50">
          {Object.entries(moduleConfigs).map(([key, config]: [string, any]) => (
            <button
              key={key}
              onClick={() => setActiveTab(key as any)}
              className={`px-4 py-3 rounded text-sm font-medium transition-all ${
                activeTab === key
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {config.label}
            </button>
          ))}
        </div>
      </div>

      {/* Configuration Panel */}
      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <h2 className="text-xl font-bold text-slate-900 mb-6">{currentModule?.label} Ayarları</h2>

        <div className="space-y-6">
          {currentModule?.settings.map((setting: any) => (
            <div key={setting.key}>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-slate-700">{setting.label}</label>
                {setting.type === 'boolean' && (
                  <input
                    type="checkbox"
                    checked={currentConfig[setting.key] || false}
                    onChange={(e) => {
                      const updated = {...currentConfig, [setting.key]: e.target.checked}
                      saveConfig(activeTab, updated)
                    }}
                    className="w-4 h-4 rounded"
                  />
                )}
              </div>
              {setting.description && (
                <p className="text-xs text-slate-500 mb-2">{setting.description}</p>
              )}
              
              {setting.type === 'number' && (
                <input
                  type="number"
                  value={currentConfig[setting.key] || 0}
                  onChange={(e) => {
                    const updated = {...currentConfig, [setting.key]: parseInt(e.target.value)}
                    setConfigs({...configs, [activeTab]: updated})
                  }}
                  onBlur={() => saveConfig(activeTab, {...currentConfig, [setting.key]: parseInt(currentConfig[setting.key] || 0)})}
                  className="w-full max-w-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              )}

              {setting.type === 'array' && (
                <div className="text-xs text-slate-500 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  <span>Dizi ayarı - Direktif işlemleri için API gerekli</span>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="mt-8 pt-6 border-t border-slate-200">
          <button
            onClick={() => saveConfig(activeTab, currentConfig)}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Kaydediliyor...' : 'Kaydet'}
          </button>
        </div>
      </div>
    </div>
  )
}

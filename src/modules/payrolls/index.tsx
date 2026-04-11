'use client'

import { useEffect, useState, useMemo } from 'react'
import { FileText, Plus, RefreshCw, Search, Edit, Trash2, Download, Calendar } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { AppCtx } from '@/app/page'

function formatCurrency(n: number) {
  return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(n)
}

function formatDate(s: string) {
  return s ? new Date(s).toLocaleDateString('tr-TR') : '-'
}

export default function BordroYonetimi({ firma }: AppCtx) {
  const [periods, setPeriods] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingPeriod, setEditingPeriod] = useState<any>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({
    donem_adi: '',
    baslangic_tarihi: '',
    bitis_tarihi: '',
    bordro_tarihi: '',
    aciklama: ''
  })

  async function fetchPeriods() {
    setLoading(true)
    const { data, error } = await supabase
      .from('bordro_donemleri')
      .select('*')
      .eq('firma_id', firma.id)
      .order('bordro_tarihi', { ascending: false })

    if (error) {
      console.error('Dönem verisi çekme hatası:', error)
      return
    }

    setPeriods(data || [])
    setLoading(false)
  }

  useEffect(() => {
    fetchPeriods()
  }, [firma.id])

  const filteredPeriods = useMemo(() => {
    if (!searchQuery) return periods
    const query = searchQuery.toLowerCase()
    return periods.filter(period =>
      period.donem_adi?.toLowerCase().includes(query) ||
      period.aciklama?.toLowerCase().includes(query)
    )
  }, [periods, searchQuery])

  function openModal(period?: any) {
    if (period) {
      setForm({
        donem_adi: period.donem_adi || '',
        baslangic_tarihi: period.baslangic_tarihi || '',
        bitis_tarihi: period.bitis_tarihi || '',
        bordro_tarihi: period.bordro_tarihi || '',
        aciklama: period.aciklama || ''
      })
      setEditingPeriod(period)
    } else {
      setForm({
        donem_adi: '',
        baslangic_tarihi: '',
        bitis_tarihi: '',
        bordro_tarihi: '',
        aciklama: ''
      })
      setEditingPeriod(null)
    }
    setShowModal(true)
  }

  async function savePeriod() {
    if (!form.donem_adi || !form.baslangic_tarihi || !form.bitis_tarihi || !form.bordro_tarihi) {
      alert('Tüm zorunlu alanları doldurun')
      return
    }

    setSaving(true)
    const payload = {
      donem_adi: form.donem_adi,
      baslangic_tarihi: form.baslangic_tarihi,
      bitis_tarihi: form.bitis_tarihi,
      bordro_tarihi: form.bordro_tarihi,
      aciklama: form.aciklama || null,
    }

    try {
      if (editingPeriod) {
        await supabase
          .from('bordro_donemleri')
          .update(payload)
          .eq('id', editingPeriod.id)
      } else {
        await supabase
          .from('bordro_donemleri')
          .insert({ ...payload, firma_id: firma.id })
      }
      setShowModal(false)
      fetchPeriods()
    } catch (error) {
      console.error('Kaydetme hatası:', error)
      alert('Kaydetme sırasında hata oluştu')
    } finally {
      setSaving(false)
    }
  }

  async function deletePeriod(id: string) {
    try {
      await supabase.from('bordro_donemleri').delete().eq('id', id)
      setDeletingId(null)
      fetchPeriods()
    } catch (error) {
      console.error('Silme hatası:', error)
      alert('Silme sırasında hata oluştu')
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 rounded-lg">
              <FileText className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Bordro Yönetimi</h1>
              <p className="text-sm text-gray-500">Personel maaş bordrolarını takip edin</p>
            </div>
          </div>
          <button
            onClick={() => openModal()}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Yeni Dönem
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 rounded-lg">
              <Calendar className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Toplam Dönem</p>
              <p className="text-xl font-bold text-gray-900">{periods.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-50 rounded-lg">
              <FileText className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Aktif Dönem</p>
              <p className="text-xl font-bold text-gray-900">
                {periods.filter(p => new Date(p.bordro_tarihi) >= new Date()).length}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-50 rounded-lg">
              <Download className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Tamamlanan</p>
              <p className="text-xl font-bold text-gray-900">
                {periods.filter(p => new Date(p.bordro_tarihi) < new Date()).length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Dönem adı veya açıklama ile ara..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
          <button
            onClick={fetchPeriods}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Yenile
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Dönem Adı</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Başlangıç</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Bitiş</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Bordro Tarihi</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Durum</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">İşlemler</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredPeriods.map((period) => {
                const isCompleted = new Date(period.bordro_tarihi) < new Date()
                return (
                  <tr key={period.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {period.donem_adi}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatDate(period.baslangic_tarihi)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatDate(period.bitis_tarihi)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatDate(period.bordro_tarihi)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        isCompleted ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'
                      }`}>
                        {isCompleted ? 'Tamamlandı' : 'Aktif'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openModal(period)}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeletingId(period.id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        <button
                          className="text-green-600 hover:text-green-900"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {filteredPeriods.length === 0 && (
          <div className="text-center py-12">
            <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">Bordro dönemi bulunamadı</p>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">
                {editingPeriod ? 'Dönem Düzenle' : 'Yeni Dönem'}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Dönem Adı *</label>
                <input
                  type="text"
                  value={form.donem_adi}
                  onChange={(e) => setForm({...form, donem_adi: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Örn: Ocak 2024"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Başlangıç Tarihi *</label>
                <input
                  type="date"
                  value={form.baslangic_tarihi}
                  onChange={(e) => setForm({...form, baslangic_tarihi: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Bitiş Tarihi *</label>
                <input
                  type="date"
                  value={form.bitis_tarihi}
                  onChange={(e) => setForm({...form, bitis_tarihi: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Bordro Tarihi *</label>
                <input
                  type="date"
                  value={form.bordro_tarihi}
                  onChange={(e) => setForm({...form, bordro_tarihi: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Açıklama</label>
                <textarea
                  value={form.aciklama}
                  onChange={(e) => setForm({...form, aciklama: e.target.value})}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="İsteğe bağlı açıklama..."
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                İptal
              </button>
              <button
                onClick={savePeriod}
                disabled={saving}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {saving ? 'Kaydediliyor...' : 'Kaydet'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deletingId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Dönemi Sil</h2>
            <p className="text-gray-600 mb-6">Bu bordro dönemini silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.</p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeletingId(null)}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                İptal
              </button>
              <button
                onClick={() => deletePeriod(deletingId)}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Sil
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
'use client'

import { useEffect, useState, useMemo } from 'react'
import { Clock, Plus, RefreshCw, Search, Edit, Trash2, Filter, Calendar, DollarSign } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { AppCtx } from '@/app/page'

function formatCurrency(n: number) {
  return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(n)
}

function formatDate(s: string) {
  return s ? new Date(s).toLocaleDateString('tr-TR') : '-'
}

const PAYMENT_TYPES = [
  { value: 'cek', label: 'Çek' },
  { value: 'cari', label: 'Cari Ödeme' },
  { value: 'vergi', label: 'Vergi' },
  { value: 'sgk', label: 'SGK' },
  { value: 'maas', label: 'Maaş' },
  { value: 'diger', label: 'Diğer' },
]

const STATUSES = {
  bekliyor: { label: 'Bekliyor', color: 'bg-yellow-100 text-yellow-800' },
  odendi: { label: 'Ödendi', color: 'bg-green-100 text-green-800' },
  kismi: { label: 'Kısmi', color: 'bg-blue-100 text-blue-800' },
  iptal: { label: 'İptal', color: 'bg-red-100 text-red-800' }
}

export default function OdemePlani({ firma }: AppCtx) {
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [showModal, setShowModal] = useState(false)
  const [editingItem, setEditingItem] = useState<any>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({
    odeme_tipi: 'cek',
    aciklama: '',
    tutar: 0,
    odenen_tutar: 0,
    vade_tarihi: '',
    odeme_tarihi: '',
    odeme_kanali: '',
    cek_no: '',
    banka_hesabi: '',
    durum: 'bekliyor',
    hatirlatici_tarihi: '',
    notlar: ''
  })

  async function fetchData() {
    setLoading(true)
    const { data, error } = await supabase
      .from('odeme_plani')
      .select('*')
      .eq('firma_id', firma.id)
      .order('vade_tarihi', { ascending: true })

    if (error) {
      console.error('Veri çekme hatası:', error)
      return
    }

    setData(data || [])
    setLoading(false)
  }

  useEffect(() => {
    fetchData()
  }, [firma.id])

  const filteredData = useMemo(() => {
    return data.filter((item) => {
      if (typeFilter !== 'all' && item.odeme_tipi !== typeFilter) return false
      if (statusFilter !== 'all' && item.durum !== statusFilter) return false
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        return item.aciklama?.toLowerCase().includes(query) ||
               item.cek_no?.toLowerCase().includes(query)
      }
      return true
    })
  }, [data, typeFilter, statusFilter, searchQuery])

  const summary = useMemo(() => {
    const total = filteredData.reduce((sum, item) => sum + Number(item.tutar), 0)
    const paid = filteredData.reduce((sum, item) => sum + Number(item.odenen_tutar), 0)
    const remaining = total - paid
    return { total, paid, remaining }
  }, [filteredData])

  function openModal(item?: any) {
    if (item) {
      setForm({
        odeme_tipi: item.odeme_tipi,
        aciklama: item.aciklama || '',
        tutar: Number(item.tutar),
        odenen_tutar: Number(item.odenen_tutar),
        vade_tarihi: item.vade_tarihi || '',
        odeme_tarihi: item.odeme_tarihi || '',
        odeme_kanali: item.odeme_kanali || '',
        cek_no: item.cek_no || '',
        banka_hesabi: item.banka_hesabi || '',
        durum: item.durum,
        hatirlatici_tarihi: item.hatirlatici_tarihi || '',
        notlar: item.notlar || ''
      })
      setEditingItem(item)
    } else {
      setForm({
        odeme_tipi: 'cek',
        aciklama: '',
        tutar: 0,
        odenen_tutar: 0,
        vade_tarihi: '',
        odeme_tarihi: '',
        odeme_kanali: '',
        cek_no: '',
        banka_hesabi: '',
        durum: 'bekliyor',
        hatirlatici_tarihi: '',
        notlar: ''
      })
      setEditingItem(null)
    }
    setShowModal(true)
  }

  async function saveItem() {
    if (!form.tutar || !form.vade_tarihi) {
      alert('Tutar ve vade tarihi zorunludur')
      return
    }

    setSaving(true)
    const payload = {
      odeme_tipi: form.odeme_tipi,
      aciklama: form.aciklama || null,
      tutar: form.tutar,
      odenen_tutar: form.odenen_tutar,
      kalan_tutar: form.tutar - form.odenen_tutar,
      vade_tarihi: form.vade_tarihi,
      odeme_tarihi: form.odeme_tarihi || null,
      odeme_kanali: form.odeme_kanali || null,
      cek_no: form.cek_no || null,
      banka_hesabi: form.banka_hesabi || null,
      durum: form.durum,
      hatirlatici_tarihi: form.hatirlatici_tarihi || null,
      notlar: form.notlar || null,
    }

    try {
      if (editingItem) {
        await supabase
          .from('odeme_plani')
          .update(payload)
          .eq('id', editingItem.id)
      } else {
        await supabase
          .from('odeme_plani')
          .insert({ ...payload, firma_id: firma.id })
      }
      setShowModal(false)
      fetchData()
    } catch (error) {
      console.error('Kaydetme hatası:', error)
      alert('Kaydetme sırasında hata oluştu')
    } finally {
      setSaving(false)
    }
  }

  async function deleteItem(id: string) {
    try {
      await supabase.from('odeme_plani').delete().eq('id', id)
      setDeletingId(null)
      fetchData()
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
              <Clock className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Ödeme Planı</h1>
              <p className="text-sm text-gray-500">Ödeme takip ve hatırlatma sistemi</p>
            </div>
          </div>
          <button
            onClick={() => openModal()}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Yeni Ödeme
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 rounded-lg">
              <DollarSign className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Toplam Tutar</p>
              <p className="text-xl font-bold text-gray-900">{formatCurrency(summary.total)}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-50 rounded-lg">
              <DollarSign className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Ödenen Tutar</p>
              <p className="text-xl font-bold text-gray-900">{formatCurrency(summary.paid)}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-50 rounded-lg">
              <DollarSign className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Kalan Tutar</p>
              <p className="text-xl font-bold text-gray-900">{formatCurrency(summary.remaining)}</p>
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
                placeholder="Açıklama veya çek no ile ara..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">Tüm Tipler</option>
            {PAYMENT_TYPES.map(type => (
              <option key={type.value} value={type.value}>{type.label}</option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">Tüm Durumlar</option>
            {Object.entries(STATUSES).map(([key, status]) => (
              <option key={key} value={key}>{status.label}</option>
            ))}
          </select>
          <button
            onClick={fetchData}
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
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tip</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Açıklama</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tutar</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Vade Tarihi</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Durum</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">İşlemler</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredData.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {PAYMENT_TYPES.find(t => t.value === item.odeme_tipi)?.label}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {item.aciklama || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatCurrency(item.tutar)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatDate(item.vade_tarihi)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${STATUSES[item.durum as keyof typeof STATUSES]?.color}`}>
                      {STATUSES[item.durum as keyof typeof STATUSES]?.label}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openModal(item)}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setDeletingId(item.id)}
                        className="text-red-600 hover:text-red-900"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filteredData.length === 0 && (
          <div className="text-center py-12">
            <Clock className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">Ödeme planı bulunamadı</p>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">
                {editingItem ? 'Ödeme Düzenle' : 'Yeni Ödeme'}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ödeme Tipi</label>
                <select
                  value={form.odeme_tipi}
                  onChange={(e) => setForm({...form, odeme_tipi: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {PAYMENT_TYPES.map(type => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Açıklama</label>
                <input
                  type="text"
                  value={form.aciklama}
                  onChange={(e) => setForm({...form, aciklama: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tutar (TL)</label>
                <input
                  type="number"
                  value={form.tutar}
                  onChange={(e) => setForm({...form, tutar: Number(e.target.value)})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ödenen Tutar (TL)</label>
                <input
                  type="number"
                  value={form.odenen_tutar}
                  onChange={(e) => setForm({...form, odenen_tutar: Number(e.target.value)})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Vade Tarihi</label>
                <input
                  type="date"
                  value={form.vade_tarihi}
                  onChange={(e) => setForm({...form, vade_tarihi: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ödeme Tarihi</label>
                <input
                  type="date"
                  value={form.odeme_tarihi}
                  onChange={(e) => setForm({...form, odeme_tarihi: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ödeme Kanalı</label>
                <input
                  type="text"
                  value={form.odeme_kanali}
                  onChange={(e) => setForm({...form, odeme_kanali: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Çek No</label>
                <input
                  type="text"
                  value={form.cek_no}
                  onChange={(e) => setForm({...form, cek_no: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Banka Hesabı</label>
                <input
                  type="text"
                  value={form.banka_hesabi}
                  onChange={(e) => setForm({...form, banka_hesabi: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Durum</label>
                <select
                  value={form.durum}
                  onChange={(e) => setForm({...form, durum: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {Object.entries(STATUSES).map(([key, status]) => (
                    <option key={key} value={key}>{status.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Hatırlatma Tarihi</label>
                <input
                  type="date"
                  value={form.hatirlatici_tarihi}
                  onChange={(e) => setForm({...form, hatirlatici_tarihi: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Notlar</label>
                <textarea
                  value={form.notlar}
                  onChange={(e) => setForm({...form, notlar: e.target.value})}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                onClick={saveItem}
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
            <h2 className="text-xl font-bold text-gray-900 mb-4">Ödemeyi Sil</h2>
            <p className="text-gray-600 mb-6">Bu ödemeyi silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.</p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeletingId(null)}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                İptal
              </button>
              <button
                onClick={() => deleteItem(deletingId)}
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
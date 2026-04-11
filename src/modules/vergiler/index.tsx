'use client'

import { useEffect, useState, useMemo } from 'react'
import { Receipt, Plus, RefreshCw, Search, Edit, Trash2, Calendar, FileText, AlertTriangle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { AppCtx } from '@/app/page'

function formatCurrency(n: number) {
  return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(n)
}

function formatDate(s: string) {
  return s ? new Date(s).toLocaleDateString('tr-TR') : '-'
}

const TAX_TYPES = [
  { value: 'kdv', label: 'KDV', color: 'bg-blue-100 text-blue-800' },
  { value: 'kdv2', label: 'KDV 2', color: 'bg-blue-200 text-blue-900' },
  { value: 'muhsgk', label: 'MUHSGK', color: 'bg-green-100 text-green-800' },
  { value: 'gecici_vergi', label: 'Geçici Vergi', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'kurumlar_vergisi', label: 'Kurumlar Vergisi', color: 'bg-red-100 text-red-800' },
  { value: 'edefter', label: 'e-Defter', color: 'bg-purple-100 text-purple-800' },
]

const STATUS_OPTIONS = [
  { value: 'bekliyor', label: 'Bekliyor', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'odendi', label: 'Ödendi', color: 'bg-green-100 text-green-800' },
  { value: 'gecikti', label: 'Gecikti', color: 'bg-red-100 text-red-800' },
]

export default function VergiTakibi({ firma }: AppCtx) {
  const [taxes, setTaxes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [showModal, setShowModal] = useState(false)
  const [editingTax, setEditingTax] = useState<any>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({
    vergi_turu: 'kdv',
    donem: '',
    tutar: 0,
    vade_tarihi: '',
    odeme_tarihi: '',
    durum: 'bekliyor',
    aciklama: '',
    belge_no: '',
    notlar: ''
  })

  async function fetchTaxes() {
    setLoading(true)
    const { data, error } = await supabase
      .from('vergi_surecleri')
      .select('*')
      .eq('firma_id', firma.id)
      .order('vade_tarihi', { ascending: false })

    if (error) {
      console.error('Vergi verisi çekme hatası:', error)
      return
    }

    setTaxes(data || [])
    setLoading(false)
  }

  useEffect(() => {
    fetchTaxes()
  }, [firma.id])

  const filteredTaxes = useMemo(() => {
    return taxes.filter(tax => {
      if (typeFilter !== 'all' && tax.vergi_turu !== typeFilter) return false
      if (statusFilter !== 'all' && tax.durum !== statusFilter) return false
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        return tax.donem?.toLowerCase().includes(query) ||
               tax.aciklama?.toLowerCase().includes(query) ||
               tax.belge_no?.toLowerCase().includes(query)
      }
      return true
    })
  }, [taxes, typeFilter, statusFilter, searchQuery])

  const summary = useMemo(() => {
    const total = filteredTaxes.reduce((sum, tax) => sum + Number(tax.tutar), 0)
    const paid = filteredTaxes.filter(t => t.durum === 'odendi').reduce((sum, tax) => sum + Number(tax.tutar), 0)
    const pending = filteredTaxes.filter(t => t.durum === 'bekliyor').length
    const overdue = filteredTaxes.filter(t => {
      return t.durum === 'bekliyor' && new Date(t.vade_tarihi) < new Date()
    }).length
    return { total, paid, pending, overdue }
  }, [filteredTaxes])

  function openModal(tax?: any) {
    if (tax) {
      setForm({
        vergi_turu: tax.vergi_turu,
        donem: tax.donem || '',
        tutar: Number(tax.tutar),
        vade_tarihi: tax.vade_tarihi || '',
        odeme_tarihi: tax.odeme_tarihi || '',
        durum: tax.durum,
        aciklama: tax.aciklama || '',
        belge_no: tax.belge_no || '',
        notlar: tax.notlar || ''
      })
      setEditingTax(tax)
    } else {
      setForm({
        vergi_turu: 'kdv',
        donem: '',
        tutar: 0,
        vade_tarihi: '',
        odeme_tarihi: '',
        durum: 'bekliyor',
        aciklama: '',
        belge_no: '',
        notlar: ''
      })
      setEditingTax(null)
    }
    setShowModal(true)
  }

  async function saveTax() {
    if (!form.vergi_turu || !form.donem || !form.tutar || !form.vade_tarihi) {
      alert('Zorunlu alanları doldurun')
      return
    }

    setSaving(true)
    const payload = {
      vergi_turu: form.vergi_turu,
      donem: form.donem,
      tutar: form.tutar,
      vade_tarihi: form.vade_tarihi,
      odeme_tarihi: form.odeme_tarihi || null,
      durum: form.durum,
      aciklama: form.aciklama || null,
      belge_no: form.belge_no || null,
      notlar: form.notlar || null,
    }

    try {
      if (editingTax) {
        await supabase
          .from('vergi_surecleri')
          .update(payload)
          .eq('id', editingTax.id)
      } else {
        await supabase
          .from('vergi_surecleri')
          .insert({ ...payload, firma_id: firma.id })
      }
      setShowModal(false)
      fetchTaxes()
    } catch (error) {
      console.error('Kaydetme hatası:', error)
      alert('Kaydetme sırasında hata oluştu')
    } finally {
      setSaving(false)
    }
  }

  async function deleteTax(id: string) {
    try {
      await supabase.from('vergi_surecleri').delete().eq('id', id)
      setDeletingId(null)
      fetchTaxes()
    } catch (error) {
      console.error('Silme hatası:', error)
      alert('Silme sırasında hata oluştu')
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="w-8 h-8 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-50 rounded-lg">
              <Receipt className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Vergi Takibi</h1>
              <p className="text-sm text-gray-500">KDV, kurumlar vergisi ve diğer vergi ödemelerinizi takip edin</p>
            </div>
          </div>
          <button
            onClick={() => openModal()}
            className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Yeni Vergi Kaydı
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 rounded-lg">
              <Receipt className="w-5 h-5 text-blue-600" />
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
              <FileText className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Ödenen</p>
              <p className="text-xl font-bold text-gray-900">{formatCurrency(summary.paid)}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-50 rounded-lg">
              <Calendar className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Bekleyen</p>
              <p className="text-xl font-bold text-gray-900">{summary.pending}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-50 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Geciken</p>
              <p className="text-xl font-bold text-gray-900">{summary.overdue}</p>
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
                placeholder="Dönem, açıklama veya belge no ile ara..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
              />
            </div>
          </div>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
          >
            <option value="all">Tüm Vergi Türleri</option>
            {TAX_TYPES.map(type => (
              <option key={type.value} value={type.value}>{type.label}</option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
          >
            <option value="all">Tüm Durumlar</option>
            {STATUS_OPTIONS.map(status => (
              <option key={status.value} value={status.value}>{status.label}</option>
            ))}
          </select>
          <button
            onClick={fetchTaxes}
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
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Vergi Türü</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Dönem</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tutar</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Vade Tarihi</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ödeme Tarihi</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Durum</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">İşlemler</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredTaxes.map((tax) => {
                const taxType = TAX_TYPES.find(t => t.value === tax.vergi_turu)
                const status = STATUS_OPTIONS.find(s => s.value === tax.durum)
                const isOverdue = tax.durum === 'bekliyor' && new Date(tax.vade_tarihi) < new Date()
                return (
                  <tr key={tax.id} className={`hover:bg-gray-50 ${isOverdue ? 'bg-red-50' : ''}`}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${taxType?.color}`}>
                        {taxType?.label}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {tax.donem}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatCurrency(tax.tutar)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatDate(tax.vade_tarihi)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatDate(tax.odeme_tarihi)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${status?.color}`}>
                        {status?.label}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openModal(tax)}
                          className="text-red-600 hover:text-red-900"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeletingId(tax.id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {filteredTaxes.length === 0 && (
          <div className="text-center py-12">
            <Receipt className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">Vergi kaydı bulunamadı</p>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">
                {editingTax ? 'Vergi Kaydı Düzenle' : 'Yeni Vergi Kaydı'}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Vergi Türü *</label>
                  <select
                    value={form.vergi_turu}
                    onChange={(e) => setForm({...form, vergi_turu: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  >
                    {TAX_TYPES.map(type => (
                      <option key={type.value} value={type.value}>{type.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Dönem *</label>
                  <input
                    type="text"
                    value={form.donem}
                    onChange={(e) => setForm({...form, donem: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                    placeholder="Örn: Ocak 2024"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tutar (TL) *</label>
                <input
                  type="number"
                  value={form.tutar}
                  onChange={(e) => setForm({...form, tutar: Number(e.target.value)})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  placeholder="0"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Vade Tarihi *</label>
                  <input
                    type="date"
                    value={form.vade_tarihi}
                    onChange={(e) => setForm({...form, vade_tarihi: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ödeme Tarihi</label>
                  <input
                    type="date"
                    value={form.odeme_tarihi}
                    onChange={(e) => setForm({...form, odeme_tarihi: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Durum</label>
                <select
                  value={form.durum}
                  onChange={(e) => setForm({...form, durum: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                >
                  {STATUS_OPTIONS.map(status => (
                    <option key={status.value} value={status.value}>{status.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Açıklama</label>
                <input
                  type="text"
                  value={form.aciklama}
                  onChange={(e) => setForm({...form, aciklama: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  placeholder="Vergi açıklaması"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Belge No</label>
                <input
                  type="text"
                  value={form.belge_no}
                  onChange={(e) => setForm({...form, belge_no: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  placeholder="Belge numarası"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notlar</label>
                <textarea
                  value={form.notlar}
                  onChange={(e) => setForm({...form, notlar: e.target.value})}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  placeholder="Ek notlar..."
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
                onClick={saveTax}
                disabled={saving}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
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
            <h2 className="text-xl font-bold text-gray-900 mb-4">Vergi Kaydını Sil</h2>
            <p className="text-gray-600 mb-6">Bu vergi kaydını silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.</p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeletingId(null)}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                İptal
              </button>
              <button
                onClick={() => deleteTax(deletingId)}
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
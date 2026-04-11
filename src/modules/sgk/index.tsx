'use client'

import { useEffect, useState, useMemo } from 'react'
import { Shield, Plus, RefreshCw, Search, Edit, Trash2, Users, Calendar, AlertTriangle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { AppCtx } from '@/app/page'

function formatCurrency(n: number) {
  return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(n)
}

function formatDate(s: string) {
  return s ? new Date(s).toLocaleDateString('tr-TR') : '-'
}

const SGK_TYPES = [
  { value: 'malulluk', label: 'Malullük, Yaşlılık ve Ölüm Sigortası', color: 'bg-blue-100 text-blue-800' },
  { value: 'genel_saglik', label: 'Genel Sağlık Sigortası', color: 'bg-green-100 text-green-800' },
  { value: 'is_kaza', label: 'İş Kazası ve Meslek Hastalığı', color: 'bg-red-100 text-red-800' },
  { value: 'is_sizlik', label: 'İşsizlik Sigortası', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'diger', label: 'Diğer', color: 'bg-gray-100 text-gray-800' },
]

const STATUS_OPTIONS = [
  { value: 'bekliyor', label: 'Bekliyor', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'odendi', label: 'Ödendi', color: 'bg-green-100 text-green-800' },
  { value: 'gecikti', label: 'Gecikti', color: 'bg-red-100 text-red-800' },
]

export default function SGKTakibi({ firma }: AppCtx) {
  const [sgkRecords, setSgkRecords] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [showModal, setShowModal] = useState(false)
  const [editingRecord, setEditingRecord] = useState<any>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({
    sgk_turu: 'malulluk',
    donem: '',
    calisan_sayisi: 0,
    prim_tutari: 0,
    vade_tarihi: '',
    odeme_tarihi: '',
    durum: 'bekliyor',
    aciklama: '',
    belge_no: '',
    notlar: ''
  })

  async function fetchSgkRecords() {
    setLoading(true)
    const { data, error } = await supabase
      .from('sgk_entegrasyon')
      .select('*')
      .eq('firma_id', firma.id)
      .order('vade_tarihi', { ascending: false })

    if (error) {
      console.error('SGK verisi çekme hatası:', error)
      return
    }

    setSgkRecords(data || [])
    setLoading(false)
  }

  useEffect(() => {
    fetchSgkRecords()
  }, [firma.id])

  const filteredRecords = useMemo(() => {
    return sgkRecords.filter(record => {
      if (typeFilter !== 'all' && record.sgk_turu !== typeFilter) return false
      if (statusFilter !== 'all' && record.durum !== statusFilter) return false
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        return record.donem?.toLowerCase().includes(query) ||
               record.aciklama?.toLowerCase().includes(query) ||
               record.belge_no?.toLowerCase().includes(query)
      }
      return true
    })
  }, [sgkRecords, typeFilter, statusFilter, searchQuery])

  const summary = useMemo(() => {
    const total = filteredRecords.reduce((sum, record) => sum + Number(record.prim_tutari), 0)
    const paid = filteredRecords.filter(r => r.durum === 'odendi').reduce((sum, record) => sum + Number(record.prim_tutari), 0)
    const pending = filteredRecords.filter(r => r.durum === 'bekliyor').length
    const overdue = filteredRecords.filter(r => {
      return r.durum === 'bekliyor' && new Date(r.vade_tarihi) < new Date()
    }).length
    const totalEmployees = filteredRecords.reduce((sum, record) => sum + Number(record.calisan_sayisi || 0), 0)
    return { total, paid, pending, overdue, totalEmployees }
  }, [filteredRecords])

  function openModal(record?: any) {
    if (record) {
      setForm({
        sgk_turu: record.sgk_turu,
        donem: record.donem || '',
        calisan_sayisi: Number(record.calisan_sayisi || 0),
        prim_tutari: Number(record.prim_tutari),
        vade_tarihi: record.vade_tarihi || '',
        odeme_tarihi: record.odeme_tarihi || '',
        durum: record.durum,
        aciklama: record.aciklama || '',
        belge_no: record.belge_no || '',
        notlar: record.notlar || ''
      })
      setEditingRecord(record)
    } else {
      setForm({
        sgk_turu: 'malulluk',
        donem: '',
        calisan_sayisi: 0,
        prim_tutari: 0,
        vade_tarihi: '',
        odeme_tarihi: '',
        durum: 'bekliyor',
        aciklama: '',
        belge_no: '',
        notlar: ''
      })
      setEditingRecord(null)
    }
    setShowModal(true)
  }

  async function saveRecord() {
    if (!form.sgk_turu || !form.donem || !form.prim_tutari || !form.vade_tarihi) {
      alert('Zorunlu alanları doldurun')
      return
    }

    setSaving(true)
    const payload = {
      sgk_turu: form.sgk_turu,
      donem: form.donem,
      calisan_sayisi: form.calisan_sayisi || null,
      prim_tutari: form.prim_tutari,
      vade_tarihi: form.vade_tarihi,
      odeme_tarihi: form.odeme_tarihi || null,
      durum: form.durum,
      aciklama: form.aciklama || null,
      belge_no: form.belge_no || null,
      notlar: form.notlar || null,
    }

    try {
      if (editingRecord) {
        await supabase
          .from('sgk_entegrasyon')
          .update(payload)
          .eq('id', editingRecord.id)
      } else {
        await supabase
          .from('sgk_entegrasyon')
          .insert({ ...payload, firma_id: firma.id })
      }
      setShowModal(false)
      fetchSgkRecords()
    } catch (error) {
      console.error('Kaydetme hatası:', error)
      alert('Kaydetme sırasında hata oluştu')
    } finally {
      setSaving(false)
    }
  }

  async function deleteRecord(id: string) {
    try {
      await supabase.from('sgk_entegrasyon').delete().eq('id', id)
      setDeletingId(null)
      fetchSgkRecords()
    } catch (error) {
      console.error('Silme hatası:', error)
      alert('Silme sırasında hata oluştu')
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="w-8 h-8 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-50 rounded-lg">
              <Shield className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">SGK Takibi</h1>
              <p className="text-sm text-gray-500">Sosyal Güvenlik Kurumu prim ödemelerinizi takip edin</p>
            </div>
          </div>
          <button
            onClick={() => openModal()}
            className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Yeni SGK Kaydı
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 rounded-lg">
              <Shield className="w-5 h-5 text-blue-600" />
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
              <Users className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Toplam Çalışan</p>
              <p className="text-xl font-bold text-gray-900">{summary.totalEmployees}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-50 rounded-lg">
              <Shield className="w-5 h-5 text-green-600" />
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
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>
          </div>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
          >
            <option value="all">Tüm SGK Türleri</option>
            {SGK_TYPES.map(type => (
              <option key={type.value} value={type.value}>{type.label}</option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
          >
            <option value="all">Tüm Durumlar</option>
            {STATUS_OPTIONS.map(status => (
              <option key={status.value} value={status.value}>{status.label}</option>
            ))}
          </select>
          <button
            onClick={fetchSgkRecords}
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
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">SGK Türü</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Dönem</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Çalışan Sayısı</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Prim Tutarı</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Vade Tarihi</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ödeme Tarihi</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Durum</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">İşlemler</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredRecords.map((record) => {
                const sgkType = SGK_TYPES.find(t => t.value === record.sgk_turu)
                const status = STATUS_OPTIONS.find(s => s.value === record.durum)
                const isOverdue = record.durum === 'bekliyor' && new Date(record.vade_tarihi) < new Date()
                return (
                  <tr key={record.id} className={`hover:bg-gray-50 ${isOverdue ? 'bg-red-50' : ''}`}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${sgkType?.color}`}>
                        {sgkType?.label}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {record.donem}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {record.calisan_sayisi || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatCurrency(record.prim_tutari)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatDate(record.vade_tarihi)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatDate(record.odeme_tarihi)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${status?.color}`}>
                        {status?.label}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openModal(record)}
                          className="text-green-600 hover:text-green-900"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeletingId(record.id)}
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
        {filteredRecords.length === 0 && (
          <div className="text-center py-12">
            <Shield className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">SGK kaydı bulunamadı</p>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">
                {editingRecord ? 'SGK Kaydı Düzenle' : 'Yeni SGK Kaydı'}
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">SGK Türü *</label>
                  <select
                    value={form.sgk_turu}
                    onChange={(e) => setForm({...form, sgk_turu: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  >
                    {SGK_TYPES.map(type => (
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder="Örn: Ocak 2024"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Çalışan Sayısı</label>
                  <input
                    type="number"
                    value={form.calisan_sayisi}
                    onChange={(e) => setForm({...form, calisan_sayisi: Number(e.target.value)})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Prim Tutarı (TL) *</label>
                  <input
                    type="number"
                    value={form.prim_tutari}
                    onChange={(e) => setForm({...form, prim_tutari: Number(e.target.value)})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder="0"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Vade Tarihi *</label>
                  <input
                    type="date"
                    value={form.vade_tarihi}
                    onChange={(e) => setForm({...form, vade_tarihi: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ödeme Tarihi</label>
                  <input
                    type="date"
                    value={form.odeme_tarihi}
                    onChange={(e) => setForm({...form, odeme_tarihi: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Durum</label>
                <select
                  value={form.durum}
                  onChange={(e) => setForm({...form, durum: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="SGK açıklaması"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Belge No</label>
                <input
                  type="text"
                  value={form.belge_no}
                  onChange={(e) => setForm({...form, belge_no: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="Belge numarası"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notlar</label>
                <textarea
                  value={form.notlar}
                  onChange={(e) => setForm({...form, notlar: e.target.value})}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
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
                onClick={saveRecord}
                disabled={saving}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
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
            <h2 className="text-xl font-bold text-gray-900 mb-4">SGK Kaydını Sil</h2>
            <p className="text-gray-600 mb-6">Bu SGK kaydını silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.</p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeletingId(null)}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                İptal
              </button>
              <button
                onClick={() => deleteRecord(deletingId)}
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
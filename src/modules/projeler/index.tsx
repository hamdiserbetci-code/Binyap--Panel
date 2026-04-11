'use client'

import { useEffect, useState, useMemo } from 'react'
import { FolderOpen, Plus, RefreshCw, Search, Edit, Trash2, Calendar, Users, DollarSign } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { AppCtx } from '@/app/page'

function formatCurrency(n: number) {
  return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(n)
}

function formatDate(s: string) {
  return s ? new Date(s).toLocaleDateString('tr-TR') : '-'
}

const STATUS_OPTIONS = [
  { value: 'planlama', label: 'Planlama', color: 'bg-gray-100 text-gray-800' },
  { value: 'devam', label: 'Devam Ediyor', color: 'bg-blue-100 text-blue-800' },
  { value: 'tamamlandi', label: 'Tamamlandı', color: 'bg-green-100 text-green-800' },
  { value: 'iptal', label: 'İptal Edildi', color: 'bg-red-100 text-red-800' },
]

export default function ProjeTakibi({ firma }: AppCtx) {
  const [projects, setProjects] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [showModal, setShowModal] = useState(false)
  const [editingProject, setEditingProject] = useState<any>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({
    proje_adi: '',
    aciklama: '',
    baslangic_tarihi: '',
    bitis_tarihi: '',
    butce: 0,
    durum: 'planlama',
    sorumlu_kisi: '',
    notlar: ''
  })

  async function fetchProjects() {
    setLoading(true)
    const { data, error } = await supabase
      .from('projeler_conf')
      .select('*')
      .eq('firma_id', firma.id)
      .order('baslangic_tarihi', { ascending: false })

    if (error) {
      console.error('Proje verisi çekme hatası:', error)
      return
    }

    setProjects(data || [])
    setLoading(false)
  }

  useEffect(() => {
    fetchProjects()
  }, [firma.id])

  const filteredProjects = useMemo(() => {
    return projects.filter(project => {
      if (statusFilter !== 'all' && project.durum !== statusFilter) return false
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        return project.proje_adi?.toLowerCase().includes(query) ||
               project.aciklama?.toLowerCase().includes(query) ||
               project.sorumlu_kisi?.toLowerCase().includes(query)
      }
      return true
    })
  }, [projects, statusFilter, searchQuery])

  const summary = useMemo(() => {
    const total = projects.length
    const active = projects.filter(p => p.durum === 'devam').length
    const completed = projects.filter(p => p.durum === 'tamamlandi').length
    const totalBudget = projects.reduce((sum, p) => sum + Number(p.butce || 0), 0)
    return { total, active, completed, totalBudget }
  }, [projects])

  function openModal(project?: any) {
    if (project) {
      setForm({
        proje_adi: project.proje_adi || '',
        aciklama: project.aciklama || '',
        baslangic_tarihi: project.baslangic_tarihi || '',
        bitis_tarihi: project.bitis_tarihi || '',
        butce: Number(project.butce || 0),
        durum: project.durum || 'planlama',
        sorumlu_kisi: project.sorumlu_kisi || '',
        notlar: project.notlar || ''
      })
      setEditingProject(project)
    } else {
      setForm({
        proje_adi: '',
        aciklama: '',
        baslangic_tarihi: '',
        bitis_tarihi: '',
        butce: 0,
        durum: 'planlama',
        sorumlu_kisi: '',
        notlar: ''
      })
      setEditingProject(null)
    }
    setShowModal(true)
  }

  async function saveProject() {
    if (!form.proje_adi || !form.baslangic_tarihi) {
      alert('Proje adı ve başlangıç tarihi zorunludur')
      return
    }

    setSaving(true)
    const payload = {
      proje_adi: form.proje_adi,
      aciklama: form.aciklama || null,
      baslangic_tarihi: form.baslangic_tarihi,
      bitis_tarihi: form.bitis_tarihi || null,
      butce: form.butce || null,
      durum: form.durum,
      sorumlu_kisi: form.sorumlu_kisi || null,
      notlar: form.notlar || null,
    }

    try {
      if (editingProject) {
        await supabase
          .from('projeler_conf')
          .update(payload)
          .eq('id', editingProject.id)
      } else {
        await supabase
          .from('projeler_conf')
          .insert({ ...payload, firma_id: firma.id })
      }
      setShowModal(false)
      fetchProjects()
    } catch (error) {
      console.error('Kaydetme hatası:', error)
      alert('Kaydetme sırasında hata oluştu')
    } finally {
      setSaving(false)
    }
  }

  async function deleteProject(id: string) {
    try {
      await supabase.from('projeler_conf').delete().eq('id', id)
      setDeletingId(null)
      fetchProjects()
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
            <div className="p-2 bg-purple-50 rounded-lg">
              <FolderOpen className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Proje Takibi</h1>
              <p className="text-sm text-gray-500">Şirket projelerini yönetin ve takip edin</p>
            </div>
          </div>
          <button
            onClick={() => openModal()}
            className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Yeni Proje
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 rounded-lg">
              <FolderOpen className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Toplam Proje</p>
              <p className="text-xl font-bold text-gray-900">{summary.total}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-50 rounded-lg">
              <Users className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Aktif Proje</p>
              <p className="text-xl font-bold text-gray-900">{summary.active}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-50 rounded-lg">
              <Calendar className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Tamamlanan</p>
              <p className="text-xl font-bold text-gray-900">{summary.completed}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-50 rounded-lg">
              <DollarSign className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Toplam Bütçe</p>
              <p className="text-xl font-bold text-gray-900">{formatCurrency(summary.totalBudget)}</p>
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
                placeholder="Proje adı, açıklama veya sorumlu kişi ile ara..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          >
            <option value="all">Tüm Durumlar</option>
            {STATUS_OPTIONS.map(status => (
              <option key={status.value} value={status.value}>{status.label}</option>
            ))}
          </select>
          <button
            onClick={fetchProjects}
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
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Proje Adı</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Başlangıç</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Bitiş</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Bütçe</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sorumlu</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Durum</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">İşlemler</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredProjects.map((project) => {
                const status = STATUS_OPTIONS.find(s => s.value === project.durum)
                return (
                  <tr key={project.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div>
                        <div className="font-medium">{project.proje_adi}</div>
                        {project.aciklama && (
                          <div className="text-gray-500 text-xs truncate max-w-xs">{project.aciklama}</div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatDate(project.baslangic_tarihi)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatDate(project.bitis_tarihi)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {project.butce ? formatCurrency(project.butce) : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {project.sorumlu_kisi || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${status?.color}`}>
                        {status?.label}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openModal(project)}
                          className="text-purple-600 hover:text-purple-900"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeletingId(project.id)}
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
        {filteredProjects.length === 0 && (
          <div className="text-center py-12">
            <FolderOpen className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">Proje bulunamadı</p>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">
                {editingProject ? 'Proje Düzenle' : 'Yeni Proje'}
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Proje Adı *</label>
                <input
                  type="text"
                  value={form.proje_adi}
                  onChange={(e) => setForm({...form, proje_adi: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="Proje adını girin"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Açıklama</label>
                <textarea
                  value={form.aciklama}
                  onChange={(e) => setForm({...form, aciklama: e.target.value})}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="Proje açıklaması..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Başlangıç Tarihi *</label>
                  <input
                    type="date"
                    value={form.baslangic_tarihi}
                    onChange={(e) => setForm({...form, baslangic_tarihi: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Bitiş Tarihi</label>
                  <input
                    type="date"
                    value={form.bitis_tarihi}
                    onChange={(e) => setForm({...form, bitis_tarihi: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Bütçe (TL)</label>
                  <input
                    type="number"
                    value={form.butce}
                    onChange={(e) => setForm({...form, butce: Number(e.target.value)})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Durum</label>
                  <select
                    value={form.durum}
                    onChange={(e) => setForm({...form, durum: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  >
                    {STATUS_OPTIONS.map(status => (
                      <option key={status.value} value={status.value}>{status.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Sorumlu Kişi</label>
                <input
                  type="text"
                  value={form.sorumlu_kisi}
                  onChange={(e) => setForm({...form, sorumlu_kisi: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="Proje sorumlusu"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notlar</label>
                <textarea
                  value={form.notlar}
                  onChange={(e) => setForm({...form, notlar: e.target.value})}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
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
                onClick={saveProject}
                disabled={saving}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
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
            <h2 className="text-xl font-bold text-gray-900 mb-4">Projeyi Sil</h2>
            <p className="text-gray-600 mb-6">Bu projeyi silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.</p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeletingId(null)}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                İptal
              </button>
              <button
                onClick={() => deleteProject(deletingId)}
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
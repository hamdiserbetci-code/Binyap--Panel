'use client'

import { useEffect, useState, useMemo } from 'react'
import { Wallet, Landmark, Plus, RefreshCw, ArrowUpRight, ArrowDownRight, Trash2, Building2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { AppCtx } from '@/app/page'

function formatCurrency(n: number) {
  return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', minimumFractionDigits: 2 }).format(n)
}

function formatDate(s: string) {
  return s ? new Date(s).toLocaleDateString('tr-TR') : '-'
}

export default function KasaBankaModule({ firma }: AppCtx) {
  const [activeTab, setActiveTab] = useState<'kasa' | 'banka'>('kasa')
  const [kasaHareketleri, setKasaHareketleri] = useState<any[]>([])
  const [bankaHesaplari, setBankaHesaplari] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState<'kasa' | 'banka' | null>(null)
  const [saving, setSaving] = useState(false)

  // Kasa Formu
  const [kasaForm, setKasaForm] = useState({
    islem_tipi: 'giris',
    tutar: 0,
    aciklama: '',
    tarih: new Date().toISOString().split('T')[0]
  })

  // Banka Formu
  const [bankaForm, setBankaForm] = useState({
    banka_adi: '',
    sube_adi: '',
    hesap_no: '',
    iban: '',
    bakiye: 0
  })

  async function fetchData() {
    setLoading(true)
    const [kasaRes, bankaRes] = await Promise.all([
      supabase.from('kasa_hareketleri').select('*').eq('firma_id', firma.id).order('tarih', { ascending: false }),
      supabase.from('banka_hesaplari').select('*').eq('firma_id', firma.id).order('created_at', { ascending: false })
    ])
    
    setKasaHareketleri(kasaRes.data || [])
    setBankaHesaplari(bankaRes.data || [])
    setLoading(false)
  }

  useEffect(() => {
    fetchData()
  }, [firma.id])

  // Kasa Bakiye Hesaplama
  const kasaBakiye = useMemo(() => {
    return kasaHareketleri.reduce((acc, islem) => {
      return islem.islem_tipi === 'giris' ? acc + Number(islem.tutar) : acc - Number(islem.tutar)
    }, 0)
  }, [kasaHareketleri])

  // Banka Toplam Bakiye Hesaplama
  const bankaBakiye = useMemo(() => {
    return bankaHesaplari.reduce((acc, hesap) => acc + Number(hesap.bakiye), 0)
  }, [bankaHesaplari])

  async function handleKasaSubmit() {
    if (!kasaForm.tutar || !kasaForm.aciklama) return alert('Tutar ve açıklama zorunludur.')
    setSaving(true)
    const { error } = await supabase.from('kasa_hareketleri').insert({
      ...kasaForm,
      firma_id: firma.id
    })
    setSaving(false)
    if (error) alert('Hata: ' + error.message)
    else {
      setShowModal(null)
      fetchData()
    }
  }

  async function handleBankaSubmit() {
    if (!bankaForm.banka_adi) return alert('Banka adı zorunludur.')
    setSaving(true)
    const { error } = await supabase.from('banka_hesaplari').insert({
      ...bankaForm,
      firma_id: firma.id
    })
    setSaving(false)
    if (error) alert('Hata: ' + error.message)
    else {
      setShowModal(null)
      fetchData()
    }
  }

  async function deleteKasaIslemi(id: string) {
    if(!confirm('Bu işlemi silmek istediğinize emin misiniz?')) return;
    await supabase.from('kasa_hareketleri').delete().eq('id', id)
    fetchData()
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="w-8 h-8 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Üst Başlık ve Özet Kartları */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6 flex items-center shadow-sm">
          <div className="p-4 bg-emerald-100 text-emerald-700 rounded-xl mr-4">
            <Wallet className="w-8 h-8" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Nakit Kasa Bakiyesi</p>
            <h2 className={`text-3xl font-bold ${kasaBakiye < 0 ? 'text-red-600' : 'text-emerald-700'}`}>
              {formatCurrency(kasaBakiye)}
            </h2>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6 flex items-center shadow-sm">
          <div className="p-4 bg-blue-100 text-blue-700 rounded-xl mr-4">
            <Landmark className="w-8 h-8" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Toplam Banka Bakiyesi</p>
            <h2 className="text-3xl font-bold text-blue-700">
              {formatCurrency(bankaBakiye)}
            </h2>
          </div>
        </div>
      </div>

      {/* İçerik ve Sekmeler */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="border-b border-gray-200 bg-gray-50/50 flex justify-between items-center px-6 py-3">
          <div className="flex space-x-4">
            <button
              onClick={() => setActiveTab('kasa')}
              className={`py-2 px-4 rounded-lg font-medium text-sm transition-colors ${
                activeTab === 'kasa' ? 'bg-white shadow border border-gray-200 text-emerald-700' : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              Kasa Hareketleri
            </button>
            <button
              onClick={() => setActiveTab('banka')}
              className={`py-2 px-4 rounded-lg font-medium text-sm transition-colors ${
                activeTab === 'banka' ? 'bg-white shadow border border-gray-200 text-blue-700' : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              Banka Hesapları
            </button>
          </div>
          <div className="flex space-x-2">
            <button onClick={fetchData} className="p-2 text-gray-500 hover:bg-gray-200 rounded-lg">
              <RefreshCw className="w-5 h-5" />
            </button>
            <button
              onClick={() => setShowModal(activeTab)}
              className="flex items-center gap-2 bg-slate-800 text-white px-4 py-2 rounded-lg hover:bg-slate-700 text-sm font-medium"
            >
              <Plus className="w-4 h-4" />
              {activeTab === 'kasa' ? 'Yeni Kasa İşlemi' : 'Yeni Banka Ekle'}
            </button>
          </div>
        </div>

        {/* Tablo Alanı */}
        <div className="p-0 overflow-x-auto">
          {activeTab === 'kasa' && (
            <table className="w-full text-left">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Tarih</th>
                  <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">İşlem / Açıklama</th>
                  <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase text-right">Tutar</th>
                  <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase text-center">İşlem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {kasaHareketleri.map((islem) => (
                  <tr key={islem.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{formatDate(islem.tarih)}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        {islem.islem_tipi === 'giris' 
                          ? <ArrowDownRight className="w-5 h-5 text-emerald-500 mr-2" /> 
                          : <ArrowUpRight className="w-5 h-5 text-rose-500 mr-2" />}
                        <span className="text-sm font-medium text-gray-800">{islem.aciklama || 'Açıklama girilmemiş'}</span>
                      </div>
                    </td>
                    <td className={`px-6 py-4 whitespace-nowrap text-sm font-bold text-right ${islem.islem_tipi === 'giris' ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {islem.islem_tipi === 'giris' ? '+ ' : '- '}
                      {formatCurrency(islem.tutar)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <button onClick={() => deleteKasaIslemi(islem.id)} className="text-rose-400 hover:text-rose-600 p-1">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
                {kasaHareketleri.length === 0 && (
                  <tr><td colSpan={4} className="px-6 py-12 text-center text-gray-500">Henüz kasa işlemi bulunmuyor.</td></tr>
                )}
              </tbody>
            </table>
          )}

          {activeTab === 'banka' && (
             <div className="p-6 grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
               {bankaHesaplari.map((banka) => (
                 <div key={banka.id} className="border border-gray-200 rounded-xl p-5 hover:border-blue-300 transition-colors relative bg-gradient-to-br from-white to-gray-50">
                   <div className="flex justify-between items-start mb-4">
                     <div className="flex items-center gap-3">
                       <div className="p-2 bg-blue-100 text-blue-600 rounded-lg"><Building2 className="w-5 h-5" /></div>
                       <h3 className="font-bold text-gray-800">{banka.banka_adi}</h3>
                     </div>
                     <span className="text-xs bg-gray-200 text-gray-600 px-2 py-1 rounded-full">{banka.sube_adi}</span>
                   </div>
                   <div className="space-y-1 mb-4">
                     <p className="text-xs text-gray-500 uppercase">IBAN</p>
                     <p className="text-sm font-mono text-gray-700 tracking-wider">{banka.iban || 'Belirtilmemiş'}</p>
                   </div>
                   <div className="pt-4 border-t border-gray-100">
                     <p className="text-xs text-gray-500 uppercase mb-1">Güncel Bakiye</p>
                     <p className="text-xl font-bold text-blue-700">{formatCurrency(banka.bakiye)}</p>
                   </div>
                 </div>
               ))}
               {bankaHesaplari.length === 0 && (
                 <div className="col-span-full py-12 text-center text-gray-500">Henüz banka hesabı eklenmemiş.</div>
               )}
             </div>
          )}
        </div>
      </div>

      {/* Kasa İşlemi Modal */}
      {showModal === 'kasa' && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-2xl">
            <h2 className="text-xl font-bold text-gray-800 mb-4">Yeni Kasa İşlemi</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">İşlem Tipi</label>
                <select 
                  className="w-full border border-gray-300 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-emerald-500"
                  value={kasaForm.islem_tipi} onChange={e => setKasaForm({...kasaForm, islem_tipi: e.target.value})}
                >
                  <option value="giris">Tahsilat / Gelir (Giriş)</option>
                  <option value="cikis">Ödeme / Gider (Çıkış)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tutar (TL)</label>
                <input type="number" step="0.01" className="w-full border border-gray-300 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-emerald-500" 
                  value={kasaForm.tutar} onChange={e => setKasaForm({...kasaForm, tutar: parseFloat(e.target.value)})} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tarih</label>
                <input type="date" className="w-full border border-gray-300 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-emerald-500" 
                  value={kasaForm.tarih} onChange={e => setKasaForm({...kasaForm, tarih: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Açıklama</label>
                <textarea rows={2} className="w-full border border-gray-300 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-emerald-500" 
                  value={kasaForm.aciklama} onChange={e => setKasaForm({...kasaForm, aciklama: e.target.value})} />
              </div>
            </div>
            <div className="flex gap-3 justify-end mt-6">
              <button onClick={() => setShowModal(null)} className="px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200">İptal</button>
              <button onClick={handleKasaSubmit} disabled={saving} className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50">
                {saving ? 'Kaydediliyor...' : 'Kaydet'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Banka Ekleme Modal */}
      {showModal === 'banka' && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-2xl">
            <h2 className="text-xl font-bold text-gray-800 mb-4">Yeni Banka Hesabı</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Banka Adı</label>
                <input type="text" placeholder="Örn: Garanti BBVA" className="w-full border border-gray-300 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-blue-500" 
                  value={bankaForm.banka_adi} onChange={e => setBankaForm({...bankaForm, banka_adi: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Şube Adı</label>
                <input type="text" placeholder="Örn: Kadıköy Ticari Şube" className="w-full border border-gray-300 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-blue-500" 
                  value={bankaForm.sube_adi} onChange={e => setBankaForm({...bankaForm, sube_adi: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">IBAN</label>
                <input type="text" placeholder="TR..." className="w-full border border-gray-300 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-blue-500 font-mono" 
                  value={bankaForm.iban} onChange={e => setBankaForm({...bankaForm, iban: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Açılış Bakiyesi (Opsiyonel)</label>
                <input type="number" step="0.01" className="w-full border border-gray-300 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-blue-500" 
                  value={bankaForm.bakiye} onChange={e => setBankaForm({...bankaForm, bakiye: parseFloat(e.target.value)})} />
              </div>
            </div>
            <div className="flex gap-3 justify-end mt-6">
              <button onClick={() => setShowModal(null)} className="px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200">İptal</button>
              <button onClick={handleBankaSubmit} disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {saving ? 'Ekleniyor...' : 'Hesabı Ekle'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
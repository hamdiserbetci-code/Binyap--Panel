'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase, OdemePlani, Firma } from '@/lib/supabase'
import Modal, { FormField, inputCls, btnPrimary, btnSecondary } from '@/components/ui/Modal'
import { Plus, Pencil, Trash2, CheckCircle, AlertTriangle, Clock } from 'lucide-react'

interface Props { userId: string; firma: Firma }

const TUR_LABELS: Record<string, string> = { cek:'Çek', vergi:'Vergi', sgk:'SGK', maas:'Maaş', cari:'Cari Hesap', diger:'Diğer' }
const TUR_COLORS: Record<string, string> = { cek:'bg-purple-50 text-purple-700 border-purple-200', vergi:'bg-red-50 text-red-700 border-red-200', sgk:'bg-orange-50 text-orange-700 border-orange-200', maas:'bg-blue-50 text-blue-700 border-blue-200', cari:'bg-teal-50 text-teal-700 border-teal-200', diger:'bg-slate-100 text-slate-600 border-slate-200' }
const TUR_BG: Record<string, string> = { cek:'#7e22ce', vergi:'#b91c1c', sgk:'#c2410c', maas:'#1d4ed8', cari:'#0f766e', diger:'#475569' }
const DURUM_COLORS: Record<string, string> = { beklemede:'bg-amber-50 text-amber-700', odendi:'bg-emerald-50 text-emerald-700', gecikti:'bg-red-50 text-red-600', iptal:'bg-slate-100 text-slate-500' }

export default function OdemePlaniPage({ userId, firma }: Props) {
  const [odemeler, setOdemeler] = useState<any[]>([])
  const [cariler, setCariler] = useState<any[]>([])
  const [bankalar, setBankalar] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [filtre, setFiltre] = useState('hepsi')
  const today = new Date().toISOString().split('T')[0]

  const emptyForm = { baslik:'', tur:'vergi', tutar:'', vade_tarihi:'', durum:'beklemede', aciklama:'', cari_id:'', banka_id:'', cek_no:'', hatirlama_tarihi:'', hatirlama_saati:'', odeme_tarihi:'' }
  const [form, setForm] = useState<any>(emptyForm)

  const fetchOdemeler = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('odeme_plani').select('*, cari_hesaplar(ad), bankalar(banka_adi)').eq('firma_id', firma.id).order('vade_tarihi', { ascending: true })
    setOdemeler(data || [])
    setLoading(false)
  }, [firma.id])

  const fetchCariler = useCallback(async () => {
    const { data } = await supabase.from('cari_hesaplar').select('id, ad, tip').eq('firma_id', firma.id).order('ad')
    setCariler(data || [])
  }, [firma.id])

  const fetchBankalar = useCallback(async () => {
    const { data } = await supabase.from('bankalar').select('id, banka_adi, sube').eq('firma_id', firma.id).order('banka_adi')
    setBankalar(data || [])
  }, [firma.id])

  useEffect(() => { fetchOdemeler(); fetchCariler(); fetchBankalar() }, [fetchOdemeler, fetchCariler, fetchBankalar])

  function openModal(o?: any) {
    setEditing(o || null)
    setForm(o ? {
      baslik:o.baslik, tur:o.tur, tutar:String(o.tutar), vade_tarihi:o.vade_tarihi,
      durum:o.durum, aciklama:o.aciklama||'', cari_id:o.cari_id||'', banka_id:o.banka_id||'', cek_no:o.cek_no||'',
      hatirlama_tarihi:o.hatirlama_tarihi||'', hatirlama_saati:o.hatirlama_saati||'', odeme_tarihi:o.odeme_tarihi||''
    } : emptyForm)
    setModal(true)
  }


  async function handleSave() {
    if (!form.baslik || !form.tutar || !form.vade_tarihi) return
    const saveData = {
      baslik:form.baslik, tur:form.tur, tutar:parseFloat(form.tutar),
      vade_tarihi:form.vade_tarihi, durum:form.durum, aciklama:form.aciklama,
      cari_id:form.cari_id||null, banka_id:form.banka_id||null, cek_no:form.cek_no||null,
      hatirlama_tarihi:form.hatirlama_tarihi||null, hatirlama_saati:form.hatirlama_saati||null,
      odeme_tarihi:form.odeme_tarihi||null,
      firma_id:firma.id, user_id:userId
    }
    if (editing) await supabase.from('odeme_plani').update(saveData).eq('id', editing.id)
    else await supabase.from('odeme_plani').insert(saveData)
    setModal(false); fetchOdemeler()
  }

  async function markOdendi(o: any) {
    const bugun = new Date().toISOString().split('T')[0]
    await supabase.from('odeme_plani').update({ durum:'odendi', odeme_tarihi: bugun }).eq('id', o.id)
    fetchOdemeler()
  }

  async function handleDelete(id: string) {
    if (!confirm('Silmek istediğinize emin misiniz?')) return
    await supabase.from('odeme_plani').delete().eq('id', id)
    fetchOdemeler()
  }

  const turToplamlari = Object.keys(TUR_LABELS).map(tur => {
    const turOdemeleri = odemeler.filter(o => o.tur === tur)
    const bekleyen = turOdemeleri.filter(o => o.durum === 'beklemede').reduce((s, o) => s + o.tutar, 0)
    const odenen = turOdemeleri.filter(o => o.durum === 'odendi').reduce((s, o) => s + o.tutar, 0)
    const gecikmisSayi = turOdemeleri.filter(o => o.durum === 'beklemede' && o.vade_tarihi < today).length
    return { tur, bekleyen, odenen, adet: turOdemeleri.length, gecikmisSayi }
  }).filter(t => t.adet > 0)

  const genelToplam = odemeler.filter(o => o.durum === 'beklemede').reduce((s, o) => s + o.tutar, 0)
  const genelOdenen = odemeler.filter(o => o.durum === 'odendi').reduce((s, o) => s + o.tutar, 0)
  const gecikmisSayi = odemeler.filter(o => o.durum === 'beklemede' && o.vade_tarihi < today).length
  const filtered = odemeler.filter(o => filtre === 'hepsi' ? true : o.tur === filtre)

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">Ödeme Planı</h2>
          <p className="text-xs text-slate-400 mt-0.5">{firma.ad}</p>
        </div>
        <button onClick={() => openModal()} className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-xl text-sm font-medium">
          <Plus size={14}/> Ödeme Ekle
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-white rounded-xl border border-slate-100 p-3.5">
          <p className="text-xs text-slate-500 mb-1">Toplam Bekleyen</p>
          <p className="text-xl font-semibold text-red-500">{genelToplam.toLocaleString('tr-TR')} ₺</p>
          <p className="text-xs text-slate-400 mt-0.5">{odemeler.filter(o=>o.durum==='beklemede').length} ödeme</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-100 p-3.5">
          <p className="text-xs text-slate-500 mb-1">Toplam Ödenen</p>
          <p className="text-xl font-semibold text-emerald-600">{genelOdenen.toLocaleString('tr-TR')} ₺</p>
          <p className="text-xs text-slate-400 mt-0.5">{odemeler.filter(o=>o.durum==='odendi').length} ödeme</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-100 p-3.5">
          <p className="text-xs text-slate-500 mb-1">Gecikmiş</p>
          <p className="text-xl font-semibold text-amber-500">{gecikmisSayi}</p>
          <p className="text-xs text-slate-400 mt-0.5">işlem bekliyor</p>
        </div>
      </div>

      {turToplamlari.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-100 p-4 mb-4">
          <p className="text-xs font-medium text-slate-500 mb-3">Tür Bazlı Özet</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {turToplamlari.map(t => (
              <div key={t.tur} onClick={() => setFiltre(filtre === t.tur ? 'hepsi' : t.tur)}
                className={`rounded-xl border p-3 cursor-pointer transition-all hover:shadow-sm ${filtre === t.tur ? 'ring-2 ring-blue-400' : ''} ${TUR_COLORS[t.tur]}`}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-semibold">{TUR_LABELS[t.tur]}</span>
                  {t.gecikmisSayi > 0 && <span className="text-[10px] bg-red-500 text-white px-1.5 py-0.5 rounded-full font-medium">{t.gecikmisSayi} geç</span>}
                </div>
                <p className="text-base font-bold">{t.bekleyen.toLocaleString('tr-TR')} ₺</p>
                <p className="text-[10px] opacity-70 mt-0.5">bekleyen • {t.adet} kayıt</p>
                {t.odenen > 0 && <p className="text-[10px] opacity-60 mt-0.5">✓ {t.odenen.toLocaleString('tr-TR')} ₺ ödendi</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-2 mb-4 flex-wrap">
        <button onClick={()=>setFiltre('hepsi')} className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${filtre==='hepsi'?'bg-blue-600 text-white':'bg-white border border-slate-200 text-slate-600'}`}>
          Tümü ({odemeler.length})
        </button>
        {Object.entries(TUR_LABELS).map(([k,v]) => {
          const sayi = odemeler.filter(o=>o.tur===k).length
          if (sayi === 0) return null
          return <button key={k} onClick={()=>setFiltre(k)} className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${filtre===k?'bg-blue-600 text-white':'bg-white border border-slate-200 text-slate-600'}`}>{v} ({sayi})</button>
        })}
      </div>

      {loading ? <p className="text-center text-slate-400 py-8 text-sm">Yükleniyor...</p> :
        filtered.length === 0 ? <p className="text-center text-slate-400 py-8 text-sm">Kayıt bulunamadı</p> :
        <div className="space-y-2">
          {filtered.map(o => {
            const gecikti = o.durum==='beklemede' && o.vade_tarihi<today
            const bugun = o.vade_tarihi===today && o.durum==='beklemede'
            return (
              <div key={o.id} className={`bg-white rounded-xl border p-3.5 flex items-center gap-3 ${gecikti?'border-l-4 border-l-red-400 border-y-slate-100 border-r-slate-100':bugun?'border-l-4 border-l-amber-400 border-y-slate-100 border-r-slate-100':'border-slate-100'}`}>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-white text-[10px] font-bold" style={{backgroundColor: TUR_BG[o.tur]}}>
                  {TUR_LABELS[o.tur].slice(0,3).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <p className="text-sm font-medium text-slate-800">{o.baslik}</p>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${DURUM_COLORS[o.durum]}`}>
                      {o.durum==='beklemede'?'Beklemede':o.durum==='odendi'?'Ödendi':o.durum==='gecikti'?'Gecikti':'İptal'}
                    </span>
                    {gecikti && <span className="text-[10px] text-red-500 flex items-center gap-1"><AlertTriangle size={10}/>Gecikti</span>}
                    {bugun && <span className="text-[10px] text-amber-500 flex items-center gap-1"><Clock size={10}/>Bugün</span>}
                  </div>
                  <div className="flex gap-3 text-[11px] text-slate-400 flex-wrap">
                    <span>Vade: {o.vade_tarihi}</span>
                    {o.cek_no && <span className="font-medium text-purple-600">Çek: {o.cek_no}</span>}
                    {o.cari_hesaplar?.ad && <span>👤 {o.cari_hesaplar.ad}</span>}
                    {o.bankalar?.banka_adi && <span>🏦 {o.bankalar.banka_adi}</span>}
                    {o.hatirlama_tarihi && <span className="text-amber-500">🔔 {o.hatirlama_tarihi}{o.hatirlama_saati ? ` ${o.hatirlama_saati.slice(0,5)}` : ''}</span>}
                    {o.odeme_tarihi && <span className="text-emerald-600 font-medium">✓ Ödendi: {o.odeme_tarihi}</span>}
                    {o.aciklama && <span>{o.aciklama}</span>}
                  </div>
                </div>
                <p className="text-sm font-semibold text-red-500 flex-shrink-0">{o.tutar.toLocaleString('tr-TR')} ₺</p>
                <div className="flex gap-1">
                  {o.durum==='beklemede' && (
                    <button onClick={()=>markOdendi(o)} title="Ödendi olarak işaretle"
                      className="w-7 h-7 rounded-lg border border-slate-100 hover:bg-emerald-50 hover:border-emerald-200 flex items-center justify-center text-slate-400 hover:text-emerald-500 transition-all">
                      <CheckCircle size={12}/>
                    </button>
                  )}
                  <button onClick={()=>openModal(o)} className="w-7 h-7 rounded-lg border border-slate-100 hover:bg-slate-50 flex items-center justify-center text-slate-400"><Pencil size={12}/></button>
                  <button onClick={()=>handleDelete(o.id)} className="w-7 h-7 rounded-lg border border-slate-100 hover:bg-red-50 hover:border-red-200 flex items-center justify-center text-slate-400 hover:text-red-500"><Trash2 size={12}/></button>
                </div>
              </div>
            )
          })}
        </div>
      }

      {modal && (
        <Modal title={editing?'Ödemeyi Düzenle':'Yeni Ödeme Ekle'} onClose={()=>setModal(false)}
          footer={<><button className={btnSecondary} onClick={()=>setModal(false)}>İptal</button><button className={btnPrimary} onClick={handleSave}>Kaydet</button></>}>
          <div className="space-y-3">
            <FormField label="Başlık" required>
              <input className={inputCls} value={form.baslik} onChange={e=>setForm({...form,baslik:e.target.value})} placeholder="Ödeme açıklaması"/>
            </FormField>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Tür">
                <select className={inputCls} value={form.tur} onChange={e=>setForm({...form,tur:e.target.value})}>
                  {Object.entries(TUR_LABELS).map(([k,v])=><option key={k} value={k}>{v}</option>)}
                </select>
              </FormField>
              <FormField label="Tutar (₺)" required>
                <input type="number" className={inputCls} value={form.tutar} onChange={e=>setForm({...form,tutar:e.target.value})} placeholder="0.00"/>
              </FormField>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Vade Tarihi" required>
                <input type="date" className={inputCls} value={form.vade_tarihi} onChange={e=>setForm({...form,vade_tarihi:e.target.value})}/>
              </FormField>
              <FormField label="Durum">
                <select className={inputCls} value={form.durum} onChange={e=>setForm({...form,durum:e.target.value})}>
                  <option value="beklemede">Beklemede</option>
                  <option value="odendi">Ödendi</option>
                  <option value="gecikti">Gecikti</option>
                  <option value="iptal">İptal</option>
                </select>
              </FormField>
            </div>

            {/* Cari ve Banka ilişkisi */}
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Cari Hesap">
                <select className={inputCls} value={form.cari_id} onChange={e=>setForm({...form,cari_id:e.target.value})}>
                  <option value="">Seçiniz (opsiyonel)</option>
                  {cariler.map(c=><option key={c.id} value={c.id}>{c.ad}</option>)}
                </select>
              </FormField>
              <FormField label="Banka Hesabı">
                <select className={inputCls} value={form.banka_id} onChange={e=>setForm({...form,banka_id:e.target.value})}>
                  <option value="">Seçiniz (opsiyonel)</option>
                  {bankalar.map(b=><option key={b.id} value={b.id}>{b.banka_adi}{b.sube?` - ${b.sube}`:''}</option>)}
                </select>
              </FormField>
            </div>

            {form.tur === 'cek' && (
              <FormField label="Çek Numarası">
                <input className={inputCls} value={form.cek_no} onChange={e=>setForm({...form,cek_no:e.target.value})} placeholder="Çek no giriniz"/>
              </FormField>
            )}

            <FormField label="Açıklama">
              <input className={inputCls} value={form.aciklama} onChange={e=>setForm({...form,aciklama:e.target.value})} placeholder="Opsiyonel not"/>
            </FormField>

            <p className="text-xs font-semibold text-amber-700 bg-amber-50 px-3 py-1.5 rounded-lg">🔔 HATIRLATICI</p>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Hatırlatma Tarihi">
                <input type="date" className={inputCls} value={form.hatirlama_tarihi} onChange={e=>setForm({...form,hatirlama_tarihi:e.target.value})}/>
              </FormField>
              <FormField label="Hatırlatma Saati">
                <input type="time" className={inputCls} value={form.hatirlama_saati} onChange={e=>setForm({...form,hatirlama_saati:e.target.value})}/>
              </FormField>
            </div>
            {form.durum === 'odendi' && (
              <FormField label="Ödeme Tarihi">
                <input type="date" className={inputCls} value={form.odeme_tarihi} onChange={e=>setForm({...form,odeme_tarihi:e.target.value})}/>
              </FormField>
            )}

            {(form.cari_id || form.banka_id) && (
              <div className="bg-blue-50 rounded-xl p-3 text-xs text-blue-600">
                💡 Ödeme <strong>Ödendi</strong> olarak kaydedildiğinde{form.cari_id?' cari hareketi':''}{form.cari_id&&form.banka_id?',':''}{form.banka_id?' banka hareketi':''} ve kasa çıkışı otomatik oluşturulacak.
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  )
}

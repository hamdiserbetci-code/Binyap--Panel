'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase, OdemePlani, Firma } from '@/lib/supabase'
import Modal, { FormField, inputCls, btnPrimary, btnSecondary } from '@/components/ui/Modal'
import { Plus, Pencil, Trash2, CheckCircle, AlertTriangle, Clock, ChevronDown, PieChart } from 'lucide-react'

interface Props { userId: string; firma: Firma }

const TUR_LABELS: Record<string, string> = { cek:'Çek', vergi:'Vergi', sgk:'SGK', maas:'Maaş', cari:'Cari Hesap', diger:'Diğer' }
const TUR_COLORS: Record<string, string> = { cek:'bg-purple-500/10 text-purple-700 border-purple-200', vergi:'bg-red-500/10 text-red-700 border-red-200', sgk:'bg-orange-50 text-orange-700 border-orange-200', maas:'bg-blue-500/10 text-blue-300 border-blue-200', cari:'bg-teal-50 text-teal-700 border-teal-200', diger:'bg-white/[0.06] text-slate-300 border-white/[0.08]' }
const TUR_BG: Record<string, string> = { cek:'#7e22ce', vergi:'#b91c1c', sgk:'#c2410c', maas:'#1d4ed8', cari:'#0f766e', diger:'#475569' }
const DURUM_COLORS: Record<string, string> = { beklemede:'bg-amber-500/10 text-amber-300', odendi:'bg-emerald-500/10 text-emerald-300', gecikti:'bg-red-500/10 text-red-400', iptal:'bg-white/[0.06] text-slate-400' }

export default function OdemePlaniPage({ userId, firma }: Props) {
  const [odemeler, setOdemeler] = useState<any[]>([])
  const [cariler, setCariler] = useState<any[]>([])
  const [bankalar, setBankalar] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [filtre, setFiltre] = useState<string | null>(null)
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
  const filtered = filtre ? odemeler.filter(o => o.tur === filtre) : []

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-300 tracking-wide">Ödeme Planı</h2>
          <p className="text-[13px] text-slate-400 mt-1 font-medium">{firma.ad}</p>
        </div>
        <button onClick={() => openModal()} className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white px-4 py-2.5 rounded-xl text-sm font-semibold shadow-lg shadow-blue-500/20 hover:shadow-blue-500/40 transition-all duration-300 hover:-translate-y-0.5">
          <Plus size={16}/> Ödeme Ekle
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-[#0B1120]/80 backdrop-blur-md rounded-2xl border border-white/10 p-5 hover:bg-white/[0.04] transition-all duration-300 hover:border-white/20 hover:shadow-[0_8px_30px_rgb(0,0,0,0.12)] group">
          <p className="text-[13px] font-medium text-slate-400 mb-1 group-hover:text-slate-300 transition-colors">Toplam Bekleyen</p>
          <p className="text-2xl font-bold text-red-400 tracking-tight">{genelToplam.toLocaleString('tr-TR')} ₺</p>
          <div className="mt-2 flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
            <span className="bg-white/5 px-2 py-0.5 rounded-md">{odemeler.filter(o=>o.durum==='beklemede').length} ödeme</span>
          </div>
        </div>
        <div className="bg-[#0B1120]/80 backdrop-blur-md rounded-2xl border border-white/10 p-5 hover:bg-white/[0.04] transition-all duration-300 hover:border-white/20 hover:shadow-[0_8px_30px_rgb(0,0,0,0.12)] group">
          <p className="text-[13px] font-medium text-slate-400 mb-1 group-hover:text-slate-300 transition-colors">Toplam Ödenen</p>
          <p className="text-2xl font-bold text-emerald-400 tracking-tight">{genelOdenen.toLocaleString('tr-TR')} ₺</p>
          <div className="mt-2 flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
            <span className="bg-white/5 px-2 py-0.5 rounded-md">{odemeler.filter(o=>o.durum==='odendi').length} ödeme</span>
          </div>
        </div>
        <div className="bg-[#0B1120]/80 backdrop-blur-md rounded-2xl border border-white/10 p-5 hover:bg-white/[0.04] transition-all duration-300 hover:border-white/20 hover:shadow-[0_8px_30px_rgb(0,0,0,0.12)] group">
          <p className="text-[13px] font-medium text-slate-400 mb-1 group-hover:text-slate-300 transition-colors">Gecikmiş</p>
          <p className="text-2xl font-bold text-amber-500 tracking-tight">{gecikmisSayi}</p>
          <div className="mt-2 flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
            <span className="bg-white/5 px-2 py-0.5 rounded-md text-amber-500/70">işlem bekliyor</span>
          </div>
        </div>
      </div>

      {turToplamlari.length > 0 && (
        <div className="bg-[#0B1120]/60 backdrop-blur-sm rounded-2xl border border-white/10 mb-6 shadow-lg p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400">
              <PieChart size={16} />
            </div>
            <span className="text-[14px] font-semibold text-white tracking-wide">Tür Bazlı Özet</span>
            <span className="bg-indigo-500/20 text-indigo-300 border border-indigo-500/20 text-[10px] font-bold px-2 py-0.5 rounded-full ml-1">
              {turToplamlari.length} Tür
            </span>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {turToplamlari.map(t => (
              <div key={t.tur} onClick={() => setFiltre(filtre === t.tur ? null : t.tur)}
                className={`rounded-xl border p-4 cursor-pointer transition-all duration-300 hover:-translate-y-1 hover:shadow-lg ${filtre === t.tur ? 'bg-indigo-500/10 border-indigo-500/50 shadow-[0_0_15px_rgba(99,102,241,0.2)]' : 'bg-white/[0.02] border-white/10 hover:border-white/20'}`}>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[13px] font-bold text-white flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full shadow-sm" style={{backgroundColor: TUR_BG[t.tur]}} />
                    {TUR_LABELS[t.tur]}
                  </span>
                  {t.gecikmisSayi > 0 && <span className="text-[10px] bg-red-500/10 border border-red-500/20 text-red-400 px-2 py-0.5 rounded-md font-semibold">{t.gecikmisSayi} geç</span>}
                </div>
                <p className={`text-lg font-bold tracking-tight ${TUR_COLORS[t.tur].includes('text-red') ? 'text-red-400' : TUR_COLORS[t.tur].includes('text-purple') ? 'text-purple-400' : TUR_COLORS[t.tur].includes('text-orange') ? 'text-orange-400' : TUR_COLORS[t.tur].includes('text-teal') ? 'text-teal-400' : TUR_COLORS[t.tur].includes('text-blue') ? 'text-blue-400' : 'text-slate-300'}`}>{t.bekleyen.toLocaleString('tr-TR')} ₺</p>
                <p className="text-[11px] text-slate-400 mt-1 font-medium">{t.adet} kayıt bekliyor</p>
                {t.odenen > 0 && <p className="text-[10px] text-emerald-400/80 mt-2 font-medium flex items-center gap-1.5"><CheckCircle size={12}/>{t.odenen.toLocaleString('tr-TR')} ₺ ödendi</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {loading ? <p className="text-center text-slate-400 py-8 text-sm">Yükleniyor...</p> :
        !filtre ? <p className="text-center text-slate-400 py-8 text-sm bg-white/[0.02] border border-white/5 rounded-xl border-dashed">Ayrıntıları görmek için yukarıdan bir tür kartına tıklayın.</p> :
        filtered.length === 0 ? <p className="text-center text-slate-400 py-8 text-sm bg-white/[0.02] border border-white/5 rounded-xl border-dashed">Bu türe ait kayıt bulunamadı.</p> :
        <div className="space-y-2">
          {filtered.map(o => {
            const gecikti = o.durum==='beklemede' && o.vade_tarihi<today
            const bugun = o.vade_tarihi===today && o.durum==='beklemede'
            return (
              <div key={o.id} className={`bg-[#0B1120]/40 backdrop-blur-md rounded-2xl border p-4 flex items-center gap-4 hover:bg-white/[0.06] transition-all duration-300 hover:shadow-lg hover:border-white/20 group ${gecikti?'border-white/[0.05] border-l-4 border-l-red-500':bugun?'border-white/[0.05] border-l-4 border-l-amber-500':'border-white/[0.05] border-l-4 border-l-transparent'}`}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-white text-[11px] font-bold shadow-lg bg-gradient-to-br from-white/10 to-transparent border border-white/10" style={{backgroundColor: TUR_BG[o.tur]}}>
                  {TUR_LABELS[o.tur].slice(0,3).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <p className="text-sm font-medium text-white">{o.baslik}</p>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${DURUM_COLORS[o.durum]}`}>
                      {o.durum==='beklemede'?'Beklemede':o.durum==='odendi'?'Ödendi':o.durum==='gecikti'?'Gecikti':'İptal'}
                    </span>
                    {gecikti && <span className="text-[10px] text-red-400 flex items-center gap-1"><AlertTriangle size={10}/>Gecikti</span>}
                    {bugun && <span className="text-[10px] text-amber-500 flex items-center gap-1"><Clock size={10}/>Bugün</span>}
                  </div>
                  <div className="flex gap-3 text-[11px] text-slate-400 flex-wrap">
                    <span>Vade: {o.vade_tarihi}</span>
                    {o.cek_no && <span className="font-medium text-purple-400">Çek: {o.cek_no}</span>}
                    {o.cari_hesaplar?.ad && <span>👤 {o.cari_hesaplar.ad}</span>}
                    {o.bankalar?.banka_adi && <span>🏦 {o.bankalar.banka_adi}</span>}
                    {o.hatirlama_tarihi && <span className="text-amber-500">🔔 {o.hatirlama_tarihi}{o.hatirlama_saati ? ` ${o.hatirlama_saati.slice(0,5)}` : ''}</span>}
                    {o.odeme_tarihi && <span className="text-emerald-400 font-medium">✓ Ödendi: {o.odeme_tarihi}</span>}
                    {o.aciklama && <span>{o.aciklama}</span>}
                  </div>
                </div>
                <p className="text-sm font-semibold text-red-400 flex-shrink-0">{o.tutar.toLocaleString('tr-TR')} ₺</p>
                <div className="flex gap-1">
                  {o.durum==='beklemede' && (
                    <button onClick={()=>markOdendi(o)} title="Ödendi olarak işaretle"
                      className="w-7 h-7 rounded-lg border border-white/[0.05] hover:bg-emerald-500/10 hover:border-emerald-200 flex items-center justify-center text-slate-400 hover:text-emerald-500 transition-all">
                      <CheckCircle size={12}/>
                    </button>
                  )}
                  <button onClick={()=>openModal(o)} className="w-7 h-7 rounded-lg border border-white/[0.05] hover:bg-white/[0.04] flex items-center justify-center text-slate-400"><Pencil size={12}/></button>
                  <button onClick={()=>handleDelete(o.id)} className="w-7 h-7 rounded-lg border border-white/[0.05] hover:bg-red-500/10 hover:border-red-200 flex items-center justify-center text-slate-400 hover:text-red-400"><Trash2 size={12}/></button>
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

            <p className="text-xs font-semibold text-amber-300 bg-amber-500/10 px-3 py-1.5 rounded-lg">🔔 HATIRLATICI</p>
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
              <div className="bg-blue-500/10 rounded-xl p-3 text-xs text-blue-400">
                💡 Ödeme <strong>Ödendi</strong> olarak kaydedildiğinde{form.cari_id?' cari hareketi':''}{form.cari_id&&form.banka_id?',':''}{form.banka_id?' banka hareketi':''} ve kasa çıkışı otomatik oluşturulacak.
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  )
}

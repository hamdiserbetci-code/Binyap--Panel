'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase, Firma, Proje } from '@/lib/supabase'
import Modal, { FormField, inputCls, btnPrimary, btnSecondary } from '@/components/ui/Modal'
import { Plus, Pencil, Trash2 } from 'lucide-react'

interface Props {
  userId: string
  firma: Firma
  proje: Proje
  subPage: 'hakedis' | 'sozlesme' | 'fatura' | 'teminat' | 'yansitma'
}

const TABLE_MAP: Record<string,string> = {
  hakedis:'hakedisler', sozlesme:'sozlesmeler', fatura:'proje_faturalar',
  teminat:'teminatlar', yansitma:'yansitma_faturalari'
}

const TITLES: Record<string,string> = {
  hakedis:'Hakediş', sozlesme:'Sözleşme', fatura:'Faturalar',
  teminat:'Teminatlar', yansitma:'Yansıtma Faturaları'
}

const DURUM_COLORS: Record<string,string> = {
  beklemede:'bg-amber-50 text-amber-700', onaylandi:'bg-blue-50 text-blue-700',
  odendi:'bg-emerald-50 text-emerald-700', aktif:'bg-emerald-50 text-emerald-700',
  iade_edildi:'bg-slate-100 text-slate-600', nakde_donusturuldu:'bg-red-50 text-red-600'
}

const DURUM_LABELS: Record<string,string> = {
  beklemede:'Beklemede', onaylandi:'Onaylandı', odendi:'Ödendi',
  aktif:'Aktif', iade_edildi:'İade Edildi', nakde_donusturuldu:'Nakde Dönüştürüldü'
}

export default function ProjeDetayPage({ userId, firma, proje, subPage }: Props) {
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [form, setForm] = useState<any>({})

  const fetchRows = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from(TABLE_MAP[subPage]).select('*')
      .eq('proje_id', proje.id).order('olusturulma', { ascending: false })
    setRows(data || [])
    setLoading(false)
  }, [subPage, proje.id])

  useEffect(() => { fetchRows() }, [fetchRows])

  function emptyForm(): any {
    switch (subPage) {
      case 'hakedis': return { no:'', tarih:'', tutar:'', kdv:'', toplam:'', durum:'beklemede', aciklama:'' }
      case 'sozlesme': return { no:'', tarih:'', tutar:'', tur:'yapim', taraf:'', aciklama:'' }
      case 'fatura': return { fatura_no:'', tarih:'', tip:'alis', tedarikci:'', tutar:'', kdv:'', toplam:'', aciklama:'' }
      case 'teminat': return { tur:'kesin', tutar:'', banka:'', no:'', verilis_tarihi:'', bitis_tarihi:'', durum:'aktif', aciklama:'' }
      case 'yansitma': return { fatura_no:'', tarih:'', alici:'', tutar:'', kdv:'', toplam:'', aciklama:'' }
    }
  }

  function openModal(row?: any) {
    setEditing(row || null)
    if (row) {
      const f: any = {}
      Object.keys(emptyForm()).forEach(k => { f[k] = row[k] !== null && row[k] !== undefined ? String(row[k]) : '' })
      setForm(f)
    } else { setForm(emptyForm()) }
    setModal(true)
  }

  async function handleSave() {
    const numFields = ['tutar', 'kdv', 'toplam']
    const saveData: any = { ...form, proje_id:proje.id, firma_id:firma.id, user_id:userId }
    numFields.forEach(f => { if (saveData[f] !== undefined && saveData[f] !== '') saveData[f] = parseFloat(saveData[f]) || 0 })
    if (editing) await supabase.from(TABLE_MAP[subPage]).update(saveData).eq('id', editing.id)
    else await supabase.from(TABLE_MAP[subPage]).insert(saveData)
    setModal(false); fetchRows()
  }

  async function handleDelete(id: string) {
    if (!confirm('Silmek istediğinize emin misiniz?')) return
    await supabase.from(TABLE_MAP[subPage]).delete().eq('id', id)
    fetchRows()
  }

  const renderForm = () => {
    switch (subPage) {
      case 'hakedis': return (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Hakediş No"><input className={inputCls} value={form.no||''} onChange={e=>setForm({...form,no:e.target.value})} placeholder="HK-001"/></FormField>
            <FormField label="Tarih"><input type="date" className={inputCls} value={form.tarih||''} onChange={e=>setForm({...form,tarih:e.target.value})}/></FormField>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <FormField label="Tutar (₺)"><input type="number" className={inputCls} value={form.tutar||''} onChange={e=>setForm({...form,tutar:e.target.value})}/></FormField>
            <FormField label="KDV (₺)"><input type="number" className={inputCls} value={form.kdv||''} onChange={e=>setForm({...form,kdv:e.target.value})}/></FormField>
            <FormField label="Toplam (₺)"><input type="number" className={inputCls} value={form.toplam||''} onChange={e=>setForm({...form,toplam:e.target.value})}/></FormField>
          </div>
          <FormField label="Durum">
            <select className={inputCls} value={form.durum||''} onChange={e=>setForm({...form,durum:e.target.value})}>
              <option value="beklemede">Beklemede</option>
              <option value="onaylandi">Onaylandı</option>
              <option value="odendi">Ödendi</option>
            </select>
          </FormField>
          <FormField label="Açıklama"><input className={inputCls} value={form.aciklama||''} onChange={e=>setForm({...form,aciklama:e.target.value})} placeholder="Opsiyonel"/></FormField>
        </div>
      )
      case 'sozlesme': return (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Sözleşme No"><input className={inputCls} value={form.no||''} onChange={e=>setForm({...form,no:e.target.value})} placeholder="SZ-001"/></FormField>
            <FormField label="Tarih"><input type="date" className={inputCls} value={form.tarih||''} onChange={e=>setForm({...form,tarih:e.target.value})}/></FormField>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Tür">
              <select className={inputCls} value={form.tur||''} onChange={e=>setForm({...form,tur:e.target.value})}>
                <option value="yapim">Yapım</option>
                <option value="hizmet">Hizmet</option>
                <option value="malzeme">Malzeme</option>
                <option value="diger">Diğer</option>
              </select>
            </FormField>
            <FormField label="Tutar (₺)"><input type="number" className={inputCls} value={form.tutar||''} onChange={e=>setForm({...form,tutar:e.target.value})}/></FormField>
          </div>
          <FormField label="Taraf"><input className={inputCls} value={form.taraf||''} onChange={e=>setForm({...form,taraf:e.target.value})} placeholder="Karşı taraf adı"/></FormField>
          <FormField label="Açıklama"><input className={inputCls} value={form.aciklama||''} onChange={e=>setForm({...form,aciklama:e.target.value})} placeholder="Opsiyonel"/></FormField>
        </div>
      )
      case 'fatura': return (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Fatura No"><input className={inputCls} value={form.fatura_no||''} onChange={e=>setForm({...form,fatura_no:e.target.value})} placeholder="FT-001"/></FormField>
            <FormField label="Tarih"><input type="date" className={inputCls} value={form.tarih||''} onChange={e=>setForm({...form,tarih:e.target.value})}/></FormField>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Tür">
              <select className={inputCls} value={form.tip||''} onChange={e=>setForm({...form,tip:e.target.value})}>
                <option value="alis">Alış</option>
                <option value="satis">Satış</option>
              </select>
            </FormField>
            <FormField label="Tedarikçi/Müşteri"><input className={inputCls} value={form.tedarikci||''} onChange={e=>setForm({...form,tedarikci:e.target.value})}/></FormField>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <FormField label="Tutar (₺)"><input type="number" className={inputCls} value={form.tutar||''} onChange={e=>setForm({...form,tutar:e.target.value})}/></FormField>
            <FormField label="KDV (₺)"><input type="number" className={inputCls} value={form.kdv||''} onChange={e=>setForm({...form,kdv:e.target.value})}/></FormField>
            <FormField label="Toplam (₺)"><input type="number" className={inputCls} value={form.toplam||''} onChange={e=>setForm({...form,toplam:e.target.value})}/></FormField>
          </div>
          <FormField label="Açıklama"><input className={inputCls} value={form.aciklama||''} onChange={e=>setForm({...form,aciklama:e.target.value})} placeholder="Opsiyonel"/></FormField>
        </div>
      )
      case 'teminat': return (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Tür">
              <select className={inputCls} value={form.tur||''} onChange={e=>setForm({...form,tur:e.target.value})}>
                <option value="kesin">Kesin</option>
                <option value="gecici">Geçici</option>
                <option value="avans">Avans</option>
                <option value="diger">Diğer</option>
              </select>
            </FormField>
            <FormField label="Tutar (₺)"><input type="number" className={inputCls} value={form.tutar||''} onChange={e=>setForm({...form,tutar:e.target.value})}/></FormField>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Banka"><input className={inputCls} value={form.banka||''} onChange={e=>setForm({...form,banka:e.target.value})}/></FormField>
            <FormField label="Teminat No"><input className={inputCls} value={form.no||''} onChange={e=>setForm({...form,no:e.target.value})}/></FormField>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Veriliş Tarihi"><input type="date" className={inputCls} value={form.verilis_tarihi||''} onChange={e=>setForm({...form,verilis_tarihi:e.target.value})}/></FormField>
            <FormField label="Bitiş Tarihi"><input type="date" className={inputCls} value={form.bitis_tarihi||''} onChange={e=>setForm({...form,bitis_tarihi:e.target.value})}/></FormField>
          </div>
          <FormField label="Durum">
            <select className={inputCls} value={form.durum||''} onChange={e=>setForm({...form,durum:e.target.value})}>
              <option value="aktif">Aktif</option>
              <option value="iade_edildi">İade Edildi</option>
              <option value="nakde_donusturuldu">Nakde Dönüştürüldü</option>
            </select>
          </FormField>
          <FormField label="Açıklama"><input className={inputCls} value={form.aciklama||''} onChange={e=>setForm({...form,aciklama:e.target.value})} placeholder="Opsiyonel"/></FormField>
        </div>
      )
      case 'yansitma': return (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Fatura No"><input className={inputCls} value={form.fatura_no||''} onChange={e=>setForm({...form,fatura_no:e.target.value})} placeholder="YF-001"/></FormField>
            <FormField label="Tarih"><input type="date" className={inputCls} value={form.tarih||''} onChange={e=>setForm({...form,tarih:e.target.value})}/></FormField>
          </div>
          <FormField label="Alıcı"><input className={inputCls} value={form.alici||''} onChange={e=>setForm({...form,alici:e.target.value})}/></FormField>
          <div className="grid grid-cols-3 gap-3">
            <FormField label="Tutar (₺)"><input type="number" className={inputCls} value={form.tutar||''} onChange={e=>setForm({...form,tutar:e.target.value})}/></FormField>
            <FormField label="KDV (₺)"><input type="number" className={inputCls} value={form.kdv||''} onChange={e=>setForm({...form,kdv:e.target.value})}/></FormField>
            <FormField label="Toplam (₺)"><input type="number" className={inputCls} value={form.toplam||''} onChange={e=>setForm({...form,toplam:e.target.value})}/></FormField>
          </div>
          <FormField label="Açıklama"><input className={inputCls} value={form.aciklama||''} onChange={e=>setForm({...form,aciklama:e.target.value})} placeholder="Opsiyonel"/></FormField>
        </div>
      )
    }
  }

  const renderRow = (row: any) => {
    switch (subPage) {
      case 'hakedis': return (
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
            <p className="text-sm font-medium text-slate-800">{row.no||'No belirtilmedi'}</p>
            {row.durum && <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${DURUM_COLORS[row.durum]}`}>{DURUM_LABELS[row.durum]}</span>}
          </div>
          <div className="flex gap-3 text-[11px] text-slate-400 flex-wrap">
            {row.tarih && <span>{row.tarih}</span>}
            {row.toplam > 0 && <span className="text-emerald-600 font-medium">{row.toplam.toLocaleString('tr-TR')} ₺</span>}
            {row.aciklama && <span>{row.aciklama}</span>}
          </div>
        </div>
      )
      case 'sozlesme': return (
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-800">{row.no||'No belirtilmedi'}</p>
          <div className="flex gap-3 text-[11px] text-slate-400 flex-wrap">
            {row.taraf && <span>{row.taraf}</span>}
            {row.tarih && <span>{row.tarih}</span>}
            {row.tutar > 0 && <span className="text-blue-600 font-medium">{row.tutar.toLocaleString('tr-TR')} ₺</span>}
          </div>
        </div>
      )
      case 'fatura': return (
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
            <p className="text-sm font-medium text-slate-800">{row.fatura_no||'No belirtilmedi'}</p>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${row.tip==='alis'?'bg-red-50 text-red-600':'bg-emerald-50 text-emerald-600'}`}>{row.tip==='alis'?'Alış':'Satış'}</span>
          </div>
          <div className="flex gap-3 text-[11px] text-slate-400 flex-wrap">
            {row.tedarikci && <span>{row.tedarikci}</span>}
            {row.tarih && <span>{row.tarih}</span>}
            {row.toplam > 0 && <span className="font-medium text-slate-600">{row.toplam.toLocaleString('tr-TR')} ₺</span>}
          </div>
        </div>
      )
      case 'teminat': return (
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
            <p className="text-sm font-medium text-slate-800">{row.no||'No belirtilmedi'}</p>
            {row.durum && <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${DURUM_COLORS[row.durum]}`}>{DURUM_LABELS[row.durum]}</span>}
          </div>
          <div className="flex gap-3 text-[11px] text-slate-400 flex-wrap">
            {row.banka && <span>{row.banka}</span>}
            {row.tutar > 0 && <span className="text-amber-600 font-medium">{row.tutar.toLocaleString('tr-TR')} ₺</span>}
            {row.bitis_tarihi && <span>Bitiş: {row.bitis_tarihi}</span>}
          </div>
        </div>
      )
      case 'yansitma': return (
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-800">{row.fatura_no||'No belirtilmedi'}</p>
          <div className="flex gap-3 text-[11px] text-slate-400 flex-wrap">
            {row.alici && <span>{row.alici}</span>}
            {row.tarih && <span>{row.tarih}</span>}
            {row.toplam > 0 && <span className="text-purple-600 font-medium">{row.toplam.toLocaleString('tr-TR')} ₺</span>}
          </div>
        </div>
      )
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-semibold text-slate-800">{TITLES[subPage]}</h2>
          <p className="text-xs text-slate-400 mt-0.5">{proje.ad} • {rows.length} kayıt</p>
        </div>
        <button onClick={() => openModal()} className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-xl text-sm font-medium transition-colors">
          <Plus size={14}/> Ekle
        </button>
      </div>

      {loading ? <p className="text-center text-slate-400 py-8 text-sm">Yükleniyor...</p> :
        rows.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl border border-dashed border-slate-200">
            <p className="text-slate-400 text-sm mb-2">{TITLES[subPage]} kaydı yok</p>
            <button onClick={() => openModal()} className="text-blue-600 text-sm hover:underline">İlk kaydı ekle</button>
          </div>
        ) : (
          <div className="space-y-2">
            {rows.map(row => (
              <div key={row.id} className="bg-white rounded-xl border border-slate-100 p-3.5 flex items-center gap-3 hover:border-slate-200 transition-all">
                {renderRow(row)}
                <div className="flex gap-1 flex-shrink-0">
                  <button onClick={() => openModal(row)} className="w-7 h-7 rounded-lg border border-slate-100 hover:bg-slate-50 flex items-center justify-center text-slate-400"><Pencil size={12}/></button>
                  <button onClick={() => handleDelete(row.id)} className="w-7 h-7 rounded-lg border border-slate-100 hover:bg-red-50 hover:border-red-200 flex items-center justify-center text-slate-400 hover:text-red-500"><Trash2 size={12}/></button>
                </div>
              </div>
            ))}
          </div>
        )
      }

      {modal && (
        <Modal title={editing?`${TITLES[subPage]} Düzenle`:`${TITLES[subPage]} Ekle`} onClose={() => setModal(false)}
          footer={<><button className={btnSecondary} onClick={() => setModal(false)}>İptal</button><button className={btnPrimary} onClick={handleSave}>Kaydet</button></>}>
          {renderForm()}
        </Modal>
      )}
    </div>
  )
}

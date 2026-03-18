'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { PlusCircle, Trash2, TrendingDown } from 'lucide-react'

export default function MalatyaGiderPage({ firmaId }: { firmaId: string }) {
  const [giderler, setGiderler] = useState<any[]>([])
  const [form, setForm] = useState({ aciklama: '', tutar: '', kategori: 'Malzeme' })

  const fetchGiderler = async () => {
    const { data } = await supabase.from('malatya_proje_giderleri').select('*').eq('firma_id', firmaId).order('tarih', { ascending: false })
    setGiderler(data || [])
  }

  useEffect(() => { if (firmaId) fetchGiderler() }, [firmaId])

  const ekle = async (e: any) => {
    e.preventDefault()
    if (!form.aciklama || !form.tutar) return
    await supabase.from('malatya_proje_giderleri').insert([{ ...form, tutar: parseFloat(form.tutar), firma_id: firmaId }])
    setForm({ ...form, aciklama: '', tutar: '' }); fetchGiderler()
  }

  const sil = async (id: string) => {
    if(!confirm('Bu harcamayı silmek istediğinize emin misiniz?')) return
    await supabase.from('malatya_proje_giderleri').delete().eq('id', id)
    fetchGiderler()
  }

  const toplam = giderler.reduce((acc, curr) => acc + Number(curr.tutar), 0)

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white p-6 rounded-2xl border shadow-sm">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Malatya Proje Giderleri</h2>
          <p className="text-slate-500 text-sm">Şantiye harcamalarını buradan takip edebilirsiniz.</p>
        </div>
        <div className="text-right">
          <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">Toplam Harcama</p>
          <div className="text-3xl font-black text-red-600">₺{toplam.toLocaleString('tr-TR')}</div>
        </div>
      </div>

      <form onSubmit={ekle} className="bg-white p-4 rounded-xl border-2 border-blue-50 flex gap-3 items-end shadow-sm">
        <div className="flex-1">
          <label className="text-[10px] font-bold text-slate-400 ml-1">AÇIKLAMA</label>
          <input type="text" value={form.aciklama} onChange={e => setForm({...form, aciklama: e.target.value})} className="w-full p-2 border rounded-lg outline-none focus:ring-2 ring-blue-500" placeholder="Örn: Nakliye gideri..." />
        </div>
        <div className="w-32">
          <label className="text-[10px] font-bold text-slate-400 ml-1">TUTAR</label>
          <input type="number" value={form.tutar} onChange={e => setForm({...form, tutar: e.target.value})} className="w-full p-2 border rounded-lg outline-none focus:ring-2 ring-blue-500" placeholder="0.00" />
        </div>
        <button className="bg-blue-600 text-white h-[42px] px-6 rounded-lg font-bold hover:bg-blue-700 transition flex items-center gap-2">
          <PlusCircle size={18}/> EKLE
        </button>
      </form>

      <div className="bg-white border rounded-2xl overflow-hidden shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 border-b text-slate-500 font-bold">
            <tr><th className="p-4">Tarih</th><th className="p-4">Harcama Detayı</th><th className="p-4 text-right">Tutar</th><th className="p-4 w-10"></th></tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {giderler.map(g => (
              <tr key={g.id} className="hover:bg-slate-50 transition">
                <td className="p-4 text-slate-400">{new Date(g.tarih).toLocaleDateString('tr-TR')}</td>
                <td className="p-4 font-semibold text-slate-700">{g.aciklama}</td>
                <td className="p-4 text-right font-bold text-red-600 text-base">₺{g.tutar.toLocaleString('tr-TR')}</td>
                <td className="p-4"><button onClick={() => sil(g.id)} className="text-slate-300 hover:text-red-500"><Trash2 size={16}/></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

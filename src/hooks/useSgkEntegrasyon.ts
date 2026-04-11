import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export interface SgkEntegrasyon {
  id: string
  firma_id: string
  sgk_tipi: 'malulluk' | 'genel_saglik' | 'is_kazasi' | 'issizlik' | 'diger'
  donem: string
  calisan_sayisi: number
  prim_tutari: number
  vade_tarihi: string
  odeme_tarihi: string | null
  durum: 'bekliyor' | 'odendi' | 'gecikti'
  belge_no: string
  aciklama: string
  notlar: string
  created_at: string
  updated_at: string
}

export function useSgkEntegrasyon(firmaId?: string) {
  const [data, setData] = useState<SgkEntegrasyon[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchSgk = async () => {
    try {
      setLoading(true)
      let query = supabase.from('sgk_entegrasyon').select('*')
      if (firmaId) query = query.eq('firma_id', firmaId)
      const { data: result, error: err } = await query.order('vade_tarihi', { ascending: true })
      if (err) throw err
      setData(result || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    } finally {
      setLoading(false)
    }
  }

  const addSgk = async (sgk: Omit<SgkEntegrasyon, 'id' | 'created_at' | 'updated_at'>) => {
    const { data: result, error: err } = await supabase.from('sgk_entegrasyon').insert([sgk]).select()
    if (err) throw err
    if (result) setData([...data, result[0]])
    return result?.[0]
  }

  const updateSgk = async (id: string, updates: Partial<SgkEntegrasyon>) => {
    const { data: result, error: err } = await supabase.from('sgk_entegrasyon').update(updates).eq('id', id).select()
    if (err) throw err
    if (result) setData(data.map(s => s.id === id ? result[0] : s))
    return result?.[0]
  }

  const deleteSgk = async (id: string) => {
    const { error: err } = await supabase.from('sgk_entegrasyon').delete().eq('id', id)
    if (err) throw err
    setData(data.filter(s => s.id !== id))
  }

  useEffect(() => {
    fetchSgk()
  }, [firmaId])

  return { data, loading, error, fetchSgk, addSgk, updateSgk, deleteSgk }
}

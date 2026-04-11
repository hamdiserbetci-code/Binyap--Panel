import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export interface Proje {
  id: string
  firma_id: string
  proje_adi: string
  aciklama: string
  baslangic_tarihi: string
  bitis_tarihi: string
  butce: number
  sorumlu_kisi: string
  durum: 'planlama' | 'devam' | 'tamamlandi' | 'iptal'
  notlar: string
  created_at: string
  updated_at: string
}

export function useProjeler(firmaId?: string) {
  const [data, setData] = useState<Proje[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchProjeler = async () => {
    try {
      setLoading(true)
      let query = supabase.from('projeler_conf').select('*')
      if (firmaId) query = query.eq('firma_id', firmaId)
      const { data: result, error: err } = await query.order('baslangic_tarihi', { ascending: false })
      if (err) throw err
      setData(result || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    } finally {
      setLoading(false)
    }
  }

  const addProje = async (proje: Omit<Proje, 'id' | 'created_at' | 'updated_at'>) => {
    const { data: result, error: err } = await supabase.from('projeler_conf').insert([proje]).select()
    if (err) throw err
    if (result) setData([...data, result[0]])
    return result?.[0]
  }

  const updateProje = async (id: string, updates: Partial<Proje>) => {
    const { data: result, error: err } = await supabase.from('projeler_conf').update(updates).eq('id', id).select()
    if (err) throw err
    if (result) setData(data.map(p => p.id === id ? result[0] : p))
    return result?.[0]
  }

  const deleteProje = async (id: string) => {
    const { error: err } = await supabase.from('projeler_conf').delete().eq('id', id)
    if (err) throw err
    setData(data.filter(p => p.id !== id))
  }

  useEffect(() => {
    fetchProjeler()
  }, [firmaId])

  return { data, loading, error, fetchProjeler, addProje, updateProje, deleteProje }
}

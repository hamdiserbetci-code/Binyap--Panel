import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export interface BordroDonemi {
  id: string
  firma_id: string
  donem_adi: string
  aciklama: string
  baslangic_tarihi: string
  bitis_tarihi: string
  bordro_tarihi: string
  durum: string
  notlar: string
  created_at: string
  updated_at: string
}

export function useBordroDonemleri(firmaId?: string) {
  const [data, setData] = useState<BordroDonemi[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchBordro = async () => {
    try {
      setLoading(true)
      let query = supabase.from('bordro_donemleri').select('*')
      if (firmaId) query = query.eq('firma_id', firmaId)
      const { data: result, error: err } = await query.order('bordro_tarihi', { ascending: false })
      if (err) throw err
      setData(result || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    } finally {
      setLoading(false)
    }
  }

  const addBordro = async (bordro: Omit<BordroDonemi, 'id' | 'created_at' | 'updated_at'>) => {
    const { data: result, error: err } = await supabase.from('bordro_donemleri').insert([bordro]).select()
    if (err) throw err
    if (result) setData([...data, result[0]])
    return result?.[0]
  }

  const updateBordro = async (id: string, updates: Partial<BordroDonemi>) => {
    const { data: result, error: err } = await supabase.from('bordro_donemleri').update(updates).eq('id', id).select()
    if (err) throw err
    if (result) setData(data.map(b => b.id === id ? result[0] : b))
    return result?.[0]
  }

  const deleteBordro = async (id: string) => {
    const { error: err } = await supabase.from('bordro_donemleri').delete().eq('id', id)
    if (err) throw err
    setData(data.filter(b => b.id !== id))
  }

  useEffect(() => {
    fetchBordro()
  }, [firmaId])

  return { data, loading, error, fetchBordro, addBordro, updateBordro, deleteBordro }
}

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export interface OdemePlani {
  id: string
  firma_id: string
  odeme_tipi: string
  odeme_no: string
  aciklama: string
  tutar: number
  gozlemleme_tarihi: string
  vade_tarihi: string
  odeme_tarihi: string | null
  durum: 'bekliyor' | 'odendi' | 'gecikti' | 'iptal'
  notlar: string
  created_at: string
  updated_at: string
}

export function useOdemePlani(firmaId?: string) {
  const [data, setData] = useState<OdemePlani[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchOdemeler = async () => {
    try {
      setLoading(true)
      let query = supabase.from('odeme_plani').select('*')
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

  const addOdeme = async (odeme: Omit<OdemePlani, 'id' | 'created_at' | 'updated_at'>) => {
    const { data: result, error: err } = await supabase.from('odeme_plani').insert([odeme]).select()
    if (err) throw err
    if (result) setData([...data, result[0]])
    return result?.[0]
  }

  const updateOdeme = async (id: string, updates: Partial<OdemePlani>) => {
    const { data: result, error: err } = await supabase.from('odeme_plani').update(updates).eq('id', id).select()
    if (err) throw err
    if (result) setData(data.map(o => o.id === id ? result[0] : o))
    return result?.[0]
  }

  const deleteOdeme = async (id: string) => {
    const { error: err } = await supabase.from('odeme_plani').delete().eq('id', id)
    if (err) throw err
    setData(data.filter(o => o.id !== id))
  }

  useEffect(() => {
    fetchOdemeler()
  }, [firmaId])

  return { data, loading, error, fetchOdemeler, addOdeme, updateOdeme, deleteOdeme }
}

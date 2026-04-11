import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export interface VergiSureci {
  id: string
  firma_id: string
  vergi_tipi: string
  donem: string
  tutar: number
  vade_tarihi: string
  odeme_tarihi: string | null
  durum: 'bekliyor' | 'odendi' | 'gecikti'
  belge_no: string
  aciklama: string
  notlar: string
  created_at: string
  updated_at: string
}

export function useVergiSurecleri(firmaId?: string) {
  const [data, setData] = useState<VergiSureci[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fetch all vergi records
  const fetchVergi = async () => {
    try {
      setLoading(true)
      let query = supabase.from('vergi_surecleri').select('*')
      
      if (firmaId) {
        query = query.eq('firma_id', firmaId)
      }
      
      const { data: result, error: err } = await query.order('vade_tarihi', { ascending: true })
      
      if (err) throw err
      setData(result || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  // Add new vergi record
  const addVergi = async (vergi: Omit<VergiSureci, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      const { data: result, error: err } = await supabase
        .from('vergi_surecleri')
        .insert([vergi])
        .select()
      
      if (err) throw err
      if (result) {
        setData([...data, result[0]])
      }
      return result?.[0]
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    }
  }

  // Update vergi record
  const updateVergi = async (id: string, updates: Partial<VergiSureci>) => {
    try {
      const { data: result, error: err } = await supabase
        .from('vergi_surecleri')
        .update(updates)
        .eq('id', id)
        .select()
      
      if (err) throw err
      if (result) {
        setData(data.map(v => v.id === id ? result[0] : v))
      }
      return result?.[0]
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    }
  }

  // Delete vergi record
  const deleteVergi = async (id: string) => {
    try {
      const { error: err } = await supabase
        .from('vergi_surecleri')
        .delete()
        .eq('id', id)
      
      if (err) throw err
      setData(data.filter(v => v.id !== id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    }
  }

  useEffect(() => {
    fetchVergi()
  }, [firmaId])

  return {
    data,
    loading,
    error,
    fetchVergi,
    addVergi,
    updateVergi,
    deleteVergi,
  }
}

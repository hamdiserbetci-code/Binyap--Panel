'use client'
import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import { Firma } from '@/types'

interface FirmaContextType {
  firma: Firma | null
  firmalar: Firma[]
  setFirma: (f: Firma) => void
  loading: boolean
  refresh: () => void
}

const FirmaContext = createContext<FirmaContextType>({
  firma: null, firmalar: [], setFirma: () => {}, loading: true, refresh: () => {}
})

export function FirmaProvider({ children, userId }: { children: ReactNode; userId: string }) {
  const [firma, setFirmaState] = useState<Firma | null>(null)
  const [firmalar, setFirmalar] = useState<Firma[]>([])
  const [loading, setLoading] = useState(true)

  async function fetchFirmalar() {
    setLoading(true)
    // Önce firma_kullanicilari üzerinden dene
    const { data: katilimlar } = await supabase
      .from('firma_kullanicilari')
      .select('firma_id')
      .eq('user_id', userId)
    const firmaIds = (katilimlar || []).map(k => k.firma_id)

    let list: Firma[] = []
    if (firmaIds.length > 0) {
      const { data } = await supabase
        .from('firmalar')
        .select('*')
        .in('id', firmaIds)
        .order('ad')
      list = data || []
    }

    // Fallback: firma_kullanicilari boşsa tüm firmaları getir
    if (list.length === 0) {
      const { data } = await supabase.from('firmalar').select('*').order('ad')
      list = data || []
    }

    setFirmalar(list)
    if (!firma && list.length > 0) setFirmaState(list[0])
    setLoading(false)
  }

  useEffect(() => { fetchFirmalar() }, [userId])

  function setFirma(f: Firma) {
    setFirmaState(f)
    if (typeof window !== 'undefined') {
      localStorage.setItem('etm_firma_id', f.id)
    }
  }

  return (
    <FirmaContext.Provider value={{ firma, firmalar, setFirma, loading, refresh: fetchFirmalar }}>
      {children}
    </FirmaContext.Provider>
  )
}

export const useFirma = () => useContext(FirmaContext)

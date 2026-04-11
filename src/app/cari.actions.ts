'use server'

import { createClient } from '@supabase/supabase-js'

// Server ortamında çalışacak Supabase client'ı (Service Role Key ile RLS'yi by-pass edebilir, 
// ancak biz her fonksiyonda firmaId kontrolü yaparak güvenliği sağlıyoruz)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function getCariKartlar(firmaId: string) {
  try {
    const { data, error } = await supabase
      .from('cari_kartlar')
      .select('*')
      .eq('firma_id', firmaId)
      .order('unvan', { ascending: true })

    if (error) throw error
    return { success: true, data }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

export async function saveCariKart(firmaId: string, payload: any) {
  try {
    const { id, ...rest } = payload

    if (id) {
      // Güncelleme
      const { error } = await supabase.from('cari_kartlar').update(rest).eq('id', id).eq('firma_id', firmaId)
      if (error) throw error
    } else {
      // Yeni Kayıt
      const { error } = await supabase.from('cari_kartlar').insert({ ...rest, firma_id: firmaId })
      if (error) throw error
    }

    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

export async function deleteCariKart(firmaId: string, id: string) {
  try {
    const { error } = await supabase.from('cari_kartlar').delete().eq('id', id).eq('firma_id', firmaId)
    if (error) throw error
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}
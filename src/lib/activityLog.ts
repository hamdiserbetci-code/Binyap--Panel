import { supabase } from '@/lib/supabase'

interface LogActivityInput {
  firmaId: string
  authUserId?: string | null
  kullaniciProfilId?: string | null
  modul: string
  islemTuru: string
  kayitTuru?: string | null
  kayitId?: string | null
  aciklama: string
  meta?: Record<string, unknown>
}

export async function logActivity(input: LogActivityInput) {
  let authUserId = input.authUserId || null
  let kullaniciProfilId = input.kullaniciProfilId || null

  if (!authUserId) {
    const { data } = await supabase.auth.getUser()
    authUserId = data.user?.id || null
  }

  if (!kullaniciProfilId && authUserId) {
    const { data } = await supabase
      .from('kullanici_profilleri')
      .select('id')
      .eq('auth_user_id', authUserId)
      .maybeSingle()

    kullaniciProfilId = data?.id || null
  }

  const { error } = await supabase.from('aktivite_loglari').insert({
    firma_id: input.firmaId,
    auth_user_id: authUserId,
    kullanici_profil_id: kullaniciProfilId,
    modul: input.modul,
    islem_turu: input.islemTuru,
    kayit_turu: input.kayitTuru || null,
    kayit_id: input.kayitId || null,
    aciklama: input.aciklama,
    meta: input.meta || {},
  })

  if (error) {
    console.error('Aktivite logu yazilamadi:', error.message)
  }
}

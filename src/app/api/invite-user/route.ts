import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL

  if (!serviceKey || !supabaseUrl) {
    return NextResponse.json({ error: 'Sunucu yapılandırması eksik (SUPABASE_SERVICE_ROLE_KEY)' }, { status: 500 })
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { email, ad_soyad, rol, firma_id } = await req.json()

  if (!email || !firma_id || !rol) {
    return NextResponse.json({ error: 'E-posta, firma ve rol zorunludur' }, { status: 400 })
  }

  // Davet e-postası gönder (kullanıcı kendi şifresini belirler)
  const { data: userData, error: inviteErr } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { firma_id, ad_soyad: ad_soyad || null },
  })

  if (inviteErr) {
    return NextResponse.json({ error: inviteErr.message }, { status: 400 })
  }

  // Profil kaydını önceden oluştur
  const { error: profileErr } = await admin.from('kullanici_profilleri').upsert({
    auth_user_id: userData.user.id,
    firma_id,
    email,
    ad_soyad: ad_soyad || null,
    rol,
    aktif: true,
  }, { onConflict: 'auth_user_id' })

  if (profileErr) {
    return NextResponse.json({ error: 'Profil oluşturulamadı: ' + profileErr.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

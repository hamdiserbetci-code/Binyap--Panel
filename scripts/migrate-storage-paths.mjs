import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !serviceRoleKey) {
  console.error('NEXT_PUBLIC_SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY tanimli olmali.')
  process.exit(1)
}

const supabase = createClient(url, serviceRoleKey, { auth: { persistSession: false } })

function sanitizeFileName(fileName) {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, '_')
}

function buildCompanyStoragePath({ firmaId, modul, kategori, fileName }) {
  const safeModule = String(modul || 'genel').replace(/[^a-zA-Z0-9_-]/g, '_')
  const safeCategory = String(kategori || '').replace(/[^a-zA-Z0-9_-]/g, '_')
  const categorySegment = safeCategory ? `${safeCategory}/` : ''
  return `${firmaId}/${safeModule}/${categorySegment}${Date.now()}_${sanitizeFileName(fileName)}`
}

function isLegacyPath(path = '') {
  return path.startsWith('arsiv/') || path.startsWith('vergi/')
}

async function run() {
  const { data: documents, error } = await supabase
    .from('dokumanlar')
    .select('id, firma_id, modul, kategori, dosya_adi, dosya_url')
    .order('created_at', { ascending: true })

  if (error) {
    throw error
  }

  const legacyDocuments = (documents || []).filter((item) => isLegacyPath(item.dosya_url))
  console.log(`Toplam eski path kaydi: ${legacyDocuments.length}`)

  for (const document of legacyDocuments) {
    const newPath = buildCompanyStoragePath({
      firmaId: document.firma_id,
      modul: document.modul,
      kategori: document.kategori,
      fileName: document.dosya_adi,
    })

    console.log(`Tasiniyor: ${document.dosya_url} -> ${newPath}`)

    const { data: downloadData, error: downloadError } = await supabase.storage
      .from('dokumanlar')
      .download(document.dosya_url)

    if (downloadError) {
      console.error(`Indirme hatasi [${document.id}]: ${downloadError.message}`)
      continue
    }

    const { error: uploadError } = await supabase.storage
      .from('dokumanlar')
      .upload(newPath, downloadData, { upsert: false })

    if (uploadError) {
      console.error(`Yukleme hatasi [${document.id}]: ${uploadError.message}`)
      continue
    }

    const { error: updateError } = await supabase
      .from('dokumanlar')
      .update({ dosya_url: newPath })
      .eq('id', document.id)

    if (updateError) {
      console.error(`Tablo guncelleme hatasi [${document.id}]: ${updateError.message}`)
      continue
    }

    const { error: removeError } = await supabase.storage
      .from('dokumanlar')
      .remove([document.dosya_url])

    if (removeError) {
      console.warn(`Eski dosya silinemedi [${document.id}]: ${removeError.message}`)
    }
  }

  console.log('Migration tamamlandi.')
}

run().catch((err) => {
  console.error('Migration durdu:', err.message || err)
  process.exit(1)
})

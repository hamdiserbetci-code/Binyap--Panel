'use client'

// PDF text layer okuyucu + SGK belge parser

export async function pdfMetinOku(url: string): Promise<string> {
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs')
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js'

  const resp = await fetch(url, { mode: 'cors' })
  if (!resp.ok) throw new Error(`Dosya indirilemedi: ${resp.status}`)
  const buffer = await resp.arrayBuffer()

  const pdf = await pdfjsLib.getDocument({
    data: buffer,
    useWorkerFetch: false,
    isEvalSupported: false,
  }).promise

  const pages: string[] = []
  for (let i = 1; i <= Math.min(pdf.numPages, 5); i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    const text = content.items.map((item: any) => ('str' in item ? item.str : '')).join(' ')
    pages.push(text)
  }
  const result = pages.join('\n').trim()
  if (!result) throw new Error('Bu PDF metin içermiyor (taranmış görüntü olabilir)')
  return result
}

export interface ParsedPersonel {
  ad_soyad?: string
  tc_no?: string
  dogum_tarihi?: string   // YYYY-MM-DD
  ise_giris_tarihi?: string
  isten_cikis_tarihi?: string
  gorev?: string
  maas?: string
}

export function sgkBelgeParse(text: string): ParsedPersonel {
  const result: ParsedPersonel = {}

  // Tarih — GG.AA.YYYY veya GG/AA/YYYY → YYYY-MM-DD
  function tarihCevir(raw: string): string {
    const [d, m, y] = raw.split(/[./]/)
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
  }

  // TC No — SGK formunda rakamlar tek tek boşlukla ayrılmış: "6   9   5   0   2   1   0   1   4   8   6"
  // Strateji: text'i token'lara böl, ard arda gelen 11 tek haneli rakam dizisini bul
  const tokens = text.split(/\s+/)
  for (let i = 0; i <= tokens.length - 11; i++) {
    const slice = tokens.slice(i, i + 11)
    if (slice.every(t => /^\d$/.test(t))) {
      const tc = slice.join('')
      if (/^[1-9]\d{10}$/.test(tc)) { result.tc_no = tc; break }
    }
  }
  // Compact fallback
  if (!result.tc_no) {
    const tcMatch = text.match(/\b([1-9]\d{10})\b/)
    if (tcMatch) result.tc_no = tcMatch[1]
  }

  // Ad Soyad + Doğum Tarihi — SGK formunda şu sıra (en sonda gelir):
  // çıkış: "MEHMET DİNCER RAYİF GEVİ GÜRPINAR 21/11/1987 E"
  // giriş: "HAMDİ ŞERBETÇİ MUHYEDDİN ARİFE ŞANLIURFA 31/07/1972 Ev Tel"
  // Son eşleşmeyi al (başlık satırları ilk eşleşmeyi bozar)
  const adRegex = /([A-ZÇĞİÖŞÜ]{2,}(?:\s+[A-ZÇĞİÖŞÜ]{2,})+)\s+(\d{1,2}[./]\d{1,2}[./]\d{4})(?:\s+[EK]\b)?/g
  let adBloğu: RegExpExecArray | null = null
  let m: RegExpExecArray | null
  while ((m = adRegex.exec(text)) !== null) adBloğu = m
  if (adBloğu) {
    const kelimeler = adBloğu[1].trim().split(/\s+/)
    result.ad_soyad = kelimeler.slice(0, 2).join(' ')
    result.dogum_tarihi = tarihCevir(adBloğu[2])
  }

  // Doğum tarihi fallback
  if (!result.dogum_tarihi) {
    const mdt = text.match(/(?:doğum tarihi)[^\d]*(\d{1,2}[./]\d{1,2}[./]\d{4})/i)
    if (mdt) result.dogum_tarihi = tarihCevir(mdt[1])
  }

  // İşten Ayrılış tarihi — "16 31/03/2026" veya "ayrılış tarihi ... tarih"
  const ayrilisMatch =
    text.match(/(?:işten ayrılış tarihi|ayrılış tarihi)[^\d]*(\d{1,2}[./]\d{1,2}[./]\d{4})/i) ||
    text.match(/\b16\s+(\d{2}[./]\d{2}[./]\d{4})\b/) ||
    text.match(/(?:işten çıkış|çıkış tarihi)[^\d]*(\d{1,2}[./]\d{1,2}[./]\d{4})/i)
  if (ayrilisMatch) result.isten_cikis_tarihi = tarihCevir(ayrilisMatch[1])

  // İşe Giriş tarihi
  // Giriş belgesinde "27/03/2026 YENİŞEHİR MAH." — tarihten sonra adres gelir
  // Çıkış belgesinde "Sigortalının İşten Ayrılış Tarihi" sonrasında değil, işe giriş için etiket ara
  const girisMatch =
    text.match(/(?:işe başladığı tarih|işe giriş|giriş tarihi|sigortalılık başlangıcı)[^\d]*(\d{1,2}[./]\d{1,2}[./]\d{4})/i) ||
    text.match(/(?:hizmet başlangıcı|başlangıç tarihi)[^\d]*(\d{1,2}[./]\d{1,2}[./]\d{4})/i)
  if (girisMatch) result.ise_giris_tarihi = tarihCevir(girisMatch[1])

  // Giriş belgesinde etiket yoksa: tarihten hemen sonra büyük harf yer adı gelen tarihi al
  // "27/03/2026 YENİŞEHİR MAH." — tarihten sonra rakam/saat değil Türkçe büyük kelime gelmeli
  if (!result.ise_giris_tarihi && !result.isten_cikis_tarihi) {
    const adresTarihMatch = text.match(/(\d{2}[./]\d{2}[./]\d{4})\s+[A-ZÇĞİÖŞÜ]{3,}/)
    if (adresTarihMatch) result.ise_giris_tarihi = tarihCevir(adresTarihMatch[1])
  }

  // Meslek — "7114.04 - Betonarme Demircisi"
  const meslekMatch = text.match(/\d{4}\.\d{2}\s*[-–]\s*([A-ZÇĞİÖŞÜa-zçğışöşü]+(?:\s+[A-ZÇĞİÖŞÜa-zçğışöşü]+)*)/)
  if (meslekMatch) result.gorev = meslekMatch[1].trim()

  // Maaş — "30828.00 ÇSGB" formatı
  const maasMatch = text.match(/(\d{4,6}[.,]\d{2})\s*(?:ÇSGB|\n| {2})/i)
  if (maasMatch) result.maas = maasMatch[1].replace(',', '.')

  return result
}

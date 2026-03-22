import { NextRequest, NextResponse } from 'next/server';

const pdf = require('pdf-parse');

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json({ error: 'Dosya bulunamadi' }, { status: 400 });
    }

    // Dosyayi buffer'a (hafizaya) ceviriyoruz
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // PDF'in icindeki tum metni cikartiyoruz
    const data = await pdf(buffer);
    const text = data.text;

    // --- FATURA ICINDEKI VERILERI AYIKLAMA (REGEX) ---
    let belge_no = '';
    let tarih = '';
    let tutar = 0;
    let kdv_tutari = 0;

    // 1. Fatura No (e-Fatura standardi: 3 Harf + 20.. + 9 Rakam, Orn: GIB2024000000123)
    const belgeNoMatch = text.match(/([A-Z]{3}20[0-9]{2}[0-9]{9})/i);
    if (belgeNoMatch) belge_no = belgeNoMatch[1];

    // 2. Tarih (DD.MM.YYYY veya DD/MM/YYYY)
    const tarihMatch = text.match(/(\d{2})[\.\/](\d{2})[\.\/](\d{4})/);
    if (tarihMatch) {
      tarih = `${tarihMatch[3]}-${tarihMatch[2]}-${tarihMatch[1]}`; // Veritabanina uygun YYYY-MM-DD
    }

    // 3. Genel Toplam (Tutar) - GIB formatlarindaki "Odenecek Tutar" veya "Genel Toplam"
    const tutarMatch = text.match(/(?:Ödenecek Tutar|Odenecek Tutar|Genel Toplam|Toplam Tutar)[\s:]*([\d\.,]+)/i);
    if (tutarMatch) {
      // Noktalari (binlik ayraci) silip, virgulu (kurus ayraci) noktaya ceviriyoruz
      const val = tutarMatch[1].replace(/\./g, '').replace(',', '.');
      tutar = parseFloat(val);
    }

    // 4. Toplam KDV
    const kdvMatch = text.match(/(?:Hesaplanan KDV|Toplam KDV)[\s:]*([\d\.,]+)/i);
    if (kdvMatch) {
      const val = kdvMatch[1].replace(/\./g, '').replace(',', '.');
      kdv_tutari = parseFloat(val);
    }

    // Ayristirilan verileri ön uce (frontend'e) gonderiyoruz
    return NextResponse.json({
      success: true, belge_no, tarih, tutar, kdv_tutari, tedarikci: '' // Tedarikci ismi fatura tasarimlarinda cok degisken oldugu icin bos birakiyoruz
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'PDF okuma basarisiz oldu.' }, { status: 500 });
  }
}
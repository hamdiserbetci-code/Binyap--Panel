'use client'
import { FileText, Download, Info, CheckCircle2 } from 'lucide-react'

export default function YardimPage() {

  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          body, html, div {
            height: auto !important;
            min-height: auto !important;
            overflow: visible !important;
          }
        }
      `}} />
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 print:hidden">
        <div>
          <h2 className="text-2xl font-bold text-white mb-2 flex items-center gap-2">
            <Info className="text-indigo-400" /> Yardım ve Kullanım Kılavuzu
          </h2>
          <p className="text-slate-400 text-sm">Sistemin tüm modülleri hakkında detaylı bilgi edinin ve kullanım kılavuzunu PDF olarak indirin.</p>
        </div>
        <button 
          onClick={handlePrint}
          className="flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-all shadow-lg shadow-indigo-500/25 border border-indigo-500/50"
        >
          <Download size={18} /> Kılavuzu PDF Olarak İndir
        </button>
      </div>

      {/* Print/PDF Container */}
      <div className="bg-white/[0.02] border border-white/[0.05] rounded-2xl p-8 print:bg-white print:text-black print:border-none print:p-0">
        
        <div className="hidden print:block mb-8 text-center border-b-2 border-slate-200 pb-6">
          <h1 className="text-3xl font-bold text-slate-800 mb-2">BİNYAPI Yönetim Paneli</h1>
          <h2 className="text-xl text-slate-600">Sistem Kullanım Kılavuzu</h2>
        </div>

        <div className="space-y-12">
          {/* Dashboard */}
          <section className="print:break-inside-avoid">
            <h3 className="text-xl font-bold text-indigo-400 mb-4 flex items-center gap-2 print:text-indigo-600">
              <span className="bg-indigo-500/20 text-indigo-400 w-8 h-8 rounded-lg flex items-center justify-center print:bg-indigo-100 print:text-indigo-700">1</span>
              Dashboard (Özet Ekran)
            </h3>
            <div className="text-slate-300 space-y-3 leading-relaxed text-sm print:text-slate-700">
              <p>Sisteme giriş yaptığınızda karşılaştığınız ilk ekrandır. Bu ekranda seçili firmanın; genel projelere ait gelirleri, giderleri, banka ve kasa durumları tek bakışta özetlenir.</p>
              <ul className="list-disc pl-5 space-y-1">
                <li><strong className="text-white print:text-black">Kasa ve Banka Durumu:</strong> Nakit akışınızı ve anlık likiditenizi takip edebilirsiniz.</li>
                <li><strong className="text-white print:text-black">Son Hareketler:</strong> Son yapılan işlemler hızlıca listelenir.</li>
              </ul>
            </div>
          </section>

          {/* Projeler */}
          <section className="print:break-inside-avoid">
            <h3 className="text-xl font-bold text-blue-400 mb-4 flex items-center gap-2 print:text-blue-600">
              <span className="bg-blue-500/20 text-blue-400 w-8 h-8 rounded-lg flex items-center justify-center print:bg-blue-100 print:text-blue-700">2</span>
              Projeler Modülü
            </h3>
            <div className="text-slate-300 space-y-3 leading-relaxed text-sm print:text-slate-700">
              <p>Firmaya ait tüm projelerin yaratıldığı ve yönetildiği modüldür. Sol menüden projenin adının yanındaki oklara tıklanarak projenin alt modüllerine ulaşılabilir.</p>
              <ul className="list-disc pl-5 space-y-2">
                <li><strong className="text-white print:text-black">Ekipler:</strong> Projede yer alan personellerin (beyaz yaka, mavi yaka) tanımlandığı alandır. Bu alan, puantaj hesaplamaları için temel oluşturur.</li>
                <li><strong className="text-white print:text-black">Puantaj:</strong> Ekip üyelerinin aydaki çalışma günlerinin girildiği modüldür. Onay ve maaş ödeme süreçleri buradan takip edilir.</li>
                <li><strong className="text-white print:text-black">Hakediş & Sözleşme:</strong> Proje hak ediş tutarları hesaplanır, proje detaylarındaki sözleşme tutarları ile kıyaslanabilir.</li>
                <li><strong className="text-white print:text-black">Dökümanlar:</strong> Projeye özel yüklenmesi gereken (Sözleşme, Fatura, Dekont vb.) dosyalar bulut sistemde saklanır.</li>
              </ul>
            </div>
          </section>

          {/* Vergi Surecleri */}
          <section className="print:break-inside-avoid">
            <h3 className="text-xl font-bold text-teal-400 mb-4 flex items-center gap-2 print:text-teal-600">
              <span className="bg-teal-500/20 text-teal-400 w-8 h-8 rounded-lg flex items-center justify-center print:bg-teal-100 print:text-teal-700">3</span>
              Vergi Süreçleri
            </h3>
            <div className="text-slate-300 space-y-3 leading-relaxed text-sm print:text-slate-700">
              <p>Firma vergi beyannamelerinin kaydedilip son ödeme tarihlerinin takip edildiği, muhasebesel süreçlerin aksamamasını sağlayan kritik modüldür.</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Vergi türü seçilir (KDV, SGK, Muhtasar, Geçici Vergi).</li>
                <li><strong className="text-white print:text-black">Son Tarih:</strong> Ödemenin yapılması gereken veya beyannamenin verilmesi gereken son tarihi belirtir.</li>
                <li>Dönemsel filtreleme sayesinde geç kalan işlemleri görebilirsiniz.</li>
              </ul>
            </div>
          </section>

          {/* Finans Modulleri */}
          <section className="print:break-inside-avoid">
            <h3 className="text-xl font-bold text-amber-400 mb-4 flex items-center gap-2 print:text-amber-600">
              <span className="bg-amber-500/20 text-amber-400 w-8 h-8 rounded-lg flex items-center justify-center print:bg-amber-100 print:text-amber-700">4</span>
              Finans ve Maliyet Kontrolü
            </h3>
            <div className="text-slate-300 space-y-3 leading-relaxed text-sm print:text-slate-700">
              <p>Detaylı muhasebe, banka, cari hesabı hareketlerinin işlendiği bölümdür.</p>
              <ul className="list-disc pl-5 space-y-2">
                <li><strong className="text-white print:text-black">Maliyet Kontrolü:</strong> Dönemlik ve Kümülatif olarak satış faturaları, işçilik giderleri, devreden KDV ve diğer çeşitli giderlerin hesabı tutularak "Net Kâr/Zarar" analizi raporlanır.</li>
                <li><strong className="text-white print:text-black">Ödeme Planı:</strong> Kesilen çekler, aylık veya dönemsel ödeme sözü verilen kalemler listelenir. 'Beklemede, Ödendi, Gecikti' durumları takip edilir.</li>
                <li><strong className="text-white print:text-black">Kasa Takibi:</strong> Nakit giriş ve çıkışlarının tarih ve evrak numarası bazında kaydedilmesi.</li>
                <li><strong className="text-white print:text-black">Banka Hesapları & Cari Hesaplar:</strong> Hesaplarda gerçekleşen tüm işlemler mutabakat amaçlı kaydedilir.</li>
              </ul>
            </div>
          </section>

          {/* Diger Moduller */}
          <section className="print:break-inside-avoid">
            <h3 className="text-xl font-bold text-rose-400 mb-4 flex items-center gap-2 print:text-rose-600">
              <span className="bg-rose-500/20 text-rose-400 w-8 h-8 rounded-lg flex items-center justify-center print:bg-rose-100 print:text-rose-700">5</span>
              Görevler ve Raporlama
            </h3>
            <div className="text-slate-300 space-y-3 leading-relaxed text-sm print:text-slate-700">
              <ul className="list-disc pl-5 space-y-2">
                <li><strong className="text-white print:text-black">Yapılacak İşler (Görevler):</strong> Haftalık, aylık veya günlük olarak kullanıcı tabanlı notların ve işlerin eklendiği takiptir. Onay kutusuyla görevler bitirilebilir.</li>
                <li><strong className="text-white print:text-black">Excel Raporlama:</strong> Veri yedeklemesi ve çıktı ihtiyacı için kullanılır. Ödeme planı, puantaj, vergi ve genel maliyet durumunun profesyonel hesap tablosu olarak indirilmesini sağlar. Sadece seçili firma veya tüm firmaların aynı dosyada birleştirilmesi mümkündür.</li>
              </ul>
            </div>
          </section>

          {/* Extra Info */}
          <div className="mt-12 bg-indigo-500/10 border border-indigo-500/20 p-6 rounded-2xl print:bg-gray-50 print:border-gray-300">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="text-indigo-400 flex-shrink-0 mt-0.5 print:text-black" />
              <div>
                <h4 className="text-white font-semibold mb-1 print:text-black">İpucu: PDF Olarak Kaydetme</h4>
                <p className="text-sm text-slate-400 print:text-slate-600">
                  Kılavuzu bilgisayarınıza kaydetmek için üst kısımda bulunan "Kılavuzu PDF Olarak İndir" butonuna basınız. Açılan yazdırma (Print) penceresinde Hedef / Yazıcı (Destination) ayarını "PDF Olarak Kaydet (Save as PDF)" şeklinde seçmeniz yeterlidir.
                </p>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}

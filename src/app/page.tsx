'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase, Firma, Proje } from '@/lib/supabase'
import ProjelerPage from '@/components/projeler/ProjelerPage'
import ProjeDetayPage from '@/components/projeler/ProjeDetayPage'
import EkiplerPage from '@/components/ekipler/EkiplerPage'
import PuantajPage from '@/components/puantaj/PuantajPage'
import DokumanlarPage from '@/components/dokumanlar/DokumanlarPage'
import VergiPage from '@/components/vergi/VergiPage'
import GelirTakibiPage from '@/components/gelir/GelirTakibiPage'
import GiderTakibiPage from '@/components/gider/GiderTakibiPage'
import OdemePlaniPage from '@/components/odeme/OdemePlaniPage'
import KasaPage from '@/components/kasa/KasaPage'
import GorevlerPage from '@/components/gorevler/GorevlerPage'
import RaporlamaPage from '@/components/raporlama/RaporlamaPage'
import CariHesaplarPage from '@/components/cari/CariHesaplarPage'
import BankalarPage from '@/components/banka/BankalarPage'
import SirketEvraklariPage from '@/components/sirket/SirketEvraklariPage'
import BildirimSistemi from '@/components/ui/BildirimSistemi'
import DashboardPage from '@/components/dashboard/DashboardPage'
import PasswordDegistirModal from '@/components/ui/PasswordDegistirModal'
import { FolderOpen, Clock, Receipt, TrendingUp, TrendingDown, CreditCard, CheckSquare, LogOut, Menu, BarChart2, Wallet, FileText, LayoutDashboard, ChevronDown, ChevronRight, Users, DollarSign, Shield, RefreshCw, Folder } from 'lucide-react'

type SubPage = 'hakedis' | 'sozlesme' | 'fatura' | 'teminat' | 'yansitma'
type DokKat = 'sozlesmeler' | 'hakedisler' | 'satis_faturalari' | 'maas_dekontlari' | 'arabulucu_evraklari' | 'alis_faturalari'
type Page = 'dashboard' | 'projeler' | 'proje-ekipler' | 'proje-puantaj' | 'proje-detay' | 'proje-dokuman' | 'vergi' | 'gelir' | 'gider' | 'odeme' | 'kasa' | 'cari' | 'banka' | 'sirket' | 'gorevler' | 'raporlama'

const VERGI_TURLERI = [
  { id:'kdv', label:'KDV' },
  { id:'muhtasar_sgk', label:'Muhtasar-SGK' },
  { id:'gecici_vergi', label:'Geçici Vergi' },
  { id:'kurumlar_vergisi', label:'Kurumlar Vergisi' },
  { id:'edefter_berat', label:'E-Defter Berat Gönderme' },
]

const PROJE_SUBS: { id: SubPage; label: string; icon: React.ReactNode }[] = [
  { id:'hakedis', label:'Hakediş', icon:<DollarSign size={12}/> },
  { id:'sozlesme', label:'Sözleşme', icon:<FileText size={12}/> },
  { id:'fatura', label:'Faturalar', icon:<Receipt size={12}/> },
  { id:'teminat', label:'Teminatlar', icon:<Shield size={12}/> },
  { id:'yansitma', label:'Yansıtma Faturaları', icon:<RefreshCw size={12}/> },
]

const DOK_CATS: { id: DokKat; label: string }[] = [
  { id:'sozlesmeler', label:'Sözleşmeler' },
  { id:'hakedisler', label:'Hakedişler' },
  { id:'satis_faturalari', label:'Satış Faturaları' },
  { id:'maas_dekontlari', label:'Maaş Ödeme Dekontları' },
  { id:'arabulucu_evraklari', label:'Arabulucu Evrakları' },
  { id:'alis_faturalari', label:'Alış Faturaları' },
]

export default function App() {
  const [user, setUser] = useState<any>(null)
  const [activePage, setActivePage] = useState<Page>('dashboard')
  const [activeSubPage, setActiveSubPage] = useState<SubPage>('hakedis')
  const [activeDokKat, setActiveDokKat] = useState<DokKat>('sozlesmeler')
  const [firma, setFirma] = useState<Firma | null>(null)
  const [projeler, setProjeler] = useState<Proje[]>([])
  const [selectedProje, setSelectedProje] = useState<Proje | null>(null)
  const [expandedProje, setExpandedProje] = useState<string | null>(null)
  const [expandedDok, setExpandedDok] = useState<string | null>(null)
  const [projelerAcik, setProjelerAcik] = useState(false)
  const [expandedVergi, setExpandedVergi] = useState<string | null>(null)
  const [vergiAcik, setVergiAcik] = useState(false)
  const [selectedVergiFirma, setSelectedVergiFirma] = useState<Firma | null>(null)
  const [selectedVergiTur, setSelectedVergiTur] = useState<string>('kdv')
  const [tumFirmalar, setTumFirmalar] = useState<Firma[]>([])
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [passwordModalOpen, setPasswordModalOpen] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { window.location.href = '/login'; return }
      setUser(data.user)
    })
  }, [])

  const fetchFirmalar = useCallback(async () => {
    let { data } = await supabase.from('firmalar').select('*').order('ad')
    if ((!data || data.length === 0) && user) {
      await supabase.from('firmalar').insert([{ ad: 'Binyapı' }, { ad: 'ETM' }])
      const res = await supabase.from('firmalar').select('*').order('ad')
      data = res.data
    }
    if (data) {
      setTumFirmalar(data)
      setFirma(prev => prev || data[0] || null)
    }
  }, [user])

  const fetchProjeler = useCallback(async () => {
    if (!firma) return
    const { data } = await supabase.from('projeler').select('*').eq('firma_id', firma.id).order('ad')
    setProjeler(data || [])
  }, [firma])

  useEffect(() => { if (user) fetchFirmalar() }, [user, fetchFirmalar])
  useEffect(() => { if (firma) fetchProjeler() }, [firma, fetchProjeler])

  useEffect(() => {
    async function fetchTumFirmalar() {
      const { data } = await supabase.from('firmalar').select('*').order('ad')
      setTumFirmalar(data || [])
    }
    if (user) fetchTumFirmalar()
  }, [user])

  async function signOut() {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  function navToPage(page: Page, proje?: Proje) {
    if (proje) setSelectedProje(proje)
    setActivePage(page)
    setSidebarOpen(false)
  }

  function navToProjeSub(proje: Proje, sub: SubPage) {
    setSelectedProje(proje); setActiveSubPage(sub); setActivePage('proje-detay'); setSidebarOpen(false)
  }

  function navToDokKat(proje: Proje, kat: DokKat) {
    setSelectedProje(proje); setActiveDokKat(kat); setActivePage('proje-dokuman'); setSidebarOpen(false)
  }

  const PAGE_TITLES: Record<Page, string> = {
    dashboard:'Dashboard', projeler:'Projeler', 'proje-ekipler':'Ekipler',
    'proje-puantaj':'Puantaj', 'proje-detay':'Proje Detay', 'proje-dokuman':'Dökümanlar',
    vergi:'Vergi Süreçleri', gelir:'Gelir Takibi', gider:'Gider Takibi', odeme:'Ödeme Planı',
    kasa:'Kasa Takibi', cari:'Cari Hesaplar', banka:'Banka Hesapları', sirket:'Şirket Evrakları', gorevler:'Yapılacak İşler', raporlama:'Excel Raporlama'
  }

  const navBtn = (id: Page, label: string, icon: React.ReactNode, color = 'blue') => {
    const colorMap: Record<string, string> = {
      blue: 'bg-blue-600 text-white shadow-blue-900/40',
      emerald: 'bg-emerald-600 text-white shadow-emerald-900/40',
      violet: 'bg-violet-600 text-white shadow-violet-900/40',
      amber: 'bg-amber-500 text-white shadow-amber-900/40',
      rose: 'bg-rose-600 text-white shadow-rose-900/40',
      cyan: 'bg-cyan-600 text-white shadow-cyan-900/40',
    }
    const active = colorMap[color] || colorMap.blue
    return (
      <button key={id} onClick={() => navToPage(id)}
        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all mb-0.5 ${activePage===id?`${active} shadow-lg`:'text-slate-400 hover:text-white hover:bg-white/5'}`}>
        {icon}<span>{label}</span>
      </button>
    )
  }

  const Sidebar = () => (
    <div className="flex flex-col h-full" style={{background:'linear-gradient(180deg,#0f1729 0%,#0d1524 100%)'}}>
      <div className="px-5 py-5 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{background:'linear-gradient(135deg,#2563eb,#1d4ed8)'}}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M2 4h14M2 9h14M2 14h9" stroke="white" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </div>
          <div>
            <p className="text-white font-bold text-sm tracking-wide">BİNYAPI</p>
            <p className="text-slate-500 text-[11px]">Yönetim Paneli</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 overflow-y-auto">
        {navBtn('dashboard', 'Dashboard', <LayoutDashboard size={16}/>, 'blue')}

        <p className="text-[10px] font-semibold text-slate-600 uppercase tracking-widest px-3 mt-4 mb-2">Projeler</p>

        <button onClick={() => { setProjelerAcik(!projelerAcik); navToPage('projeler') }}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all mb-1 ${activePage==='projeler'?'bg-indigo-600 text-white shadow-lg shadow-indigo-900/40':'text-slate-400 hover:text-white hover:bg-white/5'}`}>
          <FolderOpen size={16}/><span className="flex-1 text-left">Projeler</span>
          {projelerAcik ? <ChevronDown size={13}/> : <ChevronRight size={13}/>}
        </button>

        {projelerAcik && (
          <div className="space-y-0.5 mb-1">
          {projeler.map(p => (
            <div key={p.id}>
              <button onClick={() => setExpandedProje(expandedProje===p.id ? null : p.id)}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-all ${expandedProje===p.id?'bg-white/10 text-white':'text-slate-500 hover:text-slate-300 hover:bg-white/5'}`}>
                <FolderOpen size={13} className="flex-shrink-0"/>
                <span className="flex-1 text-left truncate">{p.ad}</span>
                {expandedProje===p.id ? <ChevronDown size={11}/> : <ChevronRight size={11}/>}
              </button>

              {expandedProje===p.id && (
                <div className="ml-3 mt-0.5 border-l border-white/10 pl-2 space-y-0.5">
                  {/* Ekipler */}
                  <button onClick={() => navToPage('proje-ekipler', p)}
                    className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${activePage==='proje-ekipler'&&selectedProje?.id===p.id?'bg-blue-600 text-white':'text-slate-500 hover:text-slate-300 hover:bg-white/5'}`}>
                    <Users size={11}/><span>Ekipler</span>
                  </button>
                  {/* Puantaj */}
                  <button onClick={() => navToPage('proje-puantaj', p)}
                    className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${activePage==='proje-puantaj'&&selectedProje?.id===p.id?'bg-blue-600 text-white':'text-slate-500 hover:text-slate-300 hover:bg-white/5'}`}>
                    <Clock size={11}/><span>Puantaj</span>
                  </button>
                  {/* Detay sayfaları */}
                  {PROJE_SUBS.map(sub => (
                    <button key={sub.id} onClick={() => navToProjeSub(p, sub.id)}
                      className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${activePage==='proje-detay'&&activeSubPage===sub.id&&selectedProje?.id===p.id?'bg-blue-600 text-white':'text-slate-500 hover:text-slate-300 hover:bg-white/5'}`}>
                      <span className="flex-shrink-0">{sub.icon}</span><span>{sub.label}</span>
                    </button>
                  ))}
                  {/* Dökümanlar ana başlık */}
                  <button onClick={() => setExpandedDok(expandedDok===p.id ? null : p.id)}
                    className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${expandedDok===p.id?'text-white bg-white/10':'text-slate-500 hover:text-slate-300 hover:bg-white/5'}`}>
                    <Folder size={11} className="flex-shrink-0"/>
                    <span className="flex-1 text-left">Dökümanlar</span>
                    {expandedDok===p.id ? <ChevronDown size={10}/> : <ChevronRight size={10}/>}
                  </button>
                  {/* Döküman kategorileri */}
                  {expandedDok===p.id && (
                    <div className="ml-3 border-l border-white/5 pl-2 space-y-0.5">
                      {DOK_CATS.map(kat => (
                        <button key={kat.id} onClick={() => navToDokKat(p, kat.id)}
                          className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-[11px] font-medium transition-all ${activePage==='proje-dokuman'&&activeDokKat===kat.id&&selectedProje?.id===p.id?'bg-blue-600 text-white':'text-slate-600 hover:text-slate-300 hover:bg-white/5'}`}>
                          <span className="w-1 h-1 rounded-full bg-current flex-shrink-0"/>
                          <span className="truncate">{kat.label}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
          </div>
        )}

        <p className="text-[10px] font-semibold text-slate-600 uppercase tracking-widest px-3 mt-3 mb-2">Vergi</p>
        <button onClick={() => { setVergiAcik(!vergiAcik); navToPage('vergi') }}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all mb-1 ${activePage==='vergi'&&!selectedVergiFirma?'bg-blue-600 text-white shadow-lg shadow-blue-900/30':'text-slate-400 hover:text-white hover:bg-white/5'}`}>
          <Receipt size={16}/><span className="flex-1 text-left">Vergi Süreçleri</span>
          {vergiAcik ? <ChevronDown size={13}/> : <ChevronRight size={13}/>}
        </button>

        {vergiAcik && (
          <div className="space-y-0.5 mb-1">
            {tumFirmalar.map(f => (
              <div key={f.id}>
                <button onClick={() => setExpandedVergi(expandedVergi===f.id ? null : f.id)}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-all ${expandedVergi===f.id?'bg-white/10 text-white':'text-slate-500 hover:text-slate-300 hover:bg-white/5'}`}>
                  <Receipt size={13} className="flex-shrink-0"/>
                  <span className="flex-1 text-left truncate">{f.ad}</span>
                  {expandedVergi===f.id ? <ChevronDown size={11}/> : <ChevronRight size={11}/>}
                </button>
                {expandedVergi===f.id && (
                  <div className="ml-3 border-l border-white/10 pl-2 space-y-0.5 mt-0.5">
                    {VERGI_TURLERI.map(vt => (
                      <button key={vt.id} onClick={() => { setSelectedVergiFirma(f); setSelectedVergiTur(vt.id); setActivePage('vergi'); setSidebarOpen(false) }}
                        className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${activePage==='vergi'&&selectedVergiFirma?.id===f.id&&selectedVergiTur===vt.id?'bg-blue-600 text-white':'text-slate-500 hover:text-slate-300 hover:bg-white/5'}`}>
                        <span className="w-1 h-1 rounded-full bg-current flex-shrink-0"/>
                        <span className="truncate">{vt.label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <p className="text-[10px] font-semibold text-slate-600 uppercase tracking-widest px-3 mt-3 mb-2">Finans</p>
        {navBtn('gelir', 'Gelir Takibi', <TrendingUp size={16}/>, 'emerald')}
        {navBtn('gider', 'Gider Takibi', <TrendingDown size={16}/>, 'rose')}
        {navBtn('odeme', 'Ödeme Planı', <CreditCard size={16}/>, 'violet')}
        {navBtn('kasa', 'Kasa', <Wallet size={16}/>, 'amber')}
        {navBtn('sirket', 'Şirket Evrakları', <FileText size={16}/>, 'cyan')}

        <p className="text-[10px] font-semibold text-slate-600 uppercase tracking-widest px-3 mt-3 mb-2">Görevler</p>
        {navBtn('gorevler', 'Yapılacak İşler', <CheckSquare size={16}/>, 'rose')}

        <p className="text-[10px] font-semibold text-slate-600 uppercase tracking-widest px-3 mt-3 mb-2">Raporlar</p>
        {navBtn('raporlama', 'Excel Raporlama', <BarChart2 size={16}/>, 'cyan')}
      </nav>

      <div className="px-3 py-3 border-t border-white/5">
        <div className="flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-white/5 transition-all">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
            {user?.email?.[0]?.toUpperCase() || 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-xs font-medium truncate">{user?.email?.split('@')[0]}</p>
            <p className="text-slate-500 text-[10px] truncate">{user?.email}</p>
          </div>
          <button
            onClick={() => setPasswordModalOpen(true)}
            className="text-[11px] text-slate-500 hover:text-slate-900 transition-colors flex-shrink-0"
            type="button"
          >
            Şifre
          </button>
          <button onClick={signOut} className="text-slate-500 hover:text-red-400 transition-colors flex-shrink-0">
            <LogOut size={14}/>
          </button>
        </div>
      </div>
    </div>
  )

  const renderContent = () => {
    if (!user || !firma) return (
      <div className="flex items-center justify-center h-full">
        <p className="text-slate-400 text-sm">Yükleniyor...</p>
      </div>
    )

    return (
      <div className="h-full overflow-y-auto p-4">
        {activePage === 'dashboard' && <DashboardPage userId={user.id} firma={firma} onNavigate={(p) => setActivePage(p as Page)}/>}
        {activePage === 'projeler' && <ProjelerPage userId={user.id} firma={firma} onProjeSelect={(p) => { if(p) { setSelectedProje(p); setExpandedProje(p.id) } }} onProjelerUpdate={(list) => setProjeler(list)} selectedProjeId={selectedProje?.id}/>}
        {activePage === 'proje-ekipler' && selectedProje && <EkiplerPage userId={user.id} firma={firma} proje={selectedProje}/>}
        {activePage === 'proje-puantaj' && <PuantajPage userId={user.id} firma={firma}/>}
        {activePage === 'proje-detay' && selectedProje && <ProjeDetayPage userId={user.id} firma={firma} proje={selectedProje} subPage={activeSubPage}/>}
        {activePage === 'proje-dokuman' && selectedProje && <DokumanlarPage userId={user.id} firma={firma} proje={selectedProje} kategori={activeDokKat}/>}
        {activePage === 'vergi' && (selectedVergiFirma 
          ? <VergiPage userId={user.id} firma={selectedVergiFirma} vergiTur={selectedVergiTur}/> 
          : <VergiPage userId={user.id} firma={firma} vergiTur={selectedVergiTur}/>)}
        {activePage === 'gelir' && <GelirTakibiPage userId={user.id} firma={firma}/>}
        {activePage === 'gider' && <GiderTakibiPage userId={user.id} firma={firma}/>}
        {activePage === 'odeme' && <OdemePlaniPage userId={user.id} firma={firma}/>} 
        {activePage === 'kasa' && <KasaPage userId={user.id} firma={firma}/>} 
        {activePage === 'sirket' && <SirketEvraklariPage userId={user.id} firma={firma}/>}
        {activePage === 'cari' && <CariHesaplarPage userId={user.id} firma={firma}/>}
        {activePage === 'banka' && <BankalarPage userId={user.id} firma={firma}/>}
        {activePage === 'gorevler' && <GorevlerPage userId={user.id} firmalar={[firma]}/>}
        {activePage === 'raporlama' && <RaporlamaPage userId={user.id} firmalar={[firma]}/>}
      </div>
    )
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <div className="hidden lg:flex w-60 flex-shrink-0 flex-col"><Sidebar/></div>

      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/60" onClick={() => setSidebarOpen(false)}/>
          <div className="absolute left-0 top-0 bottom-0 w-64 z-50"><Sidebar/></div>
        </div>
      )}

      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="bg-white border-b border-slate-100 px-4 h-14 flex items-center gap-3 flex-shrink-0">
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden text-slate-400 hover:text-slate-600"><Menu size={20}/></button>
          <div className="flex items-center gap-2 flex-1 min-w-0 text-sm">
            <span className="font-semibold text-slate-800">{PAGE_TITLES[activePage]}</span>
            {selectedProje && ['proje-ekipler','proje-puantaj','proje-detay','proje-dokuman'].includes(activePage) && (
              <><ChevronRight size={14} className="text-slate-300 flex-shrink-0"/>
              <span className="text-slate-500 truncate">{selectedProje.ad}</span></>
            )}

          </div>
          {user && <BildirimSistemi userId={user.id}/>}
        </div>
        <div className="flex-1 overflow-hidden bg-slate-50">
          {renderContent()}
        </div>
      </div>

      {passwordModalOpen && (
        <PasswordDegistirModal onClose={() => setPasswordModalOpen(false)} />
      )}
    </div>
  )
}

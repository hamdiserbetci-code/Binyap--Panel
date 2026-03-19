'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase, Firma, Proje } from '@/lib/supabase'
import ProjelerPage from '@/components/projeler/ProjelerPage'
import ProjeDetayPage from '@/components/projeler/ProjeDetayPage'
import EkiplerPage from '@/components/ekipler/EkiplerPage'
import PuantajPage from '@/components/puantaj/PuantajPage'
import DokumanlarPage from '@/components/dokumanlar/DokumanlarPage'
import VergiPage from '@/components/vergi/VergiPage'
import MaliyetPage from '@/components/maliyet/MaliyetPage'
import OdemePlaniPage from '@/components/odeme/OdemePlaniPage'
import KasaPage from '@/components/kasa/KasaPage'
import GorevlerPage from '@/components/gorevler/GorevlerPage'
import RaporlamaPage from '@/components/raporlama/RaporlamaPage'
import CariHesaplarPage from '@/components/cari/CariHesaplarPage'
import BankalarPage from '@/components/banka/BankalarPage'
import SirketEvraklariPage from '@/components/sirket/SirketEvraklariPage'
import MalatyaMaliyetPage from '@/components/malatya/MalatyaMaliyetPage'
import BildirimSistemi from '@/components/ui/BildirimSistemi'
import DashboardPage from '@/components/dashboard/DashboardPage'
import PasswordDegistirModal from '@/components/ui/PasswordDegistirModal'
import { FolderOpen, Clock, Receipt, TrendingUp, TrendingDown, CreditCard, CheckSquare, LogOut, Menu, BarChart2, Wallet, FileText, LayoutDashboard, ChevronDown, ChevronRight, Users, DollarSign, Shield, RefreshCw, Folder } from 'lucide-react'

type SubPage = 'hakedis' | 'sozlesme' | 'fatura' | 'teminat' | 'yansitma'
type DokKat = 'sozlesmeler' | 'hakedisler' | 'satis_faturalari' | 'maas_dekontlari' | 'arabulucu_evraklari' | 'alis_faturalari'
type Page = 'dashboard' | 'projeler' | 'proje-ekipler' | 'proje-puantaj' | 'proje-detay' | 'proje-dokuman' | 'vergi' | 'maliyet' | 'odeme' | 'kasa' | 'cari' | 'banka' | 'sirket' | 'malatya-maliyet' | 'gorevler' | 'raporlama'

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

  const fetchFirma = useCallback(async () => {
    const { data } = await supabase.from('firmalar').select('*').limit(1).single()
    if (data) setFirma(data)
  }, [])

  const fetchProjeler = useCallback(async () => {
    if (!firma) return
    const { data } = await supabase.from('projeler').select('*').eq('firma_id', firma.id).order('ad')
    setProjeler(data || [])
  }, [firma])

  useEffect(() => { if (user) fetchFirma() }, [user, fetchFirma])
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
    vergi:'Vergi Süreçleri', maliyet:'Maliyet Kontrolü', odeme:'Ödeme Planı',
    kasa:'Kasa Takibi', cari:'Cari Hesaplar', banka:'Banka Hesapları', sirket:'Şirket Evrakları', 'malatya-maliyet':'Malatya Proje Maliyet', gorevler:'Yapılacak İşler', raporlama:'Excel Raporlama'
  }

  const navBtn = (id: Page, label: string, icon: React.ReactNode) => {
    const isActive = activePage === id;
    return (
      <button key={id} onClick={() => navToPage(id)}
        className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-300 mb-1 group
          ${isActive 
            ? 'bg-gradient-to-r from-indigo-500/15 to-blue-500/10 text-indigo-400 shadow-[inset_0px_1px_1px_rgba(255,255,255,0.05),0_4px_12px_rgba(0,0,0,0.2)] border border-indigo-500/20' 
            : 'text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent'}`}>
        <div className={`flex items-center justify-center transition-transform duration-300 group-hover:scale-110 ${isActive ? 'text-indigo-400' : 'text-slate-500 group-hover:text-slate-300'}`}>
          {icon}
        </div>
        <span className="flex-1 text-left tracking-wide">{label}</span>
      </button>
    )
  }

  const Sidebar = () => (
    <div className="flex flex-col h-full bg-[#0B1120] border-r border-[#1E293B] shadow-2xl relative">
      <div className="absolute top-0 left-0 right-0 h-32 bg-indigo-500/10 blur-[50px] pointer-events-none" />

      <div className="px-6 py-6 border-b border-white/5 relative z-10">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg shadow-indigo-500/20 border border-white/10" style={{background:'linear-gradient(135deg,#4F46E5,#2563EB)'}}>
            <svg width="20" height="20" viewBox="0 0 18 18" fill="none">
              <path d="M2 4h14M2 9h14M2 14h9" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
            </svg>
          </div>
          <div>
            <p className="text-white font-bold text-[15px] tracking-wide bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-200">BİNYAPI</p>
            <p className="text-indigo-400/80 font-medium text-[11px] uppercase tracking-wider mt-0.5">Yönetim Paneli</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-4 py-5 overflow-y-auto [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-white/5 hover:[&::-webkit-scrollbar-thumb]:bg-white/10 [&::-webkit-scrollbar-thumb]:rounded-full relative z-10">
        {navBtn('dashboard', 'Dashboard', <LayoutDashboard size={18}/>)}

        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-4 mt-6 mb-3">Projeler</p>

        <button onClick={() => { setProjelerAcik(!projelerAcik); navToPage('projeler') }}
          className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-300 mb-1 group
            ${activePage === 'projeler' 
              ? 'bg-gradient-to-r from-indigo-500/15 to-blue-500/10 text-indigo-400 shadow-[inset_0px_1px_1px_rgba(255,255,255,0.05),0_4px_12px_rgba(0,0,0,0.2)] border border-indigo-500/20' 
              : 'text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent'}`}>
          <div className={`transition-transform duration-300 group-hover:scale-110 ${activePage === 'projeler' ? 'text-indigo-400' : 'text-slate-500 group-hover:text-slate-300'}`}>
            <FolderOpen size={18}/>
          </div>
          <span className="flex-1 text-left tracking-wide">Projeler</span>
          {projelerAcik ? <ChevronDown size={14} className="opacity-70"/> : <ChevronRight size={14} className="opacity-50 group-hover:opacity-100"/>}
        </button>

        {projelerAcik && (
          <div className="space-y-1 mb-2 mt-1 relative before:absolute before:inset-y-0 before:left-[21px] before:w-px before:bg-white/5">
          {projeler.map(p => (
            <div key={p.id} className="relative">
               <div className="absolute left-[21px] top-[18px] w-3 h-px bg-white/10" />
              <button onClick={() => setExpandedProje(expandedProje===p.id ? null : p.id)}
                className={`w-full flex items-center gap-2.5 pl-10 pr-3 py-2 rounded-xl text-[12px] font-medium transition-all duration-200 ${expandedProje===p.id?'text-white bg-white/5':'text-slate-400 hover:text-slate-200 hover:bg-white/5'}`}>
                <span className="flex-1 text-left truncate">{p.ad}</span>
                {expandedProje===p.id ? <ChevronDown size={12} className="opacity-70"/> : <ChevronRight size={12} className="opacity-50"/>}
              </button>

              {expandedProje===p.id && (
                <div className="ml-[42px] mt-1 mb-2 space-y-1 relative before:absolute before:inset-y-0 before:-left-3 before:w-px before:bg-white/5">
                  <div className="absolute -left-3 top-[14px] w-2 h-px bg-white/10" />
                  <button onClick={() => navToPage('proje-ekipler', p)}
                    className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all duration-200 ${activePage==='proje-ekipler'&&selectedProje?.id===p.id?'text-indigo-400 bg-indigo-500/10 font-semibold':'text-slate-500 hover:text-slate-300 hover:bg-white/5'}`}>
                    <Users size={12}/><span>Ekipler</span>
                  </button>
                  <div className="absolute -left-3 top-[42px] w-2 h-px bg-white/10" />
                  <button onClick={() => navToPage('proje-puantaj', p)}
                    className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all duration-200 ${activePage==='proje-puantaj'&&selectedProje?.id===p.id?'text-indigo-400 bg-indigo-500/10 font-semibold':'text-slate-500 hover:text-slate-300 hover:bg-white/5'}`}>
                    <Clock size={12}/><span>Puantaj</span>
                  </button>
                  {PROJE_SUBS.map((sub, i) => (
                    <div key={sub.id} className="relative">
                      <div className="absolute -left-3 top-[14px] w-2 h-px bg-white/10" />
                      <button onClick={() => navToProjeSub(p, sub.id)}
                        className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all duration-200 ${activePage==='proje-detay'&&activeSubPage===sub.id&&selectedProje?.id===p.id?'text-indigo-400 bg-indigo-500/10 font-semibold':'text-slate-500 hover:text-slate-300 hover:bg-white/5'}`}>
                        <span className="flex-shrink-0 opacity-70">{sub.icon}</span><span>{sub.label}</span>
                      </button>
                    </div>
                  ))}
                  
                  <div className="relative">
                    <div className="absolute -left-3 top-[14px] w-2 h-px bg-white/10" />
                    <button onClick={() => setExpandedDok(expandedDok===p.id ? null : p.id)}
                      className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all duration-200 ${expandedDok===p.id?'text-indigo-400 bg-white/5':'text-slate-500 hover:text-slate-300 hover:bg-white/5'}`}>
                      <Folder size={12} className="flex-shrink-0 opacity-70"/>
                      <span className="flex-1 text-left">Dökümanlar</span>
                      {expandedDok===p.id ? <ChevronDown size={11} className="opacity-70"/> : <ChevronRight size={11} className="opacity-50"/>}
                    </button>
                  </div>
                  {expandedDok===p.id && (
                    <div className="ml-2 mt-1 space-y-0.5">
                      {DOK_CATS.map(kat => (
                        <button key={kat.id} onClick={() => navToDokKat(p, kat.id)}
                          className={`w-full flex items-center gap-2.5 pl-3 pr-2 py-1.5 rounded-lg text-[10px] font-medium transition-all duration-200 ${activePage==='proje-dokuman'&&activeDokKat===kat.id&&selectedProje?.id===p.id?'text-indigo-400 bg-indigo-500/5':'text-slate-600 hover:text-slate-400 hover:bg-white/5'}`}>
                          <span className={`w-1 h-1 rounded-full flex-shrink-0 ${activePage==='proje-dokuman'&&activeDokKat===kat.id?'bg-indigo-400 shadow-[0_0_8px_rgba(129,140,248,0.8)]':'bg-slate-600'}`}/>
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

        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-4 mt-6 mb-3">Vergi</p>
        <button onClick={() => { setVergiAcik(!vergiAcik); navToPage('vergi') }}
          className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-300 mb-1 group
            ${activePage === 'vergi' && !selectedVergiFirma 
              ? 'bg-gradient-to-r from-indigo-500/15 to-blue-500/10 text-indigo-400 shadow-[inset_0px_1px_1px_rgba(255,255,255,0.05),0_4px_12px_rgba(0,0,0,0.2)] border border-indigo-500/20' 
              : 'text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent'}`}>
          <div className={`transition-transform duration-300 group-hover:scale-110 ${activePage === 'vergi' && !selectedVergiFirma ? 'text-indigo-400' : 'text-slate-500 group-hover:text-slate-300'}`}>
            <Receipt size={18}/>
          </div>
          <span className="flex-1 text-left tracking-wide">Vergi Süreçleri</span>
          {vergiAcik ? <ChevronDown size={14} className="opacity-70"/> : <ChevronRight size={14} className="opacity-50 group-hover:opacity-100"/>}
        </button>

        {vergiAcik && (
          <div className="space-y-1 mb-2 mt-1 relative before:absolute before:inset-y-0 before:left-[21px] before:w-px before:bg-white/5">
            {tumFirmalar.map(f => (
              <div key={f.id} className="relative">
                <div className="absolute left-[21px] top-[18px] w-3 h-px bg-white/10" />
                <button onClick={() => setExpandedVergi(expandedVergi===f.id ? null : f.id)}
                  className={`w-full flex items-center gap-2.5 pl-10 pr-3 py-2 rounded-xl text-[12px] font-medium transition-all duration-200 ${expandedVergi===f.id?'text-white bg-white/5':'text-slate-400 hover:text-slate-200 hover:bg-white/5'}`}>
                  <span className="flex-1 text-left truncate">{f.ad}</span>
                  {expandedVergi===f.id ? <ChevronDown size={12} className="opacity-70"/> : <ChevronRight size={12} className="opacity-50"/>}
                </button>
                {expandedVergi===f.id && (
                  <div className="ml-[42px] mt-1 mb-2 space-y-1 relative before:absolute before:inset-y-0 before:-left-3 before:w-px before:bg-white/5">
                    {VERGI_TURLERI.map(vt => (
                      <div key={vt.id} className="relative">
                        <div className="absolute -left-3 top-[14px] w-2 h-px bg-white/10" />
                        <button onClick={() => { setSelectedVergiFirma(f); setSelectedVergiTur(vt.id); setActivePage('vergi'); setSidebarOpen(false) }}
                          className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all duration-200 ${activePage==='vergi'&&selectedVergiFirma?.id===f.id&&selectedVergiTur===vt.id?'text-indigo-400 bg-indigo-500/10 font-semibold':'text-slate-500 hover:text-slate-300 hover:bg-white/5'}`}>
                          <span className={`w-1 h-1 rounded-full flex-shrink-0 ${activePage==='vergi'&&selectedVergiFirma?.id===f.id&&selectedVergiTur===vt.id?'bg-indigo-400 shadow-[0_0_8px_rgba(129,140,248,0.8)]':'bg-slate-600'}`}/>
                          <span className="truncate tracking-wide">{vt.label}</span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-4 mt-6 mb-3">Finans</p>
        <div className="space-y-1">
          {navBtn('maliyet', 'Maliyet Kontrolü', <TrendingUp size={18}/>)}
          {navBtn('odeme', 'Ödeme Planı', <CreditCard size={18}/>)}
          {navBtn('kasa', 'Kasa', <Wallet size={18}/>)}
          {navBtn('sirket', 'Şirket Evrakları', <FileText size={18}/>)}
          {navBtn('malatya-maliyet', 'Malatya Proje Maliyet', <TrendingUp size={18}/>)}
        </div>

        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-4 mt-6 mb-3">Görevler</p>
        <div className="space-y-1">
          {navBtn('gorevler', 'Yapılacak İşler', <CheckSquare size={18}/>)}
        </div>

        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-4 mt-6 mb-3">Raporlar</p>
        <div className="space-y-1 pb-4">
          {navBtn('raporlama', 'Excel Raporlama', <BarChart2 size={18}/>)}
        </div>
      </nav>

      <div className="px-5 py-4 border-t border-white/5 bg-[#0B1120] relative z-20">
        <div className="flex items-center gap-3 px-3 py-3 rounded-xl bg-white/[0.03] border border-white/[0.05] hover:bg-white/[0.05] hover:border-white/[0.08] transition-all duration-300">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center text-[13px] font-bold text-white flex-shrink-0 shadow-[0_0_15px_rgba(79,70,229,0.3)] border border-white/10">
            {user?.email?.[0]?.toUpperCase() || 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-[13px] font-semibold truncate leading-tight tracking-wide">{user?.email?.split('@')[0]}</p>
            <p className="text-indigo-300/60 text-[10px] truncate leading-tight mt-0.5">{user?.email}</p>
          </div>
          <div className="flex gap-1">
            <button
              onClick={() => setPasswordModalOpen(true)}
              className="p-1.5 text-slate-400 hover:text-indigo-300 hover:bg-white/10 rounded-lg transition-all flex-shrink-0"
              title="Şifre Değiştir"
              type="button"
            >
              <Shield size={14} />
            </button>
            <button 
              onClick={signOut} 
              className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-white/10 rounded-lg transition-all flex-shrink-0"
              title="Çıkış Yap"
            >
              <LogOut size={14}/>
            </button>
          </div>
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
        {activePage === 'projeler' && <ProjelerPage userId={user.id} firma={firma} onProjeSelect={(p) => { if(p) { setSelectedProje(p); setExpandedProje(p.id) } }} selectedProjeId={selectedProje?.id}/>}
        {activePage === 'proje-ekipler' && selectedProje && <EkiplerPage userId={user.id} firma={firma} proje={selectedProje}/>}
        {activePage === 'proje-puantaj' && <PuantajPage userId={user.id} firma={firma}/>}
        {activePage === 'proje-detay' && selectedProje && <ProjeDetayPage userId={user.id} firma={firma} proje={selectedProje} subPage={activeSubPage}/>}
        {activePage === 'proje-dokuman' && selectedProje && <DokumanlarPage userId={user.id} firma={firma} proje={selectedProje} kategori={activeDokKat}/>}
        {activePage === 'vergi' && (selectedVergiFirma 
          ? <VergiPage userId={user.id} firma={selectedVergiFirma} vergiTur={selectedVergiTur}/> 
          : <VergiPage userId={user.id} firma={firma} vergiTur={selectedVergiTur}/>)}
        {activePage === 'maliyet' && <MaliyetPage userId={user.id} firma={firma}/>}
        {activePage === 'odeme' && <OdemePlaniPage userId={user.id} firma={firma}/>}
        {activePage === 'kasa' && <KasaPage userId={user.id} firma={firma}/>}
        {activePage === 'sirket' && <SirketEvraklariPage userId={user.id} firma={firma}/>}
        {activePage === 'malatya-maliyet' && <MalatyaMaliyetPage userId={user.id}/>}
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
          <div className="flex items-center gap-1.5 flex-1 min-w-0 text-sm">
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

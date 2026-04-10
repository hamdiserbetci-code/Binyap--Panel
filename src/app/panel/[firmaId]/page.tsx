'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useFirma } from '@/context/FirmaContext'
import { supabase } from '@/lib/supabase'
import Sidebar from '@/components/layout/Sidebar'
import Header from '@/components/layout/Header'
import IsTakibiPage from '@/components/yonetim/IsTakibiPage'
import KarZararPage from '@/components/yonetim/KarZararPage'
import EvrakTakibiPage from '@/components/yonetim/EvrakTakibiPage'
import GunlukIslerPage from '@/components/yonetim/GunlukIslerPage'
import KasaPage from '@/components/finans/KasaPage'
import CariHesapPage from '@/components/finans/CariHesapPage'
import OdemePlaniPage from '@/components/finans/OdemePlaniPage'
import BordroPage from '@/components/ik/BordroPage'
import SgkBildirge from '@/components/ik/SgkBildirge'
import IcraTakibiPage from '@/components/ik/IcraTakibiPage'
import RaporlamaPage from '@/components/analiz/RaporlamaPage'
import AyarlarPage from '@/components/analiz/AyarlarPage'
import YedeklemePage from '@/components/analiz/YedeklemePage'

export type ActivePage =
  | 'is-takibi' | 'kar-zarar' | 'evrak-takibi' | 'gunluk-isler'
  | 'kasa' | 'cari-hesap' | 'odeme-plani'
  | 'bordro' | 'sgk-bildirge' | 'icra-takibi'
  | 'raporlama' | 'ayarlar' | 'yedekleme'

export default function PanelPage() {
  const { firmaId } = useParams<{ firmaId: string }>()
  const { firma, firmalar, setFirma, loading } = useFirma()
  const router = useRouter()
  const [activePage, setActivePage] = useState<ActivePage>('is-takibi')
  const [userId, setUserId] = useState<string>('')
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setUserId(data.user.id)
    })
  }, [])

  useEffect(() => {
    if (!loading && firmalar.length > 0) {
      const f = firmalar.find(x => x.id === firmaId)
      if (f) setFirma(f)
      else router.push('/panel')
    }
  }, [firmaId, firmalar, loading])

  if (loading || !firma) return (
    <div className="flex h-screen items-center justify-center bg-slate-50">
      <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"/>
    </div>
  )

  const renderContent = () => {
    const props = { firma, userId }
    switch (activePage) {
      case 'is-takibi':     return <IsTakibiPage {...props}/>
      case 'kar-zarar':     return <KarZararPage {...props}/>
      case 'evrak-takibi':  return <EvrakTakibiPage {...props}/>
      case 'gunluk-isler':  return <GunlukIslerPage {...props}/>
      case 'kasa':          return <KasaPage {...props}/>
      case 'cari-hesap':    return <CariHesapPage {...props}/>
      case 'odeme-plani':   return <OdemePlaniPage {...props}/>
      case 'bordro':        return <BordroPage {...props}/>
      case 'sgk-bildirge':  return <SgkBildirge {...props}/>
      case 'icra-takibi':   return <IcraTakibiPage {...props}/>
      case 'raporlama':     return <RaporlamaPage {...props}/>
      case 'ayarlar':       return <AyarlarPage {...props}/>
      case 'yedekleme':     return <YedeklemePage {...props}/>
      default:              return <IsTakibiPage {...props}/>
    }
  }

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-40 bg-slate-900/20" onClick={() => setSidebarOpen(false)}/>
      )}

      {/* Sidebar */}
      <div className={`fixed lg:static inset-y-0 left-0 z-50 w-64 flex-shrink-0 transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <Sidebar activePage={activePage} onNavigate={(p) => { setActivePage(p); setSidebarOpen(false) }}/>
      </div>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <Header
          firma={firma}
          activePage={activePage}
          onMenuOpen={() => setSidebarOpen(true)}
          userId={userId}
        />
        <main className="flex-1 overflow-y-auto p-5">
          {renderContent()}
        </main>
      </div>
    </div>
  )
}

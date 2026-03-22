'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Briefcase,
  BookUser,
  FileArchive,
  FileSpreadsheet,
  FolderKanban,
  History,
  KeyRound,
  LayoutGrid,
  ListTodo,
  LogOut,
  ShieldCheck,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import ProjectsModule, { type FirmaRecord } from '@/components/newpanel/ProjectsModule'
import FinanceModule from '@/components/newpanel/FinanceModule'
import TimesheetModule from '@/components/newpanel/TimesheetModule'
import CashModule from '@/components/newpanel/CashModule'
import TaxModule from '@/components/newpanel/TaxModule'
import DocumentsModule from '@/components/newpanel/DocumentsModule'
import ReportsModule from '@/components/newpanel/ReportsModule'
import TasksModule from '@/components/newpanel/TasksModule'
import OverviewModule from '@/components/newpanel/OverviewModule'
import NotificationCenter from '@/components/newpanel/NotificationCenter'
import ActivityLogModule from '@/components/newpanel/ActivityLogModule'
import UsersModule, { type UserProfileRecord } from '@/components/newpanel/UsersModule'
import CariHesapModule from '@/components/newpanel/CariHesapModule'
import { logActivity } from '@/lib/activityLog'

type ModuleId =
  | 'genel-bakis'
  | 'projeler'
  | 'gelir-gider'
  | 'puantaj'
  | 'cari'
  | 'kasa'
  | 'vergi-sgk'
  | 'dokuman'
  | 'raporlar'
  | 'gorevler'
  | 'kullanicilar'
  | 'aktivite'

type ModuleConfig = {
  id: ModuleId
  label: string
  shortLabel: string
  icon: LucideIcon
  accent: string
  title: string
  description: string
  allowedRoles: string[]
}

const iconRegistry: Record<string, LucideIcon> = {
  LayoutGrid, FolderKanban, TrendingUp, Users, BookUser, Wallet, ShieldCheck, FileArchive, FileSpreadsheet, ListTodo, KeyRound, History
}

const defaultModules: ModuleConfig[] = [
  { id: 'genel-bakis', label: 'Genel Bakis', shortLabel: 'Panel', icon: LayoutGrid, accent: 'from-sky-500 to-cyan-400', title: 'Merkezi Operasyon Paneli', description: 'Sistemdeki aktif görevlerin, finansal yükümlülüklerin ve resmi süreçlerin konsolide özetini sunar.', allowedRoles: ['yonetici', 'muhasebe', 'santiye', 'izleme'] },
  { id: 'projeler', label: 'Projeler', shortLabel: 'Projeler', icon: FolderKanban, accent: 'from-blue-500 to-indigo-400', title: 'Proje Yönetimi', description: 'Kurum bünyesindeki tüm projelerin bütçe, lokasyon ve operasyonel yaşam döngülerinin yönetildiği merkez.', allowedRoles: ['yonetici', 'santiye', 'izleme'] },
  { id: 'gelir-gider', label: 'Gelir / Gider', shortLabel: 'Finans', icon: TrendingUp, accent: 'from-emerald-500 to-lime-400', title: 'Finansal Operasyonlar', description: 'Proje ve cari bazlı tüm gelir-gider kalemlerinin işlendiği ve finansal analizlerin yapıldığı sistem.', allowedRoles: ['yonetici', 'muhasebe'] },
  { id: 'puantaj', label: 'Puantaj', shortLabel: 'Puantaj', icon: Users, accent: 'from-orange-500 to-amber-400', title: 'Personel Mesai Takibi', description: 'Saha ve ofis personeline ait mesai, izin ve günlük çalışma verilerinin proje bazlı izlendiği modül.', allowedRoles: ['yonetici', 'santiye'] },
  { id: 'cari', label: 'Cari Hesap', shortLabel: 'Cari', icon: BookUser, accent: 'from-cyan-500 to-teal-400', title: 'Cari Hesap Takibi', description: 'Alış/satış faturaları, tahsilat, ödeme ve çek hareketlerinin cari bazlı izlendiği modül.', allowedRoles: ['yonetici', 'muhasebe'] },
  { id: 'kasa', label: 'Kasa', shortLabel: 'Kasa', icon: Wallet, accent: 'from-teal-500 to-cyan-400', title: 'Nakit Yonetimi', description: 'Nakit ve banka hesaplarındaki tüm finansal hareketlerin ve güncel likidite durumunun izlendiği kasa modülü.', allowedRoles: ['yonetici', 'muhasebe'] },
  { id: 'vergi-sgk', label: 'Vergi / SGK', shortLabel: 'Vergi', icon: ShieldCheck, accent: 'from-rose-500 to-orange-400', title: 'Resmi Surecler', description: 'Resmi kurumlarla yürütülen periyodik vergi ve SGK yükümlülüklerinin tahakkuk ve ödeme takibi.', allowedRoles: ['yonetici', 'muhasebe'] },
  { id: 'dokuman', label: 'Dokumanlar', shortLabel: 'Arsiv', icon: FileArchive, accent: 'from-slate-700 to-slate-500', title: 'Kurumsal Arsiv', description: 'Sisteme yüklenen tüm sözleşme, fatura ve resmi evrakların merkezi olarak arşivlendiği ve yönetildiği alan.', allowedRoles: ['yonetici', 'muhasebe', 'santiye', 'izleme'] },
  { id: 'raporlar', label: 'Raporlar', shortLabel: 'Raporlar', icon: FileSpreadsheet, accent: 'from-indigo-500 to-blue-400', title: 'Raporlama ve Analiz', description: 'Tüm veri kaynaklarından derlenen operasyonel ve finansal metriklerin detaylı analiz ve dışa aktarım aracı.', allowedRoles: ['yonetici', 'muhasebe', 'izleme'] },
  { id: 'gorevler', label: 'Yapilacak Isler', shortLabel: 'Gorevler', icon: ListTodo, accent: 'from-amber-500 to-orange-400', title: 'Gorev Yonetimi', description: 'Kurum içi iş süreçlerinin, önceliklendirme ve hatırlatma algoritmalarıyla takip edildiği operasyonel görev merkezi.', allowedRoles: ['yonetici', 'muhasebe', 'santiye', 'izleme'] },
  { id: 'kullanicilar', label: 'Kullanicilar', shortLabel: 'Yetkiler', icon: KeyRound, accent: 'from-slate-600 to-slate-400', title: 'Sistem Erisimi', description: 'Sistem erişim yetkilerinin, kullanıcı rollerinin ve kurumsal profil ayarlarının yapılandırıldığı güvenlik modülü.', allowedRoles: ['yonetici'] },
  { id: 'aktivite', label: 'Aktivite Logu', shortLabel: 'Log', icon: History, accent: 'from-cyan-500 to-sky-400', title: 'Sistem Gunlugu', description: 'Platform üzerindeki tüm kritik kullanıcı hareketlerinin ve veri değişikliklerinin denetim amacıyla kaydedildiği izleme günlüğü.', allowedRoles: ['yonetici', 'muhasebe'] },
]

const roleLabels: Record<string, string> = {
  yonetici: 'Yonetici',
  muhasebe: 'Muhasebe',
  santiye: 'Santiye',
  izleme: 'Izleme',
}

function isMissingProfilesTable(message?: string) {
  const value = (message || '').toLowerCase()
  return value.includes('kullanici_profilleri') && (value.includes('schema cache') || value.includes('does not exist') || value.includes('could not find the table'))
}

export default function Page() {
  const [user, setUser] = useState<any>(null)
  const [firma, setFirma] = useState<FirmaRecord | null>(null)
  const [profile, setProfile] = useState<UserProfileRecord | null>(null)
  const [modules, setModules] = useState<ModuleConfig[]>([])
  const [activeModule, setActiveModule] = useState<ModuleId>('genel-bakis')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let mounted = true

    async function bootstrap() {
      try {
        const { data: authData, error: authError } = await supabase.auth.getUser()
        if (authError) throw authError
        if (!authData.user) {
          window.location.href = '/login'
          return
        }
        if (!mounted) return
        setUser(authData.user)

        const firmaRes = await supabase.from('firmalar').select('*').limit(1)
        if (firmaRes.error) {
          throw new Error(`Firmalar tablosuna erişilemedi: ${firmaRes.error.message}`)
        }

        let activeFirma: FirmaRecord | null = null
        if (!firmaRes.data || firmaRes.data.length === 0) {
          const insertRes = await supabase.from('firmalar').insert({ ad: 'ETM' }).select('*').single()
          if (insertRes.error) {
            throw new Error(`Varsayılan firma oluşturulamadı: ${insertRes.error.message}`)
          }
          activeFirma = insertRes.data as FirmaRecord
        } else {
          activeFirma = firmaRes.data[0] as FirmaRecord
        }
        if (!mounted) return
        setFirma(activeFirma)

        let activeProfile: UserProfileRecord | null = null
        const profileRes = await supabase.from('kullanici_profilleri').select('*').eq('auth_user_id', authData.user.id).maybeSingle()

        if (profileRes.error) {
          if (isMissingProfilesTable(profileRes.error.message)) {
            activeProfile = {
              id: 'local-admin',
              auth_user_id: authData.user.id,
              firma_id: activeFirma.id,
              ad_soyad: authData.user.user_metadata?.full_name || null,
              email: authData.user.email || 'kullanici@etm.local',
              rol: 'yonetici',
              aktif: true,
              son_giris_at: new Date().toISOString(),
            }
            if (mounted) {
              setError('kullanici_profilleri tablosu bulunamadi. Panel gecici yonetici modu ile acildi.')
            }
          } else {
            throw profileRes.error
          }
        } else {
          activeProfile = profileRes.data as UserProfileRecord | null
          if (!activeProfile) {
            const insertProfile = await supabase
              .from('kullanici_profilleri')
              .insert({
                auth_user_id: authData.user.id,
                firma_id: activeFirma.id,
                email: authData.user.email || 'kullanici@etm.local',
                ad_soyad: authData.user.user_metadata?.full_name || null,
                aktif: true,
                son_giris_at: new Date().toISOString(),
              })
              .select('*')
              .single()

            if (insertProfile.error) throw insertProfile.error
            activeProfile = insertProfile.data as UserProfileRecord
          } else {
            const updateRes = await supabase
              .from('kullanici_profilleri')
              .update({ son_giris_at: new Date().toISOString() })
              .eq('id', activeProfile.id)
              .select('*')
              .single()

            if (!updateRes.error && updateRes.data) {
              activeProfile = updateRes.data as UserProfileRecord
            }
          }
        }

        if (activeProfile && !activeProfile.aktif) {
          if (mounted) {
            setError('Bu hesap pasif durumdadir. Lutfen yonetici ile iletisime gecin.')
            setLoading(false)
          }
          await supabase.auth.signOut()
          window.location.href = '/login'
          return
        }

        if (!mounted) return
        setProfile(activeProfile)

        // Dinamik menu yapisini veritabanindan cek (Eger veritabaninda yoksa default listeyi kullan)
        let loadedModules = defaultModules
        const modRes = await supabase.from('sistem_modulleri').select('*').eq('aktif', true).order('sira', { ascending: true })
        if (!modRes.error && modRes.data && modRes.data.length > 0) {
          loadedModules = modRes.data.map((m: any) => ({
            id: m.id as ModuleId,
            label: m.label,
            shortLabel: m.short_label,
            icon: iconRegistry[m.icon] || LayoutGrid,
            accent: m.accent,
            title: m.title,
            description: m.description,
            allowedRoles: m.izin_verilen_roller || ['yonetici']
          }))
        }
        
        if (!mounted) return
        setModules(loadedModules)
        setLoading(false)

        if (activeProfile?.id !== 'local-admin') {
          void logActivity({
            firmaId: activeFirma.id,
            authUserId: authData.user.id,
            kullaniciProfilId: activeProfile?.id || null,
            modul: 'oturum',
            islemTuru: 'oturum_acildi',
            kayitTuru: 'kullanici_profili',
            kayitId: activeProfile?.id || null,
            aciklama: `${authData.user.email || 'Kullanici'} panel oturumu acti.`,
          })
        }
      } catch (err: any) {
        if (!mounted) return
        setError(err?.message || 'Panel baslatilirken bir hata olustu.')
        setLoading(false)
      }
    }

    bootstrap()
    return () => {
      mounted = false
    }
  }, [])

  const visibleModules = useMemo(() => {
    const currentRole = profile?.rol || 'izleme'
    return modules.filter((item) => item.allowedRoles.includes(currentRole))
  }, [modules, profile?.rol])

  useEffect(() => {
    if (!visibleModules.length) return
    if (!visibleModules.some((item) => item.id === activeModule)) {
      setActiveModule(visibleModules[0].id)
    }
  }, [activeModule, visibleModules])

  const activeItem = useMemo(() => visibleModules.find((item) => item.id === activeModule) ?? visibleModules[0], [activeModule, visibleModules])

  async function signOut() {
    if (firma && user && profile?.id !== 'local-admin') {
      void logActivity({
        firmaId: firma.id,
        authUserId: user.id,
        kullaniciProfilId: profile?.id || null,
        modul: 'oturum',
        islemTuru: 'oturum_kapandi',
        kayitTuru: 'kullanici_profili',
        kayitId: profile?.id || null,
        aciklama: `${user.email || 'Kullanici'} panel oturumunu kapatti.`,
      })
    }
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--page-bg)] text-slate-100">
        <div className="rounded-3xl border border-white/10 bg-white/5 px-6 py-5 text-sm text-slate-300 backdrop-blur">
          Panel yukleniyor...
        </div>
      </div>
    )
  }

  if (error && (!user || !activeItem || !firma)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--page-bg)] px-4 text-slate-100">
        <div className="w-full max-w-xl rounded-3xl border border-rose-300/20 bg-slate-950/80 p-6 shadow-[0_24px_60px_rgba(15,23,42,0.35)]">
          <p className="text-xs uppercase tracking-[0.24em] text-rose-300">Panel Hatasi</p>
          <h1 className="mt-3 text-2xl font-semibold text-white">Panel acilamadi</h1>
          <p className="mt-4 text-sm leading-7 text-slate-300">{error}</p>
          <button type="button" onClick={() => window.location.reload()} className="mt-5 rounded-2xl bg-white px-4 py-2.5 text-sm font-medium text-slate-900 transition hover:bg-slate-100">Sayfayi yenile</button>
        </div>
      </div>
    )
  }

  if (!user || !activeItem) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--page-bg)] text-slate-100">
        <div className="rounded-3xl border border-white/10 bg-white/5 px-6 py-5 text-sm text-slate-300 backdrop-blur">
          Kullanici bilgisi bekleniyor...
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[var(--page-bg)] text-slate-100">
      <div className="fixed inset-0 -z-10 bg-[#020617]">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:32px_40px] [mask-image:radial-gradient(ellipse_80%_50%_at_50%_0%,#000_70%,transparent_100%)]"></div>
        <div className="absolute top-0 right-0 -mr-[10%] -mt-[10%] h-[60%] w-[60%] rounded-full bg-indigo-500/10 blur-[120px]"></div>
        <div className="absolute bottom-0 left-0 -ml-[10%] -mb-[10%] h-[60%] w-[60%] rounded-full bg-sky-500/10 blur-[120px]"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[40%] w-[40%] rounded-full bg-blue-500/5 blur-[150px]"></div>
      </div>

      <div className="mx-auto flex min-h-screen w-full flex-col gap-4 px-4 py-4 lg:gap-6 lg:px-6 lg:py-6 2xl:px-12">
        <header className="flex flex-col md:flex-row items-center w-full rounded-2xl border border-white/[0.05] bg-slate-900/50 p-2 backdrop-blur-xl sticky top-4 lg:top-6 z-40 shadow-lg ring-1 ring-white/5 transition-all duration-300 gap-2">
          <div className="flex items-center justify-between w-full md:w-auto md:border-r border-white/5 md:pr-4 shrink-0">
            <div className="flex items-center gap-3 pl-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-sm ring-1 ring-white/10">
                <Briefcase size={18} strokeWidth={2.5} />
              </div>
              <div>
                <p className="text-[8px] font-bold uppercase tracking-[0.2em] text-blue-400/80">ETM-BİNYAPI</p>
                <h1 className="text-xs font-bold tracking-tight text-slate-100">ERP Sistemi</h1>
              </div>
            </div>
            <button type="button" onClick={signOut} className="md:hidden flex h-8 w-8 items-center justify-center rounded-full bg-rose-500/10 text-rose-400 ring-1 ring-rose-500/20">
              <LogOut size={14} />
            </button>
          </div>

          <nav className="flex-1 flex items-center justify-start gap-1 overflow-x-auto w-full px-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            {visibleModules.map((item) => {
              const Icon = item.icon
              const isActive = item.id === activeModule
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveModule(item.id)}
                  title={item.label}
                  className={`group relative flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-[13px] font-medium transition-all shrink-0 ${
                    isActive
                      ? 'text-white bg-white/10 shadow-sm ring-1 ring-white/5'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                  }`}
                >
                  <Icon size={16} className={isActive ? 'text-blue-400 drop-shadow-[0_0_8px_rgba(96,165,250,0.5)]' : 'text-slate-500 group-hover:text-slate-300'} />
                  {item.shortLabel}
                  {isActive && (
                    <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-6 h-[2px] rounded-t-full bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.8)]" />
                  )}
                </button>
              )
            })}
          </nav>

          <div className="hidden md:flex items-center gap-3 shrink-0 border-l border-white/5 pl-4 pr-2">
            <div className="flex flex-col items-end">
              <p className="truncate text-[11px] font-medium text-slate-200 max-w-[120px]">{user.email}</p>
              <button
                type="button"
                onClick={signOut}
                className="mt-0.5 flex items-center gap-1 text-[10px] text-slate-500 transition hover:text-rose-400"
              >
                <LogOut size={10} />
                Güvenli Çıkış
              </button>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-800 text-xs font-semibold text-slate-300 ring-1 ring-white/10 shrink-0">
              {user.email?.charAt(0).toUpperCase() || 'U'}
            </div>
          </div>
        </header>

        <main className="flex-1 flex flex-col min-w-0">
          <div className="flex justify-end mb-4">
            {firma && <NotificationCenter firma={firma} />}
          </div>
          {error && <p className="mb-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 px-4 py-3 text-sm text-amber-200">{error}</p>}

          <section className="flex-1">
            {firma ? renderModule(activeModule, firma, profile, setFirma) : (
              <div className="rounded-[32px] border border-white/[0.08] bg-white/[0.04] p-6 text-slate-200 shadow-2xl backdrop-blur-3xl ring-1 ring-white/10">
                Firma bulunamadi.
              </div>
            )}
          </section>
        </main>
      </div>
    </div>
  )
}

function renderModule(moduleId: ModuleId, firma: FirmaRecord, profile: UserProfileRecord | null, onFirmaUpdated: (firma: FirmaRecord) => void) {
  switch (moduleId) {
    case 'projeler':
      return <ProjectsModule firma={firma} role={profile?.rol} />
    case 'gelir-gider':
      return <FinanceModule firma={firma} role={profile?.rol} />
    case 'puantaj':
      return <TimesheetModule firma={firma} role={profile?.rol} />
    case 'cari':
      return <CariHesapModule firma={firma} role={profile?.rol} />
    case 'kasa':
      return <CashModule firma={firma} role={profile?.rol} />
    case 'vergi-sgk':
      return <TaxModule firma={firma} role={profile?.rol} />
    case 'dokuman':
      return <DocumentsModule firma={firma} role={profile?.rol} />
    case 'raporlar':
      return <ReportsModule firma={firma} role={profile?.rol} />
    case 'gorevler':
      return <TasksModule firma={firma} role={profile?.rol} />
    case 'kullanicilar':
      return <UsersModule firma={firma} currentProfile={profile} role={profile?.rol} onFirmaUpdated={onFirmaUpdated} />
    case 'aktivite':
      return <ActivityLogModule firma={firma} role={profile?.rol} />
    case 'genel-bakis':
      return <OverviewModule firma={firma} />
    default:
      return <PlaceholderModule moduleId={moduleId} />
  }
}

function PlaceholderModule({ moduleId }: { moduleId: Exclude<ModuleId, 'projeler' | 'gelir-gider' | 'puantaj'> }) {
  const items: Record<string, string[]> = {
    'genel-bakis': ['Yeni SQL semasi hazir', 'Projeler modulu baglandi', 'Finans modulu baglandi', 'Puantaj modulu baglandi'],
    kasa: ['Kasa ve banka hareket formu', 'Bagli islem kaydi mantigi', 'Gunluk bakiye ve hareket dokumu'],
    'vergi-sgk': ['Beyan donemi listesi', 'Durum ve sorumlu takibi', 'Tahakkuk ve dekont yukleme'],
    dokuman: ['Merkezi yukleme alani', 'Modul ve kategori filtreleri', 'Kayit bazli dokuman baglama'],
    raporlar: ['PDF ve Excel cikti sablonlari', 'Modul bazli filtreleme', 'Kaydedilebilir rapor yapisi'],
    gorevler: ['Gorev listesi ve durum akisi', 'Hatirlatma tarih ve saat alanlari', 'Erteleme dakikasi ve yeni hatirlatma zamani'],
    kullanicilar: ['Rol bazli menu gorunurlugu', 'Aktif pasif kullanici kontrolu', 'Firma bazli profil kayitlari'],
    aktivite: ['Oturum hareketlerini kaydet', 'Rol degisikliklerini izleme alani', 'Modul bazli filtrelenebilir log akisi'],
  }

  return (
    <div className="rounded-[32px] border border-white/[0.08] bg-white/[0.04] p-6 text-slate-200 shadow-2xl backdrop-blur-3xl ring-1 ring-white/10">
      <h3 className="text-2xl font-semibold text-white">Siradaki modul</h3>
      <p className="mt-3 text-sm leading-6 text-slate-400">Bu alan bir sonraki adimda ayni desenle calisan module donusecek. Hazirlanan kapsam:</p>
      <div className="mt-5 grid gap-3 md:grid-cols-2">
        {items[moduleId].map((item) => (
          <div key={item} className="rounded-2xl border border-white/10 bg-white/[0.05] p-4 text-sm text-slate-300">{item}</div>
        ))}
      </div>
    </div>
  )
}

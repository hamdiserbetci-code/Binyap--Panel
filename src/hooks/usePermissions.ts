import { useCallback, useMemo } from 'react'
import type { KullaniciProfil, KullaniciYetki, KullaniciRol } from '@/types'

export type PermissionAction = 'okuma' | 'yazma' | 'silme' | 'onaylama'

export interface PermissionResult {
  okuma: boolean
  yazma: boolean
  silme: boolean
  onaylama: boolean
}

// Varsayılan rol bazlı yetki matrisi
const ROL_VARSAYILAN_YETKILERI: Record<KullaniciRol, Record<string, Partial<PermissionResult>>> = {
  yonetici: {
    '*': { okuma: true, yazma: true, silme: true, onaylama: true },
  },
  muhasebe: {
    '*': { okuma: true, yazma: false, silme: false, onaylama: false },
    cari: { okuma: true, yazma: true, silme: false, onaylama: false },
    kasa: { okuma: true, yazma: true, silme: false, onaylama: false },
    cekler: { okuma: true, yazma: true, silme: false, onaylama: false },
    vergi: { okuma: true, yazma: true, silme: false, onaylama: false },
    efatura: { okuma: true, yazma: true, silme: false, onaylama: false },
    odemeplani: { okuma: true, yazma: true, silme: false, onaylama: false },
    raporlar: { okuma: true, yazma: false, silme: false, onaylama: false },
  },
  santiye: {
    '*': { okuma: true, yazma: false, silme: false, onaylama: false },
    projeler: { okuma: true, yazma: true, silme: false, onaylama: false },
    bordro: { okuma: true, yazma: true, silme: false, onaylama: false },
    gorevler: { okuma: true, yazma: true, silme: false, onaylama: false },
    gunluk: { okuma: true, yazma: true, silme: false, onaylama: false },
  },
  izleme: {
    '*': { okuma: true, yazma: false, silme: false, onaylama: false },
  },
}

export function usePermissions(profil: KullaniciProfil | null | undefined) {
  // Kullanıcının belirli bir modül için yetkilerini getir
  const getPermissions = useCallback((modul: string): PermissionResult => {
    if (!profil) {
      return { okuma: false, yazma: false, silme: false, onaylama: false }
    }

    // 1. Özel yetki kontrolü (profil.yetkiler dizisinde)
    const ozelYetki = profil.yetkiler?.find(y => y.modul === modul || y.modul === '*')
    if (ozelYetki) {
      return {
        okuma: ozelYetki.okuma,
        yazma: ozelYetki.yazma,
        silme: ozelYetki.silme,
        onaylama: ozelYetki.onaylama,
      }
    }

    // 2. Rol bazlı varsayılan yetkiler
    const rolYetkileri = ROL_VARSAYILAN_YETKILERI[profil.rol]
    if (!rolYetkileri) {
      return { okuma: false, yazma: false, silme: false, onaylama: false }
    }

    // Önce modül spesifik yetkiyi kontrol et, yoksa wildcard (*) kullan
    const modulYetkisi = rolYetkileri[modul] || rolYetkileri['*']
    if (!modulYetkisi) {
      return { okuma: false, yazma: false, silme: false, onaylama: false }
    }

    return {
      okuma: modulYetkisi.okuma ?? false,
      yazma: modulYetkisi.yazma ?? false,
      silme: modulYetkisi.silme ?? false,
      onaylama: modulYetkisi.onaylama ?? false,
    }
  }, [profil])

  // Okuma yetkisi kontrolü
  const canRead = useCallback((modul: string): boolean => {
    return getPermissions(modul).okuma
  }, [getPermissions])

  // Yazma yetkisi kontrolü
  const canWrite = useCallback((modul: string): boolean => {
    return getPermissions(modul).yazma
  }, [getPermissions])

  // Silme yetkisi kontrolü
  const canDelete = useCallback((modul: string): boolean => {
    return getPermissions(modul).silme
  }, [getPermissions])

  // Onaylama yetkisi kontrolü
  const canApprove = useCallback((modul: string): boolean => {
    return getPermissions(modul).onaylama
  }, [getPermissions])

  // Genel yetki kontrolü
  const hasPermission = useCallback((modul: string, action: PermissionAction): boolean => {
    const perms = getPermissions(modul)
    return perms[action]
  }, [getPermissions])

  // Yönetici mi kontrolü
  const isYonetici = useMemo(() => {
    return profil?.rol === 'yonetici'
  }, [profil])

  return {
    getPermissions,
    canRead,
    canWrite,
    canDelete,
    canApprove,
    hasPermission,
    isYonetici,
  }
}

// Standalone yardımcı fonksiyon (hook dışında kullanım için)
export function getDefaultPermissions(rol: KullaniciRol, modul: string): PermissionResult {
  const rolYetkileri = ROL_VARSAYILAN_YETKILERI[rol]
  if (!rolYetkileri) {
    return { okuma: false, yazma: false, silme: false, onaylama: false }
  }

  const modulYetkisi = rolYetkileri[modul] || rolYetkileri['*']
  if (!modulYetkisi) {
    return { okuma: false, yazma: false, silme: false, onaylama: false }
  }

  return {
    okuma: modulYetkisi.okuma ?? false,
    yazma: modulYetkisi.yazma ?? false,
    silme: modulYetkisi.silme ?? false,
    onaylama: modulYetkisi.onaylama ?? false,
  }
}
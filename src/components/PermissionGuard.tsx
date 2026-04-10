import type { ReactNode } from 'react'
import type { KullaniciProfil } from '@/types'
import { usePermissions, type PermissionAction } from '@/hooks/usePermissions'

interface PermissionGuardProps {
  profil: KullaniciProfil | null | undefined
  modul: string
  action?: PermissionAction
  children: ReactNode
  fallback?: ReactNode
}

/**
 * Yetki kontrolü yapan guard bileşeni.
 * 
 * Kullanım:
 * ```tsx
 * <PermissionGuard profil={profil} modul="vergi" action="yazma">
 *   <button>Düzenle</button>
 * </PermissionGuard>
 * ```
 */
export function PermissionGuard({
  profil,
  modul,
  action = 'okuma',
  children,
  fallback = null,
}: PermissionGuardProps) {
  const { hasPermission } = usePermissions(profil)

  if (!hasPermission(modul, action)) {
    return <>{fallback}</>
  }

  return <>{children}</>
}

interface WriteGuardProps {
  profil: KullaniciProfil | null | undefined
  modul: string
  children: ReactNode
  fallback?: ReactNode
}

/**
 * Yazma yetkisi kontrolü için kısayol bileşeni.
 */
export function WriteGuard({ profil, modul, children, fallback }: WriteGuardProps) {
  return (
    <PermissionGuard profil={profil} modul={modul} action="yazma" fallback={fallback}>
      {children}
    </PermissionGuard>
  )
}

interface DeleteGuardProps {
  profil: KullaniciProfil | null | undefined
  modul: string
  children: ReactNode
  fallback?: ReactNode
}

/**
 * Silme yetkisi kontrolü için kısayol bileşeni.
 */
export function DeleteGuard({ profil, modul, children, fallback }: DeleteGuardProps) {
  return (
    <PermissionGuard profil={profil} modul={modul} action="silme" fallback={fallback}>
      {children}
    </PermissionGuard>
  )
}
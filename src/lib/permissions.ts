export type AppRole = 'yonetici' | 'muhasebe' | 'santiye' | 'izleme'

export type AppAction = 'view' | 'edit' | 'delete' | 'report' | 'manage_users'

const rolePermissions: Record<AppRole, AppAction[]> = {
  yonetici: ['view', 'edit', 'delete', 'report', 'manage_users'],
  muhasebe: ['view', 'edit', 'report'],
  santiye: ['view', 'edit'],
  izleme: ['view', 'report'],
}

export function can(role: string | null | undefined, action: AppAction) {
  const resolvedRole = (role || 'izleme') as AppRole
  return (rolePermissions[resolvedRole] || rolePermissions.izleme).includes(action)
}

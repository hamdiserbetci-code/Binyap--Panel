'use client'

import { cn } from './cn'

type ModuleItem = {
  id: string
  label: string
}

type AppSidebarProps = {
  modules: ModuleItem[]
  activeModule: string
  onSelect: (id: string) => void
  collapsed?: boolean
}

export default function AppSidebar({
  modules,
  activeModule,
  onSelect,
  collapsed = false,
}: AppSidebarProps) {
  return (
    <aside
      className={cn(
        'hidden lg:flex lg:h-screen lg:flex-col lg:border-r lg:border-slate-200 lg:bg-white',
        collapsed ? 'lg:w-[84px]' : 'lg:w-[268px]'
      )}
    >
      <div className="flex h-16 items-center border-b border-slate-200 px-4">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold tracking-wide text-slate-900">
            ETM PANEL
          </div>
          {!collapsed ? (
            <div className="text-xs text-slate-500">Kurumsal yönetim ekranı</div>
          ) : null}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        <nav className="space-y-1">
          {modules.map((item) => {
            const active = item.id === activeModule

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelect(item.id)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition',
                  active
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'text-slate-700 hover:bg-slate-100'
                )}
                title={item.label}
              >
                <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-black/5 text-xs font-semibold">
                  {item.label.slice(0, 2).toUpperCase()}
                </span>

                {!collapsed ? (
                  <span className="truncate">{item.label}</span>
                ) : null}
              </button>
            )
          })}
        </nav>
      </div>
    </aside>
  )
}
'use client'

import type { ReactNode } from 'react'
import AppSidebar from './AppSidebar'

type ModuleItem = {
  id: string
  label: string
}

type AppLayoutProps = {
  modules: ModuleItem[]
  activeModule: string
  onSelectModule: (id: string) => void
  children: ReactNode
}

export default function AppLayout({
  modules,
  activeModule,
  onSelectModule,
  children,
}: AppLayoutProps) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[268px_minmax(0,1fr)]">
        <AppSidebar
          modules={modules}
          activeModule={activeModule}
          onSelect={onSelectModule}
        />

        <main className="min-w-0 overflow-x-hidden">
          <div className="min-h-screen">{children}</div>
        </main>
      </div>
    </div>
  )
}
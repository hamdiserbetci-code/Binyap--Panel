'use client'

import type { ReactNode } from 'react'
import { cn } from './cn'

type PageToolbarProps = {
  children: ReactNode
  className?: string
}

export default function PageToolbar({ children, className }: PageToolbarProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm',
        'xl:flex-row xl:items-center xl:justify-between',
        className
      )}
    >
      {children}
    </div>
  )
}
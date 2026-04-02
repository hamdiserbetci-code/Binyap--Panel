'use client'

import type { ReactNode } from 'react'
import { cn } from './cn'

type PageHeaderProps = {
  title: string
  subtitle?: string
  actions?: ReactNode
  className?: string
}

export default function PageHeader({
  title,
  subtitle,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm',
        'lg:flex-row lg:items-center lg:justify-between',
        className
      )}
    >
      <div className="min-w-0">
        <h1 className="truncate text-xl font-semibold tracking-tight text-slate-900 md:text-2xl">
          {title}
        </h1>
        {subtitle ? (
          <p className="mt-1 text-sm text-slate-600 md:text-[15px]">{subtitle}</p>
        ) : null}
      </div>

      {actions ? (
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </div>
  )
}
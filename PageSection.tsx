'use client'

import type { ReactNode } from 'react'
import { cn } from './cn'

type PageSectionProps = {
  title?: string
  subtitle?: string
  actions?: ReactNode
  children: ReactNode
  className?: string
  bodyClassName?: string
}

export default function PageSection({
  title,
  subtitle,
  actions,
  children,
  className,
  bodyClassName,
}: PageSectionProps) {
  return (
    <section
      className={cn(
        'overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm',
        className
      )}
    >
      {(title || subtitle || actions) && (
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 md:flex-row md:items-center md:justify-between md:p-5">
          <div className="min-w-0">
            {title ? (
              <h2 className="text-base font-semibold text-slate-900 md:text-lg">{title}</h2>
            ) : null}
            {subtitle ? (
              <p className="mt-1 text-sm text-slate-600">{subtitle}</p>
            ) : null}
          </div>

          {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
        </div>
      )}

      <div className={cn('p-4 md:p-5', bodyClassName)}>{children}</div>
    </section>
  )
}
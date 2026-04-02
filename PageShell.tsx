'use client'

import type { ReactNode } from 'react'
import { cn } from './cn'

type PageShellProps = {
  children: ReactNode
  dense?: boolean
  className?: string
}

export default function PageShell({
  children,
  dense = false,
  className,
}: PageShellProps) {
  return (
    <div
      className={cn(
        'w-full min-w-0',
        dense ? 'px-3 py-3 md:px-4 md:py-4 xl:px-5' : 'px-4 py-4 md:px-5 md:py-5 xl:px-6',
        className
      )}
    >
      <div className="w-full min-w-0 space-y-4">{children}</div>
    </div>
  )
}
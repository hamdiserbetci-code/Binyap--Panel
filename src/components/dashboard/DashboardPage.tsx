'use client'

import { Building2, ShieldCheck } from 'lucide-react'
import type { Firma } from '@/types'

interface DashboardHomeProps {
  userId: string
  firma: Firma
  firmaIds: string[]
  onNavigate: (module: string) => void
}

export default function DashboardHome({ firma, firmaIds, onNavigate }: DashboardHomeProps) {
  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div className="rounded-2xl border border-blue-100 bg-white px-6 py-5 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-800">Hoş Geldiniz</h1>
        <p className="text-sm text-slate-500 mt-1">
          {firma.ad} - ETM Panel Mikro ERP
        </p>
      </div>

      {/* Info */}
      <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
        <p className="text-sm text-blue-800">
          Sistem tamamen sıfırlandı. Yeni modüllerinizi eklemeye başlayabilirsiniz.
        </p>
      </div>
    </div>
  )
}
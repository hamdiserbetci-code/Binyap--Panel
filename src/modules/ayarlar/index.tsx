'use client'

import { Settings } from 'lucide-react'
import type { AppCtx } from '@/app/page'

export default function AyarlarModule({ firma }: AppCtx) {
  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-2xl border border-blue-100 bg-white px-5 py-4">
        <h1 className="text-[22px] font-semibold text-slate-800 flex items-center gap-3">
          <Settings size={22} /> Ayarlar
        </h1>
        <p className="text-[13px] text-slate-500 mt-1">Sistem ayarları</p>
      </div>

      <div className="rounded-2xl border border-blue-100 bg-white p-8 text-center text-slate-400">
        <Settings size={48} className="mx-auto mb-3 text-slate-200" />
        <p className="text-[13px]">Ayarlar modülü yapım aşamasında</p>
      </div>
    </div>
  )
}
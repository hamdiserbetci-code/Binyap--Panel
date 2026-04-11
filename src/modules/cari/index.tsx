'use client'

import { useState } from 'react'
import { Wallet, Users } from 'lucide-react'
import type { AppCtx } from '@/app/page'

export default function CariModule({ firma }: AppCtx) {
  const [loading] = useState(false)

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-2xl border border-blue-100 bg-white px-5 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-blue-100 bg-slate-50">
              <Wallet size={18} className="text-slate-800" />
            </div>
            <div>
              <h1 className="text-[22px] font-semibold text-slate-800">Cari Hesaplar</h1>
              <p className="text-[13px] text-slate-500">Logo Go 3 stili cari hesap yönetimi</p>
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="rounded-2xl border border-blue-100 bg-white p-8 text-center text-slate-400">
          <Users size={48} className="mx-auto mb-3 text-slate-200" />
          <p className="text-[13px]">Cari hesaplar yükleniyor...</p>
        </div>
      )}
    </div>
  )
}
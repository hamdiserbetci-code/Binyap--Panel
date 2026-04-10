'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { FirmaProvider } from '@/context/FirmaContext'
import { useRouter } from 'next/navigation'

export default function PanelLayout({ children }: { children: React.ReactNode }) {
  const [userId, setUserId] = useState<string | null>(null)
  const [checking, setChecking] = useState(true)
  const router = useRouter()

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.push('/login'); return }
      setUserId(data.user.id)
      setChecking(false)
    })
  }, [router])

  if (checking) return (
    <div className="flex h-screen items-center justify-center bg-slate-50">
      <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"/>
    </div>
  )

  if (!userId) return null

  return (
    <FirmaProvider userId={userId}>
      {children}
    </FirmaProvider>
  )
}

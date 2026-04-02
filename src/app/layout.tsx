import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: "ETM Panel",
  description: "Binyapı ETM Yönetim Paneli",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body>{children}</body>
    </html>
  )
}

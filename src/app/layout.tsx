import type { Metadata } from 'next'
import './globals.css'
import { AppProviders } from '@/context/AppProviders'

export const metadata: Metadata = {
  title: 'Guess&Win – ניחושי כדורגל',
  description: 'התחרה בטורנירי ניחושי כדורגל עם החברים שלך',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  )
}

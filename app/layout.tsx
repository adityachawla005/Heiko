import type { Metadata } from 'next'
import { Syne, DM_Sans, Plus_Jakarta_Sans } from 'next/font/google'
import './globals.css'

const syne = Syne({
  subsets: ['latin'],
  variable: '--font-display',
  weight: ['400', '500', '600', '700', '800'],
})

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-body',
  weight: ['300', '400', '500', '600'],
})

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-label',
  weight: ['500', '600'],
})

export const metadata: Metadata = {
  title: 'Heiko  -  Someone wrote it. You have to do it.',
  description: 'Heiko closes the gap between instructions and execution. Step-by-step guidance with the knowledge behind the words.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${syne.variable} ${dmSans.variable} ${plusJakarta.variable}`}>
      <body className="min-h-screen antialiased">
        {children}
      </body>
    </html>
  )
}

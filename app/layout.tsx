import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'

const _geist = Geist({ subsets: ["latin"] });
const _geistMono = Geist_Mono({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: 'Meeting Genius',
  description: 'Meeting and agenda management for property managers',
  generator: 'MeetingGenius',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={`font-sans antialiased`}>
        <header className="border-b bg-white shadow-sm">
          <div className="container mx-auto px-4 py-3 flex items-center">
            <img 
              src="/MG2 logo.png" 
              alt="Meeting Genius Logo" 
              className="h-10 w-auto"
            />
          </div>
        </header>
        <main>
          {children}
        </main>
        <Analytics />
      </body>
    </html>
  )
}

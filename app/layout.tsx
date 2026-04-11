import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { Toaster } from 'sonner'
import './globals.css'


const _geist = Geist({ subsets: ["latin"] });
const _geistMono = Geist_Mono({ subsets: ["latin"] });


export const metadata: Metadata = {
  title: 'Meeting Genius',
  description: 'Meeting and agenda management for property managers',
  generator: 'MeetingGenius',
  icons: {
    icon: '/MG2 logo.png',
    shortcut: '/MG2 logo.png',
    apple: '/MG2 logo.png',
  },
}


export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <head>
        <meta charSet="UTF-8" />
      </head>
      <body className={`font-sans antialiased`}>
        {children}
        <Analytics />
        <Toaster position="top-center" richColors />
      </body>
    </html>
  )
}

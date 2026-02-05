import type { Metadata } from 'next'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'

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
      </body>
    </html>
  )
}

import './globals.css'
import { Manrope, Space_Grotesk } from 'next/font/google'

export const metadata = {
  title: 'Admin',
  description: 'Admin portal'
}

const headingFont = Space_Grotesk({
  variable: '--font-heading',
  display: 'swap',
  subsets: ['latin'],
  weight: ['500', '600', '700']
})

const bodyFont = Manrope({
  variable: '--font-body',
  display: 'swap',
  subsets: ['latin'],
  weight: ['400', '500', '600']
})

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${headingFont.variable} ${bodyFont.variable}`}>
      <body>{children}</body>
    </html>
  )
}

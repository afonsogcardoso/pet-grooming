import { Lilita_One, Podkova } from 'next/font/google'
import './globals.css'
import { TranslationProvider } from '@/components/TranslationProvider'
import AppShell from '@/components/AppShell'
import { AccountProvider } from '@/components/AccountProvider'

const podkova = Podkova({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-podkova'
})

const lilitaOne = Lilita_One({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-lilita'
})

const siteName = process.env.NEXT_PUBLIC_SITE_NAME || 'Booking'
const siteDescription =
  process.env.NEXT_PUBLIC_SITE_DESCRIPTION || 'Agende online com facilidade.'

export const metadata = {
  title: siteName,
  description: siteDescription,
  openGraph: {
    title: siteName,
    description: siteDescription
  },
  twitter: {
    card: 'summary',
    title: siteName,
    description: siteDescription
  }
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`${podkova.variable} ${lilitaOne.variable}`}>
        <TranslationProvider>
          <AccountProvider>
            <AppShell>{children}</AppShell>
          </AccountProvider>
        </TranslationProvider>
      </body>
    </html>
  )
}

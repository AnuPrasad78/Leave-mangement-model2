import type { ReactNode } from 'react'
import '@fontsource-variable/plus-jakarta-sans'
import '@/styles/global.css'
import '@/styles/layout.css'
import '@/styles/login.css'
import '@/styles/pages.css'
import { Providers } from './providers'

export const metadata = {
  title: 'Emids · Leave Management',
  icons: {
    icon: '/emids-mark.svg',
  },
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}

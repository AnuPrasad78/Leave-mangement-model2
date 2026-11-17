'use client'

import type { ReactNode } from 'react'
import { AuthProvider } from '@/store/AuthContext'
import ErrorBoundary from '@/utils/ErrorBoundary'
import { Toast } from '@/components/ui'

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <Toast />
        {children}
      </AuthProvider>
    </ErrorBoundary>
  )
}

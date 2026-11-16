'use client'

import type { ReactNode } from 'react'
import { AuthProvider } from '../src/store/AuthContext'
import ErrorBoundary from '../src/utils/ErrorBoundary'
import { Toast } from '../src/components/ui'

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

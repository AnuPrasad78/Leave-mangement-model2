'use client'

import type { ReactNode } from 'react'
import { AuthProvider } from '../store/AuthContext'
import ErrorBoundary from './components/templates/ErrorBoundary'
import { Toast } from './components/index'

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <ErrorBoundary>
        <Toast />
        {children}
      </ErrorBoundary>
    </AuthProvider>
  )
}

import type { ReactNode } from 'react'
import { IconAlertTriangle } from '../../Icons'

export interface WarnBannerProps {
  children: ReactNode
}

export function WarnBanner({ children }: WarnBannerProps) {
  return (
    <div className='warn-banner'>
      <IconAlertTriangle size={20} />
      <div>{children}</div>
    </div>
  )
}

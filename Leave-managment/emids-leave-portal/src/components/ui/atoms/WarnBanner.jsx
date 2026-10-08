import { IconAlertTriangle } from '../../Icons'

export function WarnBanner({ children }) {
  return (
    <div className='warn-banner'>
      <IconAlertTriangle size={20} />
      <div>{children}</div>
    </div>
  )
}

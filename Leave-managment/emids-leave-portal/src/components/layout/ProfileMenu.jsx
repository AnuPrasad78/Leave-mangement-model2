import { useRef } from 'react'
import { useDismiss } from '../../hooks/useDismiss'
import { IconMail, IconId, IconBuilding, IconBriefcase, IconSitemap, IconUserCheck } from '../Icons'

const DETAILS = [
  { label: 'Emp ID', value: 'emp_no', icon: IconId },
  { label: 'Account', value: 'account', icon: IconBuilding },
  { label: 'Project', value: 'project_name', icon: IconBriefcase },
  { label: 'Function', value: 'function_name', icon: IconSitemap },
  { label: 'Manager', value: 'manager_full_name', icon: IconUserCheck },
]

export default function ProfileMenu({ profile, onDismiss }) {
  const ref = useRef(null)
  useDismiss(ref, { onClose: onDismiss })

  const value = (key) => (key === 'manager_full_name' ? profile?.manager?.full_name : profile?.[key])

  return (
    <>
      <div className='pop-backdrop' />
      <div className='profile-pop' role='dialog' aria-label='My profile' ref={ref}>
        <div className='pop-bar' />
        <div className='profile-pop__who'>
          <span className='avatar avatar--lg'>{profile?.initials}</span>
          <div>
            <div className='profile-pop__name'>{profile?.full_name}</div>
            <div className='dash-role mono'>{profile?.job_title} · {profile?.system_role}</div>
            <div className='dash-mail'><IconMail size={14} /> {profile?.email}</div>
          </div>
        </div>
        <dl className='dash-fields profile-pop__fields'>
          {DETAILS.map(({ label, value: key, icon: Icon }) => (
            <div className='dash-field' key={label}>
              <dt><Icon size={14} /> {label}</dt>
              <dd>{value(key) || '—'}</dd>
            </div>
          ))}
        </dl>
      </div>
    </>
  )
}

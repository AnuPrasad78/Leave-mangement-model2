import type { Meta, StoryObj } from '@storybook/react'
import {
  IconMenu, IconSearch, IconBell, IconX, IconDashboard, IconCalendarPlus,
  IconFileText, IconClipboardCheck, IconSun, IconDoor, IconLogout, IconChevronDown,
  IconBan, IconAlertTriangle, IconLifebuoy, IconMail, IconId, IconBuilding,
  IconBriefcase, IconSitemap, IconUserCheck, IconUser, IconSparkles,
} from './Icons'

type Named = { C: React.ComponentType<{ size?: number }>; name: string }

// Generated from the exported list in ./Icons.tsx — keep in sync when icons
// are added (the story doubles as an icon-gallery reference).
const catalog: Named[] = [
  { C: IconMenu, name: 'IconMenu' },
  { C: IconSearch, name: 'IconSearch' },
  { C: IconBell, name: 'IconBell' },
  { C: IconX, name: 'IconX' },
  { C: IconDashboard, name: 'IconDashboard' },
  { C: IconCalendarPlus, name: 'IconCalendarPlus' },
  { C: IconFileText, name: 'IconFileText' },
  { C: IconClipboardCheck, name: 'IconClipboardCheck' },
  { C: IconSun, name: 'IconSun' },
  { C: IconDoor, name: 'IconDoor' },
  { C: IconLogout, name: 'IconLogout' },
  { C: IconChevronDown, name: 'IconChevronDown' },
  { C: IconBan, name: 'IconBan' },
  { C: IconAlertTriangle, name: 'IconAlertTriangle' },
  { C: IconLifebuoy, name: 'IconLifebuoy' },
  { C: IconMail, name: 'IconMail' },
  { C: IconId, name: 'IconId' },
  { C: IconBuilding, name: 'IconBuilding' },
  { C: IconBriefcase, name: 'IconBriefcase' },
  { C: IconSitemap, name: 'IconSitemap' },
  { C: IconUserCheck, name: 'IconUserCheck' },
  { C: IconUser, name: 'IconUser' },
  { C: IconSparkles, name: 'IconSparkles' },
]

const meta = {
  title: 'UI/Icons',
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

/** All 23 icons at the UI size (22px), labelled by export name. */
export const Catalog: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', alignItems: 'flex-end' }}>
      {catalog.map(({ C, name }) => (
        <div key={name} style={{ display: 'grid', justifyItems: 'center', gap: 4 }}>
          <C size={22} />
          <code style={{ fontSize: 10 }}>{name}</code>
        </div>
      ))}
    </div>
  ),
}

export const Sized: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
      <IconSun size={16} />
      <IconSun size={21} />
      <IconSun size={28} />
      <code style={{ fontSize: 10 }}>16 / 21 / 28</code>
    </div>
  ),
}

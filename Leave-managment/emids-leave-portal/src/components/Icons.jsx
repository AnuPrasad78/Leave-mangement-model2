const base = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
}

const Svg = ({ size = 20, className = '', viewBox = '0 0 24 24', children, ...rest }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox={viewBox}
    className={className}
    aria-hidden="true"
    {...base}
    {...rest}
  >
    {children}
  </svg>
)

export const IconMenu = (p) => (
  <Svg {...p}><path d="M4 6h16M4 12h16M4 18h16" /></Svg>
)

export const IconSearch = (p) => (
  <Svg {...p}><path d="M10 10m-7 0a7 7 0 1 0 14 0a7 7 0 1 0 -14 0M21 21l-6 -6" /></Svg>
)

export const IconBell = (p) => (
  <Svg {...p}><path d="M10 5a2 2 0 0 1 4 0a7 7 0 0 1 4 6v3a4 4 0 0 0 2 3h-16a4 4 0 0 0 2 -3v-3a7 7 0 0 1 4 -6M9 17v1a3 3 0 0 0 6 0v-1" /></Svg>
)

export const IconX = (p) => (
  <Svg {...p}><path d="M18 6l-12 12M6 6l12 12" /></Svg>
)

export const IconDashboard = (p) => (
  <Svg {...p}><path d="M4 4h7v9H4zM13 4h7v5h-7zM13 12h7v8h-7zM4 13h7v7H4z" /></Svg>
)

export const IconCalendarPlus = (p) => (
  <Svg {...p}><path d="M4 5h16a1 1 0 0 1 1 1v13a1 1 0 0 1 -1 1H4a1 1 0 0 1 -1 -1V6a1 1 0 0 1 1 -1zM4 10h16M9 4v2M15 4v2M12 13v5M9.5 15.5h5" /></Svg>
)

export const IconFileText = (p) => (
  <Svg {...p}><path d="M14 3v5a1 1 0 0 0 1 1h5M17 21h-10a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2h7l5 5v11a2 2 0 0 1 -2 2zM9 12h6M9 16h6" /></Svg>
)

export const IconClipboardCheck = (p) => (
  <Svg {...p}><path d="M9 5H7a2 2 0 0 0 -2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2V7a2 2 0 0 0 -2 -2h-2M9 5a2 2 0 1 0 6 0a2 2 0 0 0 -6 0M9 14l2 2 4 -4" /></Svg>
)

export const IconSun = (p) => (
  <Svg {...p}><path d="M12 12m-4 0a4 4 0 1 0 8 0a4 4 0 1 0 -8 0M12 3v2M12 19v2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M3 12h2M19 12h2M5.6 18.4L7 17M17 7l1.4 -1.4" /></Svg>
)

export const IconDoor = (p) => (
  <Svg {...p}><path d="M13 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-4M9 12h.01M5 6h-1v12h1M14 9v6M5.5 4H11a1.5 1.5 0 0 1 1.5 1.5v13a1.5 1.5 0 0 1 -1.5 1.5H5.5A2.5 2.5 0 0 1 3 17.5v-11A2.5 2.5 0 0 1 5.5 4" /></Svg>
)

export const IconLogout = (p) => (
  <Svg {...p}><path d="M14 8V6a2 2 0 0 0 -2 -2H6a2 2 0 0 0 -2 2v12a2 2 0 0 0 2 2h6a2 2 0 0 0 2 -2v-2M9 12h12l-3 -3M18 15l3 -3" /></Svg>
)

export const IconChevronRight = (p) => (
  <Svg {...p}><path d="M9 6l6 6-6 6" /></Svg>
)

export const IconChevronDown = (p) => (
  <Svg {...p}><path d="M6 9l6 6 6-6" /></Svg>
)

export const IconArrowUpRight = (p) => (
  <Svg {...p}><path d="M7 17L17 7M8 7h9v9" /></Svg>
)

export const IconCheck = (p) => (
  <Svg {...p}><path d="M5 12l5 5L20 7" /></Svg>
)

export const IconBan = (p) => (
  <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="M5.7 5.7l12.6 12.6" /></Svg>
)

export const IconAlertTriangle = (p) => (
  <Svg {...p}><path d="M12 4.5l9 15.5H3L12 4.5zM12 10v4M12 16.5h.01" /></Svg>
)

export const IconLifebuoy = (p) => (
  <Svg {...p}><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="4" /><path d="M15 15l3.5 3.5M9 15l-3.5 3.5M15 9l3.5 -3.5M9 9L5.5 5.5" /></Svg>
)

export const IconClock = (p) => (
  <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></Svg>
)

export const IconMail = (p) => (
  <Svg {...p}><path d="M3 6a1 1 0 0 1 1 -1h16a1 1 0 0 1 1 1v12a1 1 0 0 1 -1 1H4a1 1 0 0 1 -1 -1V6zM3.5 6.5L12 13l8.5 -6.5" /></Svg>
)

export const IconId = (p) => (
  <Svg {...p}><path d="M3 6a1 1 0 0 1 1 -1h16a1 1 0 0 1 1 1v12a1 1 0 0 1 -1 1H4a1 1 0 0 1 -1 -1V6zM8 10m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0M5 17c.7-1.8 2.2-2.6 3.9-2.6s3.1 0.8 3.9 2.6M14 9h5M14 12.5h4M14 16h3" /></Svg>
)

export const IconBuilding = (p) => (
  <Svg {...p}><path d="M5 21V5a2 2 0 0 1 2 -2h7a2 2 0 0 1 2 2v16M16 9h2a2 2 0 0 1 2 2v10M3 21h18M8 7h1M8 11h1M8 15h1M12 7h1M12 11h1M12 15h1" /></Svg>
)

export const IconBriefcase = (p) => (
  <Svg {...p}><path d="M3 9a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v10a2 2 0 0 1 -2 2H5a2 2 0 0 1 -2 -2V9zM7 7V5a2 2 0 0 1 2 -2h6a2 2 0 0 1 2 2v2M3 12h18M12 12v2" /></Svg>
)

export const IconSitemap = (p) => (
  <Svg {...p}><path d="M9 3h6v4H9zM3 17h6v4H3zM15 17h6v4h-6zM12 7v5M6 17v-3h12v3M12 12v2" /></Svg>
)

export const IconUserCheck = (p) => (
  <Svg {...p}><circle cx="9" cy="7" r="4" /><path d="M3 21v-2a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v2M15.5 14.5l2 2 3.5 -3.8" /></Svg>
)

export const IconMapPin = (p) => (
  <Svg {...p}><path d="M12 11m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0M12 21c-4 -4 -7.5 -7.2 -7.5 -11a7.5 7.5 0 0 1 15 0c0 3.8 -3.5 7 -7.5 11" /></Svg>
)

export const IconPlus = (p) => (
  <Svg {...p}><path d="M12 5v14M5 12h14" /></Svg>
)

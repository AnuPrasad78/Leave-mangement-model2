// TEMPORARY — used only by the one-time localStorage → DB migration in Holidays.jsx.
// Maps the old pick indices (original-array order) to (date, name) pairs.
// Delete this file after users have migrated (pick data lives in optional_holiday_picks).
export const legacyHolidayData = {
  India: {
    locations: ['Bangalore', 'Hyderabad', 'Chennai'],
    optionalInfo: 10,
    fixed: {},
    optional: {
      2026: [
        { date: '2026-02-15', name: 'Maha Shivaratri' },
        { date: '2026-03-19', name: 'Ugadi' },
        { date: '2026-04-02', name: 'Sri Rama Navami' },
        { date: '2026-04-06', name: 'Mahavir Jayanti' },
        { date: '2026-05-01', name: 'Basava Jayanti' },
        { date: '2026-08-28', name: 'Varalakshmi Vratham' },
        { date: '2026-08-28', name: 'Onam' },
        { date: '2026-09-04', name: 'Milad-un-Nabi' },
        { date: '2026-10-07', name: 'Mahanavami' },
        { date: '2026-11-14', name: 'Guru Nanak Jayanti' },
      ],
      2025: [
        { date: '2025-02-26', name: 'Maha Shivaratri' },
        { date: '2025-03-30', name: 'Ugadi' },
        { date: '2025-04-06', name: 'Sri Rama Navami' },
        { date: '2025-04-14', name: 'Mahavir Jayanti' },
        { date: '2025-05-12', name: 'Buddha Purnima' },
        { date: '2025-08-08', name: 'Varalakshmi Vratham' },
        { date: '2025-09-05', name: 'Onam' },
        { date: '2025-09-05', name: 'Milad-un-Nabi' },
        { date: '2025-10-07', name: 'Durgashtami' },
        { date: '2025-11-05', name: 'Guru Nanak Jayanti' },
      ],
    },
  },
  'United States': {
    locations: ['Nashville, TN'],
    optionalInfo: 8,
    fixed: {},
    optional: {
      2026: [
        { date: '2026-12-24', name: 'Christmas Eve' },
        { date: '2026-12-31', name: "New Year's Eve" },
        { date: '2026-11-03', name: 'Election Day' },
        { date: '2026-06-14', name: 'Flag Day' },
        { date: '2026-02-02', name: 'Groundhog Day (floating)' },
        { date: '2026-07-10', name: 'Floating Personal Day' },
        { date: '2026-03-06', name: 'Employee Appreciation Day' },
        { date: '2026-10-30', name: 'Floating Wellness Day' },
      ],
      2025: [
        { date: '2025-12-24', name: 'Christmas Eve' },
        { date: '2025-12-31', name: "New Year's Eve" },
        { date: '2025-11-04', name: 'Election Day' },
        { date: '2025-06-14', name: 'Flag Day' },
        { date: '2025-07-03', name: 'Floating Personal Day' },
        { date: '2025-10-31', name: 'Floating Wellness Day' },
        { date: '2025-03-07', name: 'Employee Appreciation Day' },
        { date: '2025-05-06', name: 'National Nurses Week Floating' },
      ],
    },
  },
}

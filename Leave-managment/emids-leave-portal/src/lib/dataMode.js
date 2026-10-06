// Data-source toggle: 'mock' = in-browser seeded store, no cloud;
// 'supabase' = the real project from .env.local.
// Switch: the pill on the login screen, or load with ?data=mock / ?data=supabase.
const KEY = 'emids-data-mode'

const fromUrl = new URLSearchParams(window.location.search).get('data')
if (fromUrl === 'mock' || fromUrl === 'supabase') {
  window.localStorage.setItem(KEY, fromUrl)
}

export const DATA_MODE = window.localStorage.getItem(KEY) ?? 'mock'

export function setDataMode(mode) {
  window.localStorage.setItem(KEY, mode)
  window.location.reload()
}

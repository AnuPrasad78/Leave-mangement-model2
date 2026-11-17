type StaticAsset = string | { src: string }

// Asset-URL seam during the Vite/Next transition: Vite resolves an .svg import
// to a URL string, Next (Turbopack) to a StaticImageData object. Both end at
// the same href once passed through here. Retired with Vite in Phase 9.
export function assetSrc(asset: StaticAsset): string {
  return typeof asset === 'string' ? asset : asset.src
}

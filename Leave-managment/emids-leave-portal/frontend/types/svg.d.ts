// Ambient type for static .svg imports. Vite resolves them to URL strings;
// Next (Turbopack) to a StaticImageData object — both are consumed through
// assetSrc() before reaching an img src attribute.
declare module '*.svg' {
  const asset: string | { src: string }
  export default asset
}

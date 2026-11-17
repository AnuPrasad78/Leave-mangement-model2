/* Next.js static image imports resolve to an object with a `.src` URL string */
declare module '*.svg' {
  const content: { src: string; width?: number; height?: number }
  export default content
}

/* Genuine not-found fallback for paths Next invokes 404 on (rendering-level
 * notFound() calls, unmatched server requests). User-side unknown URLs are
 * redirected by app/[...slug]/page.tsx, mirroring the React Router wildcard —
 * this page only ever appears in situations the catch-all does not cover. */
export default function NotFound() {
  return (
    <main>
      <h1>Page not found</h1>
      <p>The page you were looking for does not exist.</p>
    </main>
  )
}

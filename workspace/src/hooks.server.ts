export async function handle({ event, resolve }) {
  const { setHeaders } = event
  setHeaders({
    'Cross-Origin-Embedder-Policy': 'require-corp',
    'Cross-Origin-Opener-Policy': 'cross-origin',
    'Cross-Origin-Resource-Policy': 'cross-origin',
  })
  return await resolve(event)
}
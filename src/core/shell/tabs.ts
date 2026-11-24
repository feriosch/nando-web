// Whether `pathname` is `path` or one of the screens under it.
export function isWithin(pathname: string, path: string) {
  if (path === '/') return pathname === '/'
  return pathname === path || pathname.startsWith(`${path}/`)
}

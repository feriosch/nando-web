// The version shown at the foot of Settings: package.json's version, then the build number, which
// the deploy sets to the number of commits on main (`VITE_APP_BUILD`), so it goes up with every
// merge. A local or PR build has no build number.
export function versionLabel(version: string = __APP_VERSION__, build: string | undefined = import.meta.env.VITE_APP_BUILD) {
  return build ? `Version ${version} (${build})` : `Version ${version}`
}

// Leaves Nando for another site, such as back to a Connector after its approval.
export type Leave = (url: string) => void

// Leaves by loading `url` in this window, which keeps Nando in the browser's history.
export const browserLeave: Leave = (url) => window.location.assign(url)

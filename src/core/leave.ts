// Leaves Nando for another site, such as back to a Connector after its approval.
export type Leave = (url: string) => void

export const browserLeave: Leave = (url) => window.location.assign(url)

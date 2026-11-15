// This device's clipboard.
export type Clipboard = {
  // Puts `text` on the clipboard. Rejects when the device refuses, such as Safari when the page
  // isn't focused.
  copy(text: string): Promise<void>
}

export const browserClipboard: Clipboard = {
  copy: (text) => navigator.clipboard.writeText(text),
}

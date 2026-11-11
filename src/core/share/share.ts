// This device's share sheet, and its downloads where it has no share sheet for files.
export type Share = {
  // Whether the share sheet takes `files` (on iPhone, yes; on most desktops, no).
  canShareFiles(files: File[]): boolean
  // Opens the share sheet with `files`. Must be called from a tap: Safari refuses it, with a
  // `NotAllowedError`, once too much was awaited since. Rejects with an `AbortError` when the Owner
  // closes the sheet without sharing.
  shareFiles(files: File[]): Promise<void>
  // Saves `file` to the device's downloads.
  download(file: File): void
}

export const browserShare: Share = {
  canShareFiles: (files) => typeof navigator.canShare === 'function' && navigator.canShare({ files }),
  shareFiles: (files) => navigator.share({ files }),
  download(file) {
    const url = URL.createObjectURL(file)
    const link = document.createElement('a')
    link.href = url
    link.download = file.name
    // In the document while clicked, which some browsers need to download it.
    document.body.append(link)
    link.click()
    link.remove()
    // Long after the download has read it, even on a slow device.
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
  },
}

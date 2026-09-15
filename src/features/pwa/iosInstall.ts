/** Whether to show manual "add to home screen" instructions (spec §7).
 * iOS/iPadOS Safari never fires `beforeinstallprompt` — `useInstallPrompt`'s
 * native flow never triggers there, so this hint is the only way an iOS
 * user finds out the app can be installed at all.
 *
 * Since iPadOS 13, an iPad's user agent reports "Macintosh" like a real Mac
 * (desktop-class UA string) — `maxTouchPoints` is what actually tells the
 * two apart, since a Mac with a mouse reports 0. Kept as plain arguments
 * rather than reading `navigator`/`document` directly so this stays a pure,
 * easily testable function. */
export function shouldShowIosInstallHint(
  userAgent: string,
  isStandalone: boolean,
  maxTouchPoints: number,
): boolean {
  if (isStandalone) return false
  const isIphoneOrIpod = /iphone|ipod/i.test(userAgent)
  const isModernIpad = /macintosh/i.test(userAgent) && maxTouchPoints > 1
  return isIphoneOrIpod || isModernIpad
}

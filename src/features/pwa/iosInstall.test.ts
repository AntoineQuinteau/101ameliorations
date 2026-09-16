import { describe, expect, it } from 'vitest'
import { shouldShowIosInstallHint } from './iosInstall'

const IPHONE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'
const IPAD_MODERN_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15'
const MAC_DESKTOP_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15'
const ANDROID_CHROME_UA =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36'

describe('shouldShowIosInstallHint', () => {
  it('shows the hint on iPhone Safari', () => {
    expect(shouldShowIosInstallHint(IPHONE_UA, false, 5)).toBe(true)
  })

  it('shows the hint on a modern iPad (desktop-class UA, but touch-capable)', () => {
    expect(shouldShowIosInstallHint(IPAD_MODERN_UA, false, 5)).toBe(true)
  })

  it('does not show the hint on a real Mac (same UA family, no touch)', () => {
    expect(shouldShowIosInstallHint(MAC_DESKTOP_UA, false, 0)).toBe(false)
  })

  it('does not show the hint on Android', () => {
    expect(shouldShowIosInstallHint(ANDROID_CHROME_UA, false, 5)).toBe(false)
  })

  it('does not show the hint once already installed (standalone)', () => {
    expect(shouldShowIosInstallHint(IPHONE_UA, true, 5)).toBe(false)
  })
})

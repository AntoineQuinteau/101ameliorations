import { z } from 'zod'

// Trim + lowercase before validating: users paste with trailing spaces, and
// mobile keyboards auto-capitalize the first letter.
export const emailSchema = z.string().trim().toLowerCase().email()

// Mirrors `otp_length = 6` (supabase/config.toml).
export const otpCodeSchema = z
  .string()
  .trim()
  .regex(/^\d{6}$/)

// Mirrors the DB CHECK constraint on profiles.display_name (2-40 chars).
export const displayNameSchema = z.string().trim().min(2).max(40)

/** Keeps only digits and caps at 6 — handles a paste like "123 456" or an
 * SMS/email autofill blob that includes surrounding text. */
export function sanitizeOtpInput(raw: string): string {
  return raw.replace(/\D/g, '').slice(0, 6)
}

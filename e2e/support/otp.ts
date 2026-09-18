const MAILPIT_URL = 'http://127.0.0.1:54324'
const POLL_INTERVAL_MS = 500
const POLL_TIMEOUT_MS = 20_000

interface MailpitMessageSummary {
  ID: string
  To: Array<{ Address: string }>
  Created: string
}

interface MailpitMessagesResponse {
  messages: MailpitMessageSummary[]
}

interface MailpitMessage {
  Text: string
}

/**
 * Reads the 6-digit OTP code from the most recent email sent to `email` via
 * the local Mailpit API (Supabase's local SMTP catcher, see
 * supabase/config.toml — there is no real email delivery locally).
 *
 * Polls rather than fetching once: email delivery through Mailpit is fast
 * but not synchronous with `signInWithOtp()` resolving, so the message may
 * not exist yet on the first check.
 *
 * `sentAfter` guards against a staleness race that's real here, not
 * theoretical: the three staff accounts (seed-moderator@, seed-authority@,
 * seed-admin@) are reused across specs, so "most recent message to this
 * address" can otherwise return the *previous* test's code if this one's
 * hasn't landed in Mailpit yet. Pass `Date.now()` from just before
 * triggering the send.
 *
 * The OTP itself is `{{ .Token }}` in supabase/templates/magic_link.html,
 * rendered as a standalone 6-digit line in the plaintext body (confirmed
 * against a live local message — see the surrounding "Votre code de
 * connexion" wording that also appears in the template).
 */
export async function getLatestOtpCode(email: string, sentAfter = 0): Promise<string> {
  const deadline = Date.now() + POLL_TIMEOUT_MS
  const target = email.toLowerCase()

  let lastError: string | null = null
  while (Date.now() < deadline) {
    try {
      const message = await findLatestMessageFor(target, sentAfter)
      if (message) {
        const code = extractOtpCode(message.Text)
        if (code) return code
        lastError = `message found for ${email} but no 6-digit code in its body`
      } else {
        lastError = `no Mailpit message yet for ${email} newer than ${new Date(sentAfter).toISOString()}`
      }
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error)
    }
    await sleep(POLL_INTERVAL_MS)
  }

  throw new Error(`Timed out waiting for an OTP email to ${email}: ${lastError}`)
}

async function findLatestMessageFor(
  email: string,
  sentAfter: number,
): Promise<MailpitMessage | null> {
  const listResponse = await fetch(`${MAILPIT_URL}/api/v1/messages?limit=50`)
  if (!listResponse.ok) {
    throw new Error(`Mailpit list request failed: ${listResponse.status}`)
  }
  const list = (await listResponse.json()) as MailpitMessagesResponse

  // Mailpit returns newest first; take the first recipient match that was
  // sent at/after `sentAfter`, with NO backward clock slack. The three
  // staff accounts are reused across specs running in parallel workers, so
  // several logins to the same address can be in flight within the same
  // few seconds — a backward slack window here previously let this match a
  // genuinely older (but still recent-looking) email before the one this
  // exact call triggered had landed in Mailpit, which meant filling in a
  // stale, already-used OTP code and failing verifyOtp with "Code incorrect
  // ou expiré". Since the list is newest-first, the first match honestly
  // satisfying `Created >= sentAfter` is unambiguous: nothing seeded or
  // sent earlier can be newer than a message that itself is newer than
  // `sentAfter`.
  const summary = list.messages.find(
    (message) =>
      message.To.some((recipient) => recipient.Address.toLowerCase() === email) &&
      new Date(message.Created).getTime() >= sentAfter,
  )
  if (!summary) return null

  const messageResponse = await fetch(`${MAILPIT_URL}/api/v1/message/${summary.ID}`)
  if (!messageResponse.ok) {
    throw new Error(`Mailpit message fetch failed: ${messageResponse.status}`)
  }
  return (await messageResponse.json()) as MailpitMessage
}

function extractOtpCode(text: string): string | null {
  const match = /\b(\d{6})\b/.exec(text)
  return match ? match[1] : null
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

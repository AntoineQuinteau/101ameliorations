import { z } from 'zod'

// Mirrors the DB CHECK constraint on status_changes.note (char_length <=
// 500). Empty is allowed here (an optional note) — the RPC itself turns a
// blank/whitespace-only note into null.
export const statusNoteSchema = z.string().trim().max(500)

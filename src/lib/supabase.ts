import { createClient } from '@supabase/supabase-js'
import { env } from '../env'
import type { Database } from '../types/database'

export const supabase = createClient<Database>(
  env.VITE_SUPABASE_URL,
  env.VITE_SUPABASE_PUBLISHABLE_KEY,
  {
    auth: {
      // Session persists in localStorage across reloads (spec §6.4) — this is
      // the default, made explicit here since it's the requirement's home.
      persistSession: true,
      autoRefreshToken: true,
      // The app only uses the 6-digit OTP flow and has no callback route. The
      // default (true, with flowType 'implicit') would parse an
      // #access_token=... fragment on load if anyone ever clicked a magic
      // link, leaving tokens in browser history — disabled since it's unused.
      detectSessionInUrl: false,
    },
  },
)

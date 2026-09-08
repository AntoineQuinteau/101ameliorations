import { createClient } from '@supabase/supabase-js'
import { env } from '../env'
import type { Database } from '../types/database'

export const supabase = createClient<Database>(
  env.VITE_SUPABASE_URL,
  env.VITE_SUPABASE_PUBLISHABLE_KEY,
)

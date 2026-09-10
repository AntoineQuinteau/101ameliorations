import { createContext } from 'react'
import type { Session, User } from '@supabase/supabase-js'

export interface AuthContextValue {
  session: Session | null
  user: User | null
  /** True until the first auth-state notification has been received. */
  isInitializing: boolean
  signInWithOtp: (email: string) => Promise<void>
  verifyOtp: (email: string, token: string) => Promise<void>
  signOut: () => Promise<void>
}

// Split into its own file (component + hook live elsewhere) so that
// react-refresh/only-export-components doesn't need a suppression anywhere.
export const AuthContext = createContext<AuthContextValue | null>(null)

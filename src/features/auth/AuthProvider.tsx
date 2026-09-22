import { useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { queryClient } from '../../lib/queryClient'
import { supabase } from '../../lib/supabase'
import { AuthContext, type AuthContextValue } from './authContext'
import { clearDraftPhotos } from '../newKlash/draftPhotoStore'
import { clearStoredDraft } from '../newKlash/draftStorage'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [isInitializing, setIsInitializing] = useState(true)

  useEffect(() => {
    // `onAuthStateChange` fires `INITIAL_SESSION` immediately on subscribe,
    // already carrying the session restored from localStorage (or `null`).
    // That single event is used as the only source of truth: there's no
    // separate `getSession()` call to race against it, which is what makes
    // this safe under StrictMode's double-invoke (the effect subscribes
    // twice, unsubscribes once, and each subscription independently
    // re-delivers INITIAL_SESSION — no torn state).
    //
    // The callback itself must stay synchronous: auth-js runs it while
    // holding an internal lock, and awaiting another supabase.auth.* call
    // inside it can deadlock. Clearing the query cache here (rather than in
    // signOut()) also means sign-out from another tab, a revoked session, or
    // an expired token all clean up the profile cache the same way.
    //
    // The draft store is cleared here too: it's per-origin, not per-user,
    // so on a shared device it would otherwise offer the next signed-in
    // user the previous one's unsent report — text, position and geotagged
    // photos included. clearStoredDraft is synchronous (safe under the
    // lock above); clearDraftPhotos is fire-and-forget IndexedDB, not a
    // supabase.auth.* call, so it can't deadlock this callback either.
    // Deliberately not mirrored on SIGNED_IN: that event also fires during
    // SubmitStep's inline OTP login, which is exactly the flow this draft
    // is meant to survive.
    const { data } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession)
      setIsInitializing(false)
      if (event === 'SIGNED_OUT') {
        queryClient.clear()
        clearStoredDraft()
        void clearDraftPhotos()
      }
    })
    return () => data.subscription.unsubscribe()
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      isInitializing,
      signInWithOtp: async (email: string, captchaToken?: string) => {
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: { shouldCreateUser: true, captchaToken },
        })
        if (error) throw error
      },
      verifyOtp: async (email: string, token: string) => {
        const { error } = await supabase.auth.verifyOtp({ email, token, type: 'email' })
        if (error) throw error
      },
      signOut: async () => {
        const { error } = await supabase.auth.signOut()
        if (error) throw error
      },
    }),
    [session, isInitializing],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

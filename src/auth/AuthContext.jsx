import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined)
  // Gesetzt, wenn jemand über den Link "Passwort vergessen" kommt und ein neues Passwort vergeben muss.
  const [recovery, setRecovery] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
    })

    const { data: subscription } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (event === 'PASSWORD_RECOVERY') setRecovery(true)
      setSession(nextSession)
    })

    return () => subscription.subscription.unsubscribe()
  }, [])

  const user = session?.user ?? null

  const value = {
    session,
    user,
    loading: session === undefined,
    // Neu eingerichtete Zugänge müssen beim ersten Login ein eigenes Passwort vergeben.
    mustChangePassword: Boolean(user?.user_metadata?.must_change_password),
    recovery,
    signInWithPassword: (email, password) => supabase.auth.signInWithPassword({ email, password }),
    resetPasswordForEmail: (email) =>
      supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin,
      }),
    /**
     * Neues Passwort setzen. Mit oldPassword wird das aktuelle Passwort vorher geprüft
     * (nicht nötig, wenn jemand über den "Passwort vergessen"-Link kommt).
     */
    async changePassword(newPassword, oldPassword) {
      if (oldPassword !== undefined) {
        const { error: checkError } = await supabase.auth.signInWithPassword({ email: user?.email ?? '', password: oldPassword })
        if (checkError) return { error: { code: 'wrong_password' } }
      }
      const { error } = await supabase.auth.updateUser({ password: newPassword, data: { must_change_password: false } })
      if (!error) setRecovery(false)
      return { error }
    },
    signOut: () => supabase.auth.signOut(),
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth muss innerhalb von AuthProvider verwendet werden.')
  }
  return context
}

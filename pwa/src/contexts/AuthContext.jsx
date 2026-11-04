import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext({})

// Where Supabase sends the user after clicking the recovery link (must match Site URL / Redirect URLs)
const APP_URL = `${window.location.origin}${import.meta.env.BASE_URL}`

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [role, setRole] = useState(null)
  const [loading, setLoading] = useState(true)
  // true while the user arrived via a password-recovery link and hasn't set a new password yet
  const [recovery, setRecovery] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const u = session?.user ?? null
      setUser(u)
      setRole(u?.user_metadata?.role ?? 'viewer')
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      const u = session?.user ?? null
      setUser(u)
      setRole(u?.user_metadata?.role ?? 'viewer')
      if (event === 'PASSWORD_RECOVERY') setRecovery(true)
      if (event === 'SIGNED_OUT') setRecovery(false)
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  const signIn = (email, password) =>
    supabase.auth.signInWithPassword({ email, password })

  const signOut = () => supabase.auth.signOut()

  const resetPassword = (email) =>
    supabase.auth.resetPasswordForEmail(email, { redirectTo: APP_URL })

  const updatePassword = async (password) => {
    const res = await supabase.auth.updateUser({ password })
    if (!res.error) setRecovery(false)
    return res
  }

  const value = { user, role, loading, recovery, signIn, signOut, resetPassword, updatePassword }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)

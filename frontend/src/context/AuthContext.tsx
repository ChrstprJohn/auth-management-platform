import { useEffect, useState, type ReactNode } from 'react'
import { authRequest, clearSession, signOut } from '@/services/auth-api'
import { api } from '@/services/api-client'
import { AuthContext } from './auth-context'
export function AuthProvider({ children }: { children: ReactNode }) {
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  useEffect(() => {
    const endSession = () => setIsLoggedIn(false)
    window.addEventListener('auth-session-ended', endSession)
    return () => window.removeEventListener('auth-session-ended', endSession)
  }, [])
  async function login(email: string, password: string) {
    try {
      await authRequest('/token?grant_type=password', { email, password })
      const { data } = await api<{ data: { isAdmin: boolean } }>('/me')
      if (!data.isAdmin)
        throw new Error('This account does not have dashboard administrator access.')
      setIsLoggedIn(true)
    } catch (error) {
      clearSession()
      throw error
    }
  }
  function logout() {
    setIsLoggedIn(false)
    void signOut()
  }
  return (
    <AuthContext.Provider value={{ isLoggedIn, login, logout }}>{children}</AuthContext.Provider>
  )
}

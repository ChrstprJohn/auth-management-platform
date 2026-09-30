import { createContext } from 'react'
export interface AuthContextValue {
  isLoggedIn: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void
}
export const AuthContext = createContext<AuthContextValue | null>(null)

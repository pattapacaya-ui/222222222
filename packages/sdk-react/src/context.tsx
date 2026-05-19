import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import type { ReactNode } from 'react'
import { LegionAuthClient } from '@legionauth/js'
import type { User, Session, Organization } from '@legionauth/js'

export interface LegionAuthContextValue {
  client: LegionAuthClient
  isLoaded: boolean
  isSignedIn: boolean
  user: User | null
  session: Session | null
  signOut: () => Promise<void>
  reload: () => Promise<void>
}

export const LegionAuthContext = createContext<LegionAuthContextValue | null>(null)

export interface LegionAuthProviderProps {
  publishableKey: string
  baseUrl?: string
  children: ReactNode
}

export function LegionAuthProvider({ publishableKey, baseUrl, children }: LegionAuthProviderProps) {
  const [client] = useState(() => new LegionAuthClient({ publishableKey, baseUrl }))
  const [isLoaded, setIsLoaded] = useState(false)
  const [isSignedIn, setIsSignedIn] = useState(false)
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)

  const load = useCallback(async () => {
    const signedIn = await client.initialize()
    if (signedIn) {
      const u = await client.getUser()
      setUser(u)
      setSession(client.getSession())
      setIsSignedIn(true)
    }
    setIsLoaded(true)
  }, [client])

  useEffect(() => {
    void load()
  }, [load])

  const signOut = useCallback(async () => {
    await client.signOut()
    setUser(null)
    setSession(null)
    setIsSignedIn(false)
  }, [client])

  const reload = useCallback(async () => {
    const u = await client.getUser()
    setUser(u)
    setSession(client.getSession())
  }, [client])

  return (
    <LegionAuthContext.Provider value={{ client, isLoaded, isSignedIn, user, session, signOut, reload }}>
      {children}
    </LegionAuthContext.Provider>
  )
}

export function useLegionAuth(): LegionAuthContextValue {
  const ctx = useContext(LegionAuthContext)
  if (!ctx) throw new Error('useLegionAuth must be used inside LegionAuthProvider')
  return ctx
}

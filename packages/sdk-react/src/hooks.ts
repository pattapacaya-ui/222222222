import { useLegionAuth } from './context'
import type { User, Session } from '@legionauth/js'

export function useAuth() {
  const { isLoaded, isSignedIn, user, session, signOut } = useLegionAuth()
  return {
    isLoaded,
    isSignedIn,
    userId: user?.id ?? null,
    user,
    session,
    signOut,
  }
}

export function useUser(): {
  isLoaded: boolean
  isSignedIn: boolean
  user: User | null
} {
  const { isLoaded, isSignedIn, user } = useLegionAuth()
  return { isLoaded, isSignedIn, user }
}

export function useSession(): {
  isLoaded: boolean
  session: Session | null
} {
  const { isLoaded, session } = useLegionAuth()
  return { isLoaded, session }
}

export function useClient() {
  const { client } = useLegionAuth()
  return client
}

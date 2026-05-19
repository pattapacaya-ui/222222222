import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuthStore } from '../../lib/auth-store'
import { api } from '../../lib/api'
import Logo from '../../components/Logo'

export default function OAuthCallbackPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { setTokens } = useAuthStore()

  useEffect(() => {
    const accessToken = params.get('access_token')
    const refreshToken = params.get('refresh_token')
    const error = params.get('error')

    if (error) {
      navigate(`/sign-in?error=${error}`)
      return
    }

    if (!accessToken || !refreshToken) {
      navigate('/sign-in?error=oauth_failed')
      return
    }

    // Get user info with the access token
    api.me(accessToken).then(({ user, session }) => {
      setTokens(accessToken, refreshToken, user, session)
      navigate('/dashboard')
    }).catch(() => {
      navigate('/sign-in?error=oauth_failed')
    })
  }, [params, navigate, setTokens])

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#0f0f15', flexDirection: 'column', gap: 20,
    }}>
      <Logo size={48} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#94a3b8' }}>
        <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" style={{
          width: 20, height: 20, border: '2px solid #6366f1',
          borderTopColor: 'transparent', borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }} />
        Completing sign in...
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}

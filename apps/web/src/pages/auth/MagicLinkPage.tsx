import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuthStore } from '../../lib/auth-store'
import { api } from '../../lib/api'
import Logo from '../../components/Logo'

export default function MagicLinkPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { setTokens } = useAuthStore()

  useEffect(() => {
    const token = params.get('token')
    if (!token) {
      navigate('/sign-in?error=missing_token')
      return
    }

    api.verifyMagicLink(token).then(result => {
      setTokens(result.access_token, result.refresh_token, result.user, result.session)
      navigate('/dashboard')
    }).catch(() => {
      navigate('/sign-in?error=invalid_magic_link')
    })
  }, [params, navigate, setTokens])

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#0f0f15', flexDirection: 'column', gap: 20,
    }}>
      <Logo size={48} />
      <div style={{ color: '#94a3b8' }}>Verifying magic link...</div>
    </div>
  )
}

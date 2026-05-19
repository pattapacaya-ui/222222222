import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect } from 'react'
import { useAuthStore } from './lib/auth-store'
import LandingPage from './pages/landing/LandingPage'
import SignInPage from './pages/auth/SignInPage'
import SignUpPage from './pages/auth/SignUpPage'
import DashboardLayout from './pages/dashboard/DashboardLayout'
import OverviewPage from './pages/dashboard/OverviewPage'
import UsersPage from './pages/dashboard/UsersPage'
import SessionsPage from './pages/dashboard/SessionsPage'
import OrganizationsPage from './pages/dashboard/OrganizationsPage'
import APIKeysPage from './pages/dashboard/APIKeysPage'
import WebhooksPage from './pages/dashboard/WebhooksPage'
import SettingsPage from './pages/dashboard/SettingsPage'
import OAuthCallbackPage from './pages/auth/OAuthCallbackPage'
import MagicLinkPage from './pages/auth/MagicLinkPage'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isSignedIn, isLoaded } = useAuthStore()
  if (!isLoaded) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#0f0f15' }}>
      <div className="flex items-center gap-3 text-indigo-400">
        <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-sm">Loading...</span>
      </div>
    </div>
  )
  if (!isSignedIn) return <Navigate to="/sign-in" replace />
  return <>{children}</>
}

export default function App() {
  const { initAuth } = useAuthStore()

  useEffect(() => {
    void initAuth()
  }, [initAuth])

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/sign-in" element={<SignInPage />} />
        <Route path="/sign-up" element={<SignUpPage />} />
        <Route path="/auth/magic-link" element={<MagicLinkPage />} />
        <Route path="/auth/oauth-callback" element={<OAuthCallbackPage />} />
        <Route path="/dashboard" element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        }>
          <Route index element={<OverviewPage />} />
          <Route path="users" element={<UsersPage />} />
          <Route path="sessions" element={<SessionsPage />} />
          <Route path="organizations" element={<OrganizationsPage />} />
          <Route path="api-keys" element={<APIKeysPage />} />
          <Route path="webhooks" element={<WebhooksPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

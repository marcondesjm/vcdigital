import React, { useState, useEffect } from 'react'
import { UserProvider, useUser } from './contexts/UserContext'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import AdminDashboard from './pages/AdminDashboard'
import ClientDetails from './pages/ClientDetails'
import AuditLogs from './pages/AuditLogs'
import TermsConsent from './pages/TermsConsent'
import Sidebar from './components/Sidebar'
import ClientPortal from './pages/ClientPortal'
import SignaturePortal from './pages/SignaturePortal'
import Employees from './pages/Employees'

type Screen =
  | 'terms'
  | 'login'
  | 'admin-dashboard'
  | 'dashboard'
  | 'client-details'
  | 'employees'
  | 'audit-logs'
  | 'client-portal'
  | 'client-audit'
  | 'client-signature'

function AppContent() {
  const { user, setUser, loading } = useUser()
  const [screen, setScreen] = useState<Screen>('terms')
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null)

  // Se já tem usuário logado, redireciona automaticamente
  useEffect(() => {
    if (user && (screen === 'terms' || screen === 'login')) {
      if (user.role === 'admin') {
        setScreen('admin-dashboard')
      } else if (user.role === 'client') {
        setScreen('client-portal')
      }
    }
  }, [user, screen])

  // Se usuário foi deslogado, volta para login
  const handleLogout = () => {
    setUser(null)
    setScreen('login')
  }

  const renderScreen = () => {
    if (loading) {
      return (
        <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0f172a' }}>
          <div style={{ color: '#10b981', fontSize: '1.2rem' }}>⏳ Carregando...</div>
        </div>
      )
    }

    switch (screen) {
      case 'terms':
        return <TermsConsent onAccept={() => setScreen('login')} />

      case 'login':
        return <Login onLogin={() => {}} />

      case 'admin-dashboard':
      case 'dashboard':
      case 'client-details':
      case 'employees':
      case 'audit-logs':
      case 'client-portal':
      case 'client-audit':
      case 'client-signature':
        return (
          <div className="app-layout">
            <Sidebar
              currentPage={screen}
              onNavigate={(p) => setScreen(p as Screen)}
              onLogout={handleLogout}
              user={user}
            />
            <div className="main-content">
              <header className="topbar">
                <div className="topbar-title">
                  <span className="topbar-icon">🛡️</span>
                  <h2>Você Digital — Gestor de Certificados</h2>
                </div>
                {user && (
                  <div
                    className="user-badge"
                    style={{ cursor: 'pointer' }}
                    onClick={handleLogout}
                    title="Sair"
                  >
                    <span className="user-avatar">👤</span>
                    <span>{user.name}</span>
                  </div>
                )}
              </header>
              <main className="page-content">
                {renderPage()}
              </main>
            </div>
          </div>
        )

      default:
        return <TermsConsent onAccept={() => setScreen('login')} />
    }
  }

  function renderPage() {
    switch (screen) {
      // --- VISÃO ADMIN ---
      case 'admin-dashboard':
        return (
          <AdminDashboard
            onSelectClient={(id) => {
              setSelectedClientId(id)
              setScreen('client-details')
            }}
            onNavigateToAudit={() => setScreen('audit-logs')}
          />
        )

      case 'dashboard':
        return (
          <Dashboard
            onSelectClient={(id) => {
              setSelectedClientId(id)
              setScreen('client-details')
            }}
          />
        )

      case 'client-details':
        return (
          <ClientDetails
            clientId={selectedClientId || ''}
            onBack={() => setScreen('admin-dashboard')}
          />
        )

      case 'employees':
        return <Employees />

      case 'audit-logs':
        return <AuditLogs />

      // --- VISÃO CLIENTE ---
      case 'client-portal':
        return (
          <ClientPortal
            onNavigateToAudit={() => setScreen('client-audit')}
            onLogout={handleLogout}
          />
        )

      case 'client-audit':
        return <AuditLogs /> // Reutilizamos o AuditLogs, que já tem filtragem embutida para cliente logado!

      case 'client-signature':
        return <SignaturePortal />

      default:
        return <Dashboard onSelectClient={() => {}} />
    }
  }

  return renderScreen()
}

export default function App() {
  return (
    <UserProvider>
      <AppContent />
    </UserProvider>
  )
}

import React from 'react'
import type { User } from '../types'

interface SidebarProps {
  currentPage: string
  onNavigate: (page: string) => void
  onLogout?: () => void
  user?: User | null
}

export default function Sidebar({ currentPage, onNavigate, onLogout, user }: SidebarProps) {
  const isClient = user?.role === 'client'

  return (
    <div className="sidebar">
      <div className="sidebar-header">⚡ Você Digital</div>

      <ul className="sidebar-menu">
        {!isClient ? (
          <>
            <li
              className={`sidebar-item ${currentPage === 'admin-dashboard' ? 'active' : ''}`}
              onClick={() => onNavigate('admin-dashboard')}
            >
              📊 Painel Admin
            </li>
            <li
              className={`sidebar-item ${currentPage === 'dashboard' ? 'active' : ''}`}
              onClick={() => onNavigate('dashboard')}
            >
              📁 Meus Clientes
            </li>
            <li
              className={`sidebar-item ${currentPage === 'employees' ? 'active' : ''}`}
              onClick={() => onNavigate('employees')}
            >
              👥 Equipe (Funcionários)
            </li>
            <li
              className={`sidebar-item ${currentPage === 'audit-logs' ? 'active' : ''}`}
              onClick={() => onNavigate('audit-logs')}
            >
              📜 Auditoria (Rastro)
            </li>
            <li
              className={`sidebar-item ${currentPage === 'client-signature' ? 'active' : ''}`}
              onClick={() => onNavigate('client-signature')}
            >
              ✍️ Assinar PDF
            </li>
          </>
        ) : (
          <>
            <li
              className={`sidebar-item ${currentPage === 'client-portal' ? 'active' : ''}`}
              onClick={() => onNavigate('client-portal')}
            >
              🏢 Minha Empresa
            </li>
            <li
              className={`sidebar-item ${currentPage === 'client-audit' ? 'active' : ''}`}
              onClick={() => onNavigate('client-audit')}
            >
              📜 Meu Rastro de Uso
            </li>
            <li
              className={`sidebar-item ${currentPage === 'client-signature' ? 'active' : ''}`}
              onClick={() => onNavigate('client-signature')}
            >
              ✍️ Assinar Documento
            </li>
          </>
        )}
      </ul>

      <div style={{ marginTop: 'auto', padding: '16px', borderTop: '1px solid var(--border)' }}>
        {user && (
          <div style={{ marginBottom: '12px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Logado como <strong style={{ color: 'var(--text-main)' }}>{user.name}</strong>
            <br />
            <span className={`badge-${user.role === 'admin' ? 'success' : 'warning'}`}>
              {user.role === 'admin' ? 'Contador' : 'Cliente'}
            </span>
          </div>
        )}
        {onLogout && (
          <button className="btn" style={{ width: '100%', background: '#475569' }} onClick={onLogout}>
            🚪 Sair
          </button>
        )}
      </div>
    </div>
  )
}

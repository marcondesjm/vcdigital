import React, { useState, useEffect } from 'react'
import { useUser } from '../contexts/UserContext'
import Sidebar from '../components/Sidebar'
import { getClient, listClientCertificates, listAuditLogs } from '../services/api'
import type { Client, CertificateMetadata, AuditLog } from '../types'

interface ClientPortalProps {
  onNavigateToAudit: () => void
  onLogout: () => void
}

export default function ClientPortal({ onNavigateToAudit, onLogout }: ClientPortalProps) {
  const { user } = useUser()
  const [client, setClient] = useState<Client | null>(null)
  const [certs, setCerts] = useState<CertificateMetadata[]>([])
  const [recentLogs, setRecentLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user?.client_id) {
      setLoading(false)
      return
    }

    Promise.all([
      getClient(user.client_id),
      listClientCertificates(user.client_id),
      listAuditLogs(user.client_id),
    ])
      .then(([clientData, certsData, logsData]) => {
        setClient(clientData)
        setCerts(certsData)
        setRecentLogs((logsData || []).slice(0, 5))
      })
      .catch((err) => {
        console.error('Erro ao carregar dados:', err)
      })
      .finally(() => setLoading(false))
  }, [user])

  // Helpers de validade
  const isExpiringSoon = (cert: CertificateMetadata): boolean => {
    if (!cert.expiry_date || cert.status !== 'Active') return false
    const expiry = new Date(cert.expiry_date)
    const now = new Date()
    const diffDays = Math.floor((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    return diffDays <= 30 && diffDays > 0
  }

  const isExpired = (cert: CertificateMetadata): boolean => {
    if (!cert.expiry_date) return false
    return new Date(cert.expiry_date) < new Date()
  }

  const certStatus = (cert: CertificateMetadata): 'success' | 'warning' | 'danger' => {
    if (cert.status === 'Revoked') return 'danger'
    if (isExpired(cert)) return 'danger'
    if (isExpiringSoon(cert)) return 'warning'
    return 'success'
  }

  const certStatusLabel = (cert: CertificateMetadata): string => {
    if (cert.status === 'Revoked') return 'Revogado'
    if (isExpired(cert)) return 'Expirado'
    if (isExpiringSoon(cert)) return 'Vence em breve'
    return 'Ativo'
  }

  // Stats
  const activeCount = certs.filter((c) => c.status === 'Active').length
  const expiringCount = certs.filter(isExpiringSoon).length
  const signedThisMonth = recentLogs.filter((l) => {
    const d = new Date(l.timestamp)
    const now = new Date()
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  }).length

  return (
    <div className="app-layout">
      <Sidebar
        currentPage="client-portal"
        onNavigate={() => {}}
        onLogout={onLogout}
        user={user}
      />
      <div className="main-content">
        <header className="topbar">
          <div className="topbar-title">
            <span className="topbar-icon">🏢</span>
            <h2>Minha Empresa — Visão do Cliente</h2>
          </div>
          {user && (
            <div className="user-badge">
              <span className="user-avatar">👤</span>
              <span>{user.name}</span>
            </div>
          )}
        </header>

        <main className="page-content">
          {loading ? (
            <div style={{ color: '#94a3b8' }}>⏳ Carregando dados...</div>
          ) : !client ? (
            <div style={{ color: '#fca5a5' }}>⚠️ Cliente não encontrado.</div>
          ) : (
            <>
              <div style={{ marginBottom: '24px' }}>
                <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{client.name}</h1>
                <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>CNPJ: {client.document}</p>
              </div>

              {/* Cards de Resumo */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '32px' }}>
                <div className="card" style={{ marginBottom: 0 }}>
                  <div style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Meus Certificados Ativos</div>
                  <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#10b981', marginTop: '8px' }}>
                    {activeCount}
                  </div>
                </div>
                <div className="card" style={{ marginBottom: 0 }}>
                  <div style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Vencendo em 30 dias</div>
                  <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#f59e0b', marginTop: '8px' }}>
                    {expiringCount}
                  </div>
                </div>
                <div className="card" style={{ marginBottom: 0 }}>
                  <div style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Assinaturas (últimas)</div>
                  <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#10b981', marginTop: '8px' }}>
                    {recentLogs.length}
                  </div>
                </div>
              </div>

              {/* Lista de Certificados */}
              <div className="card">
                <h3 style={{ marginBottom: '16px' }}>📋 Meus Certificados</h3>
                {certs.length === 0 ? (
                  <p style={{ color: '#94a3b8' }}>Nenhum certificado custodiado.</p>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid #475569', color: '#94a3b8', fontSize: '0.85rem' }}>
                        <th style={{ padding: '12px' }}>Tipo</th>
                        <th style={{ padding: '12px' }}>Data de Validade</th>
                        <th style={{ padding: '12px' }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {certs.map((cert) => (
                        <tr key={cert.id} style={{ borderBottom: '1px solid #334155' }}>
                          <td style={{ padding: '16px', fontWeight: '500' }}>{cert.type}</td>
                          <td style={{ padding: '16px', color: '#94a3b8' }}>
                            {cert.expiry_date ? new Date(cert.expiry_date).toLocaleDateString('pt-BR') : '—'}
                          </td>
                          <td style={{ padding: '16px' }}>
                            <span className={`badge-${certStatus(cert)}`}>
                              {certStatusLabel(cert)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Últimas Assinaturas */}
              <div className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h3>📜 Últimas Assinaturas</h3>
                  <button
                    className="btn"
                    style={{ padding: '6px 12px', fontSize: '0.85rem' }}
                    onClick={onNavigateToAudit}
                  >
                    Ver Todas
                  </button>
                </div>
                {recentLogs.length === 0 ? (
                  <p style={{ color: '#94a3b8' }}>Nenhuma assinatura registrada.</p>
                ) : (
                  <ul style={{ listStyle: 'none', padding: 0 }}>
                    {recentLogs.map((log) => (
                      <li
                        key={log.id}
                        style={{
                          padding: '12px 0',
                          borderBottom: '1px solid #334155',
                          fontSize: '0.9rem',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span>
                            <strong>{log.document_name}</strong>
                          </span>
                          <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>
                            {new Date(log.timestamp).toLocaleString('pt-BR')}
                          </span>
                        </div>
                        <div style={{ color: '#94a3b8', fontSize: '0.8rem', marginTop: '4px' }}>
                          {log.action} — <span style={{ color: log.status === 'SUCCESS' ? '#10b981' : '#ef4444' }}>{log.status}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  )
}
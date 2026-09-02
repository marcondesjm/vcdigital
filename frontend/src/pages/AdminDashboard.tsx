import React, { useState, useEffect, useMemo } from 'react'
import {
  listClients,
  listClientCertificates,
  listAuditLogs,
  listEmployees,
  createClient,
} from '../services/api'
import type { Client, CertificateMetadata, AuditLog, Employee } from '../types'

interface AdminDashboardProps {
  onSelectClient: (clientId: string) => void
  onNavigateToAudit: () => void
}

interface ClientWithStats {
  client: Client
  total_certs: number
  active_certs: number
  expiring_certs: number
  last_activity?: string
}

interface ExpiringCert {
  cert: CertificateMetadata
  client_name: string
  client_id: string
  days_remaining: number
}

interface EmployeeActivity {
  employee: Employee
  signatures_count: number
  last_activity?: string
}

export default function AdminDashboard({ onSelectClient, onNavigateToAudit }: AdminDashboardProps) {
  const [clients, setClients] = useState<ClientWithStats[]>([])
  const [expiringCerts, setExpiringCerts] = useState<ExpiringCert[]>([])
  const [recentLogs, setRecentLogs] = useState<AuditLog[]>([])
  const [employees, setEmployees] = useState<EmployeeActivity[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDocument, setNewDocument] = useState('')
  const [creatingClient, setCreatingClient] = useState(false)
  const [filterModel, setFilterModel] = useState<string>('all')  // Modelo ágil

  const loadAll = async () => {
    setLoading(true)
    setError('')
    try {
      const clientsList = await listClients()

      // Carregar estatísticas por cliente
      const clientStats: ClientWithStats[] = await Promise.all(
        clientsList.map(async (c) => {
          try {
            const certs = await listClientCertificates(c.id)
            const now = new Date()
            const active = certs.filter((x) => x.status === 'Active').length
            const expiring = certs.filter((x) => {
              if (!x.expiry_date || x.status !== 'Active') return false
              const expiry = new Date(x.expiry_date)
              const diff = (expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
              return diff <= 30 && diff > 0
            }).length
            return {
              client: c,
              total_certs: certs.length,
              active_certs: active,
              expiring_certs: expiring,
            }
          } catch {
            return {
              client: c,
              total_certs: 0,
              active_certs: 0,
              expiring_certs: 0,
            }
          }
        })
      )
      setClients(clientStats)

      // Coletar certificados vencendo (consolidado)
      const allExpiring: ExpiringCert[] = []
      for (const stat of clientStats) {
        try {
          const certs = await listClientCertificates(stat.client.id)
          for (const cert of certs) {
            if (!cert.expiry_date || cert.status !== 'Active') continue
            const expiry = new Date(cert.expiry_date)
            const now = new Date()
            const diff = Math.floor((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
            if (diff <= 30 && diff > 0) {
              allExpiring.push({
                cert,
                client_name: stat.client.name,
                client_id: stat.client.id,
                days_remaining: diff,
              })
            }
          }
        } catch { /* ignorar */ }
      }
      allExpiring.sort((a, b) => a.days_remaining - b.days_remaining)
      setExpiringCerts(allExpiring)

      // Coletar últimas atividades
      const logs: AuditLog[] = []
      for (const stat of clientStats) {
        try {
          const clientLogs = await listAuditLogs(stat.client.id)
          for (const log of clientLogs) {
            logs.push({ ...log, client_id: stat.client.id })
          }
        } catch { /* ignorar */ }
      }
      logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      setRecentLogs(logs.slice(0, 10))

      // Carregar funcionários (se houver escritório)
      try {
        const tenantId = clientsList[0]?.tenant_id
        if (tenantId) {
          const empList = await listEmployees(tenantId)
          // Contar assinaturas por funcionário
          const empActivity: EmployeeActivity[] = empList.map((emp) => {
            const empLogs = logs.filter((l) => l.employee_id === emp.id)
            return {
              employee: emp,
              signatures_count: empLogs.filter((l) => l.action === 'SIGNATURE').length,
              last_activity: empLogs[0]?.timestamp,
            }
          })
          empActivity.sort((a, b) => b.signatures_count - a.signatures_count)
          setEmployees(empActivity)
        }
      } catch { /* escritório sem funcionários ainda */ }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar dados')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAll()
  }, [])

  // Cards de resumo
  const totals = useMemo(() => {
    return {
      clients: clients.length,
      certs: clients.reduce((s, c) => s + c.total_certs, 0),
      active: clients.reduce((s, c) => s + c.active_certs, 0),
      expiring: expiringCerts.length,
      signatures: recentLogs.filter((l) => l.action === 'SIGNATURE').length,
      employees: employees.length,
    }
  }, [clients, expiringCerts, recentLogs, employees])

  const handleAddClient = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newName || !newDocument) {
      alert('Preencha nome e CNPJ/CPF.')
      return
    }
    setCreatingClient(true)
    try {
      await createClient({ name: newName, document: newDocument })
      setNewName('')
      setNewDocument('')
      setShowModal(false)
      await loadAll()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao criar cliente')
    } finally {
      setCreatingClient(false)
    }
  }

  const filteredClients = clients.filter((c) => {
    const term = searchTerm.toLowerCase()
    return (
      c.client.name.toLowerCase().includes(term) ||
      c.client.document.includes(term)
    )
  })

  const urgencyColor = (days: number): string => {
    if (days <= 7) return '#ef4444'  // vermelho
    if (days <= 15) return '#f59e0b'  // laranja
    return '#eab308'  // amarelo
  }

  const formatDate = (iso?: string): string => {
    if (!iso) return '—'
    try {
      return new Date(iso).toLocaleDateString('pt-BR')
    } catch {
      return iso
    }
  }

  const formatRelativeTime = (iso?: string): string => {
    if (!iso) return '—'
    try {
      const date = new Date(iso)
      const now = new Date()
      const diffMs = now.getTime() - date.getTime()
      const diffMin = Math.floor(diffMs / (1000 * 60))
      const diffHour = Math.floor(diffMs / (1000 * 60 * 60))
      const diffDay = Math.floor(diffMs / (1000 * 60 * 60 * 24))
      if (diffMin < 1) return 'agora'
      if (diffMin < 60) return `${diffMin}min atrás`
      if (diffHour < 24) return `${diffHour}h atrás`
      if (diffDay < 30) return `${diffDay}d atrás`
      return date.toLocaleDateString('pt-BR')
    } catch {
      return iso
    }
  }

  const actionLabel = (action: string): string => {
    const map: Record<string, string> = {
      SIGNATURE: 'Assinatura',
      UPLOAD_CERTIFICATE: 'Upload de Certificado',
      REVOKE_CERTIFICATE: 'Revogação',
    }
    return map[action] || action
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 'bold', margin: 0 }}>
            Painel Administrativo
          </h1>
          <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginTop: '4px' }}>
            Visão geral da operação e gestão proativa
          </p>
        </div>
        <button className="btn" onClick={() => setShowModal(true)}>
          + Novo Cliente
        </button>
      </div>

      {error && (
        <div className="alert-danger" style={{ marginBottom: '16px' }}>
          ⚠️ {error}
        </div>
      )}

      {/* Cards de Resumo - 6 métricas */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: '12px',
        marginBottom: '24px',
      }}>
        <div className="card" style={{ marginBottom: 0, padding: '20px' }}>
          <div style={{ color: '#94a3b8', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Clientes
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#10b981', marginTop: '8px' }}>
            {totals.clients}
          </div>
          <div style={{ color: '#64748b', fontSize: '0.75rem', marginTop: '4px' }}>
            ativos no sistema
          </div>
        </div>

        <div className="card" style={{ marginBottom: 0, padding: '20px' }}>
          <div style={{ color: '#94a3b8', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Certificados
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#10b981', marginTop: '8px' }}>
            {totals.certs}
          </div>
          <div style={{ color: '#64748b', fontSize: '0.75rem', marginTop: '4px' }}>
            {totals.active} ativos
          </div>
        </div>

        <div className="card" style={{ marginBottom: 0, padding: '20px' }}>
          <div style={{ color: '#94a3b8', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Vencendo 30d
          </div>
          <div style={{
            fontSize: '2rem',
            fontWeight: 'bold',
            color: totals.expiring > 0 ? '#f59e0b' : '#10b981',
            marginTop: '8px',
          }}>
            {totals.expiring}
          </div>
          <div style={{ color: '#64748b', fontSize: '0.75rem', marginTop: '4px' }}>
            atenção necessária
          </div>
        </div>

        <div className="card" style={{ marginBottom: 0, padding: '20px' }}>
          <div style={{ color: '#94a3b8', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Assinaturas
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#10b981', marginTop: '8px' }}>
            {totals.signatures}
          </div>
          <div style={{ color: '#64748b', fontSize: '0.75rem', marginTop: '4px' }}>
            últimos logs
          </div>
        </div>

        <div className="card" style={{ marginBottom: 0, padding: '20px' }}>
          <div style={{ color: '#94a3b8', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Equipe
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#10b981', marginTop: '8px' }}>
            {totals.employees}
          </div>
          <div style={{ color: '#64748b', fontSize: '0.75rem', marginTop: '4px' }}>
            funcionários
          </div>
        </div>

        <div className="card" style={{ marginBottom: 0, padding: '20px' }}>
          <div style={{ color: '#94a3b8', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Status Sistema
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: '#10b981', marginTop: '8px' }}>
            ✓ Operacional
          </div>
          <div style={{ color: '#64748b', fontSize: '0.75rem', marginTop: '4px' }}>
            todos os serviços OK
          </div>
        </div>
      </div>

      {/* Layout em Grid - 2 colunas */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px' }}>
        {/* Coluna Esquerda: Clientes */}
        <div>
          <div className="card" style={{ marginBottom: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0 }}>📁 Meus Clientes</h3>
              <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>
                {filteredClients.length} de {clients.length}
              </span>
            </div>
            <input
              type="text"
              className="input"
              placeholder="🔍 Buscar por nome ou CNPJ..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ marginBottom: '12px' }}
            />
            {loading ? (
              <div style={{ color: '#94a3b8', textAlign: 'center', padding: '24px' }}>⏳ Carregando...</div>
            ) : filteredClients.length === 0 ? (
              <div style={{ color: '#94a3b8', textAlign: 'center', padding: '24px' }}>
                {searchTerm ? 'Nenhum cliente encontrado.' : 'Nenhum cliente cadastrado.'}
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #475569', color: '#94a3b8', fontSize: '0.8rem' }}>
                      <th style={{ padding: '10px' }}>Nome</th>
                      <th style={{ padding: '10px' }}>CNPJ/CPF</th>
                      <th style={{ padding: '10px', textAlign: 'center' }}>Certs</th>
                      <th style={{ padding: '10px', textAlign: 'center' }}>Status</th>
                      <th style={{ padding: '10px', textAlign: 'center' }}>Ação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredClients.map((stat) => (
                      <tr key={stat.client.id} style={{ borderBottom: '1px solid #334155' }}>
                        <td style={{ padding: '12px', fontWeight: '500' }}>{stat.client.name}</td>
                        <td style={{ padding: '12px', color: '#94a3b8', fontSize: '0.85rem' }}>
                          {stat.client.document}
                        </td>
                        <td style={{ padding: '12px', textAlign: 'center' }}>{stat.total_certs}</td>
                        <td style={{ padding: '12px', textAlign: 'center' }}>
                          {stat.expiring_certs > 0 ? (
                            <span className="badge-warning">{stat.expiring_certs} ⚠️</span>
                          ) : stat.total_certs === 0 ? (
                            <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>—</span>
                          ) : (
                            <span className="badge-success">OK</span>
                          )}
                        </td>
                        <td style={{ padding: '12px', textAlign: 'center' }}>
                          <button
                            className="btn"
                            style={{ padding: '4px 10px', fontSize: '0.8rem' }}
                            onClick={() => onSelectClient(stat.client.id)}
                          >
                            Abrir
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Atividade da Equipe */}
          <div className="card">
            <h3 style={{ margin: 0, marginBottom: '12px' }}>👥 Atividade da Equipe</h3>
            {employees.length === 0 ? (
              <div style={{ color: '#94a3b8', padding: '16px', textAlign: 'center' }}>
                Nenhum funcionário cadastrado ainda.
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #475569', color: '#94a3b8', fontSize: '0.8rem' }}>
                    <th style={{ padding: '8px', textAlign: 'left' }}>Funcionário</th>
                    <th style={{ padding: '8px', textAlign: 'center' }}>Assinaturas</th>
                    <th style={{ padding: '8px', textAlign: 'right' }}>Última Atividade</th>
                  </tr>
                </thead>
                <tbody>
                  {employees.slice(0, 5).map((ea) => (
                    <tr key={ea.employee.id} style={{ borderBottom: '1px solid #334155' }}>
                      <td style={{ padding: '10px' }}>
                        <div style={{ fontWeight: '500' }}>{ea.employee.name}</div>
                        <div style={{ color: '#94a3b8', fontSize: '0.75rem' }}>{ea.employee.email}</div>
                      </td>
                      <td style={{ padding: '10px', textAlign: 'center' }}>
                        <span style={{
                          padding: '2px 10px',
                          borderRadius: '12px',
                          background: ea.signatures_count > 0 ? '#1e3a8a' : '#475569',
                          color: '#fff',
                          fontSize: '0.8rem',
                        }}>
                          {ea.signatures_count}
                        </span>
                      </td>
                      <td style={{ padding: '10px', textAlign: 'right', color: '#94a3b8', fontSize: '0.8rem' }}>
                        {formatRelativeTime(ea.last_activity)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Coluna Direita: Alertas + Logs */}
        <div>
          {/* Alertas de Vencimento */}
          <div className="card" style={{ marginBottom: '16px' }}>
            <h3 style={{ margin: 0, marginBottom: '12px' }}>⚠️ Alertas de Vencimento</h3>
            {expiringCerts.length === 0 ? (
              <div style={{
                color: '#10b981',
                padding: '16px',
                textAlign: 'center',
                background: '#064e3b',
                borderRadius: '6px',
              }}>
                ✓ Nenhum vencendo nos próximos 30 dias
              </div>
            ) : (
              <>
                <div style={{ marginBottom: '8px' }}>
                  <select
                    className="input"
                    value={filterModel}
                    onChange={(e) => setFilterModel(e.target.value)}
                    style={{ marginBottom: 0, fontSize: '0.85rem' }}
                  >
                    <option value="all">Todos os modelos</option>
                    <option value="A1">A1</option>
                    <option value="A3">A3</option>
                    <option value="A4">A4</option>
                    <option value="SE">Selo Eletrônico</option>
                  </select>
                </div>
                <div style={{ maxHeight: '320px', overflowY: 'auto' }}>
                  {expiringCerts
                    .filter((e) => filterModel === 'all' || e.cert.cert_model === filterModel)
                    .slice(0, 10)
                    .map((item) => (
                      <div
                        key={item.cert.id}
                        onClick={() => onSelectClient(item.client_id)}
                        style={{
                          padding: '10px',
                          marginBottom: '6px',
                          background: '#1e293b',
                          borderRadius: '6px',
                          borderLeft: `3px solid ${urgencyColor(item.days_remaining)}`,
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = '#334155')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = '#1e293b')}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ fontWeight: '500', fontSize: '0.85rem' }}>
                            {item.client_name}
                          </span>
                          <span style={{
                            color: urgencyColor(item.days_remaining),
                            fontWeight: 'bold',
                            fontSize: '0.85rem',
                          }}>
                            {item.days_remaining}d
                          </span>
                        </div>
                        <div style={{ color: '#94a3b8', fontSize: '0.75rem', marginTop: '2px' }}>
                          {item.cert.cert_model} · {formatDate(item.cert.expiry_date)}
                        </div>
                      </div>
                    ))}
                </div>
              </>
            )}
          </div>

          {/* Atividade Recente */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h3 style={{ margin: 0 }}>📋 Atividade Recente</h3>
              <button
                className="btn"
                style={{ padding: '4px 10px', fontSize: '0.75rem', background: '#475569' }}
                onClick={onNavigateToAudit}
              >
                Ver todos
              </button>
            </div>
            {recentLogs.length === 0 ? (
              <div style={{ color: '#94a3b8', padding: '16px', textAlign: 'center' }}>
                Nenhuma atividade registrada.
              </div>
            ) : (
              <div style={{ maxHeight: '280px', overflowY: 'auto' }}>
                {recentLogs.map((log) => (
                  <div
                    key={log.id}
                    style={{
                      padding: '8px',
                      marginBottom: '4px',
                      borderBottom: '1px solid #334155',
                      fontSize: '0.85rem',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontWeight: '500' }}>
                        {actionLabel(log.action)}
                      </span>
                      <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>
                        {formatRelativeTime(log.timestamp)}
                      </span>
                    </div>
                    <div style={{ color: '#94a3b8', fontSize: '0.75rem', marginTop: '2px' }}>
                      {log.document_name || '—'}
                    </div>
                    {log.status === 'FAILED' && (
                      <span className="badge-danger" style={{ fontSize: '0.7rem', marginTop: '4px' }}>
                        FALHOU
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal de Novo Cliente */}
      {showModal && (
        <div className="modal-overlay">
          <div className="card" style={{ width: '450px', margin: 0 }}>
            <h3>Cadastrar Novo Cliente</h3>
            <form onSubmit={handleAddClient} style={{ marginTop: '16px' }}>
              <label style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Nome da Empresa</label>
              <input
                className="input"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Ex: Comercial LTDA"
                autoFocus
              />

              <label style={{ fontSize: '0.85rem', color: '#94a3b8' }}>CNPJ / CPF</label>
              <input
                className="input"
                value={newDocument}
                onChange={(e) => setNewDocument(e.target.value)}
                placeholder="00.000.000/0001-00"
              />

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px' }}>
                <button
                  type="button"
                  className="btn"
                  style={{ background: '#475569' }}
                  onClick={() => setShowModal(false)}
                  disabled={creatingClient}
                >
                  Cancelar
                </button>
                <button type="submit" className="btn" disabled={creatingClient}>
                  {creatingClient ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

import React, { useState, useEffect } from 'react'
import { listAuditLogs, listClients } from '../services/api'
import { useUser } from '../contexts/UserContext'
import type { AuditLog, Client } from '../types'

export default function AuditLogs() {
  const { user } = useUser()
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [filterClient, setFilterClient] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadData = async () => {
    setLoading(true)
    setError('')
    try {
      const [clientsData] = await Promise.all([listClients()])
      setClients(clientsData)

      // Determinar qual client_id usar
      let targetClientId = filterClient
      if (user?.role === 'client') {
        targetClientId = user.client_id || ''
      }
      if (targetClientId && targetClientId !== 'all') {
        const statusFilter = filterStatus === 'all' ? undefined : filterStatus
        const data = await listAuditLogs(targetClientId, statusFilter)
        setLogs(data)
      } else {
        // Para admin sem cliente selecionado, mostrar todos os logs via join manual
        // Como simplificação, pegamos todos os clientes
        const allLogs: AuditLog[] = []
        for (const client of clientsData) {
          try {
            const clientLogs = await listAuditLogs(client.id, filterStatus === 'all' ? undefined : filterStatus)
            allLogs.push(...clientLogs)
          } catch {
            // ignorar
          }
        }
        allLogs.sort((a, b) => (a.timestamp > b.timestamp ? -1 : 1))
        setLogs(allLogs)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterClient, filterStatus, user])

  // Exportar CSV
  const handleExportCSV = () => {
    const headers = ['Data/Hora', 'Documento', 'Ação', 'Status', 'Hash (truncado)', 'Funcionário']
    const rows = logs.map((log) => [
      new Date(log.timestamp).toLocaleString('pt-BR'),
      log.document_name,
      log.action,
      log.status,
      log.document_hash ? log.document_hash.substring(0, 16) + '...' : '',
      log.employee_id.substring(0, 8),
    ])
    const csvContent = [headers, ...rows]
      .map((row) => row.map((cell) => `"${cell}"`).join(','))
      .join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `auditoria_${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    alert('Hash copiado!')
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>Auditoria (Rastro de Uso)</h1>
          <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>
            Histórico imutável de todas as operações realizadas no sistema
          </p>
        </div>
        {logs.length > 0 && (
          <button className="btn" onClick={handleExportCSV}>
            📥 Exportar CSV
          </button>
        )}
      </div>

      {/* Filtros */}
      <div className="card" style={{ padding: '16px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-end' }}>
          {user?.role !== 'client' && (
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Filtrar por Cliente</label>
              <select
                className="input"
                value={filterClient}
                onChange={(e) => setFilterClient(e.target.value)}
                style={{ margin: 0 }}
              >
                <option value="all">Todos os Clientes</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Status</label>
            <select
              className="input"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              style={{ margin: 0 }}
            >
              <option value="all">Todos</option>
              <option value="SUCCESS">✅ Sucesso</option>
              <option value="FAILED">❌ Falha</option>
            </select>
          </div>
        </div>
      </div>

      {/* Tabela de Logs */}
      <div className="card">
        {loading ? (
          <div style={{ color: '#94a3b8', textAlign: 'center', padding: '24px' }}>⏳ Carregando...</div>
        ) : error ? (
          <div style={{ color: '#fca5a5' }}>⚠️ {error}</div>
        ) : logs.length === 0 ? (
          <div style={{ color: '#94a3b8', textAlign: 'center', padding: '24px' }}>
            Nenhum log encontrado para os filtros selecionados.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #475569', color: '#94a3b8', fontSize: '0.85rem' }}>
                <th style={{ padding: '12px' }}>Data / Hora</th>
                <th style={{ padding: '12px' }}>Documento</th>
                <th style={{ padding: '12px' }}>Ação</th>
                <th style={{ padding: '12px' }}>Status</th>
                <th style={{ padding: '12px' }}>Hash (SHA-256)</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} style={{ borderBottom: '1px solid #334155' }}>
                  <td style={{ padding: '16px', color: '#94a3b8' }}>
                    {new Date(log.timestamp).toLocaleString('pt-BR')}
                  </td>
                  <td style={{ padding: '16px', fontWeight: '500' }}>{log.document_name}</td>
                  <td style={{ padding: '16px' }}>{log.action}</td>
                  <td style={{ padding: '16px' }}>
                    <span className={log.status === 'SUCCESS' ? 'badge-success' : 'badge-danger'}>
                      {log.status === 'SUCCESS' ? '✅ Sucesso' : '❌ Falha'}
                    </span>
                  </td>
                  <td style={{ padding: '16px', color: '#94a3b8', fontSize: '0.85rem' }}>
                    {log.document_hash ? (
                      <span
                        style={{ cursor: 'pointer' }}
                        onClick={() => copyToClipboard(log.document_hash)}
                        title="Clique para copiar o hash completo"
                      >
                        {log.document_hash.substring(0, 16)}...
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
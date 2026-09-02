import React, { useState, useEffect } from 'react'
import { listClients, createClient, listClientCertificates, listAuditLogs, deleteClient } from '../services/api'
import type { Client } from '../types'

interface DashboardProps {
  onSelectClient: (clientId: string) => void
}

interface ClientWithStats extends Client {
  total_certs: number
  expiring_certs: number
  last_signature?: string
}

export default function Dashboard({ onSelectClient }: DashboardProps) {
  const [clients, setClients] = useState<ClientWithStats[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [name, setName] = useState('')
  const [document, setDocument] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Carregar lista de clientes com stats
  const loadClients = async () => {
    setLoading(true)
    setError('')
    try {
      const list = await listClients()
      // Para cada cliente, buscar certificados
      const withStats: ClientWithStats[] = await Promise.all(
        list.map(async (c) => {
          try {
            const certs = await listClientCertificates(c.id)
            const logs = await listAuditLogs(c.id)
            const now = new Date()
            const expiring = certs.filter((cert) => {
              if (!cert.expiry_date || cert.status !== 'Active') return false
              const expiry = new Date(cert.expiry_date)
              const diff = (expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
              return diff <= 30 && diff > 0
            }).length
            return {
              ...c,
              total_certs: certs.length,
              expiring_certs: expiring,
              last_signature: logs[0]?.timestamp,
            }
          } catch {
            return { ...c, total_certs: 0, expiring_certs: 0 }
          }
        })
      )
      setClients(withStats)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar clientes')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadClients()
  }, [])

  const handleAddClient = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name || !document) {
      alert('Preencha nome e CNPJ/CPF.')
      return
    }

    try {
      await createClient({ name, document })
      setName('')
      setDocument('')
      setShowModal(false)
      await loadClients()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao criar cliente')
    }
  }

  const handleDeleteClient = async (clientId: string, clientName: string) => {
    if (!confirm(`Tem certeza que deseja excluir o cliente "${clientName}"?`)) return

    try {
      await deleteClient(clientId)
      await loadClients()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao excluir cliente')
    }
  }

  // Filtro de busca
  const filteredClients = clients.filter(
    (c) =>
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.document.includes(searchTerm)
  )

  // Cards de resumo globais
  const totalClients = clients.length
  const totalCerts = clients.reduce((sum, c) => sum + c.total_certs, 0)
  const expiringTotal = clients.reduce((sum, c) => sum + c.expiring_certs, 0)

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>Painel do Contador</h1>
          <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>
            Gerencie empresas e seus certificados digitais
          </p>
        </div>
        <button className="btn" onClick={() => setShowModal(true)}>
          + Novo Cliente
        </button>
      </div>

      {/* Cards de Resumo */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '24px' }}>
        <div className="card" style={{ marginBottom: 0 }}>
          <div style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Total de Clientes</div>
          <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#10b981', marginTop: '8px' }}>
            {totalClients}
          </div>
        </div>
        <div className="card" style={{ marginBottom: 0 }}>
          <div style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Total de Certificados</div>
          <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#10b981', marginTop: '8px' }}>
            {totalCerts}
          </div>
        </div>
        <div className="card" style={{ marginBottom: 0 }}>
          <div style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Vencendo em 30 dias</div>
          <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#f59e0b', marginTop: '8px' }}>
            {expiringTotal}
          </div>
        </div>
      </div>

      {/* Busca */}
      <div style={{ marginBottom: '16px' }}>
        <input
          type="text"
          className="input"
          placeholder="🔍 Buscar por nome ou CNPJ..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ marginBottom: 0 }}
        />
      </div>

      <div className="card">
        {loading ? (
          <div style={{ color: '#94a3b8', textAlign: 'center', padding: '32px' }}>⏳ Carregando...</div>
        ) : error ? (
          <div style={{ color: '#fca5a5' }}>⚠️ {error}</div>
        ) : filteredClients.length === 0 ? (
          <div style={{ color: '#94a3b8', textAlign: 'center', padding: '32px' }}>
            {searchTerm ? 'Nenhum cliente encontrado.' : 'Nenhum cliente cadastrado ainda.'}
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #475569', color: '#94a3b8', fontSize: '0.85rem' }}>
                <th style={{ padding: '12px' }}>Nome</th>
                <th style={{ padding: '12px' }}>CNPJ / CPF</th>
                <th style={{ padding: '12px' }}>Certificados</th>
                <th style={{ padding: '12px' }}>Vencendo</th>
                <th style={{ padding: '12px' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {filteredClients.map((client) => (
                <tr key={client.id} style={{ borderBottom: '1px solid #334155' }}>
                  <td style={{ padding: '16px', fontWeight: '500' }}>{client.name}</td>
                  <td style={{ padding: '16px', color: '#94a3b8' }}>{client.document}</td>
                  <td style={{ padding: '16px' }}>{client.total_certs}</td>
                  <td style={{ padding: '16px' }}>
                    {client.expiring_certs > 0 ? (
                      <span className="badge-warning">{client.expiring_certs}</span>
                    ) : (
                      <span style={{ color: '#94a3b8' }}>0</span>
                    )}
                  </td>
                  <td style={{ padding: '16px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <button
                      className="btn"
                      style={{ padding: '6px 12px', fontSize: '0.85rem' }}
                      onClick={() => onSelectClient(client.id)}
                    >
                      Gerenciar Certificados
                    </button>
                    <button
                      className="btn"
                      style={{ padding: '6px 10px', fontSize: '0.85rem', background: '#ef4444' }}
                      onClick={() => handleDeleteClient(client.id, client.name)}
                      title="Excluir Cliente"
                    >
                      🗑️
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
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
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Comercial LTDA"
                autoFocus
              />

              <label style={{ fontSize: '0.85rem', color: '#94a3b8' }}>CNPJ / CPF</label>
              <input
                className="input"
                value={document}
                onChange={(e) => setDocument(e.target.value)}
                placeholder="00.000.000/0001-00"
              />

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px' }}>
                <button
                  type="button"
                  className="btn"
                  style={{ background: '#475569' }}
                  onClick={() => setShowModal(false)}
                >
                  Cancelar
                </button>
                <button type="submit" className="btn">Salvar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
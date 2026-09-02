import React, { useState, useEffect, useRef } from 'react'
import {
  uploadCertificate,
  listClientCertificates,
  revokeCertificate,
  getClient,
} from '../services/api'
import { useUser } from '../contexts/UserContext'
import type { CertificateMetadata, Client } from '../types'

interface ClientDetailsProps {
  clientId: string
  onBack: () => void
}

export default function ClientDetails({ clientId, onBack }: ClientDetailsProps) {
  const { user } = useUser()
  const [client, setClient] = useState<Client | null>(null)
  const [certs, setCerts] = useState<CertificateMetadata[]>([])
  const [certPath, setCertPath] = useState('')
  const [password, setPassword] = useState('')
  const [certModel, setCertModel] = useState('A1')  // Modelo Agnóstico: A1, A3, A4, SE, etc.
  const [certType, setCertType] = useState<'file' | 'token' | 'hardware'>('file')
  const [loading, setLoading] = useState(false)
  const [loadingList, setLoadingList] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showUpload, setShowUpload] = useState(false)
  const [confirmRevoke, setConfirmRevoke] = useState<string | null>(null)

  const loadData = async () => {
    setLoadingList(true)
    try {
      const [clientData, certsData] = await Promise.all([
        getClient(clientId),
        listClientCertificates(clientId),
      ])
      setClient(clientData)
      setCerts(certsData)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar')
    } finally {
      setLoadingList(false)
    }
  }

  useEffect(() => {
    if (clientId) loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId])

  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleSelectFile = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setCertPath(file.name)
    }
  }

  const handleUploadCert = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    if (!certPath || !password) {
      setError('Selecione o arquivo e informe a senha.')
      return
    }

    setLoading(true)
    try {
      const res = await uploadCertificate({
        filePath: certPath,
        password,
        clientId,
        certModel,
        certType,
        employeeId: user?.user_id,
      })

      setSuccess(res.message || 'Certificado custodiado com sucesso!')
      setCertPath('')
      setPassword('')
      setShowUpload(false)
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao enviar certificado')
    } finally {
      setLoading(false)
    }
  }

  const handleRevoke = async (certId: string) => {
    setError('')
    try {
      await revokeCertificate(certId, user?.user_id || '')
      setSuccess('Certificado revogado com sucesso.')
      setConfirmRevoke(null)
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao revogar')
    }
  }

  // Helpers de validade
  const isExpiringSoon = (cert: CertificateMetadata): boolean => {
    if (!cert.expiry_date || cert.status !== 'Active') return false
    const expiry = new Date(cert.expiry_date)
    const now = new Date()
    const diff = Math.floor((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    return diff <= 30 && diff > 0
  }

  const isExpired = (cert: CertificateMetadata): boolean => {
    if (!cert.expiry_date) return false
    return new Date(cert.expiry_date) < new Date()
  }

  const daysUntilExpiry = (cert: CertificateMetadata): number | null => {
    if (!cert.expiry_date) return null
    return Math.floor((new Date(cert.expiry_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
  }

  const certStatusBadge = (cert: CertificateMetadata): string => {
    if (cert.status === 'Revoked') return 'badge-danger'
    if (isExpired(cert)) return 'badge-danger'
    if (isExpiringSoon(cert)) return 'badge-warning'
    return 'badge-success'
  }

  const certStatusLabel = (cert: CertificateMetadata): string => {
    if (cert.status === 'Revoked') return 'Revogado'
    if (isExpired(cert)) return 'Expirado'
    if (isExpiringSoon(cert)) return 'Vence em breve'
    return 'Ativo'
  }

  return (
    <div>
      <button
        className="btn"
        style={{ background: '#475569', marginBottom: '20px' }}
        onClick={onBack}
      >
        ← Voltar aos Clientes
      </button>

      <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '8px' }}>
        {client?.name || 'Carregando...'}
      </h1>
      <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '24px' }}>
        CNPJ/CPF: {client?.document || '—'}
      </p>

      {error && (
        <div className="alert-danger" style={{ marginBottom: '16px' }}>
          ⚠️ {error}
        </div>
      )}
      {success && (
        <div className="alert-success" style={{ marginBottom: '16px' }}>
          ✓ {success}
        </div>
      )}

      {/* Header da lista */}
      <div
        style={{
                display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '16px',
            }}
      >
        <h2 style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>
          📋 Certificados Custodiados ({certs.length})
        </h2>
        <button className="btn" onClick={() => setShowUpload(!showUpload)}>
          {showUpload ? '✕ Cancelar' : '+ Novo Upload'}
        </button>
      </div>

      {/* Modal de Upload */}
      {showUpload && (
        <div className="card">
          <h3>Novo Certificado</h3>
          <form onSubmit={handleUploadCert} style={{ marginTop: '16px' }}>
            <label style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Modelo do Certificado</label>
            <select
              className="input"
              value={certModel}
              onChange={(e) => setCertModel(e.target.value)}
              style={{ marginBottom: '16px' }}
            >
              <option value="A1">A1 (Arquivo .pfx / .p12)</option>
              <option value="A3">A3 (Token USB / Smartcard)</option>
              <option value="A4">A4 (Cartão Inteligente)</option>
              <option value="SE">Selo Eletrônico</option>
            </select>

            <label style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Tipo de Suporte</label>
            <select
              className="input"
              value={certType}
              onChange={(e) => setCertType(e.target.value as 'file' | 'token' | 'hardware')}
              style={{ marginBottom: '16px' }}
            >
              <option value="file">Arquivo (.pfx / .p12)</option>
              <option value="token">Token USB</option>
              <option value="hardware">Hardware (HSM)</option>
            </select>

            <label style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Arquivo do Certificado (.pfx / .p12)</label>
            <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
              <input
                className="input"
                value={certPath}
                readOnly
                placeholder="Nenhum arquivo selecionado"
                style={{ margin: 0 }}
              />
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept=".pfx,.p12"
                style={{ display: 'none' }}
              />
              <button type="button" className="btn" onClick={handleSelectFile}>
                Examinar
              </button>
            </div>

            {certType === 'file' && (
              <>
                <label style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Senha do Certificado</label>
                <input
                  type="password"
                  className="input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                />
                <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '12px' }}>
                  ℹ️ A senha será validada no upload. Se o arquivo .pfx não abrir com ela, retornaremos erro.
                </p>
              </>
            )}

            <button type="submit" className="btn" style={{ width: '100%' }} disabled={loading}>
              {loading ? 'Validando e Criptografando...' : 'Salvar em Custódia Segura'}
            </button>
          </form>
        </div>
      )}

      {/* Lista de Certificados */}
      <div className="card">
        {loadingList ? (
          <div style={{ color: '#94a3b8', textAlign: 'center', padding: '24px' }}>⏳ Carregando...</div>
        ) : certs.length === 0 ? (
          <div style={{ color: '#94a3b8', textAlign: 'center', padding: '24px' }}>
            Nenhum certificado custodiado. Clique em "+ Novo Upload" para começar.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #475569', color: '#94a3b8', fontSize: '0.85rem' }}>
                <th style={{ padding: '12px' }}>Modelo</th>
                <th style={{ padding: '12px' }}>Validade</th>
                <th style={{ padding: '12px' }}>Status</th>
                <th style={{ padding: '12px' }}>Cadastrado em</th>
                <th style={{ padding: '12px' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {certs.map((cert) => {
                const days = daysUntilExpiry(cert)
                return (
                  <tr key={cert.id} style={{ borderBottom: '1px solid #334155' }}>
                    <td style={{ padding: '16px', fontWeight: '500' }}>{cert.cert_model || cert.type}</td>
                    <td style={{ padding: '16px', color: '#94a3b8' }}>
                      {cert.expiry_date
                        ? new Date(cert.expiry_date).toLocaleDateString('pt-BR')
                        : '—'}
                      {days !== null && cert.status === 'Active' && (
                        <div style={{ fontSize: '0.75rem', marginTop: '4px' }}>
                          {days > 0 ? `${days} dias restantes` : `${Math.abs(days)} dias atrás`}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '16px' }}>
                      <span className={certStatusBadge(cert)}>{certStatusLabel(cert)}</span>
                    </td>
                    <td style={{ padding: '16px', color: '#94a3b8', fontSize: '0.85rem' }}>
                      {new Date(cert.created_at).toLocaleDateString('pt-BR')}
                    </td>
                    <td style={{ padding: '16px' }}>
                      {cert.status === 'Active' && (
                        <button
                          className="btn"
                          style={{
                            background: '#475569',
                            padding: '6px 12px',
                            fontSize: '0.85rem',
                          }}
                          onClick={() => setConfirmRevoke(cert.id)}
                        >
                          🚫 Revogar
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal de Confirmação de Revogação */}
      {confirmRevoke && (
        <div className="modal-overlay">
          <div className="card" style={{ width: '400px', margin: 0 }}>
            <h3 style={{ color: '#ef4444' }}>⚠️ Confirmar Revogação</h3>
            <p style={{ color: '#cbd5e1', marginTop: '12px', marginBottom: '16px', fontSize: '0.9rem' }}>
              Esta ação marcará o certificado como <strong>Revogado</strong> e ele não poderá mais ser usado para assinaturas.
              O histórico de auditoria será preservado.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button
                className="btn"
                style={{ background: '#475569' }}
                onClick={() => setConfirmRevoke(null)}
              >
                Cancelar
              </button>
              <button
                className="btn"
                style={{ background: '#ef4444' }}
                onClick={() => handleRevoke(confirmRevoke)}
              >
                Sim, Revogar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
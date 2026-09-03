import React, { useState, useEffect } from 'react'
import { listClients, listClientCertificates } from '../services/api'
import { useUser } from '../contexts/UserContext'
import type { Client, CertificateMetadata } from '../types'

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'http://localhost:8001' : '')

export default function SignaturePortal() {
  const { user } = useUser()
  const [clients, setClients] = useState<Client[]>([])
  const [selectedClientId, setSelectedClientId] = useState<string>('')
  const [certificates, setCertificates] = useState<CertificateMetadata[]>([])
  const [selectedCertId, setSelectedCertId] = useState<string>('')
  const [pdfFile, setPdfFile] = useState<File | null>(null)
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string>('')
  const [success, setSuccess] = useState<string>('')
  const [signedBase64, setSignedBase64] = useState<string | null>(null)
  const [signedHash, setSignedHash] = useState<string | null>(null)

  // Carregar clientes (se for admin) ou o próprio cliente (se for client)
  useEffect(() => {
    if (user?.role === 'admin') {
      listClients()
        .then((data) => {
          setClients(data)
          if (data.length > 0) setSelectedClientId(data[0].id)
        })
        .catch((err) => setError(err.message))
    } else if (user?.role === 'client' && user.client_id) {
      setSelectedClientId(user.client_id)
    }
  }, [user])

  // Quando o cliente selecionado mudar, carregar seus certificados ativos
  useEffect(() => {
    if (!selectedClientId) {
      setCertificates([])
      setSelectedCertId('')
      return
    }

    listClientCertificates(selectedClientId)
      .then((data) => {
        const active = data.filter((c) => c.status === 'Active')
        setCertificates(active)
        if (active.length > 0) setSelectedCertId(active[0].id)
        else setSelectedCertId('')
      })
      .catch((err) => setError(err.message))
  }, [selectedClientId])

  const handleSelectPdf = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError('')
    if (e.target.files && e.target.files[0]) {
      setPdfFile(e.target.files[0])
    }
  }

  const handleSign = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setSignedBase64(null)

    if (!pdfFile || !selectedCertId || !selectedClientId) {
      setError('Selecione o cliente, o certificado e o arquivo PDF.')
      return
    }

    if (!pdfFile.name.toLowerCase().endsWith('.pdf')) {
      setError('O arquivo selecionado deve ser um PDF válido (.pdf). Você selecionou um arquivo de certificado.')
      return
    }

    setLoading(true)
    try {
      const formData = new FormData()
      formData.append('pdf_file', pdfFile)
      formData.append('certificate_id', selectedCertId)
      formData.append('employee_id', user?.user_id || 'default_admin')

      const res = await fetch(`${BACKEND_URL}/sign-pdf/`, {
        method: 'POST',
        body: formData,
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.detail || 'Erro ao assinar PDF')
      }

      setSuccess(data.message || 'PDF assinado com sucesso!')
      setSignedBase64(data.signed_pdf_base64 || null)
      setSignedHash(data.document_hash || null)
    } catch (err: any) {
      setError(err.message || 'Erro ao assinar PDF')
    } finally {
      setLoading(false)
    }
  }

  const handleDownload = () => {
    if (!signedBase64) return
    // Converter base64 para blob e disparar download
    const byteCharacters = atob(signedBase64)
    const byteNumbers = new Array(byteCharacters.length)
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i)
    }
    const byteArray = new Uint8Array(byteNumbers)
    const blob = new Blob([byteArray], { type: 'application/pdf' })

    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `documento_assinado_${Date.now()}.pdf`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>Portal de Assinatura PAdES</h1>
        <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>
          Assine documentos digitais com validade jurídica (ICP-Brasil) usando os certificados custodiados
        </p>
      </div>

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

      <div className="card" style={{ maxWidth: '700px' }}>
        <form onSubmit={handleSign}>
          {/* Seleção de Cliente (Apenas se for Admin) */}
          {user?.role === 'admin' && (
            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Empresa / Cliente</label>
              <select
                className="input"
                value={selectedClientId}
                onChange={(e) => setSelectedClientId(e.target.value)}
                style={{ margin: 0 }}
              >
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.document})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Seleção de Certificado */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Certificado Disponível</label>
            <select
              className="input"
              value={selectedCertId}
              onChange={(e) => setSelectedCertId(e.target.value)}
              style={{ margin: 0 }}
              disabled={certificates.length === 0}
            >
              {certificates.length === 0 ? (
                <option value="">Nenhum certificado ativo encontrado para este cliente</option>
              ) : (
                certificates.map((c) => (
                  <option key={c.id} value={c.id}>
                    Certificado {c.type} — Válido até {c.expiry_date ? new Date(c.expiry_date).toLocaleDateString('pt-BR') : '—'}
                  </option>
                ))
              )}
            </select>
          </div>

          {/* Seleção de Arquivo PDF */}
          <div style={{ marginBottom: '24px' }}>
            <label style={{ fontSize: '0.85rem', color: '#94a3b8', display: 'block', marginBottom: '6px' }}>Documento PDF para Assinar</label>
            <input
              type="file"
              accept=".pdf"
              onChange={handleSelectPdf}
              style={{
                width: '100%',
                padding: '10px',
                borderRadius: '8px',
                background: '#0f172a',
                border: '1px solid var(--border)',
                color: '#fff',
              }}
            />
          </div>

          <button
            type="submit"
            className="btn"
            style={{ width: '100%', padding: '12px' }}
            disabled={loading || !pdfFile || !selectedCertId}
          >
            {loading ? 'Assinando PDF...' : '✍️ Assinar PDF'}
          </button>
        </form>

        {/* Resultado da Assinatura */}
        {signedBase64 && (
          <div
            style={{
              marginTop: '24px',
              padding: '20px',
              backgroundColor: '#1e293b',
              borderRadius: '8px',
              border: '1px solid #10b981',
            }}
          >
            <h3 style={{ color: '#10b981', marginBottom: '8px' }}>✓ Assinatura PAdES Concluída</h3>
            <p style={{ color: '#cbd5e1', fontSize: '0.85rem', marginBottom: '12px' }}>
              O documento foi assinado com sucesso na RAM e o log de auditoria foi gerado de forma atômica.
            </p>
            {signedHash && (
              <p style={{ color: '#94a3b8', fontSize: '0.8rem', marginBottom: '16px', wordBreak: 'break-all' }}>
                <strong>Hash SHA-256:</strong> {signedHash}
              </p>
            )}
            <button className="btn" onClick={handleDownload} style={{ width: '100%' }}>
              📥 Baixar PDF Assinado
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
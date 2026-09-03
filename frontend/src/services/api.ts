/**
 * Serviço centralizado para comunicação com o backend via Proxy do Vite (/api).
 */

import axios from 'axios'
import type {
  User,
  Client,
  CertificateMetadata,
  Employee,
  AuditLog,
  Permission,
  SignResponse,
  UploadResponse,
} from '../types'

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'http://localhost:8001' : '')
const electronApi = (window as any).api

function unwrapError(e: unknown): string {
  if (e instanceof Error) return e.message
  if (typeof e === 'string') return e
  return 'Erro de conexão com o servidor.'
}

// ============================================
// AUTH
// ============================================

export async function login(email: string, password: string): Promise<User> {
  try {
    if (electronApi?.login) {
      return await electronApi.login({ email, password })
    } else {
      const res = await axios.post(`${BACKEND_URL}/login`, { email, password })
      return res.data
    }
  } catch (e) {
    throw new Error(unwrapError(e))
  }
}

// ============================================
// CLIENTS
// ============================================

export async function listClients(): Promise<Client[]> {
  try {
    if (electronApi?.listClients) {
      const res = await electronApi.listClients()
      return res.clients || []
    } else {
      const res = await axios.get(`${BACKEND_URL}/clients/`)
      return res.data.clients || []
    }
  } catch (e) {
    throw new Error(unwrapError(e))
  }
}

export async function createClient(data: { name: string; document: string }): Promise<string> {
  try {
    if (electronApi?.createClient) {
      const res = await electronApi.createClient(data)
      return res.client_id
    } else {
      const res = await axios.post(`${BACKEND_URL}/clients/`, data)
      return res.data.client_id
    }
  } catch (e) {
    throw new Error(unwrapError(e))
  }
}

export async function deleteClient(clientId: string): Promise<void> {
  try {
    const res = await axios.delete(`${BACKEND_URL}/clients/${clientId}`)
    if (res.data.status !== 'success') {
      throw new Error('Erro ao excluir cliente')
    }
  } catch (e) {
    throw new Error(unwrapError(e))
  }
}

export async function getClient(clientId: string): Promise<Client> {
  try {
    if (electronApi?.getClient) {
      const res = await electronApi.getClient(clientId)
      return res.client
    } else {
      const res = await axios.get(`${BACKEND_URL}/clients/${clientId}`)
      return res.data.client
    }
  } catch (e) {
    throw new Error(unwrapError(e))
  }
}

// ============================================
// CERTIFICATES
// ============================================

export async function uploadCertificate(data: {
  filePath: string
  password: string
  clientId: string
  certModel: string
  certType: string
  employeeId?: string
}): Promise<UploadResponse> {
  try {
    if (electronApi?.uploadCertificate) {
      return await electronApi.uploadCertificate(data)
    } else {
      // No browser, enviamos arquivo via input
      const formData = new FormData()
      // Se houver arquivo selecionado
      const fileInput = (document.querySelector('input[type="file"]') as HTMLInputElement)
      if (!fileInput || !fileInput.files || !fileInput.files[0]) {
        throw new Error('Nenhum arquivo de certificado selecionado.')
      }
      formData.append('file', fileInput.files[0])
      formData.append('password', data.password)
      formData.append('client_id', data.clientId)
      formData.append('cert_model', data.certModel)
      formData.append('cert_type', data.certType)
      formData.append('employee_id', data.employeeId || '')

      const res = await axios.post(`${BACKEND_URL}/upload-certificate/`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      return res.data
    }
  } catch (e) {
    throw new Error(unwrapError(e))
  }
}

export async function listClientCertificates(clientId: string): Promise<CertificateMetadata[]> {
  try {
    if (electronApi?.listClientCertificates) {
      const res = await electronApi.listClientCertificates(clientId)
      return res.certificates || []
    } else {
      const res = await axios.get(`${BACKEND_URL}/clients/${clientId}/certificates`)
      return res.data.certificates || []
    }
  } catch (e) {
    throw new Error(unwrapError(e))
  }
}

export async function revokeCertificate(certId: string, employeeId: string): Promise<void> {
  try {
    if (electronApi?.revokeCertificate) {
      await electronApi.revokeCertificate({ certId, employeeId })
    } else {
      await axios.delete(`${BACKEND_URL}/certificates/${certId}?employee_id=${employeeId}`)
    }
  } catch (e) {
    throw new Error(unwrapError(e))
  }
}

// ============================================
// SIGNATURE
// ============================================

export async function signPdf(data: {
  pdfPath: string
  certificateId: string
  employeeId: string
}): Promise<SignResponse> {
  try {
    if (electronApi?.signPdf) {
      return await electronApi.signPdf(data)
    } else {
      throw new Error('Assinatura de PDF requer ambiente desktop.')
    }
  } catch (e) {
    throw new Error(unwrapError(e))
  }
}

// ============================================
// AUDIT LOGS
// ============================================

export async function listAuditLogs(clientId?: string, status?: string): Promise<AuditLog[]> {
  try {
    const url = clientId ? `${BACKEND_URL}/audit-logs/${clientId}` : `${BACKEND_URL}/audit-logs/`
    const params = status ? { status } : {}
    const res = await axios.get(url, { params })
    return res.data.logs || []
  } catch (e) {
    throw new Error(unwrapError(e))
  }
}

// ============================================
// EMPLOYEES & PERMISSIONS
// ============================================

export async function listEmployees(tenantId: string): Promise<Employee[]> {
  try {
    const res = await axios.get(`${BACKEND_URL}/employees/?tenant_id=${tenantId}`)
    return res.data.employees || []
  } catch (e) {
    throw new Error(unwrapError(e))
  }
}

export async function listPermissions(certId: string): Promise<Permission[]> {
  try {
    const res = await axios.get(`${BACKEND_URL}/certificates/${certId}/permissions`)
    return res.data.permissions || []
  } catch (e) {
    throw new Error(unwrapError(e))
  }
}

export async function grantPermission(employeeId: string, certificateId: string): Promise<void> {
  try {
    await axios.post(`${BACKEND_URL}/permissions/grant`, { employeeId, certificateId })
  } catch (e) {
    throw new Error(unwrapError(e))
  }
}

export async function revokePermission(permId: string): Promise<void> {
  try {
    await axios.post(`${BACKEND_URL}/permissions/revoke/${permId}`)
  } catch (e) {
    throw new Error(unwrapError(e))
  }
}

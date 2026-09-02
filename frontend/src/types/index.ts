// Tipos globais do projeto Você Digital

export type UserRole = 'admin' | 'client' | 'operator'

export interface User {
  user_id: string
  name: string
  role: UserRole
  client_id?: string | null
  tenant_id?: string | null
}

export interface Client {
  id: string
  name: string
  document: string
  tenant_id?: string
  created_at?: string
}

export type CertificateModel = 'A1' | 'A3' | 'A4' | 'SE' | 'CODE_SIGNING'  // Modelo Agnóstico
export type CertificateType = 'file' | 'token' | 'hardware'  // Tipo de suporte
export type CertificateStatus = 'Active' | 'Expired' | 'Revoked' | 'Pending'

export interface CertificateMetadata {
  id: string
  cert_model: CertificateModel  // Modelo Agnóstico: A1, A3, A4, SE, etc.
  cert_type: CertificateType    // Tipo de suporte: file, token, hardware
  provider?: string             // Emissor: ICP-Brasil, ACRA, etc.
  expiry_date: string | null
  status: CertificateStatus
  created_at: string
  subject_name?: string         // CN do certificado
  serial_number?: string        // Número de série
  issuer?: string               // Emissor do certificado
}

export interface Employee {
  id: string
  name: string
  email: string
  role: string
  tenant_id?: string
  created_at?: string
}

export interface DashboardStats {
  total_clients: number
  total_certificates: number
  active_certificates: number
  expired_certificates: number
  expiring_30_days: number
  total_signatures: number
  total_employees: number
  recent_logs: AuditLog[]
}

export interface AuditLog {
  id: string
  certificate_id: string
  employee_id: string
  document_name: string
  document_hash: string
  action: string
  timestamp: string
  status: 'SUCCESS' | 'FAILED'
  ip_address?: string
}

export interface Permission {
  id: string
  employee_id: string
  certificate_id: string
  granted_at: string
}

export interface SignResponse {
  status: string
  message: string
  signed_pdf_base64?: string
  document_hash?: string
  timestamp?: string
  metadata?: Record<string, unknown>
}

export interface UploadResponse {
  status: string
  certificate_id?: string
  expiry_date?: string | null
  metadata?: Record<string, unknown>
  message?: string
}

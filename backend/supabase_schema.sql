-- Schema Supabase para Você Digital
-- Execute este script no SQL Editor do Supabase

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Tenants (Escritórios Contábeis)
CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    email TEXT UNIQUE,
    master_key_encrypted TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Clients (Clientes do Contador)
CREATE TABLE IF NOT EXISTS clients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id),
    name TEXT NOT NULL,
    document TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    status TEXT DEFAULT 'active',
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- Users (Usuários do Sistema)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id),
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'client')),
    client_id UUID REFERENCES clients(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Employees (Funcionários do Escritório)
CREATE TABLE IF NOT EXISTS employees (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id),
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'employee',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Certificates (Custódia de Certificados - Modelo Agnóstico)
CREATE TABLE IF NOT EXISTS certificates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID REFERENCES clients(id),
    tenant_id UUID REFERENCES tenants(id),
    cert_model TEXT NOT NULL,  -- 'A1', 'A3', 'A4', 'SE', 'CODE_SIGNING', etc.
    cert_type TEXT NOT NULL,   -- 'file', 'token', 'hardware'
    provider TEXT,
    encrypted_pfx TEXT,
    encrypted_password TEXT,
    pkcs11_slot TEXT,
    pkcs11_label TEXT,
    expiry_date TEXT,
    subject_name TEXT,
    serial_number TEXT,
    issuer TEXT,
    status TEXT DEFAULT 'Active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Certificate Permissions
CREATE TABLE IF NOT EXISTS certificate_permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID REFERENCES employees(id),
    certificate_id UUID REFERENCES certificates(id),
    granted_by TEXT,
    granted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(employee_id, certificate_id)
);

-- Audit Logs (Rastro de Uso - Audit-First)
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id),
    certificate_id UUID REFERENCES certificates(id),
    employee_id UUID REFERENCES employees(id),
    client_id UUID REFERENCES clients(id),
    document_name TEXT,
    document_hash TEXT,
    action TEXT NOT NULL,
    status TEXT NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    metadata JSONB,
    timestamp TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    log_hash TEXT
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_certificates_client ON certificates(client_id);
CREATE INDEX IF NOT EXISTS idx_certificates_tenant ON certificates(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_client ON audit_logs(client_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_cert ON audit_logs(certificate_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_employee ON audit_logs(employee_id);

-- Row Level Security (RLS)
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE certificate_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Políticas de Segurança (exemplo básico)
-- Em produção, ajuste conforme sua lógica de acesso
CREATE POLICY "Autenticados podem ler tenants"
    ON tenants FOR SELECT TO authenticated USING (true);
CREATE POLICY "Autenticados podem inserir tenants"
    ON tenants FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Autenticados podem ler clients"
    ON clients FOR SELECT TO authenticated USING (true);
CREATE POLICY "Autenticados podem inserir clients"
    ON clients FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Autenticados podem ler users"
    ON users FOR SELECT TO authenticated USING (true);

CREATE POLICY "Autenticados podem ler employees"
    ON employees FOR SELECT TO authenticated USING (true);
CREATE POLICY "Autenticados podem inserir employees"
    ON employees FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Autenticados podem ler certificates"
    ON certificates FOR SELECT TO authenticated USING (true);
CREATE POLICY "Autenticados podem inserir certificates"
    ON certificates FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Autenticados podem ler certificate_permissions"
    ON certificate_permissions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Autenticados podem inserir certificate_permissions"
    ON certificate_permissions FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Autenticados podem ler audit_logs"
    ON audit_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Autenticados podem inserir audit_logs"
    ON audit_logs FOR INSERT TO authenticated WITH CHECK (true);

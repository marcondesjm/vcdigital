-- ============================================================================
-- Você Digital - Schema PostgreSQL (Supabase)
-- Migração de SQLite para Supabase com RLS e Auditoria Imutável
-- Modelo Agnóstico: Suporta A3, A4, Selo Eletrônico (SE) e futuros padrões
-- ============================================================================

----------------------------------------------------------------------------------------------------
-- 1. EXTENSÕES NECESSÁRIAS
----------------------------------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

----------------------------------------------------------------------------------------------------
-- 2. TABELA: tenants (Escritórios Contábeis)
-- Hierarquia de Confiança: Nível mais alto da hierarquia
----------------------------------------------------------------------------------------------------
CREATE TABLE tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    master_key_encrypted TEXT NOT NULL, -- Chave mestra Fernet criptografada
    created_at TIMESTAMP DEFAULT NOW()
);

----------------------------------------------------------------------------------------------------
-- 3. TABELA: clients (Clientes do Escritório)
-- Hierarquia de Confiança: Cliente pertence a um Escritório
----------------------------------------------------------------------------------------------------
CREATE TABLE clients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    document TEXT NOT NULL, -- CNPJ/CPF
    created_at TIMESTAMP DEFAULT NOW()
);

----------------------------------------------------------------------------------------------------
-- 4. TABELA: employees (Funcionários do Escritório)
-- Hierarquia de Confiança: Funcionário pertence a um Escritório
----------------------------------------------------------------------------------------------------
CREATE TABLE employees (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL, -- bcrypt/argon2
    role TEXT NOT NULL DEFAULT 'operator' CHECK (role IN ('admin', 'operator')),
    created_at TIMESTAMP DEFAULT NOW()
);

----------------------------------------------------------------------------------------------------
-- 5. TABELA: users (Usuários do Sistema)
-- Tabela de login unificada - pode ser admin (escritório) ou client
----------------------------------------------------------------------------------------------------
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'manager', 'operator', 'client')),
    name TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

----------------------------------------------------------------------------------------------------
-- 6. TABELA: certificates (Custódia de Certificados)
-- MODELO AGNSÓSTICO: Usa cert_model para suportar A3, A4, SE e futuros padrões
-- NÃO usa type: 'A1' | 'A3' - usa cert_model para flexibilidade
----------------------------------------------------------------------------------------------------
CREATE TABLE certificates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    -- Modelo Agnóstico: A3, A4, Selo Eletrônico (SE), futuros
    cert_model TEXT NOT NULL, -- 'A1', 'A3', 'A4', 'SE', 'CODE_SIGNING', etc.
    cert_type TEXT NOT NULL CHECK (cert_type IN ('file', 'token', 'hardware')), -- A1=file, A3=A3 token
    provider TEXT, -- 'ICP-Brasil', 'ACRA', etc.

    encrypted_pfx TEXT, -- Criptografado com AES-256 (Fernet), NULL para A3+
    encrypted_password TEXT, -- Senha do certificado criptografada, NULL para A3+
    pkcs11_slot TEXT, -- Slot do token A3 (para A3+)
    pkcs11_label TEXT, -- Label do certificado no token (para A3+)

    expiry_date DATE NOT NULL,
    subject_name TEXT, -- CN do certificado
    serial_number TEXT, -- Número de série
    issuer TEXT, -- Emissor do certificado
    status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Expired', 'Revoked', 'Pending')),
    created_at TIMESTAMP DEFAULT NOW()
);

----------------------------------------------------------------------------------------------------
-- 7. TABELA: certificate_permissions (Quem pode usar qual certificado)
-- Hierarquia de Confiança: Funcionário -> Certificado -> Cliente -> Escritório
----------------------------------------------------------------------------------------------------
CREATE TABLE certificate_permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    certificate_id UUID NOT NULL REFERENCES certificates(id) ON DELETE CASCADE,
    granted_by UUID REFERENCES employees(id), -- Quem concedeu a permissão
    granted_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP, -- Permissão pode expirar
    UNIQUE(employee_id, certificate_id)
);

----------------------------------------------------------------------------------------------------
-- 8. TABELA: audit_logs (Rastro de Uso - O coração da auditoria)
-- AUDIT-FIRST: Todo uso de certificado DEVE gerar um log imutável
-- Zero-Knowledge: Não armazena dados sensíveis
----------------------------------------------------------------------------------------------------
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    certificate_id UUID REFERENCES certificates(id),
    employee_id UUID REFERENCES employees(id),
    client_id UUID REFERENCES clients(id),

    document_name TEXT,
    document_hash TEXT, -- SHA-256 do arquivo assinado
    action TEXT NOT NULL, -- 'SIGNATURE', 'UPLOAD_CERTIFICATE', 'REVOKE_CERTIFICATE', etc.
    status TEXT NOT NULL CHECK (status IN ('SUCCESS', 'FAILED', 'PENDING')),
    ip_address TEXT,
    user_agent TEXT,
    metadata JSONB, -- Dados adicionais (tamanho do documento, duração, etc.)

    created_at TIMESTAMP DEFAULT NOW(),

    -- Hash imutável para integridade (opcional, para blockchain-style)
    log_hash TEXT
);

----------------------------------------------------------------------------------------------------
-- 9. ÍNDICES PARA PERFORMANCE
----------------------------------------------------------------------------------------------------
CREATE INDEX idx_certificates_client ON certificates(client_id);
CREATE INDEX idx_certificates_tenant ON certificates(tenant_id);
CREATE INDEX idx_certificates_status ON certificates(status);
CREATE INDEX idx_certificates_expiry ON certificates(expiry_date);
CREATE INDEX idx_audit_logs_tenant ON audit_logs(tenant_id);
CREATE INDEX idx_audit_logs_certificate ON audit_logs(certificate_id);
CREATE INDEX idx_audit_logs_employee ON audit_logs(employee_id);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_action_status ON audit_logs(action, status);
CREATE INDEX idx_audit_logs_client ON audit_logs(client_id);
CREATE INDEX idx_permissions_cert ON certificate_permissions(certificate_id);
CREATE INDEX idx_permissions_emp ON certificate_permissions(employee_id);

----------------------------------------------------------------------------------------------------
-- 10. FUNÇÃO: Calcular hash imutável do log (para auditoria)
-- Ativa-se via trigger antes de inserir um log
----------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION calculate_log_hash()
RETURNS TRIGGER AS $$
DECLARE
    prev_hash TEXT;
    combined_data TEXT;
BEGIN
    -- Pega o hash do log anterior (mesmo tenant) para criar uma cadeia
    SELECT created_at INTO prev_hash
    FROM audit_logs
    WHERE tenant_id = NEW.tenant_id
    ORDER BY created_at DESC
    LIMIT 1 OFFSET 1;

    -- Combina os dados para hash
    combined_data := COALESCE(NEW.certificate_id::TEXT, '') || '|' ||
                     COALESCE(NEW.employee_id::TEXT, '') || '|' ||
                     COALESCE(NEW.document_name, '') || '|' ||
                     COALESCE(NEW.action, '') || '|' ||
                     COALESCE(NEW.status, '') || '|' ||
                     COALESCE(NEW.created_at::TEXT, '');

    NEW.log_hash := encode(digest(combined_data, 'sha256'), 'hex');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

----------------------------------------------------------------------------------------------------
-- 11. TRIGGER: Aplicar hash imutável antes de inserir log
----------------------------------------------------------------------------------------------------
CREATE TRIGGER trigger_audit_log_hash
    BEFORE INSERT ON audit_logs
    FOR EACH ROW
    EXECUTE FUNCTION calculate_log_hash();

----------------------------------------------------------------------------------------------------
-- 12. ROW LEVEL SECURITY (RLS) - Isso aqui é crucial para segurança multi-tenant
----------------------------------------------------------------------------------------------------

-- Tabela: tenants
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant admin can view own tenant" ON tenants
    FOR ALL USING (auth.uid() IS NOT NULL);

-- Tabela: clients
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant can view own clients" ON clients
    FOR ALL USING (tenant_id = auth.uid()::TEXT);
-- Nota: Ajuste isso para usar claims do JWT (supabase.auth.session().user)

-- Tabela: certificates
ALTER TABLE certificates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant can view own certificates" ON certificates
    FOR ALL USING (tenant_id = auth.uid()::TEXT);

-- Tabela: employees
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant can view own employees" ON employees
    FOR ALL USING (tenant_id = auth.uid()::TEXT);

-- Tabela: users
ALTER TABLE users ENABLE ROW SECURITY;
CREATE POLICY "User can view own record" ON users
    FOR ALL USING (id = auth.uid()::TEXT);

-- Tabela: certificate_permissions
ALTER TABLE certificate_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant can manage own permissions" ON certificate_permissions
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM employees e
            WHERE e.id = employee_id AND e.tenant_id = auth.uid()::TEXT
        )
    );

-- Tabela: audit_logs
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant can view own audit logs" ON audit_logs
    FOR ALL USING (tenant_id = auth.uid()::TEXT);

----------------------------------------------------------------------------------------------------
-- 13. VIEW: certificates_com_metadata (View de certificados com metadados seguros)
-- Retorna apenas metadados, NUNCA o PFX ou senha
----------------------------------------------------------------------------------------------------
CREATE OR REPLACE VIEW certificates_com_metadata AS
SELECT
    id,
    client_id,
    tenant_id,
    cert_model,
    cert_type,
    provider,
    expiry_date,
    subject_name,
    serial_number,
    issuer,
    status,
    created_at
FROM certificates;

----------------------------------------------------------------------------------------------------
-- 14. VIEW: audit_logs_com_dados (View de auditoria com joins para facilitar queries)
----------------------------------------------------------------------------------------------------
CREATE OR REPLACE VIEW audit_logs_com_dados AS
SELECT
    l.id,
    l.tenant_id,
    l.certificate_id,
    c.subject_name as certificate_subject,
    l.employee_id,
    e.name as employee_name,
    l.client_id,
    cl.name as client_name,
    l.document_name,
    l.document_hash,
    l.action,
    l.status,
    l.ip_address,
    l.user_agent,
    l.metadata,
    l.created_at,
    l.log_hash
FROM audit_logs l
LEFT JOIN certificates c ON l.certificate_id = c.id
LEFT JOIN employees e ON l.employee_id = e.id
LEFT JOIN clients cl ON l.client_id = cl.id;

----------------------------------------------------------------------------------------------------
-- 15. FUNÇÃO AUXILIAR: Verificar se funcionário tem permissão para certificado
----------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION employee_can_use_certificate(emp_id UUID, cert_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM certificate_permissions
        WHERE employee_id = emp_id AND certificate_id = cert_id
    );
END;
$$ LANGUAGE plpgsql;

----------------------------------------------------------------------------------------------------
-- 16. FUNÇÃO AUXILIAR: Hash SHA-256 de documento (usado em Python também)
----------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION sha256_hash(data BYTEA)
RETURNS TEXT AS $$
BEGIN
    RETURN encode(digest(data, 'sha256'), 'hex');
END;
$$ LANGUAGE plpgsql;

COMMENT ON SCHEMA public IS 'Você Digital - Schema multi-tenant para gestão de certificados digitais ICP-Brasil';

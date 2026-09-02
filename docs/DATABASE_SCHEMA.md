# 🗄️ Modelagem de Dados - Você Digital

Este documento detalha a estrutura do banco de dados para a custódia segura de certificados e auditoria de uso.

## 1. Diagrama Lógico (Relacional)

### Tabela: `tenants` (Contadores/Escritórios)
- `id`: UUID (PK)
- `name`: String (Nome do Escritório)
- `email`: String (Unique)
- `master_key_encrypted`: Text (Chave mestra do escritório criptografada)
- `created_at`: Timestamp

### Tabela: `clients` (Clientes do Contador)
- `id`: UUID (PK)
- `tenant_id`: UUID (FK -> tenants)
- `name`: String (Nome da Empresa/Pessoa)
- `document`: String (CNPJ/CPF)
- `created_at`: Timestamp

### Tabela: `certificates` (Custódia de Certificados)
- `id`: UUID (PK)
- `client_id`: UUID (FK -> clients)
- `type`: Enum (A1, A3)
- `encrypted_pfx`: Blob/Text (Arquivo .pfx criptografado com AES-256)
- `encrypted_password`: Text (Senha do certificado criptografada)
- `expiry_date`: Date (Data de expiração)
- `status`: Enum (Active, Expired, Revoked)
- `created_at`: Timestamp

### Tabela: `employees` (Funcionários do Escritório)
- `id`: UUID (PK)
- `tenant_id`: UUID (FK -> tenants)
- `name`: String
- `email`: String (Unique)
- `password_hash`: String
- `role`: Enum (Admin, Operator)

### Tabela: `certificate_permissions` (Quem pode usar o quê)
- `id`: UUID (PK)
- `employee_id`: UUID (FK -> employees)
- `certificate_id`: UUID (FK -> certificates)
- `granted_at`: Timestamp

### Tabela: `audit_logs` (Rastro de Uso - O coração da auditoria)
- `id`: UUID (PK)
- `certificate_id`: UUID (FK -> certificates)
- `employee_id`: UUID (FK -> employees)
- `document_hash`: String (SHA-256 do arquivo assinado)
- `document_name`: String (Nome do arquivo)
- `action`: String (ex: "ASSINATURA_PDF")
- `timestamp`: Timestamp
- `ip_address`: String
- `status`: Enum (Success, Failed)

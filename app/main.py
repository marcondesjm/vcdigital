import os
from pathlib import Path
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from cryptography.fernet import Fernet
from typing import List, Optional, Tuple
import uuid
import io
from datetime import datetime

# Importar serviços e modelos locais
from app.models import (
    ClientCreate,
    EmployeeCreate,
    AuditLogCreate,
    UserLogin,
    PermissionGrant,
)
from app.config import settings
from app.services.signature_service import sign_pdf_a1, extract_pfx_metadata
from app.database import (
    init_db,
    get_cert_by_id,
    list_certs_by_client,
    soft_delete_cert,
    create_audit_log,
    get_client_by_id,
    list_all_clients,
    get_user_by_email,
    get_user_by_id,
    list_employees_by_tenant,
    grant_permission,
    revoke_permission,
    get_employee_by_id,
    get_permissions_by_cert,
    employee_can_use_certificate,
    get_tenant_by_id,
)
from app.config import settings, is_production, is_sqlite_mode

# --- CONFIGURAÇÕES ---

# Chave Mestra para Criptografia
# Carregada de variável de ambiente via pydantic-settings
# NUNCA commitar a chave real no código!
MASTER_KEY = settings.VOCE_DIGITAL_MASTER_KEY.encode()
cipher_suite = Fernet(MASTER_KEY)

app = FastAPI(title="Você Digital - API de Custódia e Auditoria")

# --- CONFIGURAÇÃO DE CORS ---
# Em desenvolvimento, permite todas as origens
# Em produção, restringe para origens específicas
if is_production():
    allow_origins_list = [
        "https://voce-digital.vercel.app",
        "http://localhost:5173",
        "http://localhost:3000",
    ]
else:
    allow_origins_list = ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- INICIALIZAÇÃO DO BANCO ---
init_db()

# Log de inicialização
if is_sqlite_mode():
    print("[DB] Usando SQLite (MVP)")
else:
    print("[DB] Usando Supabase/PostgreSQL (Produção)")


# --- MODELOS ---

class LoginResponse(BaseModel):
    user_id: str
    name: str
    role: str  # 'admin' ou 'client'
    client_id: Optional[str] = None
    tenant_id: Optional[str] = None


class CertificateMetadata(BaseModel):
    id: str
    cert_model: str
    cert_type: str
    expiry_date: Optional[str] = None
    status: str
    created_at: str


class EmployeeResponse(BaseModel):
    id: str
    name: str
    email: str
    role: str


class SignResponse(BaseModel):
    status: str
    message: str
    signed_pdf_base64: Optional[str] = None
    document_hash: Optional[str] = None
    timestamp: Optional[str] = None
    metadata: Optional[dict] = None


# --- HELPERS ---

def decrypt_pfx(pfx_encrypted: str, password_encrypted: str) -> Tuple[bytes, bytes]:
    """Descriptografa PFX e senha usando Fernet."""
    pfx_bytes = cipher_suite.decrypt(pfx_encrypted.encode())
    password_bytes = cipher_suite.decrypt(password_encrypted.encode())
    return pfx_bytes, password_bytes


def compute_pdf_hash(pdf_bytes: bytes) -> str:
    """Calcula o hash SHA-256 do PDF."""
    import hashlib
    return hashlib.sha256(pdf_bytes).hexdigest()


# --- ENDPOINTS ---

@app.get("/health")
async def health():
    """Endpoint de status para monitoramento (Vercel/Health Check)."""
    return {
        "status": "healthy",
        "database": "sqlite" if is_sqlite_mode() else "supabase",
        "timestamp": datetime.now().isoformat()
    }

@app.get("/")
async def root():
    return {"message": "Voce Digital API is running"}

@app.post("/clients/")
async def create_client(client: ClientCreate):
    """Cria um novo cliente associado ao escritório (tenant)."""
    client_id = str(uuid.uuid4())
    from app.database import get_db_connection
    with get_db_connection() as conn:
        cursor = conn.cursor()
        if is_sqlite_mode():
            cursor.execute(
                "INSERT INTO clients (id, tenant_id, name, document, created_at) VALUES (?, ?, ?, ?, ?)",
                (client_id, getattr(client, 'tenant_id', None), client.name, client.document, datetime.now().isoformat())
            )
        else:
            cursor.execute(
                "INSERT INTO clients (id, tenant_id, name, document, created_at) VALUES (%s, %s, %s, %s, %s)",
                (client_id, getattr(client, 'tenant_id', None), client.name, client.document, datetime.now().isoformat())
            )
        conn.commit()
    return {"status": "success", "client_id": client_id}


@app.post("/login")
async def login(user: UserLogin):
    """Autentica o usuário e retorna perfil (admin ou client)."""
    user_db = get_user_by_email(user.email)
    if not user_db:
        raise HTTPException(status_code=404, detail="Usuário ou senha inválidos")

    # Em produção, comparar hash bcrypt/argon2 da senha
    # Aqui simplificado para o MVP: comparar password_hash direto
    if user_db['password_hash'] != user.password:
        raise HTTPException(status_code=401, detail="Senha incorreta")

    role = user_db['role']
    client_id = user_db.get('client_id')

    return LoginResponse(
        user_id=user_db['id'],
        name=user_db.get('name', user_db['email']),
        role=role,
        client_id=client_id,
        tenant_id=user_db.get('tenant_id'),
    )


@app.post("/upload-certificate/")
async def upload_certificate(
    file: UploadFile = File(...),
    password: str = Form(...),
    client_id: str = Form(...),
    cert_model: str = Form(...),  # 'A1', 'A3', 'A4', 'SE', 'CODE_SIGNING', etc.
    cert_type: str = Form(...),   # 'file', 'token', 'hardware'
    employee_id: str = Form(""),
):
    """
    Upload de certificado digital.

    Modelo Agnóstico: Usa cert_model para suportar A1, A3, A4, Selo Eletrônico (SE) e futuros padrões.
    NUNCA usa type: 'A1' | 'A3'.

    Valida:
    - Se o arquivo .pfx é válido (tenta carregar com a senha)
    - Extrai metadata (data de validade)
    - Salva criptografado no banco

    Retorna:
    - status success com certificate_id
    - ou erro 422 se senha/PFX inválido
    """
    try:
        # Buscar cliente e tenant
        client = get_client_by_id(client_id)
        if not client:
            raise HTTPException(status_code=404, detail="Cliente não encontrado")
        tenant_id = client.get('tenant_id')

        # Ler conteúdo do arquivo
        pfx_content = await file.read()

        # Validar o PFX tentando carregar com a senha
        try:
            from cryptography.hazmat.primitives.serialization import pkcs12
            loaded = pkcs12.load_key_and_certificates(pfx_content, password.encode())
            pfx_valid = True
        except Exception as e:
            pfx_valid = False
            error_detail = str(e)

        if not pfx_valid:
            raise HTTPException(
                status_code=422,
                detail=f"Arquivo PFX inválido ou senha incorreta: {error_detail}"
            )

        # Extrair metadados (data de validade, CN do sujeito, etc)
        metadata = extract_pfx_metadata(pfx_content, password.encode())
        expiry_date = metadata.get('expiry_date')

        # Criptografar PFX e senha com Fernet (Zero-Knowledge)
        pfx_encrypted = cipher_suite.encrypt(pfx_content).decode()
        password_encrypted = cipher_suite.encrypt(password.encode()).decode()

        # Gerar ID e salvar no banco
        cert_id = str(uuid.uuid4())
        from app.database import get_db_connection
        with get_db_connection() as conn:
            cursor = conn.cursor()
            if is_sqlite_mode():
                cursor.execute(
                    """INSERT INTO certificates
                       (id, client_id, tenant_id, cert_model, cert_type, provider,
                        encrypted_pfx, encrypted_password,
                        expiry_date, subject_name, serial_number, issuer,
                        status, created_at)
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                    (
                        cert_id,
                        client_id,
                        tenant_id,
                        cert_model,
                        cert_type,
                        metadata.get('issuer', 'ICP-Brasil'),
                        pfx_encrypted,
                        password_encrypted,
                        expiry_date or "2099-12-31",  # fallback para data indeterminada
                        metadata.get('subject_name', ''),
                        metadata.get('serial_number', ''),
                        metadata.get('issuer', ''),
                        "Active",
                        datetime.now().isoformat(),
                    )
                )
            else:
                cursor.execute(
                    """INSERT INTO certificates
                       (id, client_id, tenant_id, cert_model, cert_type, provider,
                        encrypted_pfx, encrypted_password,
                        expiry_date, subject_name, serial_number, issuer,
                        status, created_at)
                       VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)""",
                    (
                        cert_id,
                        client_id,
                        tenant_id,
                        cert_model,
                        cert_type,
                        metadata.get('issuer', 'ICP-Brasil'),
                        pfx_encrypted,
                        password_encrypted,
                        expiry_date or "2099-12-31",
                        metadata.get('subject_name', ''),
                        metadata.get('serial_number', ''),
                        metadata.get('issuer', ''),
                        "Active",
                        datetime.now().isoformat(),
                    )
                )
            conn.commit()

        # Registrar log de auditoria (Audit-First)
        create_audit_log({
            "certificate_id": cert_id,
            "employee_id": employee_id,
            "client_id": client_id,
            "tenant_id": tenant_id,
            "document_name": file.filename or "Upload de Certificado",
            "document_hash": compute_pdf_hash(pfx_content),
            "action": "UPLOAD_CERTIFICATE",
            "status": "SUCCESS",
        })

        return {
            "status": "success",
            "certificate_id": cert_id,
            "expiry_date": expiry_date,
            "metadata": metadata,
            "message": "Certificado validado e custodiado com sucesso!"
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro interno: {str(e)}")


@app.get("/clients/")
async def list_clients():
    """Lista todos os clientes."""
    clients = list_all_clients()
    return {"status": "success", "clients": clients}


@app.get("/clients/{client_id}")
async def get_client(client_id: str):
    """Busca um cliente específico."""
    client = get_client_by_id(client_id)
    if not client:
        raise HTTPException(status_code=404, detail="Cliente não encontrado")
    return {"status": "success", "client": client}


@app.delete("/clients/{client_id}")
async def delete_client(client_id: str):
    """Remove um cliente e seus dados associados (soft-delete)."""
    from app.database import get_db_connection, is_sqlite_mode

    # Verificar se o cliente existe
    client = get_client_by_id(client_id)
    if not client:
        raise HTTPException(status_code=404, detail="Cliente não encontrado")

    with get_db_connection() as conn:
        cursor = conn.cursor()

        if is_sqlite_mode():
            # Soft-delete: marcar como inativo
            cursor.execute(
                "UPDATE clients SET status = 'inactive', deleted_at = datetime('now') WHERE id = ?",
                (client_id,)
            )
            # Marcar certificados como inativos
            cursor.execute(
                "UPDATE certificates SET status = 'inactive' WHERE client_id = ?",
                (client_id,)
            )
        else:
            cursor.execute(
                "UPDATE clients SET status = 'inactive', deleted_at = NOW() WHERE id = %s",
                (client_id,)
            )
            cursor.execute(
                "UPDATE certificates SET status = 'inactive' WHERE client_id = %s",
                (client_id,)
            )

        conn.commit()

    # Criar log de auditoria
    create_audit_log(
        action="DELETE_CLIENT",
        entity_type="client",
        entity_id=client_id,
        user_id="admin",  # Será substituído pelo user_id real quando integrar autenticação
        details=f"Cliente {client.get('name', client_id)} removido",
        ip_address="127.0.0.1"
    )

    return {"status": "success", "message": "Cliente removido com sucesso"}


@app.get("/clients/{client_id}/certificates")
async def list_client_certificates(client_id: str):
    """Lista metadados dos certificados de um cliente específico."""
    certs = list_certs_by_client(client_id)
    # Retornar apenas metadados seguros (NUNCA o PFX nem a senha)
    metadata_list = []
    for cert in certs:
        metadata_list.append({
            "id": cert['id'],
            "cert_model": cert.get('cert_model', cert.get('type', 'A1')),
            "cert_type": cert.get('cert_type', 'file'),
            "expiry_date": cert['expiry_date'],
            "status": cert['status'],
            "created_at": cert['created_at'],
        })
    return {"status": "success", "certificates": metadata_list}


@app.delete("/certificates/{cert_id}")
async def revoke_certificate(cert_id: str, employee_id: str):
    """Revoga (soft delete) um certificado - preserva histórico de auditoria."""
    # Verificar se o certificado existe
    cert = get_cert_by_id(cert_id)
    if not cert:
        raise HTTPException(status_code=404, detail="Certificado não encontrado")

    # Marcar como Revoked (soft delete)
    success = soft_delete_cert(cert_id)
    if not success:
        raise HTTPException(status_code=500, detail="Erro ao revogar certificado")

    # Registrar log de auditoria (Audit-First)
    create_audit_log({
        "certificate_id": cert_id,
        "employee_id": employee_id,
        "client_id": cert.get('client_id'),
        "tenant_id": cert.get('tenant_id'),
        "document_name": f"Revogação do certificado {cert_id}",
        "document_hash": "",
        "action": "REVOKE_CERTIFICATE",
        "status": "SUCCESS",
    })

    return {"status": "success", "message": "Certificado revogado com sucesso"}


@app.post("/audit-log/")
async def create_audit_log_endpoint(log: AuditLogCreate):
    """Cria um log de auditoria manualmente (usado pela integração futura)."""
    log_id = create_audit_log({
        "certificate_id": log.certificate_id,
        "employee_id": log.employee_id,
        "document_name": log.document_name,
        "document_hash": log.document_hash,
        "action": log.action,
        "status": log.status,
    })
    return {"status": "success", "log_id": log_id}


@app.get("/audit-logs/{client_id}")
async def get_audit_logs(client_id: str, status: Optional[str] = None):
    """Lista logs de auditoria de um cliente específico."""
    from app.database import get_db_connection
    with get_db_connection() as conn:

        cursor = conn.cursor()
        if is_sqlite_mode():
            query = '''SELECT l.*, c.client_id as cert_client_id FROM audit_logs l
                       JOIN certificates c ON l.certificate_id = c.id
                       WHERE c.client_id = ?'''
            params = [client_id]
            if status:
                query += ' AND l.status = ?'
                params.append(status)
            query += ' ORDER BY l.timestamp DESC'
            cursor.execute(query, params)
            # Para SQLite, converter manualmente os resultados
            columns = [col[0] for col in cursor.description]
            logs = [dict(zip(columns, row)) for row in cursor.fetchall()]
        else:
            # No modo Supabase, database.py já configura RealDictCursor
            cursor = conn.cursor()
            query = '''SELECT l.* FROM audit_logs l
                       JOIN certificates c ON l.certificate_id = c.id
                       WHERE c.client_id = %s'''
            params = [client_id]
            if status:
                query += ' AND l.status = %s'
                params.append(status)
            query += ' ORDER BY l.timestamp DESC'
            cursor.execute(query, params)
            logs = cursor.fetchall()
        return {"status": "success", "logs": logs}


@app.post("/sign-pdf/")
async def sign_pdf(
    pdf_file: UploadFile = File(...),
    certificate_id: str = Form(...),
    employee_id: str = Form(...),
):
    """
    Assina um PDF usando um certificado custodiado.

    Fluxo:
    1. Recebe o PDF e o ID do certificado
    2. Busca o certificado no banco (criptografado)
    3. Descriptografa em memória (NUNCA grava em disco)
    4. Valida que o funcionário tem permissão
    5. Assina o PDF usando pyhanko
    6. Cria log de auditoria automático
    7. Retorna o PDF assinado
    """
    try:
        # 1. Validar permissão
        user_db = get_user_by_id(employee_id)

        if not user_db:
            raise HTTPException(
                status_code=404,
                detail=f"Usuário/Funcionário {employee_id} não encontrado"
            )

        is_admin = user_db.get('role') == 'admin'

        if not is_admin:
            has_perm = employee_can_use_certificate(employee_id, certificate_id)
            if not has_perm:
                raise HTTPException(
                    status_code=403,
                    detail="Sem permissão para usar este certificado"
                )

        # 2. Buscar certificado no banco
        cert = get_cert_by_id(certificate_id)
        if not cert:
            raise HTTPException(status_code=404, detail="Certificado não encontrado")

        if cert['status'] != 'Active':
            raise HTTPException(
                status_code=400,
                detail=f"Certificado não está ativo (status: {cert['status']})"
            )

        # 3. Descriptografar PFX e senha em memória
        try:
            pfx_bytes = cipher_suite.decrypt(cert['encrypted_pfx'].encode())
            password_bytes = cipher_suite.decrypt(cert['encrypted_password'].encode())
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Erro ao descriptografar certificado: {str(e)}"
            )

        # 4. Ler PDF
        pdf_content = await pdf_file.read()

        # Validar que o arquivo é realmente um PDF (header %PDF-)
        if not pdf_content.startswith(b'%PDF-'):
            raise HTTPException(
                status_code=400,
                detail="Arquivo inválido: não é um PDF válido. Verifique se selecionou o arquivo correto."
            )

        document_hash = compute_pdf_hash(pdf_content)

        # 5. Assinar PDF em memória (chamada assíncrona nativa com async_sign_pdf)
        signed_pdf_bytes, sign_msg, metadata = await sign_pdf_a1(
            pdf_bytes=pdf_content,
            pfx_bytes=pfx_bytes,
            password=password_bytes,
        )

        if signed_pdf_bytes is None:
            # Erro na assinatura - registrar log de falha (Audit-First)
            cert = get_cert_by_id(certificate_id)
            create_audit_log({
                "certificate_id": certificate_id,
                "employee_id": employee_id,
                "client_id": cert.get('client_id'),
                "tenant_id": cert.get('tenant_id'),
                "document_name": pdf_file.filename or "documento.pdf",
                "document_hash": document_hash,
                "action": "SIGNATURE",
                "status": "FAILED",
            })
            raise HTTPException(status_code=400, detail=sign_msg)

        # 6. Log de sucesso (Audit-First)
        timestamp = datetime.now().isoformat()
        cert = get_cert_by_id(certificate_id)
        create_audit_log({
            "certificate_id": certificate_id,
            "employee_id": employee_id,
            "client_id": cert.get('client_id'),
            "tenant_id": cert.get('tenant_id'),
            "document_name": pdf_file.filename or "documento.pdf",
            "document_hash": document_hash,
            "action": "SIGNATURE",
            "status": "SUCCESS",
        })

        # 7. Retornar PDF assinado em base64 (para passar pelo JSON)
        import base64
        signed_base64 = base64.b64encode(signed_pdf_bytes).decode('utf-8')

        return SignResponse(
            status="success",
            message="PDF assinado com sucesso!",
            signed_pdf_base64=signed_base64,
            document_hash=document_hash,
            timestamp=timestamp,
            metadata=metadata,
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro interno: {str(e)}")


# --- EMPLOYEES ---

@app.post("/employees/")
async def create_employee(emp: EmployeeCreate):
    """Cria um novo funcionário no escritório."""
    emp_id = str(uuid.uuid4())
    from app.database import get_db_connection
    with get_db_connection() as conn:
        cursor = conn.cursor()
        if is_sqlite_mode():
            cursor.execute(
                """INSERT INTO employees
                   (id, tenant_id, name, email, password_hash, role, created_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?)""",
                (
                    emp_id,
                    emp.tenant_id or "default_tenant",
                    emp.name,
                    emp.email,
                    emp.password,  # Em produção, hash com bcrypt
                    emp.role,
                    datetime.now().isoformat(),
                )
            )
        else:
            cursor.execute(
                """INSERT INTO employees
                   (id, tenant_id, name, email, password_hash, role, created_at)
                   VALUES (%s, %s, %s, %s, %s, %s, %s)""",
                (
                    emp_id,
                    emp.tenant_id or "default_tenant",
                    emp.name,
                    emp.email,
                    emp.password,
                    emp.role,
                    datetime.now().isoformat(),
                )
            )
        conn.commit()
    return {"status": "success", "employee_id": emp_id}


@app.get("/employees/")
async def list_employees(tenant_id: str):
    """Lista funcionários de um escritório."""
    emps = list_employees_by_tenant(tenant_id)
    return {"status": "success", "employees": emps}


@app.get("/employees/{emp_id}")
async def get_employee(emp_id: str):
    """Busca um funcionário pelo ID."""
    emp = get_employee_by_id(emp_id)
    if not emp:
        raise HTTPException(status_code=404, detail="Funcionário não encontrado")
    return {"status": "success", "employee": emp}


@app.put("/employees/{emp_id}")
async def update_employee(emp_id: str, emp: EmployeeCreate):
    """Atualiza os dados de um funcionário."""
    from app.database import get_db_connection
    with get_db_connection() as conn:
        cursor = conn.cursor()
        if is_sqlite_mode():
            cursor.execute(
                """UPDATE employees
                   SET name = ?, email = ?, password_hash = ?, role = ?
                   WHERE id = ?""",
                (emp.name, emp.email, emp.password, emp.role, emp_id)
            )
        else:
            cursor.execute(
                """UPDATE employees
                   SET name = %s, email = %s, password_hash = %s, role = %s
                   WHERE id = %s""",
                (emp.name, emp.email, emp.password, emp.role, emp_id)
            )
        conn.commit()
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Funcionário não encontrado")
    return {"status": "success", "message": "Funcionário atualizado com sucesso"}


@app.delete("/employees/{emp_id}")
async def delete_employee(emp_id: str):
    """Remove um funcionário (soft delete ou remoção física - aqui remoção direta pois é MVP)."""
    from app.database import get_db_connection
    with get_db_connection() as conn:
        cursor = conn.cursor()
        if is_sqlite_mode():
            cursor.execute("DELETE FROM employees WHERE id = ?", (emp_id,))
        else:
            cursor.execute("DELETE FROM employees WHERE id = %s", (emp_id,))
        conn.commit()
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Funcionário não encontrado")
    return {"status": "success", "message": "Funcionário excluído com sucesso"}


# --- PERMISSIONS ---

@app.post("/permissions/grant")
async def grant_permission_endpoint(perm: PermissionGrant):
    """Concede permissão a um funcionário para usar um certificado."""
    perm_id = grant_permission(perm.employee_id, perm.certificate_id)
    return {"status": "success", "permission_id": perm_id}


@app.post("/permissions/revoke/{perm_id}")
async def revoke_permission_endpoint(perm_id: str):
    """Revoga uma permissão."""
    success = revoke_permission(perm_id)
    if not success:
        raise HTTPException(status_code=404, detail="Permissão não encontrada")
    return {"status": "success", "message": "Permissão revogada"}


@app.get("/certificates/{cert_id}/permissions")
async def list_permissions_endpoint(cert_id: str):
    """Lista permissões de um certificado."""
    perms = get_permissions_by_cert(cert_id)
    return {"status": "success", "permissions": perms}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

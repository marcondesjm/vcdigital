"""
Módulo de conexão com banco de dados.
Suporta SQLite (MVP) e Supabase/PostgreSQL (Produção).

Hierarquia de Confiança:
    Tenant (Escritório) -> Client -> Certificate
    Tenant (Escritório) -> Employee

Modelo Agnóstico:
    Usa cert_model para suportar A3, A4, Selo Eletrônico (SE) e futuros padrões.
    NUNCA usa type: 'A1' | 'A3' - sempre usa cert_model.
"""

import sqlite3
import uuid
from datetime import datetime
from pathlib import Path
from typing import Optional, List, Dict, Any, Iterator
from contextlib import contextmanager

from app.config import settings, is_sqlite_mode


# ============================================================================
# CONFIGURAÇÃO DO BANCO
# ============================================================================

BASE_DIR = Path(__file__).resolve().parent.parent
SQLITE_DB_PATH = BASE_DIR / "voce_digital.db"

# Tabelas do sistema (usadas para inicialização SQLite)
TABLES_SQLITE = [
    # Tenants (Escritórios Contábeis)
    '''CREATE TABLE IF NOT EXISTS tenants
       (id TEXT PRIMARY KEY, name TEXT, email TEXT UNIQUE,
        master_key_encrypted TEXT, created_at TEXT)''',

    # Clients (Clientes do Contador)
    '''CREATE TABLE IF NOT EXISTS clients
       (id TEXT PRIMARY KEY, tenant_id TEXT, name TEXT, document TEXT,
        created_at TEXT, FOREIGN KEY (tenant_id) REFERENCES tenants(id))''',

    # Users (Usuários do Sistema)
    '''CREATE TABLE IF NOT EXISTS users
       (id TEXT PRIMARY KEY, tenant_id TEXT, email TEXT UNIQUE,
        password_hash TEXT, role TEXT, client_id TEXT,
        created_at TEXT, FOREIGN KEY (tenant_id) REFERENCES tenants(id),
        FOREIGN KEY (client_id) REFERENCES clients(id))''',

    # Employees (Funcionários do Escritório)
    '''CREATE TABLE IF NOT EXISTS employees
       (id TEXT PRIMARY KEY, tenant_id TEXT, name TEXT, email TEXT UNIQUE,
        password_hash TEXT, role TEXT, created_at TEXT,
        FOREIGN KEY (tenant_id) REFERENCES tenants(id))''',

    # Certificates (Custódia de Certificados - Modelo Agnóstico)
    '''CREATE TABLE IF NOT EXISTS certificates
       (id TEXT PRIMARY KEY, client_id TEXT, tenant_id TEXT,
        cert_model TEXT, cert_type TEXT, provider TEXT,
        encrypted_pfx TEXT, encrypted_password TEXT,
        pkcs11_slot TEXT, pkcs11_label TEXT,
        expiry_date TEXT, subject_name TEXT, serial_number TEXT, issuer TEXT,
        status TEXT, created_at TEXT,
        FOREIGN KEY (client_id) REFERENCES clients(id),
        FOREIGN KEY (tenant_id) REFERENCES tenants(id))''',

    # Certificate Permissions (Quem pode usar qual certificado)
    '''CREATE TABLE IF NOT EXISTS certificate_permissions
       (id TEXT PRIMARY KEY, employee_id TEXT, certificate_id TEXT,
        granted_by TEXT, granted_at TEXT,
        FOREIGN KEY (employee_id) REFERENCES employees(id),
        FOREIGN KEY (certificate_id) REFERENCES certificates(id))''',

    # Audit Logs (Rastro de Uso - Audit-First)
    # Note: timestamp column maintained for backward compatibility
    '''CREATE TABLE IF NOT EXISTS audit_logs
       (id TEXT PRIMARY KEY, tenant_id TEXT, certificate_id TEXT, employee_id TEXT,
        client_id TEXT, document_name TEXT, document_hash TEXT, action TEXT,
        status TEXT, ip_address TEXT, user_agent TEXT, metadata TEXT,
        timestamp TEXT, created_at TEXT, log_hash TEXT,
        FOREIGN KEY (tenant_id) REFERENCES tenants(id),
        FOREIGN KEY (certificate_id) REFERENCES certificates(id),
        FOREIGN KEY (employee_id) REFERENCES employees(id),
        FOREIGN KEY (client_id) REFERENCES clients(id))''',
]


# ============================================================================
# CONEXÃO COM BANCO
# ============================================================================

@contextmanager
def get_db_connection() -> Iterator[Any]:
    """
    Retorna uma conexão com o banco de dados.
    Suporta SQLite (MVP) e Supabase/PostgreSQL (Produção).
    """
    if is_sqlite_mode():
        # Modo SQLite (MVP)
        conn = sqlite3.connect(SQLITE_DB_PATH)
        conn.row_factory = sqlite3.Row
        try:
            yield conn
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()
    else:
        # Modo Supabase/PostgreSQL (Produção)
        import psycopg2
        from psycopg2.extras import RealDictCursor

        conn = psycopg2.connect(
            host=settings.SUPABASE_URL.split("://")[1].split("/")[0],
            database=settings.SUPABASE_URL.split("/")[-1],
            user=settings.SUPABASE_URL.split("://")[1].split(":")[0],
            password=settings.SUPABASE_KEY,
            cursor_factory=RealDictCursor
        )
        try:
            yield conn
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()


def init_db():
    """
    Inicializa o banco de dados SQLite com todas as tabelas necessárias.
    Para Supabase, o schema deve ser criado manualmente via SQL ou Dashboard.
    """
    if is_sqlite_mode():
        with sqlite3.connect(SQLITE_DB_PATH) as conn:
            cursor = conn.cursor()
            for table_sql in TABLES_SQLITE:
                cursor.execute(table_sql)
            conn.commit()


# ============================================================================
# HELPERS DE CERTIFICADOS (Modelo Agnóstico)
# ============================================================================

def get_cert_by_id(cert_id: str) -> Optional[Dict[str, Any]]:
    """Busca um certificado pelo ID."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        if is_sqlite_mode():
            cursor.execute("SELECT * FROM certificates WHERE id = ?", (cert_id,))
        else:
            cursor.execute("SELECT * FROM certificates WHERE id = %s", (cert_id,))
        row = cursor.fetchone()
        return dict(row) if row else None


def list_certs_by_client(client_id: str) -> List[Dict[str, Any]]:
    """Lista todos os certificados de um cliente."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        if is_sqlite_mode():
            cursor.execute("SELECT * FROM certificates WHERE client_id = ? ORDER BY created_at DESC", (client_id,))
        else:
            cursor.execute("SELECT * FROM certificates WHERE client_id = %s ORDER BY created_at DESC", (client_id,))
        return [dict(row) for row in cursor.fetchall()]


def list_certs_by_tenant(tenant_id: str) -> List[Dict[str, Any]]:
    """Lista todos os certificados de um tenant (escritório)."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        if is_sqlite_mode():
            cursor.execute("SELECT * FROM certificates WHERE tenant_id = ? ORDER BY created_at DESC", (tenant_id,))
        else:
            cursor.execute("SELECT * FROM certificates WHERE tenant_id = %s ORDER BY created_at DESC", (tenant_id,))
        return [dict(row) for row in cursor.fetchall()]


def soft_delete_cert(cert_id: str) -> bool:
    """Marca um certificado como Revoked (soft delete)."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        if is_sqlite_mode():
            cursor.execute("UPDATE certificates SET status = 'Revoked' WHERE id = ?", (cert_id,))
        else:
            cursor.execute("UPDATE certificates SET status = 'Revoked' WHERE id = %s", (cert_id,))
        conn.commit()
        return cursor.rowcount > 0


# ============================================================================
# HELPERS DE AUDITORIA (Audit-First)
# ============================================================================

def create_audit_log(log_data: Dict[str, Any]) -> str:
    """
    Cria um log de auditoria e retorna o ID.

    AUDIT-FIRST: Toda operação de uso de certificado DEVE gerar um log imutável.
    ZERO-KNOWLEDGE: Não armazena senhas ou dados sensíveis.
    """
    log_id = str(uuid.uuid4())

    # Calcular hash imutável (simplificado para SQLite)
    import hashlib
    import json

    combined_data = f"{log_data.get('certificate_id', '')}|{log_data.get('employee_id', '')}|{log_data.get('document_name', '')}|{log_data.get('action', '')}|{log_data.get('status', '')}"
    log_hash = hashlib.sha256(combined_data.encode()).hexdigest()

    with get_db_connection() as conn:
        cursor = conn.cursor()
        if is_sqlite_mode():
            cursor.execute(
                """INSERT INTO audit_logs
                   (id, tenant_id, certificate_id, employee_id, client_id, document_name,
                    document_hash, action, status, ip_address, user_agent, metadata,
                    timestamp, created_at, log_hash)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    log_id,
                    log_data.get('tenant_id'),
                    log_data.get('certificate_id'),
                    log_data.get('employee_id'),
                    log_data.get('client_id'),
                    log_data.get('document_name'),
                    log_data.get('document_hash'),
                    log_data.get('action', 'SIGNATURE'),
                    log_data.get('status', 'SUCCESS'),
                    log_data.get('ip_address', ''),
                    log_data.get('user_agent', ''),
                    json.dumps(log_data.get('metadata', {})),
                    log_data.get('timestamp') or datetime.now().isoformat(),
                    datetime.now().isoformat(),
                    log_hash,
                )
            )
        else:
            cursor.execute(
                """INSERT INTO audit_logs
                   (id, tenant_id, certificate_id, employee_id, client_id, document_name,
                    document_hash, action, status, ip_address, user_agent, metadata,
                    timestamp, created_at, log_hash)
                   VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)""",
                (
                    log_id,
                    log_data.get('tenant_id'),
                    log_data.get('certificate_id'),
                    log_data.get('employee_id'),
                    log_data.get('client_id'),
                    log_data.get('document_name'),
                    log_data.get('document_hash'),
                    log_data.get('action', 'SIGNATURE'),
                    log_data.get('status', 'SUCCESS'),
                    log_data.get('ip_address', ''),
                    log_data.get('user_agent', ''),
                    json.dumps(log_data.get('metadata', {})),
                    log_data.get('timestamp') or datetime.now().isoformat(),
                    datetime.now().isoformat(),
                    log_hash,
                )
            )
        conn.commit()
    return log_id


# ============================================================================
# HELPERS DE CLIENTES
# ============================================================================

def get_client_by_id(client_id: str) -> Optional[Dict[str, Any]]:
    """Busca um cliente pelo ID."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        if is_sqlite_mode():
            cursor.execute("SELECT * FROM clients WHERE id = ?", (client_id,))
        else:
            cursor.execute("SELECT * FROM clients WHERE id = %s", (client_id,))
        row = cursor.fetchone()
        return dict(row) if row else None


def list_all_clients(tenant_id: Optional[str] = None) -> List[Dict[str, Any]]:
    """Lista todos os clientes (opcionalmente filtrado por tenant)."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        if tenant_id:
            if is_sqlite_mode():
                cursor.execute("SELECT * FROM clients WHERE tenant_id = ? ORDER BY name", (tenant_id,))
            else:
                cursor.execute("SELECT * FROM clients WHERE tenant_id = %s ORDER BY name", (tenant_id,))
        else:
            cursor.execute("SELECT * FROM clients ORDER BY name")
        return [dict(row) for row in cursor.fetchall()]


# ============================================================================
# HELPERS DE USUÁRIOS
# ============================================================================

def get_user_by_email(email: str) -> Optional[Dict[str, Any]]:
    """Busca usuário pelo email."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        if is_sqlite_mode():
            cursor.execute("SELECT * FROM users WHERE email = ?", (email,))
        else:
            cursor.execute("SELECT * FROM users WHERE email = %s", (email,))
        row = cursor.fetchone()
        return dict(row) if row else None


def get_user_by_id(user_id: str) -> Optional[Dict[str, Any]]:
    """Busca usuário pelo ID."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        if is_sqlite_mode():
            cursor.execute("SELECT * FROM users WHERE id = ?", (user_id,))
        else:
            cursor.execute("SELECT * FROM users WHERE id = %s", (user_id,))
        row = cursor.fetchone()
        return dict(row) if row else None


# ============================================================================
# HELPERS DE FUNCIONÁRIOS
# ============================================================================

def list_employees_by_tenant(tenant_id: str) -> List[Dict[str, Any]]:
    """Lista todos os funcionários de um tenant."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        if is_sqlite_mode():
            cursor.execute("SELECT * FROM employees WHERE tenant_id = ? ORDER BY name", (tenant_id,))
        else:
            cursor.execute("SELECT * FROM employees WHERE tenant_id = %s ORDER BY name", (tenant_id,))
        return [dict(row) for row in cursor.fetchall()]


def get_employee_by_id(emp_id: str) -> Optional[Dict[str, Any]]:
    """Busca funcionário pelo ID."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        if is_sqlite_mode():
            cursor.execute("SELECT * FROM employees WHERE id = ?", (emp_id,))
        else:
            cursor.execute("SELECT * FROM employees WHERE id = %s", (emp_id,))
        row = cursor.fetchone()
        return dict(row) if row else None


# ============================================================================
# HELPERS DE PERMISSÕES
# ============================================================================

def get_permissions_by_cert(cert_id: str) -> List[Dict[str, Any]]:
    """Lista todas as permissões de um certificado."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        if is_sqlite_mode():
            cursor.execute("""
                SELECT p.* FROM certificate_permissions p
                WHERE p.certificate_id = ?
            """, (cert_id,))
        else:
            cursor.execute("""
                SELECT p.* FROM certificate_permissions p
                WHERE p.certificate_id = %s
            """, (cert_id,))
        return [dict(row) for row in cursor.fetchall()]


def grant_permission(employee_id: str, cert_id: str) -> str:
    """Concede permissão a um funcionário para usar um certificado."""
    perm_id = str(uuid.uuid4())
    with get_db_connection() as conn:
        cursor = conn.cursor()
        if is_sqlite_mode():
            cursor.execute(
                "INSERT INTO certificate_permissions (id, employee_id, certificate_id, granted_at) VALUES (?, ?, ?, ?)",
                (perm_id, employee_id, cert_id, "NOW()")
            )
        else:
            cursor.execute(
                "INSERT INTO certificate_permissions (id, employee_id, certificate_id, granted_at) VALUES (%s, %s, %s, NOW())",
                (perm_id, employee_id, cert_id)
            )
        conn.commit()
    return perm_id


def revoke_permission(perm_id: str) -> bool:
    """Revoga uma permissão."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        if is_sqlite_mode():
            cursor.execute("DELETE FROM certificate_permissions WHERE id = ?", (perm_id,))
        else:
            cursor.execute("DELETE FROM certificate_permissions WHERE id = %s", (perm_id,))
        conn.commit()
        return cursor.rowcount > 0


def employee_can_use_certificate(employee_id: str, cert_id: str) -> bool:
    """Verifica se um funcionário tem permissão para usar um certificado."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        if is_sqlite_mode():
            cursor.execute("""
                SELECT 1 FROM certificate_permissions
                WHERE employee_id = ? AND certificate_id = ?
            """, (employee_id, cert_id))
        else:
            cursor.execute("""
                SELECT 1 FROM certificate_permissions
                WHERE employee_id = %s AND certificate_id = %s
            """, (employee_id, cert_id))
        return cursor.fetchone() is not None


# ============================================================================
# HELPERS DE TENANTS
# ============================================================================

def get_tenant_by_id(tenant_id: str) -> Optional[Dict[str, Any]]:
    """Busca um tenant pelo ID."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        if is_sqlite_mode():
            cursor.execute("SELECT * FROM tenants WHERE id = ?", (tenant_id,))
        else:
            cursor.execute("SELECT * FROM tenants WHERE id = %s", (tenant_id,))
        row = cursor.fetchone()
        return dict(row) if row else None


def get_tenant_by_email(email: str) -> Optional[Dict[str, Any]]:
    """Busca um tenant pelo email."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        if is_sqlite_mode():
            cursor.execute("SELECT * FROM tenants WHERE email = ?", (email,))
        else:
            cursor.execute("SELECT * FROM tenants WHERE email = %s", (email,))
        row = cursor.fetchone()
        return dict(row) if row else None

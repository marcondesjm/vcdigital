from datetime import datetime
import sqlite3
from pathlib import Path
from typing import Optional, List, Dict, Any
import os

BASE_DIR = Path(__file__).resolve().parent.parent
DB_PATH = BASE_DIR / "voce_digital.db"

def get_db():
    """Factory para conexao SQLite com row_factory."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()


def init_db():
    """Inicializa o banco de dados com todas as tabelas necessarias."""
    with sqlite3.connect(DB_PATH) as conn:
        cursor = conn.cursor()

        # Tabela de Tenants (Escritorios Contabeis)
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS tenants
            (id TEXT PRIMARY KEY, name TEXT, email TEXT UNIQUE,
             master_key_encrypted TEXT, created_at TEXT)
        ''')

        # Tabela de Clientes (do Contador)
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS clients
            (id TEXT PRIMARY KEY, tenant_id TEXT, name TEXT, document TEXT,
             created_at TEXT,
             FOREIGN KEY (tenant_id) REFERENCES tenants(id))
        ''')

        # Tabela de Usuarios (Login)
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS users
            (id TEXT PRIMARY KEY, tenant_id TEXT, email TEXT UNIQUE,
             password_hash TEXT, role TEXT, client_id TEXT,
             created_at TEXT,
             FOREIGN KEY (tenant_id) REFERENCES tenants(id),
             FOREIGN KEY (client_id) REFERENCES clients(id))
        ''')

        # Tabela de Funcionarios (do Escritorio)
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS employees
            (id TEXT PRIMARY KEY, tenant_id TEXT, name TEXT, email TEXT UNIQUE,
             password_hash TEXT, role TEXT, created_at TEXT,
             FOREIGN KEY (tenant_id) REFERENCES tenants(id))
        ''')

        # Tabela de Certificados (Custodia)
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS certificates
            (id TEXT PRIMARY KEY, client_id TEXT, type TEXT,
             encrypted_pfx TEXT, encrypted_password TEXT,
             expiry_date TEXT, status TEXT, created_at TEXT,
             FOREIGN KEY (client_id) REFERENCES clients(id))
        ''')

        # Tabela de Permissoes (Quem pode usar qual certificado)
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS certificate_permissions
            (id TEXT PRIMARY KEY, employee_id TEXT, certificate_id TEXT,
             granted_at TEXT,
             FOREIGN KEY (employee_id) REFERENCES employees(id),
             FOREIGN KEY (certificate_id) REFERENCES certificates(id))
        ''')

        # Tabela de Auditoria (Rastro de Uso)
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS audit_logs
            (id TEXT PRIMARY KEY, certificate_id TEXT, employee_id TEXT,
             document_name TEXT, document_hash TEXT, action TEXT,
             timestamp TEXT, status TEXT, ip_address TEXT,
             FOREIGN KEY (certificate_id) REFERENCES certificates(id),
             FOREIGN KEY (employee_id) REFERENCES employees(id))
        ''')

        conn.commit()


# --- Helpers de Certificados ---

def get_cert_by_id(cert_id: str) -> Optional[Dict[str, Any]]:
    """Busca um certificado pelo ID."""
    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM certificates WHERE id = ?", (cert_id,))
        row = cursor.fetchone()
        return dict(row) if row else None


def list_certs_by_client(client_id: str) -> List[Dict[str, Any]]:
    """Lista todos os certificados de um cliente."""
    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM certificates WHERE client_id = ? ORDER BY created_at DESC", (client_id,))
        return [dict(row) for row in cursor.fetchall()]


def soft_delete_cert(cert_id: str) -> bool:
    """Marca um certificado como Revoked (soft delete)."""
    with sqlite3.connect(DB_PATH) as conn:
        cursor = conn.cursor()
        cursor.execute("UPDATE certificates SET status = 'Revoked' WHERE id = ?", (cert_id,))
        conn.commit()
        return cursor.rowcount > 0


def create_audit_log(log_data: Dict[str, Any]) -> str:
    """Cria um log de auditoria e retorna o ID."""
    import uuid
    from datetime import datetime

    log_id = str(uuid.uuid4())
    with sqlite3.connect(DB_PATH) as conn:
        cursor = conn.cursor()
        cursor.execute(
            """INSERT INTO audit_logs
               (id, certificate_id, employee_id, document_name, document_hash,
                action, timestamp, status, ip_address)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                log_id,
                log_data.get('certificate_id'),
                log_data.get('employee_id'),
                log_data.get('document_name'),
                log_data.get('document_hash'),
                log_data.get('action', 'SIGNATURE'),
                datetime.now().isoformat(),
                log_data.get('status', 'SUCCESS'),
                log_data.get('ip_address', '')
            )
        )
        conn.commit()
    return log_id


# --- Helpers de Clientes ---

def get_client_by_id(client_id: str) -> Optional[Dict[str, Any]]:
    """Busca um cliente pelo ID."""
    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM clients WHERE id = ?", (client_id,))
        row = cursor.fetchone()
        return dict(row) if row else None


def list_all_clients(tenant_id: Optional[str] = None) -> List[Dict[str, Any]]:
    """Lista todos os clientes (opcionalmente filtrado por tenant)."""
    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        if tenant_id:
            cursor.execute("SELECT * FROM clients WHERE tenant_id = ? ORDER BY name", (tenant_id,))
        else:
            cursor.execute("SELECT * FROM clients ORDER BY name")
        return [dict(row) for row in cursor.fetchall()]


# --- Helpers de Usuarios ---

def get_user_by_email(email: str) -> Optional[Dict[str, Any]]:
    """Busca usuario pelo email."""
    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM users WHERE email = ?", (email,))
        row = cursor.fetchone()
        return dict(row) if row else None


def get_user_by_id(user_id: str) -> Optional[Dict[str, Any]]:
    """Busca usuario pelo ID."""
    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM users WHERE id = ?", (user_id,))
        row = cursor.fetchone()
        return dict(row) if row else None


# --- Helpers de Funcionarios ---

def list_employees_by_tenant(tenant_id: str) -> List[Dict[str, Any]]:
    """Lista todos os funcionarios de um tenant."""
    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM employees WHERE tenant_id = ? ORDER BY name", (tenant_id,))
        return [dict(row) for row in cursor.fetchall()]


def get_employee_by_id(emp_id: str) -> Optional[Dict[str, Any]]:
    """Busca funcionario pelo ID."""
    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM employees WHERE id = ?", (emp_id,))
        row = cursor.fetchone()
        return dict(row) if row else None


# --- Helpers de Permissoes ---

def get_permissions_by_cert(cert_id: str) -> List[Dict[str, Any]]:
    """Lista todas as permissoes de um certificado."""
    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute("""
            SELECT p.* FROM certificate_permissions p
            WHERE p.certificate_id = ?
        """, (cert_id,))
        return [dict(row) for row in cursor.fetchall()]


def grant_permission(employee_id: str, cert_id: str) -> str:
    """Concede permissao a um funcionario para usar um certificado."""
    import uuid
    from datetime import datetime

    perm_id = str(uuid.uuid4())
    with sqlite3.connect(DB_PATH) as conn:
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO certificate_permissions (id, employee_id, certificate_id, granted_at) VALUES (?, ?, ?, ?)",
            (perm_id, employee_id, cert_id, datetime.now().isoformat())
        )
        conn.commit()
    return perm_id


def revoke_permission(perm_id: str) -> bool:
    """Revoga uma permissao."""
    with sqlite3.connect(DB_PATH) as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM certificate_permissions WHERE id = ?", (perm_id,))
        conn.commit()
        return cursor.rowcount > 0

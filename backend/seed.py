"""
Script de seed para popular dados de teste no banco SQLite.
Execute: python seed.py
"""

import sqlite3
import uuid
from datetime import datetime, timedelta
from pathlib import Path

from app.database import SQLITE_DB_PATH as DB_PATH, init_db

# Chave mestra para criptografia (mesma do main.py)
from cryptography.fernet import Fernet
from app.config import settings

MASTER_KEY = settings.VOCE_DIGITAL_MASTER_KEY.encode()
cipher_suite = Fernet(MASTER_KEY)

# Inicializar banco antes de popular
init_db()

# Dados de seed
def seed():
    print("Iniciando seed...")

    with sqlite3.connect(DB_PATH) as conn:
        cursor = conn.cursor()

        # 1. Criar Tenant (Escritorio)
        tenant_id = str(uuid.uuid4())
        cursor.execute(
            "INSERT OR IGNORE INTO tenants (id, name, email, created_at) VALUES (?, ?, ?, ?)",
            (tenant_id, "Contabilidade Silva LTDA", "admin@contabilidade.com", datetime.now().isoformat())
        )
        print(f"Tenant: {tenant_id}")

        # 2. Criar Usuario Admin
        admin_id = str(uuid.uuid4())
        cursor.execute(
            """INSERT OR IGNORE INTO users
               (id, tenant_id, email, password_hash, role, created_at)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (admin_id, tenant_id, "admin@contabilidade.com", "admin123", "admin", datetime.now().isoformat())
        )
        print(f"Admin: {admin_id}")

        # 3. Criar Clientes
        clients = [
            ("Empresa A LTDA", "12.345.678/0001-99"),
            ("Empresa B Comercio", "23.456.789/0001-88"),
            ("Empresa C Servicos", "34.567.890/0001-77"),
        ]
        client_ids = []
        for name, doc in clients:
            cid = str(uuid.uuid4())
            cursor.execute(
                "INSERT OR IGNORE INTO clients (id, tenant_id, name, document, created_at) VALUES (?, ?, ?, ?, ?)",
                (cid, tenant_id, name, doc, datetime.now().isoformat())
            )
            client_ids.append(cid)
            print(f"Cliente: {name}")

        # 4. Criar Funcionarios
        employees = [
            ("Joao Silva", "joao@contabilidade.com", "operator"),
            ("Maria Santos", "maria@contabilidade.com", "operator"),
        ]
        employee_ids = []
        for name, email, role in employees:
            eid = str(uuid.uuid4())
            cursor.execute(
                """INSERT OR IGNORE INTO employees
                   (id, tenant_id, name, email, password_hash, role, created_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?)""",
                (eid, tenant_id, name, email, "123456", role, datetime.now().isoformat())
            )
            employee_ids.append(eid)
            print(f"Funcionario: {name}")

        # 5. Criar Usuario Cliente
        client_user_id = str(uuid.uuid4())
        cursor.execute(
            """INSERT OR IGNORE INTO users
               (id, tenant_id, email, password_hash, role, client_id, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (client_user_id, tenant_id, "cliente@empresaa.com", "cliente123", "client", client_ids[0], datetime.now().isoformat())
        )
        print(f"User Cliente: {client_user_id}")

        # 6. Criar Certificados
        # Modelo Agnóstico: Usa cert_model para A1, A3, A4, SE, etc.
        certs = [
            (client_ids[0], tenant_id, "A1", "file", "ICP-Brasil", "2027-12-31", "Active"),
            (client_ids[0], tenant_id, "A3", "token", "ICP-Brasil", "2026-09-15", "Active"),
            (client_ids[1], tenant_id, "SE", "file", "ICP-Brasil", "2025-12-31", "Expired"),
            (client_ids[2], tenant_id, "A1", "file", "ICP-Brasil", "2028-06-30", "Active"),
        ]
        cert_ids = []
        for client_id, t_id, cert_model, cert_type, provider, expiry, status in certs:
            cid = str(uuid.uuid4())
            mock_pfx = b"MOCK_PFX_CONTENT"
            mock_pass = b"mock_password"
            encrypted_pfx = cipher_suite.encrypt(mock_pfx).decode()
            encrypted_pass = cipher_suite.encrypt(mock_pass).decode()

            cursor.execute(
                """INSERT OR IGNORE INTO certificates
                   (id, client_id, tenant_id, cert_model, cert_type, provider,
                    encrypted_pfx, encrypted_password, expiry_date, status, created_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (cid, client_id, t_id, cert_model, cert_type, provider,
                 encrypted_pfx, encrypted_pass, expiry, status, datetime.now().isoformat())
            )
            cert_ids.append(cid)
            print(f"Certificado: {cid}")

        # 7. Criar Permissoes
        for cert_id in cert_ids[:2]:
            for emp_id in employee_ids:
                perm_id = str(uuid.uuid4())
                cursor.execute(
                    """INSERT OR IGNORE INTO certificate_permissions
                       (id, employee_id, certificate_id, granted_at)
                       VALUES (?, ?, ?, ?)""",
                    (perm_id, emp_id, cert_id, datetime.now().isoformat())
                )
                print(f"Permissao: {emp_id} -> {cert_id}")

        # 8. Criar Logs (Audit-First)
        actions = ["UPLOAD_CERTIFICATE", "SIGNATURE", "SIGNATURE", "UPLOAD_CERTIFICATE"]
        for i, cert_id in enumerate(cert_ids):
            log_id = str(uuid.uuid4())
            cursor.execute(
                """INSERT OR IGNORE INTO audit_logs
                   (id, certificate_id, employee_id, client_id, tenant_id,
                    document_name, document_hash, action, timestamp, status)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    log_id,
                    cert_id,
                    employee_ids[0] if i % 2 == 0 else employee_ids[1],
                    client_ids[i % len(client_ids)],
                    tenant_id,
                    f"documento_{i}.pdf",
                    f"hash_{i}",
                    actions[i % len(actions)],
                    (datetime.now() - timedelta(days=i)).isoformat(),
                    "SUCCESS"
                )
            )
            print(f"Log: {cert_id}")

        conn.commit()

    print("Seed concluido com sucesso!")


if __name__ == "__main__":
    seed()

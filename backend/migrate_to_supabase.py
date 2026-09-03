#!/usr/bin/env python
"""
Script de migração: SQLite → Supabase (PostgreSQL)

Este script:
1. Conecta ao SQLite local (voce_digital.db)
2. Cria as tabelas no Supabase
3. Migra todos os dados (clientes, certificados, logs de auditoria, etc)

Usage:
    python migrate_to_supabase.py

Prerequisites:
    - Ter o arquivo voce_digital.db no diretório backend/
    - Ter as variáveis SUPABASE_URL e SUPABASE_KEY configuradas
"""

import sqlite3
import os
from datetime import datetime

# Configurações
DB_PATH = os.path.join(os.path.dirname(__file__), "voce_digital.db")

# Schema Supabase (SQL DDL)
SCHEMA_SQL = """
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Tenants (Escritórios Contábeis)
CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY,
    name TEXT,
    email TEXT UNIQUE,
    master_key_encrypted TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Clients (Clientes do Contador)
CREATE TABLE IF NOT EXISTS clients (
    id UUID PRIMARY KEY,
    tenant_id UUID REFERENCES tenants(id),
    name TEXT,
    document TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    status TEXT DEFAULT 'active',
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- Users (Usuários do Sistema)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY,
    tenant_id UUID REFERENCES tenants(id),
    email TEXT UNIQUE,
    password_hash TEXT,
    role TEXT,
    client_id UUID REFERENCES clients(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Employees (Funcionários do Escritório)
CREATE TABLE IF NOT EXISTS employees (
    id UUID PRIMARY KEY,
    tenant_id UUID REFERENCES tenants(id),
    name TEXT,
    email TEXT UNIQUE,
    password_hash TEXT,
    role TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Certificates (Custódia de Certificados - Modelo Agnóstico)
CREATE TABLE IF NOT EXISTS certificates (
    id UUID PRIMARY KEY,
    client_id UUID REFERENCES clients(id),
    tenant_id UUID REFERENCES tenants(id),
    cert_model TEXT,
    cert_type TEXT,
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
    id UUID PRIMARY KEY,
    employee_id UUID REFERENCES employees(id),
    certificate_id UUID REFERENCES certificates(id),
    granted_by TEXT,
    granted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Audit Logs (Rastro de Uso - Audit-First)
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY,
    tenant_id UUID REFERENCES tenants(id),
    certificate_id UUID REFERENCES certificates(id),
    employee_id UUID REFERENCES employees(id),
    client_id UUID REFERENCES clients(id),
    document_name TEXT,
    document_hash TEXT,
    action TEXT,
    status TEXT,
    ip_address TEXT,
    user_agent TEXT,
    metadata TEXT,
    timestamp TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    log_hash TEXT
);

-- Row Level Security (RLS) - Supabase
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE certificate_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
"""


def sqlite_to_dict(rows):
    """Converte rows do SQLite para lista de dicionários."""
    result = []
    for row in rows:
        result.append(dict(row))
    return result


def migrate_table(cursor, pg_cursor, table_name, columns):
    """Migra uma tabela do SQLite para PostgreSQL."""
    if not columns:
        return 0

    cursor.execute(f"SELECT {', '.join(columns)} FROM {table_name}")
    rows = sqlite_to_dict(cursor.fetchall())

    for row in rows:
        placeholders = ', '.join(['%s'] * len(columns))
        col_names = ', '.join(columns)
        values = [row.get(col) for col in columns]

        try:
            pg_cursor.execute(
                f"INSERT INTO {table_name} ({col_names}) VALUES ({placeholders})",
                values
            )
        except Exception as e:
            print(f"  ⚠️ Erro ao inserir em {table_name}: {e}")

    return len(rows)


def main():
    # Conectar ao SQLite
    print(f"🔄 Conectando ao SQLite: {DB_PATH}")
    sqlite_conn = sqlite3.connect(DB_PATH)
    sqlite_conn.row_factory = sqlite3.Row
    sqlite_cursor = sqlite_conn.cursor()

    # Conectar ao Supabase
    supabase_url = os.environ.get("SUPABASE_URL")
    supabase_key = os.environ.get("SUPABASE_KEY")

    if not supabase_url or not supabase_key:
        print("\n❌ Erro: SUPABASE_URL e SUPABASE_KEY não configuradas")
        print("\n💡 Configure as variáveis de ambiente:")
        print(f"   set SUPABASE_URL=postgresql://user:password@host:port/database")
        print(f"   set SUPABASE_KEY=your-supabase-service-role-key")
        return

    try:
        import psycopg2

        # Parse da URL do Supabase
        # Formato: postgresql://user:password@host:port/database
        from urllib.parse import urlparse
        parsed = urlparse(supabase_url.replace("postgresql://", "postgres://"))

        pg_conn = psycopg2.connect(
            host=parsed.hostname,
            database=parsed.path[1:],
            user=parsed.username,
            password=parsed.password,
            port=parsed.port or 5432
        )
        pg_cursor = pg_conn.cursor()

        print("✅ Conectado ao Supabase!")

        # Criar schema
        print("\n📋 Criando schema no Supabase...")
        pg_cursor.execute(SCHEMA_SQL)
        pg_conn.commit()
        print("  ✅ Tabelas criadas com sucesso!")

        # Migrar dados
        tables = {
            "tenants": ["id", "name", "email", "master_key_encrypted", "created_at"],
            "clients": ["id", "tenant_id", "name", "document", "created_at"],
            "users": ["id", "tenant_id", "email", "password_hash", "role", "client_id", "created_at"],
            "employees": ["id", "tenant_id", "name", "email", "password_hash", "role", "created_at"],
            "certificates": [
                "id", "client_id", "tenant_id", "cert_model", "cert_type", "provider",
                "encrypted_pfx", "encrypted_password", "pkcs11_slot", "pkcs11_label",
                "expiry_date", "subject_name", "serial_number", "issuer", "status", "created_at"
            ],
            "certificate_permissions": ["id", "employee_id", "certificate_id", "granted_by", "granted_at"],
            "audit_logs": [
                "id", "tenant_id", "certificate_id", "employee_id", "client_id",
                "document_name", "document_hash", "action", "status", "ip_address",
                "user_agent", "metadata", "timestamp", "created_at", "log_hash"
            ]
        }

        total_rows = 0
        for table, columns in tables.items():
            # Verificar se a tabela existe no SQLite
            sqlite_cursor.execute(f"SELECT name FROM sqlite_master WHERE type='table' AND name='{table}'")
            if not sqlite_cursor.fetchone():
                print(f"\n  ⏭️ Tabela {table} não existe no SQLite, pulando...")
                continue

            count = migrate_table(sqlite_cursor, pg_cursor, table, columns)
            if count > 0:
                pg_conn.commit()
                total_rows += count
                print(f"  ✅ {table}: {count} registros migrados")

        print(f"\n🎉 Migração concluída! Total: {total_rows} registros migrados.")

        pg_conn.close()
        sqlite_conn.close()

    except ImportError:
        print("\n❌ psycopg2 não instalado. Instale com:")
        print("   pip install psycopg2-binary")
    except Exception as e:
        print(f"\n❌ Erro na migração: {e}")


if __name__ == "__main__":
    main()

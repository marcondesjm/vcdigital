"""
Configuração centralizada do Você Digital.
Suporta SQLite (MVP) e Supabase (Produção).
"""

import os
from pathlib import Path
from typing import Optional
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Configurações do sistema carregadas de variáveis de ambiente."""

    # Chave mestra para criptografia Fernet
    # Em produção, deve ser uma chave de 32 bytes (44 caracteres base64 url-safe)
    VOCE_DIGITAL_MASTER_KEY: str = b'peNrjJ7xHXBM_FFJy9jTLNj_dGp2hmkoj-tXvIfw9lM='.decode()

    # Supabase Configuration
    SUPABASE_URL: Optional[str] = None
    SUPABASE_KEY: Optional[str] = None
    SUPABASE_JWT_SECRET: Optional[str] = None

    # Modo SQLite (MVP) - True por padrão, False quando Supabase está configurado
    SQLITE_MODE: Optional[bool] = None

    # Ambiente
    ENVIRONMENT: str = "development"  # development, staging, production

    # PKCS#11 Library Path (para tokens A3)
    PYKCS11_LIBRARY_PATH: Optional[str] = None

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


# Instância global de configurações
settings = Settings()


def is_production() -> bool:
    """Verifica se está em ambiente de produção."""
    return settings.ENVIRONMENT == "production"


def is_sqlite_mode() -> bool:
    """Verifica se deve usar SQLite (quando Supabase não está configurado)."""
    if settings.SQLITE_MODE is not None:
        return settings.SQLITE_MODE
    return not settings.SUPABASE_URL or not settings.SUPABASE_KEY

#!/bin/bash

# Script de inicialização para Render
# Este script é executado automaticamente pelo Render

cd /app

# Instalar dependências (caso não tenham sido instaladas no build)
pip install -r requirements.txt

# Iniciar o servidor FastAPI
exec uvicorn app.main:app --host 0.0.0.0 --port 8000

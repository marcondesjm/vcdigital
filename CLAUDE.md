# CLAUDE.md - Você Digital

## 🚀 Comandos Rápidos

### Backend (FastAPI)
- **Iniciar:** `cd backend && ./venv/Scripts/python -m uvicorn app.main:app --host 0.0.0.0 --port 8000`
- **Banco de Dados:** SQLite em `backend/voce_digital.db`

### Frontend (Electron + React)
- **Modo Dev (Vite):** `cd frontend && npm run dev`
- **Iniciar App (Electron):** `cd frontend && npm start`
- **Build Produção:** `cd frontend && npm run build`
- **Gerar Instalador (.exe):** `cd frontend && npm run package`

## 🛠️ Estrutura do Projeto
- `backend/app/main.py`: Endpoints da API e lógica de banco.
- `backend/app/services/signature_service.py`: Motor de assinatura PAdES (ICP-Brasil).
- `frontend/src/App.tsx`: Fluxo de navegação e controle de telas.
- `frontend/main.js` & `preload.js`: Ponte de comunicação IPC Electron $\leftrightarrow$ Backend.

## 🧬 Skill: system-evolution
Sempre que criar novas tabelas ou endpoints, siga estas diretrizes:
1. **Agnóstico a Modelo:** Nunca use `type: 'A1' | 'A3'`. Use `cert_model` para suportar A3, A4, Selo Eletrônico (SE) e futuros padrões.
2. **Hierarquia de Confiança:** `Cliente` $\rightarrow$ `Escritório` $\rightarrow$ `Usuário`.
3. **Audit-First:** Toda operação de uso de certificado DEVE gerar um log imutável e disparar um evento de notificação.
4. **Zero-Knowledge:** Senhas de certificados nunca devem ser armazenadas em texto claro; usar criptografia assimétrica ou cofre seguro.

## 🎯 Roadmap Imediato (Próximas Etapas)
- [ ] **Infra Transition:** Migrar de SQLite para Supabase (PostgreSQL) para habilitar RLS e Auditoria Imutável.
- [ ] **DB Evolution:** Modelar schema no Supabase com modelos agnósticos (SE, A3, A4) e Hierarquia de Confiança.
- [ ] **Hierarquia de Acesso:** Implementar permissões `Escritório` $\rightarrow$ `Funcionário`.
- [ ] **Dashboard Admin:** Telas de Clientes, Certificados Vencendo e Utilizações.
- [ ] **Fluxo de Custódia:** Implementar solicitação de uso $\rightarrow$ Log $\rightarrow$ Notificação ao Cliente.

## 📝 Convenções de Código
- **Estilo:** Senior Assistant / Rigorous.
- **Frontend:** React com TypeScript, CSS Global (Dark Mode Slate/Emerald).
- **Backend:** Python 3.12+, FastAPI, SQLite (MVP).
- **Comunicação:** O frontend chama a API via `window.api` $\rightarrow$ `main.js` $\rightarrow$ `FastAPI`.

## ⚠️ Notas Críticas
- **Login:** Rota correta é `/login` (sem barra final).
- **Ambiente Virtual:** Usar `backend/venv/Scripts/python`.
- **Segurança:** Chave mestra AES atualmente hardcoded no `main.py` (necessita migração para `.env`).

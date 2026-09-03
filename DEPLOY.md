# 🚀 Guide de Deploy do Você Digital

Este documento contém instruções para fazer o deploy do **Você Digital** em ambientes de produção.

## 📋 Índice
1. [Deploy no Render (Backend)](#deploy-no-render-backend)
2. [Deploy no Vercel (Frontend)](#deploy-no-vercel-frontend)
3. [Configuração do Supabase](#configuração-do-supabase)
4. [Migração de Dados](#migração-de-dados-sqlite--supabase)
5. [Build do Frontend](#build-do-frontend-electron)
6. [Testando o Deploy](#testando-o-deploy)
7. [Solução de Problemas](#solução-de-problemas)

---

## 🖥️ Deploy no Render (Backend)

### 1. Criar conta no Render
Acesse [https://render.com](https://render.com) e faça login com sua conta do GitHub.

### 2. Criar servico Web
1. Clique em **"New +"** → **"Web Service"**
2. Conecte seu repositório GitHub
3. Na tela de configuração:
   - **Name:** `voce-digital-backend`
   - **Region:** `São Paulo` (recomendado para Brasil)
   - **Branch:** `master` (ou `main`)
   - **Plan:** `Free` (ou `Starter` para mais recursos)

4. O Render irá detectar automaticamente o arquivo `render.yaml` na raiz do projeto

### 3. Configurar variáveis de ambiente
No dashboard do Render, vá em **"Environment" → "Environment Variables"** e configure:

| Variável | Valor |
|----------|-------|
| `VOCE_DIGITAL_MASTER_KEY` | `peNrjJ7xHXBM_FFJy9jTLNj_dGp2hmkoj-tXvIfw9lM=` |
| `ENVIRONMENT` | `production` |
| `SQLITE_MODE` | `false` |
| `SUPABASE_URL` | *(suas credenciais do Supabase)* |
| `SUPABASE_KEY` | *(sua chave do Supabase)* |

### 4. Deploy automático
O Render fará o deploy automaticamente:
- A cada `git push` para a branch configurada
- O build command do `render.yaml` será executado
- O start command iniciará o servidor uvicorn

---

## 🌐 Deploy no Vercel (Frontend)

### 1. Criar conta no Vercel
Acesse [https://vercel.com](https://vercel.com) e faça login com sua conta do GitHub.

### 2. Importar projeto
1. Clique em **"New Project"**
2. Selecione seu repositório GitHub
3. Na tela de configuração:
   - **Framework Preset:** `Other`
   - **Build Command:** `npm install && npm run build`
   - **Output Directory:** `frontend/dist`

### 3. Configurar variáveis de ambiente
No dashboard do Vercel, vá em **"Settings" → "Environment Variables"** e configure:

| Variável | Valor |
|----------|-------|
| `NEXT_PUBLIC_API_URL` | `https://voce-digital-backend.onrender.com` |
| `NODE_ENV` | `production` |

### 4. Deploy automático
O Vercel fará o deploy automaticamente:
- A cada `git push` para a branch configurada
- O `vercel.json` na raiz configurará as rotas
- A API será redirecionada para o backend no Render

### 5. URL do frontend
Após o deploy, você receberá uma URL como:
\`https://voce-digital.vercel.app\`

---

## 🗄️ Configuração do Supabase

### 1. Criar conta no Supabase
Acesse [https://supabase.com](https://supabase.com) e faça login.

### 2. Criar projeto
1. Clique em **"New Project"**
2. Nomeie seu projeto: `voce-digital`
3. Crie uma senha forte para o banco
4. Selecione a região mais próxima (São Paulo está disponível)
5. Clique em **"Create New Project"** (aguarde 5-10 minutos)

### 3. Obter credenciais
No dashboard do Supabase:
1. Vá em **"Project Settings" → "API"**
2. Copie a **"Connection string"** (URI postgresql://)
3. Copie a **"service_role key"** (usada como SUPABASE_KEY)

### 4. Criar schema do banco
1. No Supabase, vá em **"SQL Editor"**
2. Abra um novo editor
3. Cole o conteúdo do arquivo `backend/supabase_schema.sql`
4. Clique em **"Run"** para executar

---

## 🔄 Migração de Dados (SQLite → Supabase)

### 1. Instalar dependências
\`\`\`bash
cd backend
pip install psycopg2-binary
\`\`\`

### 2. Configurar variáveis de ambiente
\`\`\`bash
set SUPABASE_URL=postgresql://user:password@host:port/database
set SUPABASE_KEY=your-service-role-key
\`\`\`

### 3. Executar migração
\`\`\`bash
python migrate_to_supabase.py
\`\`\`

O script irá:
1. Ler o banco SQLite (`voce_digital.db`)
2. Criar as tabelas no Supabase
3. Migrar todos os registros

---

## 📦 Build do Frontend (Electron)

### 1. Build para distribuição
\`\`\`bash
cd frontend
npm install
npm run build
npm run package
\`\`\`

Isso criará os instaladores em:
- `frontend/dist/win-unpacked/` (instalação portátil)
- `frontend/dist/Setup Você Digital-1.0.0.exe` (instalador)

### 2. Configurar URL da API em produção
No `frontend/main.js`, a URL da API é configurada automaticamente:

\`\`\`javascript
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged
const API_URL = isDev
  ? 'http://localhost:8000'      // Desenvolvimento
  : 'https://voce-digital-backend.onrender.com'  // Produção
\`\`\`

Não é necessário alterar nada - o Electron detecta automaticamente se é ambiente de desenvolvimento ou produção.

---

## 🧪 Testando o Deploy

### 1. Verificar saúde da API
\`\`\`bash
curl https://voce-digital-backend.onrender.com/clients/
\`\`\`

Resposta esperada:
\`\`\`json
{"status": "success", "clients": [...]}
\`\`\`

### 2. Acessar documentação
- Swagger UI: \`https://voce-digital-backend.onrender.com/docs\`
- ReDoc: \`https://voce-digital-backend.onrender.com/redoc\`

### 3. Testar login
\`\`\`bash
curl -X POST https://voce-digital-backend.onrender.com/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@voce-digital.com", "password": "admin123"}'
\`\`\`

---

## 🔧 Solução de Problemas

### Problema: CORS Error
Se o frontend não consegue acessar a API:
1. Verifique se a CORS middleware está configurada corretamente no `main.py`
2. Adicione as origens permitidas no `app/main.py`

### Problema: 500 Internal Server Error
Verifique os logs no dashboard do Render:
1. Acesse o dashboard do seu serviço
2. Clique em **"Logs"**
3. Procure por erros recentes

### Problema: Erro de conexão com Supabase
1. Verifique as variáveis `SUPABASE_URL` e `SUPABASE_KEY`
2. Certifique-se de que o schema foi criado corretamente
3. Verifique se o IP do Render está na lista de permissões

### Problema: Certificado não carrega
1. Verifique se o `VOCE_DIGITAL_MASTER_KEY` está correta
2. A chave deve ser a mesma usada para criptografar os certificados

---

## 📞 Suporte

Para suporte adicional:
- Abra uma issue no repositório GitHub
- Consulte a documentação em `docs/`

---
*Última atualização: 2024*

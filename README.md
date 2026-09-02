# 🛡️ Você Digital - Gestor de Certificados Digitais

Sistema desktop multiplataforma para gestão, custódia e auditoria de certificados digitais (A1 e A3), focado em escritórios de contabilidade e seus clientes.

## 🎯 Objetivos do Sistema
1. **Gestão Centralizada:** Permitir que contadores gerenciem certificados de múltiplos clientes em um único painel.
2. **Rastreabilidade (Auditoria):** Registrar cada uso do certificado (Quem assinou? Quando? Qual documento? Qual cliente?).
3. **Segurança Jurídica:** Implementar Termos de Uso e Consentimento para conformidade com a LGPD e TST.
4. **Custódia Segura:** Armazenar certificados criptografados, eliminando a necessidade de compartilhar senhas com funcionários.

## 🏗️ Arquitetura Técnica
- **Frontend (Interface):** Electron.js ou Tauri (com React/Next.js) para experiência Desktop.
- **Backend (Core):** Python (FastAPI) para manipulação de certificados e criptografia.
- **Banco de Dados:** PostgreSQL (Centralizado para o Contador) + SQLite (Local para cache e logs temporários).
- **Criptografia:** AES-256 para arquivos PFX e integração via PKCS#11 para Tokens A3.

## 🛠️ Módulos Principais

### 1. Painel do Administrador (Contador)
- **Gestão de Clientes:** Cadastro de empresas e pessoas físicas.
- **Repositório de Certificados:** Upload de certificados A1 com criptografia de chave mestre.
- **Controle de Acessos:** Definir qual funcionário tem permissão para usar qual certificado.
- **Logs de Auditoria:** Visualização de histórico de uso detalhado.

### 2. Interface do Operador (Funcionário)
- **Portal de Assinatura:** Área para arrastar PDF e assinar digitalmente sem conhecer a senha do certificado.
- **Fluxo de Solicitação:** Pedido de uso de certificado com justificativa.

### 3. Módulo de Segurança & Compliance
- **Aceite de Termos:** Bloqueio de uso até a assinatura do Termo de Ferramentas Corporativas.
- **Criptografia de Ponta a Ponta:** Certificados nunca ficam expostos em pastas comuns.

## ⚠️ Observações Importantes
- **Assinatura de Código:** Necessário certificado de Code Signing (DigiCert/GlobalSign) para evitar que o Windows Defender identifique o app como malware.
- **Tokens A3:** Integração via drivers nativos para leitura de cartões e tokens USB.

# 🎨 Especificação de UI/UX - Você Digital

Este documento guia o Agente de Frontend na criação da interface desktop utilizando Electron + React.

## 🎨 Identidade Visual
- **Cores:** Azul Marinho Profundo (Confiança), Branco Gelo (Limpeza) e Verde Esmeralda (Sucesso/Assinatura).
- **Estilo:** Interface "Enterprise" — limpa, com bordas arredondadas suaves e tipografia legível (Inter ou Roboto).

## 🖥️ Telas Principais

### 1. Login & Autenticação
- Campo de Email e Senha.
- Opção "Lembrar este dispositivo" (token seguro).
- Validação de permissões (Admin vs Operador).

### 2. Dashboard do Contador (Admin)
- **Sidebar:** Clientes, Funcionários, Certificados, Auditoria, Configurações.
- **Home:** Cards com resumo (Total de Clientes, Certificados a Vencer em 30 dias, Total de Assinaturas no Mês).
- **Tabela de Clientes:** Busca rápida, Filtros por CNPJ e botão "Gerenciar Certificados".

### 3. Gestão de Certificados (View Cliente)
- **Lista de Certificados:** Nome do certificado, Tipo (A1/A3), Data de Expiração (com alerta visual se estiver perto de vencer).
- **Botão "Novo Upload":** Abre modal para upload de PFX e senha.
- **Controle de Acesso:** Checklist de funcionários permitidos a usar aquele certificado.

### 4. Portal de Assinatura (Operador/Funcionário)
- **Área de Drag & Drop:** Campo central para arrastar o arquivo PDF.
- **Seletor de Certificado:** Dropdown com os certificados que o funcionário tem permissão para usar.
- **Botão "Assinar Documento":** Gatilho para a API do Backend.
- **Feedback Visual:** Barra de progresso e check de "Assinatura Qualificada Realizada com Sucesso".

### 5. Painel de Auditoria (Rastro de Uso)
- **Tabela de Logs:** Colunas [Data/Hora | Funcionário | Cliente | Documento | Status].
- **Exportação:** Botão para exportar relatório de uso em PDF/Excel para fins jurídicos.

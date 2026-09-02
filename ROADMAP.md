# 🗺️ Roadmap de Desenvolvimento - Você Digital

Este documento define a evolução do sistema, dividida em fases para garantir a entrega de valor constante e a segurança jurídica.

## 📍 Fase 1: Fundação e Segurança (MVP)
**Objetivo:** Conseguir realizar a primeira assinatura qualificada e salvar o certificado com segurança.
- [ ] Modelagem do Banco de Dados (Custódia de Certificados).
- [ ] Implementação do motor de assinatura PAdES (A1).
- [ ] Sistema de Criptografia AES-256 para armazenamento de PFX.
- [ ] Termo de Consentimento LGPD (Aceite obrigatório).

## 📍 Fase 2: Gestão do Contador (Admin)
**Objetivo:** Permitir que o contador gerencie múltiplos clientes e funcionários.
- [ ] Dashboard de Gestão de Clientes.
- [ ] Módulo de atribuição de certificados a funcionários.
- [ ] Log de Auditoria (Quem assinou, quando e o quê).
- [ ] Sistema de Notificação de Uso.

## 📍 Fase 3: Experiência do Usuário (Desktop App)
**Objetivo:** Transformar a API em um aplicativo profissional.
- [ ] Interface Electron/React para desktop.
- [ ] Fluxo de "Arraste e Assine" simplificado.
- [ ] Integração com Tokens A3 (via PKCS#11).
- [ ] Sistema de Login e Senha para o Admin.

## 📍 Fase 4: Validação e Escala
**Objetivo:** Garantir aceitação total em órgãos governamentais e estabilidade.
- [ ] Testes exaustivos no Verificador ITI.
- [ ] Assinatura de Código (Code Signing) para evitar bloqueios de antivírus.
- [ ] Deploy de Banco de Dados em Nuvem Seguro.

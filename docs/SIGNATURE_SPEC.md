# ✍️ Especificação de Assinatura Qualificada (Padrão ICP-Brasil)

Este documento define os requisitos técnicos para que as assinaturas geradas pelo "Você Digital" sejam aceitas pelo DETRAN e demais órgãos públicos.

## 1. Padrão de Assinatura
O sistema deve implementar a assinatura **PAdES (PDF Advanced Electronic Signatures)**.
- **Formato:** CMS (Cryptographic Message Syntax).
- **Algoritmo de Hash:** SHA-256 (mínimo).
- **Algoritmo de Criptografia:** RSA ou ECDSA (conforme o certificado do cliente).

## 2. Fluxo de Processamento da Assinatura
Para garantir a segurança e a validade jurídica:

### Para Certificados A1 (Arquivo .pfx/.p12)
1. **Recuperação:** O sistema recupera o certificado criptografado do Banco de Dados.
2. **Descriptografia em Memória:** O arquivo é descriptografado usando a chave mestra do sistema diretamente na RAM (nunca gravado em disco).
3. **Hash do Documento:** O sistema gera o hash SHA-256 do PDF.
4. **Assinatura:** A chave privada assina o hash.
5. **Embutimento:** A assinatura e a cadeia de certificados (CA) são inseridas no PDF.

### Para Certificados A3 (Token USB/Smartcard)
1. **Conexão PKCS#11:** O app detecta o driver do token (ex: SafeNet, GD Burti).
2. **Sessão de Usuário:** Solicita a senha PIN do token.
3. **Assinatura Remota:** O hash do documento é enviado ao token; a chave privada assina internamente e devolve a assinatura.
4. **Embutimento:** A assinatura é inserida no PDF.

## 3. Verificação de Validade
O documento final deve ser validado pelo **Verificador ITI (Instituto Nacional de Tecnologia da Informação)**.
- O sistema deve realizar um "auto-teste" de validade antes de entregar o arquivo ao usuário.

## 4. Bibliotecas Recomendadas (Python)
- `pyHanko`: Para a criação de assinaturas PAdES.
- `cryptography`: Para manipulação de chaves e descriptografia AES.
- `PyKCS11`: Para comunicação com Tokens A3.

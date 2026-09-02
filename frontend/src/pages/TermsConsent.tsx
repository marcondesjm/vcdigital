import React, { useState } from 'react'

interface TermsConsentProps {
  onAccept: () => void
}

export default function TermsConsent({ onAccept }: TermsConsentProps) {
  const [checked, setChecked] = useState(false)

  return (
    <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0f172a' }}>
      <div className="card" style={{ width: '700px', maxHeight: '85vh', overflowY: 'auto' }}>
        <h2 style={{ marginBottom: '8px', color: '#10b981' }}>📜 Termo de Uso de Ferramentas Corporativas</h2>
        <p style={{ color: '#94a3b8', fontSize: '0.85rem', marginBottom: '20px' }}>
          Para utilizar o sistema Você Digital, é necessário aceitar os termos abaixo.
        </p>

        <div style={{ backgroundColor: '#1e293b', padding: '16px', borderRadius: '8px', marginBottom: '20px' }}>
          <h4 style={{ color: '#f8fafc', marginBottom: '12px' }}>1. OBJETO</h4>
          <p style={{ color: '#cbd5e1', fontSize: '0.85rem', lineHeight: '1.6' }}>
            Este termo regulamenta o uso do sistema de gestão e auditoria de certificados digitais,
            garantindo a conformidade com a Lei Geral de Proteção de Dados (LGPD - Lei 13.709/2018) e
            as normas do Tribunal Superior do Trabalho (TST).
          </p>

          <h4 style={{ color: '#f8fafc', marginBottom: '12px', marginTop: '16px' }}>2. MONITORAMENTO E AUDITORIA</h4>
          <p style={{ color: '#cbd5e1', fontSize: '0.85rem', lineHeight: '1.6' }}>
            O sistema registra automaticamente o histórico de uso de cada certificado digital,
            incluindo: data, horário, usuário, documento assinado e status da operação.
            Estes dados são armazenados de forma criptografada e são utilizados
            exclusivamente para fins de auditoria interna e conformidade legal.
          </p>

          <h4 style={{ color: '#f8fafc', marginBottom: '12px', marginTop: '16px' }}>3. CUSTÓDIA DE CERTIFICADOS</h4>
          <p style={{ color: '#cbd5e1', fontSize: '0.85rem', lineHeight: '1.6' }}>
            Os certificados digitais (A1) são armazenados de forma criptografada no sistema.
            A senha do certificado nunca é exposta ou compartilhada com terceiros.
            O acesso é restrito ao administrador do escritório contábil.
          </p>

          <h4 style={{ color: '#f8fafc', marginBottom: '12px', marginTop: '16px' }}>4. ASSINATURA QUALIFICADA</h4>
          <p style={{ color: '#cbd5e1', fontSize: '0.85rem', lineHeight: '1.6' }}>
            Todas as assinaturas são realizadas no padrão PAdES (ICP-Brasil), aceitas pelo
            DETRAN, Receita Federal e demais órgãos públicos. O sistema não altera o
            conteúdo do documento, apenas adiciona a assinatura digital criptografada.
          </p>

          <h4 style={{ color: '#f8fafc', marginBottom: '12px', marginTop: '16px' }}>5. ACEITAÇÃO</h4>
          <p style={{ color: '#cbd5e1', fontSize: '0.85rem', lineHeight: '1.6' }}>
            Ao marcar a opção abaixo e clicar em "Aceitar e Continuar", o usuário
            declara ter lido e concordado com todos os termos deste documento.
          </p>
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', marginBottom: '16px' }}>
          <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} style={{ width: '18px', height: '18px' }} />
          <span style={{ fontSize: '0.9rem' }}>Li e concordo com os termos de uso e monitoramento.</span>
        </label>

        <button className="btn" style={{ width: '100%' }} onClick={onAccept} disabled={!checked}>
          Aceitar e Continuar
        </button>
      </div>
    </div>
  )
}

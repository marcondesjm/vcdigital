import React, { useState } from 'react'
import { login, register } from '../services/api'
import { useUser } from '../contexts/UserContext'

interface LoginProps {
  onLogin: () => void
}

export default function Login({ onLogin }: LoginProps) {
  const [email, setEmail] = useState('marcondesgestaotrafego@gmail.com')
  const [password, setPassword] = useState('Mjm1978*')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showRegister, setShowRegister] = useState(false)
  const [registerName, setRegisterName] = useState('')
  const [registerEmail, setRegisterEmail] = useState('')
  const [registerPassword, setRegisterPassword] = useState('')
  const [registerError, setRegisterError] = useState('')
  const [registerLoading, setRegisterLoading] = useState(false)
  const { setUser } = useUser()

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    setError('')
    if (!email || !password) {
      setError('Preencha email e senha.')
      return
    }

    setLoading(true)
    try {
      const user = await login(email.trim(), password)
      setUser(user)
      onLogin()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao fazer login.'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  const handleRegister = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    setRegisterError('')
    if (!registerName || !registerEmail || !registerPassword) {
      setRegisterError('Preencha todos os campos.')
      return
    }

    setRegisterLoading(true)
    try {
      const response = await register({
        name: registerName,
        email: registerEmail,
        password: registerPassword,
        role: 'admin'
      })

      setRegisterError('')
      alert('Conta criada com sucesso! Faça login com as credenciais fornecidas.')
      setShowRegister(false)
      setEmail(registerEmail)
      setPassword(registerPassword)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao criar conta.'
      setRegisterError(msg)
    } finally {
      setRegisterLoading(false)
    }
  }

  return (
    <div
      style={{
        display: 'flex',
        height: '100vh',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#0f172a',
      }}
    >
      <div className="card" style={{ width: '420px', textAlign: 'center' }}>
        <h2 style={{ marginBottom: '8px', color: '#10b981' }}>🛡️ Você Digital</h2>
        <p style={{ color: '#94a3b8', marginBottom: '24px', fontSize: '0.9rem' }}>
          Gestão e Auditoria de Certificados ICP-Brasil
        </p>

        <form onSubmit={handleLogin}>
          <div style={{ textAlign: 'left', marginBottom: '16px' }}>
            <label style={{ fontSize: '0.85rem', color: '#94a3b8' }}>E-mail Corporativo</label>
            <input
              type="email"
              className="input"
              placeholder="contador@escritorio.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoFocus
            />
          </div>

          <div style={{ textAlign: 'left', marginBottom: '16px' }}>
            <label style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Senha</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                className="input"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{ margin: 0 }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  fontSize: '0.8rem',
                }}
              >
                {showPassword ? 'Ocultar' : 'Mostrar'}
              </button>
            </div>
          </div>

          {error && (
            <div
              style={{
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid #ef4444',
                color: '#fca5a5',
                padding: '10px',
                borderRadius: '6px',
                fontSize: '0.85rem',
                marginBottom: '16px',
              }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            className="btn"
            style={{ width: '100%', marginTop: '8px' }}
            disabled={loading}
          >
            {loading ? 'Autenticando...' : 'Entrar no Sistema'}
          </button>

          <div style={{ textAlign: 'center', marginTop: '16px' }}>
            <button
              type="button"
              onClick={() => setShowRegister(!showRegister)}
              style={{{
                background: 'transparent',
                border: '1px solid #3b82f6',
                color: '#3b82f6',
                padding: '8px 16px',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '0.9rem',
                transition: 'all 0.2s',
              }}
              onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#1e40af1a'}
              onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              {showRegister ? 'Cancelar Registro' : 'Criar Conta'}
            </button>
          </div>
        </form>
      </div>

      {showRegister && (
        <div
          style={{{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
        >
          <div
            className="card"
            style={{{
              width: '420px',
              textAlign: 'center',
              backgroundColor: '#1e293b',
              borderRadius: '12px',
              padding: '24px',
              boxShadow: '0 10px 25px rgba(0, 0, 0, 0.3)',
            }}
          >
            <h2 style={{ marginBottom: '16px', color: '#10b981' }}>🛡️ Criar Conta</h2>
            <p style={{ color: '#94a3b8', marginBottom: '24px', fontSize: '0.9rem' }}>Cadastre-se para acessar o sistema</p>

            {registerError && (
              <div
                style={{{
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid #ef4444',
                  color: '#fca5a5',
                  padding: '10px',
                  borderRadius: '6px',
                  fontSize: '0.85rem',
                  marginBottom: '16px',
                }}
              >
                {registerError}
              </div>
            )}

            <form onSubmit={handleRegister}>
              <div style={{ textAlign: 'left', marginBottom: '16px' }}>
                <label style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Nome Completo</label>
                <input
                  type="text"
                  className="input"
                  placeholder="Seu nome"
                  value={registerName}
                  onChange={(e) => setRegisterName(e.target.value)}
                  required
                  style={{ marginTop: '4px' }}
                />
              </div>

              <div style={{ textAlign: 'left', marginBottom: '16px' }}>
                <label style={{ fontSize: '0.85rem', color: '#94a3b8' }}>E-mail Corporativo</label>
                <input
                  type="email"
                  className="input"
                  placeholder="contador@escritorio.com"
                  value={registerEmail}
                  onChange={(e) => setRegisterEmail(e.target.value)}
                  required
                  style={{ marginTop: '4px' }}
                />
              </div>

              <div style={{ textAlign: 'left', marginBottom: '16px' }}>
                <label style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Senha</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className="input"
                    placeholder="••••••••"
                    value={registerPassword}
                    onChange={(e) => setRegisterPassword(e.target.value)}
                    required
                    style={{ margin: 0 }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{{
                      position: 'absolute',
                      right: '10px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: '#94a3b8',
                      cursor: 'pointer',
                      fontSize: '0.8rem',
                    }}
                  >
                    {showPassword ? 'Ocultar' : 'Mostrar'}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="btn"
                style={{{
                  width: '100%',
                  marginTop: '8px',
                  backgroundColor: '#10b981',
                  color: 'white',
                  border: 'none',
                  padding: '12px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '0.95rem',
                  fontWeight: '500',
                }}
                disabled={registerLoading}
              >
                {registerLoading ? 'Criando conta...' : 'Criar Conta'}
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}

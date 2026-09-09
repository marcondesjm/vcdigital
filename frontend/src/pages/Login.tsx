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
  const [registerSuccess, setRegisterSuccess] = useState('')
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
    setRegisterSuccess('')
    if (!registerName || !registerEmail || !registerPassword) {
      setRegisterError('Preencha todos os campos.')
      return
    }
    if (registerPassword.length < 6) {
      setRegisterError('A senha deve ter pelo menos 6 caracteres.')
      return
    }

    setRegisterLoading(true)
    try {
      await register({
        name: registerName,
        email: registerEmail,
        password: registerPassword,
        role: 'admin'
      })
      setRegisterSuccess('Conta criada com sucesso! Redirecionando para o login...')
      setEmail(registerEmail)
      setPassword(registerPassword)
      setTimeout(() => {
        setShowRegister(false)
        setRegisterSuccess('')
      }, 2000)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao criar conta.'
      setRegisterError(msg)
    } finally {
      setRegisterLoading(false)
    }
  }

  // TELA DE LOGIN
  if (!showRegister) {
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
          </form>

          <div style={{ textAlign: 'center', marginTop: '20px', paddingTop: '16px', borderTop: '1px solid #334155' }}>
            <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Ainda nao tem conta? </span>
            <button
              type="button"
              onClick={() => {
                setShowRegister(true)
                setError('')
              }}
              style={{
                background: 'none',
                border: 'none',
                color: '#3b82f6',
                cursor: 'pointer',
                fontSize: '0.85rem',
                fontWeight: 'bold',
                textDecoration: 'underline',
              }}
            >
              Criar Conta
            </button>
          </div>
        </div>
      </div>
    )
  }

  // TELA DE REGISTRO
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
        <h2 style={{ marginBottom: '8px', color: '#10b981' }}>🛡️ Criar Conta</h2>
        <p style={{ color: '#94a3b8', marginBottom: '24px', fontSize: '0.9rem' }}>
          Cadastre-se para acessar o sistema
        </p>

        {registerError && (
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
            {registerError}
          </div>
        )}

        {registerSuccess && (
          <div
            style={{
              background: 'rgba(16, 185, 129, 0.1)',
              border: '1px solid #10b981',
              color: '#6ee7b7',
              padding: '10px',
              borderRadius: '6px',
              fontSize: '0.85rem',
              marginBottom: '16px',
            }}
          >
            {registerSuccess}
          </div>
        )}

        <form onSubmit={handleRegister}>
          <div style={{ textAlign: 'left', marginBottom: '16px' }}>
            <label style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Nome Completo</label>
            <input
              type="text"
              className="input"
              placeholder="Seu nome completo"
              value={registerName}
              onChange={(e) => setRegisterName(e.target.value)}
              autoFocus
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
            />
          </div>

          <div style={{ textAlign: 'left', marginBottom: '16px' }}>
            <label style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Senha</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                className="input"
                placeholder="Minimo 6 caracteres"
                value={registerPassword}
                onChange={(e) => setRegisterPassword(e.target.value)}
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

          <button
            type="submit"
            className="btn"
            style={{
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

        <div style={{ textAlign: 'center', marginTop: '20px', paddingTop: '16px', borderTop: '1px solid #334155' }}>
          <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Ja tem uma conta? </span>
          <button
            type="button"
            onClick={() => {
              setShowRegister(false)
              setRegisterError('')
              setRegisterSuccess('')
            }}
            style={{
              background: 'none',
              border: 'none',
              color: '#3b82f6',
              cursor: 'pointer',
              fontSize: '0.85rem',
              fontWeight: 'bold',
              textDecoration: 'underline',
            }}
          >
            Fazer Login
          </button>
        </div>
      </div>
    </div>
  )
}

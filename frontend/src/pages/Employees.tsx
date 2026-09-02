import React, { useState, useEffect } from 'react'
import type { Employee } from '../types'
import { useUser } from '../contexts/UserContext'

const BACKEND_URL = 'http://localhost:8001'

export default function Employees() {
  const { user } = useUser()
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  const [showModal, setShowModal] = useState<boolean>(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const [name, setName] = useState<string>('')
  const [email, setEmail] = useState<string>('')
  const [password, setPassword] = useState<string>('')
  const [role, setRole] = useState<string>('operator')

  const tenantId = user?.tenant_id || 'f38454cb-195c-4042-a835-465e398c965b'

  const fetchEmployees = async () => {
    try {
      setLoading(true)
      const res = await fetch(`${BACKEND_URL}/employees/?tenant_id=${tenantId}`)
      const data = await res.json()
      if (data.status === 'success') {
        setEmployees(data.employees || [])
      } else {
        setError('Erro ao carregar funcionários.')
      }
    } catch (err: any) {
      setError(err.message || 'Erro de conexão')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchEmployees()
  }, [tenantId])

  const handleOpenCreate = () => {
    setEditingId(null)
    setName('')
    setEmail('')
    setPassword('')
    setRole('operator')
    setShowModal(true)
  }

  const handleOpenEdit = (emp: Employee) => {
    setEditingId(emp.id)
    setName(emp.name)
    setEmail(emp.email)
    setPassword(emp.password_hash || '')
    setRole(emp.role || 'operator')
    setShowModal(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccessMsg(null)

    try {
      const payload = {
        name,
        email,
        password,
        role,
        tenant_id: tenantId,
      }

      let res
      if (editingId) {
        res = await fetch(`${BACKEND_URL}/employees/${editingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      } else {
        res = await fetch(`${BACKEND_URL}/employees/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      }

      const data = await res.json()
      if (data.status === 'success') {
        setSuccessMsg(editingId ? 'Funcionário atualizado com sucesso!' : 'Funcionário cadastrado com sucesso!')
        setShowModal(false)
        fetchEmployees()
      } else {
        setError(data.detail || 'Erro ao salvar funcionário.')
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao processar requisição.')
    }
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm('Tem certeza que deseja remover este funcionário?')) return
    try {
      const res = await fetch(`${BACKEND_URL}/employees/${id}`, {
        method: 'DELETE',
      })
      const data = await res.json()
      if (data.status === 'success') {
        setSuccessMsg('Funcionário removido com sucesso!')
        fetchEmployees()
      } else {
        setError(data.detail || 'Erro ao remover funcionário.')
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao excluir.')
    }
  }

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h2>👥 Gestão de Funcionários & Equipe</h2>
          <p style={{ color: 'var(--text-muted)' }}>Controle de operadores e permissões de acesso aos certificados.</p>
        </div>
        <button className="btn" onClick={handleOpenCreate} style={{ background: '#10b981', color: '#fff' }}>
          ➕ Novo Funcionário
        </button>
      </div>

      {successMsg && (
        <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid #10b981', color: '#10b981', padding: '12px', borderRadius: '8px', marginBottom: '16px' }}>
          {successMsg}
        </div>
      )}

      {error && (
        <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', color: '#ef4444', padding: '12px', borderRadius: '8px', marginBottom: '16px' }}>
          {error}
        </div>
      )}

      {loading ? (
        <p>Carregando equipe...</p>
      ) : (
        <div style={{ background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border)', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', background: 'rgba(255,255,255,0.02)' }}>
                <th style={{ padding: '14px' }}>Nome</th>
                <th style={{ padding: '14px' }}>E-mail</th>
                <th style={{ padding: '14px' }}>Perfil / Função</th>
                <th style={{ padding: '14px' }}>Data de Cadastro</th>
                <th style={{ padding: '14px', textAlign: 'right' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {employees.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    Nenhum funcionário cadastrado.
                  </td>
                </tr>
              ) : (
                employees.map((emp) => (
                  <tr key={emp.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '14px', fontWeight: '500' }}>{emp.name}</td>
                    <td style={{ padding: '14px', color: 'var(--text-muted)' }}>{emp.email}</td>
                    <td style={{ padding: '14px' }}>
                      <span className={`badge-${emp.role === 'admin' ? 'success' : 'warning'}`}>
                        {emp.role === 'admin' ? 'Administrador' : 'Operador'}
                      </span>
                    </td>
                    <td style={{ padding: '14px', color: 'var(--text-muted)' }}>
                      {emp.created_at ? new Date(emp.created_at).toLocaleDateString('pt-BR') : '-'}
                    </td>
                    <td style={{ padding: '14px', textAlign: 'right' }}>
                      <button
                        className="btn"
                        style={{ background: '#3b82f6', marginRight: '8px', padding: '6px 12px', fontSize: '0.85rem' }}
                        onClick={() => handleOpenEdit(emp)}
                      >
                        ✏️ Editar
                      </button>
                      <button
                        className="btn"
                        style={{ background: '#ef4444', padding: '6px 12px', fontSize: '0.85rem' }}
                        onClick={() => handleDelete(emp.id)}
                      >
                        🗑️ Excluir
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal de Criação / Edição */}
      {showModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#1e293b', border: '1px solid var(--border)', borderRadius: '12px', padding: '24px', width: '400px', maxWidth: '90%' }}>
            <h3 style={{ marginBottom: '16px' }}>{editingId ? 'Editar Funcionário' : 'Novo Funcionário'}</h3>
            <form onSubmit={handleSave}>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '6px' }}>Nome Completo</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  style={{ width: '100%', padding: '10px', borderRadius: '6px', background: '#0f172a', border: '1px solid var(--border)', color: '#fff' }}
                  placeholder="Ex: Carlos Silva"
                />
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '6px' }}>E-mail de Acesso</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  style={{ width: '100%', padding: '10px', borderRadius: '6px', background: '#0f172a', border: '1px solid var(--border)', color: '#fff' }}
                  placeholder="carlos@contabilidade.com"
                />
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '6px' }}>Senha Temporária</label>
                <input
                  type="text"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  style={{ width: '100%', padding: '10px', borderRadius: '6px', background: '#0f172a', border: '1px solid var(--border)', color: '#fff' }}
                  placeholder="••••••••"
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '6px' }}>Função</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  style={{ width: '100%', padding: '10px', borderRadius: '6px', background: '#0f172a', border: '1px solid var(--border)', color: '#fff' }}
                >
                  <option value="operator">Operador</option>
                  <option value="admin">Administrador</option>
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button
                  type="button"
                  className="btn"
                  style={{ background: '#475569' }}
                  onClick={() => setShowModal(false)}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn"
                  style={{ background: '#10b981' }}
                >
                  {editingId ? 'Salvar Alterações' : 'Cadastrar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

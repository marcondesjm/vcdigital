const { app, BrowserWindow, ipcMain, dialog } = require('electron')
const path = require('path')
const axios = require('axios')

// Configuração da URL da API
// Em desenvolvimento: localhost:8000
// Em produção (Render): https://voce-digital-backend.onrender.com
// Em Web (Vercel): a mesma API do Render
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged
const isWeb = process.env.IS_WEB === 'true' || !app.isPackaged && process.type === 'web'
// Forçar isWeb quando não é Electron nativo
const forceWebMode = typeof process.versions === 'undefined' || !process.versions.electron

const API_URL = isDev
  ? 'http://localhost:8000'
  : 'https://voce-digital-backend.onrender.com'

let mainWindow

function createWindow() {
  // Se for web, não cria janela Electron
  if (isWeb && app.isPackaged) {
    return
  }

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 700,
    title: 'Você Digital - Gestor de Certificados',
    icon: path.join(__dirname, 'public', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    frame: false,
    backgroundColor: '#0f172a',
  })

  mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'))

  // Abrir DevTools em modo desenvolvimento
  if (isDev) {
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  }
}

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  if (!isWeb && process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (!isWeb && BrowserWindow.getAllWindows().length === 0) createWindow()
})

// ============================================
// IPC HANDLERS — Comunicação segura Frontend → Backend
// ============================================

// --- AUTH ---
ipcMain.handle('login', async (event, { email, password }) => {
  try {
    const response = await axios.post(`${API_URL}/login`, { email, password })
    return response.data
  } catch (error) {
    console.error('Erro no login:', error.response?.data || error.message)
    return { status: 'error', message: error.response?.data?.detail || error.message }
  }
})

// --- CLIENTS ---
ipcMain.handle('create-client', async (event, { name, document }) => {
  try {
    const response = await axios.post(`${API_URL}/clients/`, { name, document })
    return response.data
  } catch (error) {
    console.error('Erro ao criar cliente:', error.response?.data || error.message)
    return { status: 'error', message: error.response?.data?.detail || error.message }
  }
})

ipcMain.handle('list-clients', async () => {
  try {
    const response = await axios.get(`${API_URL}/clients/`)
    return response.data
  } catch (error) {
    console.error('Erro ao listar clientes:', error.message)
    return { status: 'error', clients: [] }
  }
})

ipcMain.handle('get-client', async (event, clientId) => {
  try {
    const response = await axios.get(`${API_URL}/clients/${clientId}`)
    return response.data
  } catch (error) {
    console.error('Erro ao buscar cliente:', error.message)
    return { status: 'error', client: null }
  }
})

// --- CERTIFICATES ---
ipcMain.handle('select-file', async (event, filters) => {
  if (isWeb) {
    // Em web, retorna null (o arquivo é selecionado pelo browser)
    return { canceled: false, filePaths: [] }
  }

  const defaultFilters = [
    { name: 'Certificado Digital', extensions: ['pfx', 'p12'] },
    { name: 'PDF Document', extensions: ['pdf'] },
  ]
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: filters || defaultFilters,
  })
  return result
})

ipcMain.handle('upload-certificate', async (event, { filePath, password, clientId, certModel, certType, employeeId }) => {
  const fs = require('fs')
  const FormData = require('form-data')
  const form = new FormData()
  form.append('file', fs.createReadStream(filePath))
  form.append('password', password)
  form.append('client_id', clientId)
  form.append('cert_model', certModel)
  form.append('cert_type', certType)
  form.append('employee_id', employeeId || '')

  try {
    const response = await axios.post(`${API_URL}/upload-certificate/`, form, {
      headers: form.getHeaders(),
    })
    return response.data
  } catch (error) {
    console.error('Erro no upload:', error.response?.data || error.message)
    return { status: 'error', message: error.response?.data?.detail || error.message }
  }
})

ipcMain.handle('list-client-certificates', async (event, clientId) => {
  try {
    const response = await axios.get(`${API_URL}/clients/${clientId}/certificates`)
    return response.data
  } catch (error) {
    console.error('Erro ao listar certificados:', error.message)
    return { status: 'error', certificates: [] }
  }
})

ipcMain.handle('revoke-certificate', async (event, { certId, employeeId }) => {
  try {
    const response = await axios.delete(
      `${API_URL}/certificates/${certId}?employee_id=${employeeId}`
    )
    return response.data
  } catch (error) {
    console.error('Erro ao revogar certificado:', error.response?.data || error.message)
    return { status: 'error', message: error.response?.data?.detail || error.message }
  }
})

// --- SIGN PDF ---
ipcMain.handle('sign-pdf', async (event, { pdfPath, certificateId, employeeId }) => {
  const fs = require('fs')
  const FormData = require('form-data')
  const form = new FormData()
  form.append('pdf_file', fs.createReadStream(pdfPath))
  form.append('certificate_id', certificateId)
  form.append('employee_id', employeeId)

  try {
    const response = await axios.post(`${API_URL}/sign-pdf/`, form, {
      headers: form.getHeaders(),
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
      timeout: 120000,
    })
    return response.data
  } catch (error) {
    console.error('Erro na assinatura:', error.response?.data || error.message)
    return {
      status: 'error',
      message: error.response?.data?.detail || error.message
    }
  }
})

// --- AUDIT LOGS ---
ipcMain.handle('get-audit-logs', async (event, { clientId, status }) => {
  const params = status ? `?status=${status}` : ''
  try {
    const response = await axios.get(`${API_URL}/audit-logs/${clientId}${params}`)
    return response.data
  } catch (error) {
    console.error('Erro ao buscar logs:', error.message)
    return { status: 'error', logs: [] }
  }
})

// --- EMPLOYEES ---
ipcMain.handle('list-employees', async (event, tenantId) => {
  try {
    const response = await axios.get(`${API_URL}/employees/?tenant_id=${tenantId}`)
    return response.data
  } catch (error) {
    console.error('Erro ao listar funcionários:', error.message)
    return { status: 'error', employees: [] }
  }
})

ipcMain.handle('create-employee', async (event, data) => {
  try {
    const response = await axios.post(`${API_URL}/employees/`, data)
    return response.data
  } catch (error) {
    console.error('Erro ao criar funcionário:', error.response?.data || error.message)
    return { status: 'error', message: error.response?.data?.detail || error.message }
  }
})

// --- PERMISSIONS ---
ipcMain.handle('list-permissions', async (event, certId) => {
  try {
    const response = await axios.get(`${API_URL}/certificates/${certId}/permissions`)
    return response.data
  } catch (error) {
    console.error('Erro ao listar permissões:', error.message)
    return { status: 'error', permissions: [] }
  }
})

ipcMain.handle('grant-permission', async (event, { employeeId, certificateId }) => {
  try {
    const response = await axios.post(`${API_URL}/permissions/grant`, {
      employee_id: employeeId,
      certificate_id: certificateId
    })
    return response.data
  } catch (error) {
    console.error('Erro ao conceder permissão:', error.response?.data || error.message)
    return { status: 'error', message: error.response?.data?.detail || error.message }
  }
})

ipcMain.handle('revoke-permission', async (event, permId) => {
  try {
    const response = await axios.post(`${API_URL}/permissions/revoke/${permId}`)
    return response.data
  } catch (error) {
    console.error('Erro ao revogar permissão:', error.response?.data?.detail || error.message)
    return { status: 'error', message: error.response?.data?.detail || error.message }
  }
})

// --- WINDOW ---
ipcMain.handle('minimize-window', () => {
  if (mainWindow) mainWindow.minimize()
})
ipcMain.handle('maximize-window', () => {
  if (mainWindow) {
    mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize()
  }
})
ipcMain.handle('close-window', () => {
  if (mainWindow) mainWindow.close()
})

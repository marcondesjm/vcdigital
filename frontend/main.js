const { app, BrowserWindow, ipcMain, dialog } = require('electron')
const path = require('path')
const axios = require('axios')

const API_URL = 'http://localhost:8001'

let mainWindow

function createWindow() {
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
}

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

// ============================================
// IPC HANDLERS — Comunicação segura Frontend → Backend
// ============================================

// --- AUTH ---
ipcMain.handle('login', async (event, { email, password }) => {
  const response = await axios.post(`${API_URL}/login/`, { email, password })
  return response.data
})

// --- CLIENTS ---
ipcMain.handle('create-client', async (event, { name, document }) => {
  const response = await axios.post(`${API_URL}/clients/`, { name, document })
  return response.data
})

ipcMain.handle('list-clients', async () => {
  const response = await axios.get(`${API_URL}/clients/`)
  return response.data
})

ipcMain.handle('get-client', async (event, clientId) => {
  const response = await axios.get(`${API_URL}/clients/${clientId}`)
  return response.data
})

// --- CERTIFICATES ---
ipcMain.handle('select-file', async (event, filters) => {
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
  form.append('cert_model', certModel)  // Modelo agnóstico: A1, A3, A4, SE, etc.
  form.append('cert_type', certType)   // 'file', 'token', 'hardware'
  form.append('employee_id', employeeId || '')

  const response = await axios.post(`${API_URL}/upload-certificate/`, form, {
    headers: form.getHeaders(),
  })
  return response.data
})

ipcMain.handle('list-client-certificates', async (event, clientId) => {
  const response = await axios.get(`${API_URL}/clients/${clientId}/certificates`)
  return response.data
})

ipcMain.handle('revoke-certificate', async (event, { certId, employeeId }) => {
  const response = await axios.delete(
    `${API_URL}/certificates/${certId}?employee_id=${employeeId}`
  )
  return response.data
})

// --- SIGN PDF ---
ipcMain.handle('sign-pdf', async (event, { pdfPath, certificateId, employeeId }) => {
  const fs = require('fs')
  const FormData = require('form-data')
  const form = new FormData()
  form.append('pdf_file', fs.createReadStream(pdfPath))
  form.append('certificate_id', certificateId)
  form.append('employee_id', employeeId)

  const response = await axios.post(`${API_URL}/sign-pdf/`, form, {
    headers: form.getHeaders(),
    maxBodyLength: Infinity,
    maxContentLength: Infinity,
  })
  return response.data
})

// --- AUDIT LOGS ---
ipcMain.handle('get-audit-logs', async (event, { clientId, status }) => {
  const params = status ? `?status=${status}` : ''
  const response = await axios.get(`${API_URL}/audit-logs/${clientId}${params}`)
  return response.data
})

// --- EMPLOYEES ---
ipcMain.handle('list-employees', async (event, tenantId) => {
  const response = await axios.get(`${API_URL}/employees/?tenant_id=${tenantId}`)
  return response.data
})

ipcMain.handle('create-employee', async (event, data) => {
  const response = await axios.post(`${API_URL}/employees/`, data)
  return response.data
})

// --- PERMISSIONS ---
ipcMain.handle('list-permissions', async (event, certId) => {
  const response = await axios.get(`${API_URL}/certificates/${certId}/permissions`)
  return response.data
})

ipcMain.handle('grant-permission', async (event, { employeeId, certificateId }) => {
  const response = await axios.post(`${API_URL}/permissions/grant`, { employeeId, certificateId })
  return response.data
})

ipcMain.handle('revoke-permission', async (event, permId) => {
  const response = await axios.post(`${API_URL}/permissions/revoke/${permId}`)
  return response.data
})

// --- JANELA ---
ipcMain.handle('minimize-window', () => mainWindow.minimize())
ipcMain.handle('maximize-window', () => {
  mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize()
})
ipcMain.handle('close-window', () => mainWindow.close())
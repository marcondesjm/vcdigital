const { contextBridge, ipcRenderer } = require('electron')

// Detecta se está rodando no Electron
const isElectron = typeof ipcRenderer !== 'undefined'

// Expõe APIs seguras ao contexto do React
contextBridge.exposeInMainWorld('api', {
  // Auth
  login: (data) => isElectron ? ipcRenderer.invoke('login', data) : fetch('/api/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  }).then(res => res.json()),

  // Clientes
  createClient: (data) => isElectron ? ipcRenderer.invoke('create-client', data) : fetch('/api/clients/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  }).then(res => res.json()),

  listClients: () => isElectron ? ipcRenderer.invoke('list-clients') : fetch('/api/clients/').then(res => res.json()),

  getClient: (clientId) => isElectron ? ipcRenderer.invoke('get-client', clientId) : fetch(`/api/clients/${clientId}`).then(res => res.json()),

  // Certificados
  selectFile: (filters) => isElectron ? ipcRenderer.invoke('select-file', filters) : Promise.resolve({ canceled: false, filePaths: [] }),

  uploadCertificate: (data) => isElectron ? ipcRenderer.invoke('upload-certificate', data) : {
    // Em web, o upload é feito pelo browser
    status: 'web-upload',
    message: 'Upload de certificados não suportado no modo web',
  },

  listClientCertificates: (clientId) => isElectron ? ipcRenderer.invoke('list-client-certificates', clientId) : fetch(`/api/clients/${clientId}/certificates`).then(res => res.json()),

  revokeCertificate: (data) => isElectron ? ipcRenderer.invoke('revoke-certificate', data) : fetch(`/api/certificates/${data.certId}?employee_id=${data.employeeId}`, {
    method: 'DELETE',
  }).then(res => res.json()),

  // Assinatura
  signPdf: (data) => isElectron ? ipcRenderer.invoke('sign-pdf', data) : {
    // Em web, a assinatura é feita pelo browser
    status: 'web-sign',
    message: 'Assinatura de PDFs não suportada no modo web',
  },

  // Auditoria
  listAuditLogs: (data) => isElectron ? ipcRenderer.invoke('get-audit-logs', data) : fetch(`/api/audit-logs/${data.clientId}${data.status ? `?status=${data.status}` : ''}`).then(res => res.json()),

  // Funcionários
  listEmployees: (tenantId) => isElectron ? ipcRenderer.invoke('list-employees', tenantId) : fetch(`/api/employees/?tenant_id=${tenantId}`).then(res => res.json()),

  createEmployee: (data) => isElectron ? ipcRenderer.invoke('create-employee', data) : fetch('/api/employees/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  }).then(res => res.json()),

  // Permissões
  listPermissions: (certId) => isElectron ? ipcRenderer.invoke('list-permissions', certId) : fetch(`/api/certificates/${certId}/permissions`).then(res => res.json()),

  grantPermission: (data) => isElectron ? ipcRenderer.invoke('grant-permission', data) : fetch('/api/permissions/grant', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  }).then(res => res.json()),

  revokePermission: (permId) => isElectron ? ipcRenderer.invoke('revoke-permission', permId) : fetch(`/api/permissions/revoke/${permId}`, {
    method: 'POST',
  }).then(res => res.json()),

  // Janela
  minimize: () => isElectron && ipcRenderer.invoke('minimize-window'),
  maximize: () => isElectron && ipcRenderer.invoke('maximize-window'),
  close: () => isElectron && ipcRenderer.invoke('close-window'),

  // Detecta se está rodando no Electron
  isElectron: isElectron,
})

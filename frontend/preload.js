const { contextBridge, ipcRenderer } = require('electron')

// Expõe APIs seguras ao contexto do React
contextBridge.exposeInMainWorld('api', {
  // Auth
  login: (data) => ipcRenderer.invoke('login', data),

  // Clientes
  createClient: (data) => ipcRenderer.invoke('create-client', data),
  listClients: () => ipcRenderer.invoke('list-clients'),
  getClient: (clientId) => ipcRenderer.invoke('get-client', clientId),

  // Certificados
  selectFile: (filters) => ipcRenderer.invoke('select-file', filters),
  uploadCertificate: (data) => ipcRenderer.invoke('upload-certificate', data),
  listClientCertificates: (clientId) => ipcRenderer.invoke('list-client-certificates', clientId),
  revokeCertificate: (data) => ipcRenderer.invoke('revoke-certificate', data),

  // Assinatura
  signPdf: (data) => ipcRenderer.invoke('sign-pdf', data),

  // Auditoria
  listAuditLogs: (data) => ipcRenderer.invoke('get-audit-logs', data),

  // Funcionários
  listEmployees: (tenantId) => ipcRenderer.invoke('list-employees', tenantId),
  createEmployee: (data) => ipcRenderer.invoke('create-employee', data),

  // Permissões
  listPermissions: (certId) => ipcRenderer.invoke('list-permissions', certId),
  grantPermission: (data) => ipcRenderer.invoke('grant-permission', data),
  revokePermission: (permId) => ipcRenderer.invoke('revoke-permission', permId),

  // Janela
  minimize: () => ipcRenderer.invoke('minimize-window'),
  maximize: () => ipcRenderer.invoke('maximize-window'),
  close: () => ipcRenderer.invoke('close-window'),
})

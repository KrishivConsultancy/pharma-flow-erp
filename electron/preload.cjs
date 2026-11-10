const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  printToPDF: (options) => ipcRenderer.invoke('print-to-pdf', options),
  exportInvoicePdf: (options) => ipcRenderer.invoke('export-invoice-pdf', options),
  lookupGstin: (payload) => ipcRenderer.invoke('lookup-gstin', payload),
  scanInvoiceGemini: (payload) => ipcRenderer.invoke('scan-invoice-gemini', payload),
  checkForUpdates: () => ipcRenderer.invoke('updater:check'),
  quitAndInstall: () => ipcRenderer.invoke('updater:install'),
  onUpdaterStatus: (callback) => {
    const handler = (event, data) => callback(data);
    ipcRenderer.on('updater:status', handler);
    return () => ipcRenderer.removeListener('updater:status', handler);
  },
  platform: process.platform,
});

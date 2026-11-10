const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { autoUpdater } = require('electron-updater');

let mainWindow;

// Configure autoUpdater behavior
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;

function setupAutoUpdater() {
  autoUpdater.on('checking-for-update', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('updater:status', { status: 'checking' });
    }
  });

  autoUpdater.on('update-available', (info) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('updater:status', {
        status: 'available',
        version: info.version,
        releaseDate: info.releaseDate,
      });
    }
  });

  autoUpdater.on('update-not-available', (info) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('updater:status', {
        status: 'not-available',
        version: info?.version,
      });
    }
  });

  autoUpdater.on('download-progress', (progressObj) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('updater:status', {
        status: 'downloading',
        percent: Math.round(progressObj.percent || 0),
        bytesPerSecond: progressObj.bytesPerSecond,
        transferred: progressObj.transferred,
        total: progressObj.total,
      });
    }
  });

  autoUpdater.on('update-downloaded', (info) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('updater:status', {
        status: 'downloaded',
        version: info.version,
      });
    }
  });

  autoUpdater.on('error', (err) => {
    console.warn('AutoUpdater background error:', err ? err.message : 'Unknown');
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('updater:status', {
        status: 'error',
        message: err ? err.message : 'Update check failed',
      });
    }
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1366,
    height: 860,
    minWidth: 1024,
    minHeight: 700,
    title: 'RADHA DRUGS | Wholesale Medicine Dealer ERP',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs'),
      webSecurity: false, // Prevents external API CORS blocks in desktop client
    },
    autoHideMenuBar: false,
    backgroundColor: '#f8fafc',
  });

  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(app.getAppPath(), 'dist', 'index.html'));
  }

  mainWindow.webContents.once('did-finish-load', () => {
    if (app.isPackaged) {
      autoUpdater.checkForUpdatesAndNotify().catch((err) => {
        console.warn('Auto-update initial check error:', err ? err.message : 'Unknown');
      });
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  setupAutoUpdater();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC: Native Print to PDF buffer
ipcMain.handle('print-to-pdf', async (event, options) => {
  if (!mainWindow) return null;
  return await mainWindow.webContents.printToPDF(options || {});
});

// IPC: Native Export Invoice PDF with Save Dialog
ipcMain.handle('export-invoice-pdf', async (event, { invoiceNo, isHalfPage }) => {
  if (!mainWindow) return { ok: false, error: 'Window not available' };
  try {
    const defaultFilename = `${invoiceNo || 'Invoice'}.pdf`;
    const saveResult = await dialog.showSaveDialog(mainWindow, {
      title: 'Save Invoice PDF',
      defaultPath: defaultFilename,
      filters: [{ name: 'PDF Documents', extensions: ['pdf'] }],
    });

    if (saveResult.canceled || !saveResult.filePath) {
      return { ok: false, canceled: true };
    }

    const pdfBuffer = await mainWindow.webContents.printToPDF({
      landscape: Boolean(isHalfPage),
      pageSize: isHalfPage ? 'A5' : 'A4',
      printBackground: true,
      margins: { marginType: 'none' },
    });

    await fs.promises.writeFile(saveResult.filePath, pdfBuffer);
    return { ok: true, filePath: saveResult.filePath };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

// IPC: Multi-Tier Live GSTIN Resolution in Node.js
ipcMain.handle('lookup-gstin', async (event, { gstin, cashfreeClientId, cashfreeClientSecret, isSandbox }) => {
  const cleanGstin = (gstin || '').trim().toUpperCase();
  if (cleanGstin.length !== 15) {
    return { ok: false, error: 'Invalid GSTIN length' };
  }

  // Tier 1: Cashfree Verification API (VRS v2)
  if (cashfreeClientId && cashfreeClientSecret) {
    try {
      const baseUrl = isSandbox
        ? 'https://sandbox.cashfree.com/verification/gstin'
        : 'https://api.cashfree.com/verification/gstin';

      const res = await fetch(baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-client-id': cashfreeClientId,
          'x-client-secret': cashfreeClientSecret,
        },
        body: JSON.stringify({ GSTIN: cleanGstin, gstin: cleanGstin }),
      });

      if (res.ok) {
        const rawData = await res.json();
        const split = rawData.principal_place_split_address || {};
        const fullAddress = rawData.principal_place_address || rawData.address || '';
        const tradeName = rawData.trade_name_of_business || rawData.trade_name || rawData.legal_name_of_business || rawData.legal_name || '';
        const legalName = rawData.legal_name_of_business || rawData.legal_name || tradeName;
        const status = (rawData.gst_in_status || rawData.status || 'ACTIVE').toUpperCase();
        const city = (split.city || split.location || split.district || rawData.city || '').toUpperCase();
        const state = (split.state || rawData.state || '').toUpperCase();
        const pincode = split.pincode || rawData.pincode || (fullAddress.match(/\b\d{6}\b/)?.[0] ?? '');

        return {
          ok: true,
          source: 'CASHFREE_LIVE',
          data: {
            valid: rawData.valid !== false,
            gstin: cleanGstin,
            trade_name: tradeName.toUpperCase(),
            legal_name: legalName.toUpperCase(),
            address: fullAddress.toUpperCase(),
            city,
            state_name: state,
            state_code: cleanGstin.substring(0, 2),
            pincode,
            gst_status: status === 'ACTIVE' || status === 'VALID' ? 'ACTIVE' : 'CANCELLED',
          },
        };
      } else {
        const errJson = await res.json().catch(() => ({}));
        console.warn('Cashfree API responded with status:', res.status, errJson);
        if (errJson && errJson.code === 'ip_validation_failed') {
          return {
            ok: false,
            error: errJson.message || 'Cashfree IP not whitelisted',
            isIpError: true,
          };
        }
      }
    } catch (cfErr) {
      console.warn('Tier 1 Cashfree lookup failed in Node process:', cfErr.message);
    }
  }

  // Tier 2: Public GSTIN Resolution Endpoint
  try {
    const pubUrl = `https://sheet.gstincheck.co.in/check/${cleanGstin}`;
    const pubRes = await fetch(pubUrl, { method: 'GET', signal: AbortSignal.timeout(5000) });
    if (pubRes.ok) {
      const pubData = await pubRes.json();
      if (pubData && pubData.flag && pubData.data) {
        const d = pubData.data;
        const addr = d.pradr?.addr || {};
        const fullAddr = [addr.bno, addr.bnm, addr.st, addr.loc, addr.dst, addr.stcd, addr.pncd].filter(Boolean).join(', ');

        return {
          ok: true,
          source: 'PUBLIC_GST_DIRECTORY',
          data: {
            valid: true,
            gstin: cleanGstin,
            trade_name: (d.tradeNam || d.lgnm || '').toUpperCase(),
            legal_name: (d.lgnm || d.tradeNam || '').toUpperCase(),
            address: (fullAddr || '').toUpperCase(),
            city: (addr.dst || addr.city || '').toUpperCase(),
            state_name: (addr.stcd || '').toUpperCase(),
            state_code: cleanGstin.substring(0, 2),
            pincode: String(addr.pncd || ''),
            gst_status: (d.sts || 'ACTIVE').toUpperCase() === 'ACTIVE' ? 'ACTIVE' : 'CANCELLED',
          },
        };
      }
    }
  } catch (pubErr) {
    console.warn('Tier 2 Public GST lookup failed in Node process:', pubErr.message);
  }

  return { ok: false, error: 'Could not resolve online' };
});

// IPC: Gemini Vision Multimodal Invoice Scanner with Multi-Model Waterfall Fallback
ipcMain.handle('scan-invoice-gemini', async (event, { apiKey, base64Data, mimeType, promptText }) => {
  const key = apiKey || process.env.VITE_GEMINI_API_KEY || 'AQ.Ab8RN6KUF0ci2iNcvzDi1i8zp4SexEw2ttH2hm_PA6uUEE_fag';
  const models = ['gemini-3.5-flash-lite', 'gemini-3.5-flash', 'gemini-3.8-flash', 'gemini-flash-latest'];
  let lastError = null;

  for (const model of models) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;

      const requestBody = {
        contents: [
          {
            parts: [
              { text: promptText },
              {
                inlineData: {
                  mimeType: mimeType || 'image/jpeg',
                  data: base64Data,
                },
              },
            ],
          },
        ],
        generationConfig: {
          responseMimeType: 'application/json',
        },
      };

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 25000); // 25s timeout per model

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        const errText = await response.text();
        console.warn(`Gemini model ${model} HTTP ${response.status}: ${errText}`);
        lastError = `Gemini API (${model} HTTP ${response.status}): ${errText}`;
        continue;
      }

      const resJson = await response.json();
      return { ok: true, data: resJson, modelUsed: model };
    } catch (err) {
      console.warn(`Gemini model ${model} error:`, err.message);
      lastError = `Gemini model ${model} error: ${err.message}`;
    }
  }

  return { ok: false, error: lastError || 'All Gemini Vision models failed to respond' };
});

// IPC: Auto-Updater commands
ipcMain.handle('updater:check', async () => {
  try {
    return await autoUpdater.checkForUpdates();
  } catch (err) {
    return { error: err.message };
  }
});

ipcMain.handle('updater:install', () => {
  try {
    // Cleanly close and destroy all renderer windows first so file locks on Windows are instantly released
    BrowserWindow.getAllWindows().forEach((w) => {
      try {
        w.removeAllListeners('close');
        w.destroy();
      } catch (e) {}
    });
  } catch (err) {
    console.warn('Error closing windows prior to update:', err.message);
  }

  // Allow OS 300ms to release file handles, then run silent update and force exit
  setTimeout(() => {
    try {
      autoUpdater.quitAndInstall(true, true);
    } catch (e) {
      console.warn('quitAndInstall error:', e);
    }
    // Force terminate process tree so Windows immediately releases executable locks
    setTimeout(() => {
      app.exit(0);
    }, 500);
  }, 300);
});

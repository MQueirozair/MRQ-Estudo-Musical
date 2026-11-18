const { app, BrowserWindow, Menu, shell, dialog, session, desktopCapturer, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const net = require('net');
const http = require('http');
const { spawn } = require('child_process');

// Allow smooth Web Audio metronome & YouTube IFrame API playback inside desktop shell
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

let mainWindow = null;
let splashWindow = null;
let backendProc = null;
let backendPort = 8765;
let backendExitCode = null;
let backendStderrTail = '';
let engineLogPath = '';

function findFreePort(startPort = 8765) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.unref();
    server.on('error', () => resolve(findFreePort(startPort + 1)));
    server.listen(startPort, '127.0.0.1', () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

function waitForBackend(port, timeoutMs = 60000) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const probe = () => {
      if (backendExitCode !== null) {
        const tail = backendStderrTail.trim().slice(-900);
        return reject(
          new Error(
            `O motor local MRQ encerrou inesperadamente (código ${backendExitCode}).\n\n` +
              (tail ? `Detalhes:\n${tail}\n\n` : '') +
              `Log completo: ${engineLogPath}`
          )
        );
      }
      const req = http.get(`http://127.0.0.1:${port}/api/health`, (res) => {
        res.resume();
        if (res.statusCode === 200) return resolve();
        retry();
      });
      req.on('error', retry);
      req.setTimeout(1200, () => {
        req.destroy();
        retry();
      });
    };
    const retry = () => {
      if (backendExitCode !== null) {
        return probe();
      }
      if (Date.now() > deadline) {
        const tail = backendStderrTail.trim().slice(-900);
        return reject(
          new Error(
            'O motor local de áudio MRQ não respondeu dentro do tempo esperado (60s).\n\n' +
              (tail ? `Última saída:\n${tail}\n\n` : '') +
              `Log completo: ${engineLogPath}`
          )
        );
      }
      setTimeout(probe, 300);
    };
    probe();
  });
}

function resolveBackendCommand(port) {
  const dataDir = path.join(app.getPath('userData'), 'mrq-data');
  fs.mkdirSync(dataDir, { recursive: true });
  engineLogPath = path.join(dataDir, 'engine.log');

  const env = {
    ...process.env,
    MRQ_PORT: String(port),
    MRQ_HOST: '127.0.0.1',
    MRQ_DATA_DIR: dataDir,
    PYTHONUNBUFFERED: '1',
  };

  if (app.isPackaged) {
    const exeName = process.platform === 'win32' ? 'mrq-engine.exe' : 'mrq-engine';
    const onedirPath = path.join(process.resourcesPath, 'backend', 'mrq-engine', exeName);
    const onefilePath = path.join(process.resourcesPath, 'backend', exeName);
    const sidecarPath = fs.existsSync(onedirPath) ? onedirPath : onefilePath;

    const dspLibName =
      process.platform === 'win32'
        ? 'mrq_dsp.dll'
        : process.platform === 'darwin'
        ? 'libmrq_dsp.dylib'
        : 'libmrq_dsp.so';

    env.MRQ_DSP_LIB = path.join(process.resourcesPath, 'dsp', dspLibName);
    env.MRQ_RESOURCES_DIR = process.resourcesPath;
    return { cmd: sidecarPath, args: [], cwd: path.dirname(sidecarPath), env };
  }

  // Development mode: run repo Python backend directly
  const repoRoot = path.resolve(__dirname, '..', '..');
  const venvPy =
    process.platform === 'win32'
      ? path.join(repoRoot, '.venv', 'Scripts', 'python.exe')
      : path.join(repoRoot, '.venv', 'bin', 'python');
  const pythonCmd = fs.existsSync(venvPy) ? venvPy : process.platform === 'win32' ? 'python' : 'python3';
  return { cmd: pythonCmd, args: ['-m', 'backend.main'], cwd: repoRoot, env };
}

function createSplashWindow() {
  splashWindow = new BrowserWindow({
    width: 440,
    height: 220,
    frame: false,
    resizable: false,
    center: true,
    backgroundColor: '#090D16',
    show: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  const html = `<!doctype html>
  <html lang="pt-BR"><head><meta charset="utf-8" />
  <style>
    body{margin:0;height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;
    background:#090D16;color:#E2E8F0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
    border:1px solid #1E293B;box-sizing:border-box;user-select:none;}
    .title{font-size:20px;font-weight:700;letter-spacing:.4px;color:#F8FAFC;margin-bottom:6px;}
    .sub{font-size:12px;color:#94A3B8;margin-bottom:18px;}
    .bar{width:220px;height:4px;background:#1E293B;border-radius:99px;overflow:hidden;}
    .fill{width:45%;height:100%;background:linear-gradient(90deg,#38BDF8,#6366F1);animation:m 1.1s infinite ease-in-out;}
    @keyframes m{0%{transform:translateX(-100%)}100%{transform:translateX(260%)}}
  </style></head>
  <body>
    <div class="title">MRQ Estudo Musical</div>
    <div class="sub">Iniciando motor nativo de áudio C++17 &amp; IA local...</div>
    <div class="bar"><div class="fill"></div></div>
  </body></html>`;
  splashWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
}

async function startBackend() {
  backendPort = await findFreePort(8765);
  backendExitCode = null;
  backendStderrTail = '';
  const { cmd, args, cwd, env } = resolveBackendCommand(backendPort);

  if (!fs.existsSync(cmd) && app.isPackaged) {
    throw new Error(`Executável do motor local não encontrado em: ${cmd}`);
  }

  // Keep the previous session and rotate on startup instead of erasing diagnostics.
  try {
    if (fs.existsSync(engineLogPath) && fs.statSync(engineLogPath).size >= 5 * 1024 * 1024) {
      fs.rmSync(`${engineLogPath}.1`, { force: true });
      fs.renameSync(engineLogPath, `${engineLogPath}.1`);
    }
  } catch (err) {
    console.error('[MRQ] Falha ao rotacionar log:', err);
  }
  const logStream = fs.createWriteStream(engineLogPath, { flags: 'a' });
  logStream.on('error', (err) => console.error('[MRQ] Falha ao gravar log do motor:', err));
  logStream.write(`[${new Date().toISOString()}] Starting: ${cmd} ${args.join(' ')}\n`);
  logStream.write(`[${new Date().toISOString()}] CWD: ${cwd}\n`);
  logStream.write(`[${new Date().toISOString()}] MRQ_DSP_LIB: ${env.MRQ_DSP_LIB || '(default)'}\n`);

  backendProc = spawn(cmd, args, { cwd, env, stdio: 'pipe', windowsHide: true });

  backendProc.stdout.on('data', (d) => {
    const txt = d.toString();
    logStream.write(txt);
    process.stdout.write(`[mrq-engine] ${txt}`);
  });
  backendProc.stderr.on('data', (d) => {
    const txt = d.toString();
    logStream.write(txt);
    backendStderrTail = (backendStderrTail + txt).slice(-4000);
    process.stderr.write(`[mrq-engine] ${txt}`);
  });
  backendProc.on('error', (err) => {
    logStream.write(`[spawn error] ${err.stack || err.message}\n`);
    backendStderrTail += `\n[spawn error] ${err.message}\n`;
    backendExitCode = -1;
  });
  backendProc.on('exit', (code) => {
    backendExitCode = code === null ? -1 : code;
    logStream.write(`[exit] code=${backendExitCode}\n`);
    logStream.end();
    console.log(`[mrq-engine] exited with code ${backendExitCode}`);
  });

  await waitForBackend(backendPort, 60000);
}

function stopBackend() {
  if (backendProc && !backendProc.killed) {
    try {
      backendProc.kill('SIGTERM');
    } catch {
      // ignore
    }
    backendProc = null;
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 980,
    minHeight: 680,
    backgroundColor: '#090D16',
    title: 'MRQ Estudo Musical',
    autoHideMenuBar: process.platform !== 'darwin',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadURL(`http://127.0.0.1:${backendPort}`);

  mainWindow.once('ready-to-show', () => {
    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.close();
      splashWindow = null;
    }
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  if (process.platform === 'darwin') {
    const template = [
      {
        label: 'MRQ Estudo Musical',
        submenu: [{ role: 'about' }, { type: 'separator' }, { role: 'quit' }],
      },
      {
        label: 'Editar',
        submenu: [{ role: 'undo' }, { role: 'redo' }, { type: 'separator' }, { role: 'cut' }, { role: 'copy' }, { role: 'paste' }],
      },
      {
        label: 'Janela',
        submenu: [{ role: 'minimize' }, { role: 'zoom' }, { role: 'togglefullscreen' }],
      },
    ];
    Menu.setApplicationMenu(Menu.buildFromTemplate(template));
  }
}

app.whenReady().then(async () => {
  ipcMain.handle('mrq:show-engine-log', (event) => {
    if (!mainWindow || event.sender !== mainWindow.webContents || event.senderFrame !== mainWindow.webContents.mainFrame || !engineLogPath || !fs.existsSync(engineLogPath)) return false;
    shell.showItemInFolder(engineLogPath);
    return true;
  });
  // Grant local media & system audio capture permissions for the MRQ Studio window
  try {
    const isLocalOrigin = (url = '') => {
      try {
        const parsed = new URL(url);
        return parsed.protocol === 'http:' && parsed.hostname === '127.0.0.1' && parsed.port === String(backendPort);
      } catch {
        return false;
      }
    };

    const generalPermissions = new Set([
      'fullscreen',
      'mediaKeySystem',
      'speaker-selection',
      'clipboard-read',
      'clipboard-sanitized-write',
    ]);
    const localCapturePermissions = new Set(['media', 'audioCapture', 'display-capture']);

    session.defaultSession.setPermissionRequestHandler((webContents, permission, callback, details) => {
      if (generalPermissions.has(permission)) {
        callback(true);
        return;
      }
      if (localCapturePermissions.has(permission)) {
        const reqUrl = (details && details.requestingUrl) || (webContents && webContents.getURL()) || '';
        callback(isLocalOrigin(reqUrl));
        return;
      }
      callback(false);
    });

    session.defaultSession.setPermissionCheckHandler((webContents, permission, requestingOrigin) => {
      if (generalPermissions.has(permission)) return true;
      if (localCapturePermissions.has(permission)) {
        const origin = requestingOrigin || (webContents && webContents.getURL()) || '';
        return isLocalOrigin(origin);
      }
      return false;
    });

    // Enable native System Audio Loopback (Windows WASAPI / macOS ScreenCaptureKit) via getDisplayMedia()
    session.defaultSession.setDisplayMediaRequestHandler(
      async (request, callback) => {
        if (!isLocalOrigin(request.securityOrigin || '')) {
          callback({});
          return;
        }
        try {
          const sources = await desktopCapturer.getSources({
            types: ['screen'],
            thumbnailSize: { width: 1, height: 1 },
          });
          if (sources && sources.length > 0) {
            callback({ video: sources[0], audio: 'loopback' });
          } else {
            callback({});
          }
        } catch (err) {
          console.error('[MRQ] desktopCapturer loopback error:', err);
          callback({});
        }
      },
      { useSystemPicker: false }
    );
  } catch (err) {
    console.error('[MRQ] permission/loopback setup warning:', err);
  }

  // Ensure official YouTube IFrame Player embeds always receive a valid Referer header (prevents YT Error 153)
  try {
    session.defaultSession.webRequest.onBeforeSendHeaders(
      {
        urls: [
          'https://www.youtube.com/embed/*',
          'https://www.youtube-nocookie.com/embed/*',
          'https://www.youtube.com/iframe_api*',
          'https://www.youtube.com/s/player/*',
        ],
      },
      (details, callback) => {
        const headers = { ...details.requestHeaders };
        if (!headers['Referer'] || headers['Referer'].startsWith('file://')) {
          headers['Referer'] = `http://127.0.0.1:${backendPort}/`;
        }
        callback({ requestHeaders: headers });
      }
    );
  } catch {
    // ignore if webRequest unavailable
  }

  createSplashWindow();
  try {
    await startBackend();
    createWindow();
  } catch (err) {
    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.close();
      splashWindow = null;
    }
    dialog.showErrorBox('Erro ao iniciar MRQ Estudo Musical', String(err.message || err));
    app.quit();
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('before-quit', () => {
  stopBackend();
});

app.on('window-all-closed', () => {
  stopBackend();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

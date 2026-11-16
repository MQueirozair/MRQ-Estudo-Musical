const { app, BrowserWindow, Menu, shell, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const net = require('net');
const http = require('http');
const { spawn } = require('child_process');

let mainWindow = null;
let backendProc = null;
let backendPort = 8765;

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

function waitForBackend(port, timeoutMs = 25000) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const probe = () => {
      const req = http.get(`http://127.0.0.1:${port}/api/health`, (res) => {
        res.resume();
        if (res.statusCode === 200) return resolve();
        retry();
      });
      req.on('error', retry);
      req.setTimeout(1000, () => {
        req.destroy();
        retry();
      });
    };
    const retry = () => {
      if (Date.now() > deadline) {
        return reject(new Error('O motor local de áudio MRQ não respondeu dentro do tempo esperado.'));
      }
      setTimeout(probe, 300);
    };
    probe();
  });
}

function resolveBackendCommand(port) {
  const dataDir = path.join(app.getPath('userData'), 'mrq-data');
  fs.mkdirSync(dataDir, { recursive: true });
  const env = {
    ...process.env,
    MRQ_PORT: String(port),
    MRQ_HOST: '127.0.0.1',
    MRQ_DATA_DIR: dataDir,
  };

  if (app.isPackaged) {
    const exeName = process.platform === 'win32' ? 'mrq-engine.exe' : 'mrq-engine';
    const sidecarPath = path.join(process.resourcesPath, 'backend', exeName);
    const dspLibName =
      process.platform === 'win32'
        ? 'mrq_dsp.dll'
        : process.platform === 'darwin'
        ? 'libmrq_dsp.dylib'
        : 'libmrq_dsp.so';
    env.MRQ_DSP_LIB = path.join(process.resourcesPath, 'dsp', dspLibName);
    return { cmd: sidecarPath, args: [], cwd: process.resourcesPath, env };
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

async function startBackend() {
  backendPort = await findFreePort(8765);
  const { cmd, args, cwd, env } = resolveBackendCommand(backendPort);
  backendProc = spawn(cmd, args, { cwd, env, stdio: 'pipe' });
  backendProc.stdout.on('data', (d) => process.stdout.write(`[mrq-engine] ${d}`));
  backendProc.stderr.on('data', (d) => process.stderr.write(`[mrq-engine] ${d}`));
  backendProc.on('exit', (code) => {
    console.log(`[mrq-engine] exited with code ${code}`);
  });
  await waitForBackend(backendPort);
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
  try {
    await startBackend();
    createWindow();
  } catch (err) {
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

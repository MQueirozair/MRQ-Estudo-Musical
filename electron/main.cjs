const { app, BrowserWindow, shell, Menu, ipcMain, dialog, nativeTheme } = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');

const isDev = !!process.env.VITE_DEV_SERVER_URL;
const APP_NAME = 'MRQ Estudo Musical';

// Pasta de dados local do usuário (Windows: %APPDATA%, macOS: ~/Library/Application Support)
const dataDir = path.join(app.getPath('userData'), 'dados');

async function ensureDir() {
  await fs.mkdir(dataDir, { recursive: true });
}

function safeName(key) {
  return String(key).replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120);
}

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 940,
    minWidth: 1024,
    minHeight: 680,
    backgroundColor: '#0b0f1a',
    show: false,
    title: APP_NAME,
    autoHideMenuBar: process.platform !== 'darwin',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      spellcheck: false,
    },
  });

  mainWindow.once('ready-to-show', () => mainWindow.show());

  // Links externos abrem no navegador padrão, nunca dentro do app
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });

  if (isDev) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function buildMenu() {
  const isMac = process.platform === 'darwin';
  const template = [
    ...(isMac
      ? [
          {
            label: APP_NAME,
            submenu: [
              { role: 'about', label: 'Sobre o MRQ Estudo Musical' },
              { type: 'separator' },
              { role: 'hide', label: 'Ocultar' },
              { role: 'hideOthers', label: 'Ocultar Outros' },
              { role: 'unhide', label: 'Mostrar Tudo' },
              { type: 'separator' },
              { role: 'quit', label: 'Sair' },
            ],
          },
        ]
      : []),
    {
      label: 'Arquivo',
      submenu: [
        {
          label: 'Exportar meus dados (backup)…',
          click: async () => {
            const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
              title: 'Salvar backup',
              defaultPath: `mrq-estudo-musical-backup-${new Date().toISOString().slice(0, 10)}.json`,
              filters: [{ name: 'JSON', extensions: ['json'] }],
            });
            if (canceled || !filePath) return;
            const all = await readAllData();
            await fs.writeFile(filePath, JSON.stringify(all, null, 2), 'utf8');
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              message: 'Backup salvo com sucesso!',
              detail: filePath,
            });
          },
        },
        {
          label: 'Importar backup…',
          click: async () => {
            const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
              title: 'Abrir backup',
              properties: ['openFile'],
              filters: [{ name: 'JSON', extensions: ['json'] }],
            });
            if (canceled || !filePaths[0]) return;
            try {
              const raw = await fs.readFile(filePaths[0], 'utf8');
              const data = JSON.parse(raw);
              for (const [key, value] of Object.entries(data)) {
                await fs.writeFile(
                  path.join(dataDir, `${safeName(key)}.json`),
                  JSON.stringify(value),
                  'utf8',
                );
              }
              mainWindow?.webContents.send('dados:importados');
              dialog.showMessageBox(mainWindow, {
                type: 'info',
                message: 'Backup restaurado!',
                detail: 'Reinicie o aplicativo para carregar os dados importados.',
              });
            } catch (err) {
              dialog.showMessageBox(mainWindow, {
                type: 'error',
                message: 'Não foi possível importar o backup.',
                detail: String(err),
              });
            }
          },
        },
        { type: 'separator' },
        {
          label: 'Abrir pasta de dados',
          click: () => shell.openPath(dataDir),
        },
        { type: 'separator' },
        isMac ? { role: 'close', label: 'Fechar janela' } : { role: 'quit', label: 'Sair' },
      ],
    },
    {
      label: 'Editar',
      submenu: [
        { role: 'undo', label: 'Desfazer' },
        { role: 'redo', label: 'Refazer' },
        { type: 'separator' },
        { role: 'cut', label: 'Recortar' },
        { role: 'copy', label: 'Copiar' },
        { role: 'paste', label: 'Colar' },
        { role: 'selectAll', label: 'Selecionar tudo' },
      ],
    },
    {
      label: 'Exibir',
      submenu: [
        { role: 'reload', label: 'Recarregar' },
        { role: 'toggleDevTools', label: 'Ferramentas de desenvolvedor' },
        { type: 'separator' },
        { role: 'resetZoom', label: 'Tamanho normal' },
        { role: 'zoomIn', label: 'Ampliar' },
        { role: 'zoomOut', label: 'Reduzir' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: 'Tela cheia' },
        ...(isMac
          ? [{ type: 'separator' }, { role: 'front', label: 'Trazer tudo para frente' }]
          : []),
      ],
    },
    {
      label: 'Ajuda',
      submenu: [
        {
          label: 'Site do projeto',
          click: () => shell.openExternal('https://github.com/MQueirozair/MRQ-Estudo-Musical'),
        },
        {
          label: 'Atalhos de teclado',
          click: () =>
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              message: 'Atalhos',
              detail:
                'A–K: tocar notas (Dó a Si)\n' +
                '← / →: acorde anterior / próximo\n' +
                '↑ / ↓: oitava dos graves\n' +
                'Espaço: tocar o acorde\n' +
                'Esc: parar o som',
            }),
        },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

async function readAllData() {
  await ensureDir();
  const files = await fs.readdir(dataDir);
  const out = {};
  for (const f of files) {
    if (!f.endsWith('.json')) continue;
    try {
      out[f.replace(/\.json$/, '')] = JSON.parse(await fs.readFile(path.join(dataDir, f), 'utf8'));
    } catch {
      /* ignora arquivos corrompidos */
    }
  }
  return out;
}

// ---- IPC de armazenamento local (um JSON por chave) ----
ipcMain.handle('store:get', async (_e, key) => {
  try {
    const raw = await fs.readFile(path.join(dataDir, `${safeName(key)}.json`), 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
});

ipcMain.handle('store:set', async (_e, key, value) => {
  await ensureDir();
  const tmp = path.join(dataDir, `${safeName(key)}.json.tmp`);
  const dest = path.join(dataDir, `${safeName(key)}.json`);
  await fs.writeFile(tmp, JSON.stringify(value), 'utf8');
  await fs.rename(tmp, dest);
  return true;
});

ipcMain.handle('store:remove', async (_e, key) => {
  try {
    await fs.unlink(path.join(dataDir, `${safeName(key)}.json`));
  } catch {
    /* nada a remover */
  }
  return true;
});

ipcMain.handle('app:info', () => ({
  version: app.getVersion(),
  platform: process.platform,
  dataDir,
  electron: process.versions.electron,
}));

ipcMain.handle('app:setTheme', (_e, theme) => {
  nativeTheme.themeSource = theme === 'light' ? 'light' : 'dark';
  return nativeTheme.shouldUseDarkColors;
});

app.whenReady().then(async () => {
  await ensureDir();
  app.setName(APP_NAME);
  buildMenu();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

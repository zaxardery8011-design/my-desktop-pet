const path = require('node:path');
const fs = require('node:fs');
const { app, BrowserWindow, ipcMain, Menu, screen } = require('electron');

let win = null;
let ignoringMouse = null;
let petScale = 1;

const scaleOptions = [0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3];

if (process.env.MRWU_PET_USER_DATA_DIR) {
  const userDataDir = path.resolve(process.env.MRWU_PET_USER_DATA_DIR);
  fs.mkdirSync(userDataDir, { recursive: true });
  app.setPath('userData', userDataDir);
}

function clampScale(value) {
  const scale = Number(value);
  if (!Number.isFinite(scale)) {
    return 1;
  }
  return Math.min(Math.max(scale, 0.5), 3);
}

function settingsPath() {
  return path.join(app.getPath('userData'), 'settings.json');
}

function readSettings() {
  try {
    const payload = JSON.parse(fs.readFileSync(settingsPath(), 'utf8'));
    petScale = clampScale(payload.petScale);
  } catch (_error) {
    petScale = 1;
  }
}

function writeSettings() {
  const file = settingsPath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify({ petScale }, null, 2), 'utf8');
}

function setPetScale(value) {
  petScale = clampScale(value);
  writeSettings();
  if (win && !win.isDestroyed()) {
    win.webContents.send('pet:scale-changed', petScale);
  }
}

function setMousePassthrough(ignore) {
  if (!win || win.isDestroyed() || ignoringMouse === ignore) {
    return;
  }

  ignoringMouse = ignore;
  if (ignore) {
    win.setIgnoreMouseEvents(true, { forward: true });
    return;
  }

  win.setIgnoreMouseEvents(false);
}

function showContextMenu(point = {}) {
  if (!win || win.isDestroyed()) {
    return;
  }

  const menu = Menu.buildFromTemplate([
    {
      label: '大小',
      submenu: scaleOptions.map((scale) => ({
        label: `${scale}x`,
        type: 'radio',
        checked: Math.abs(petScale - scale) < 0.001,
        click: () => setPetScale(scale)
      }))
    },
    { type: 'separator' },
    {
      label: '退出',
      accelerator: 'CmdOrCtrl+Q',
      click: () => app.quit()
    }
  ]);

  menu.popup({
    window: win,
    x: Math.max(0, Math.round(Number(point.x) || 0)),
    y: Math.max(0, Math.round(Number(point.y) || 0))
  });
}

function createWindow() {
  const workArea = screen.getPrimaryDisplay().workArea;

  win = new BrowserWindow({
    x: workArea.x,
    y: workArea.y,
    width: workArea.width,
    height: workArea.height,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    resizable: false,
    fullscreenable: false,
    backgroundColor: '#00000000',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false
    }
  });

  win.setMenuBarVisibility(false);
  win.setAlwaysOnTop(true, 'screen-saver');
  const loadOptions = process.env.MRWU_PET_DEBUG === '1' ? { query: { debug: '1' } } : undefined;
  win.loadFile(path.join(__dirname, 'pet.html'), loadOptions);

  win.once('ready-to-show', () => {
    win.showInactive();
    setMousePassthrough(true);
  });

  win.on('closed', () => {
    win = null;
    ignoringMouse = null;
  });
}

app.whenReady().then(() => {
  readSettings();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

ipcMain.on('pet:set-ignore-mouse-events', (_event, ignore) => {
  setMousePassthrough(Boolean(ignore));
});

ipcMain.handle('pet:get-work-area', () => screen.getPrimaryDisplay().workArea);

ipcMain.handle('pet:get-scale', () => petScale);

ipcMain.handle('pet:set-scale', (_event, scale) => {
  setPetScale(scale);
  return petScale;
});

ipcMain.on('pet:show-context-menu', (_event, point) => {
  setMousePassthrough(false);
  showContextMenu(point);
});

ipcMain.on('pet:exit', () => {
  app.quit();
});

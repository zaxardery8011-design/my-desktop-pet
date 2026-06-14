const path = require('node:path');
const { app, BrowserWindow, ipcMain, Menu, screen } = require('electron');

let win = null;
let ignoringMouse = null;

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
  win.loadFile(path.join(__dirname, 'pet.html'));

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

ipcMain.on('pet:show-context-menu', (_event, point) => {
  setMousePassthrough(false);
  showContextMenu(point);
});

ipcMain.on('pet:exit', () => {
  app.quit();
});

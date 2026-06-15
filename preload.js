const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('mrwuPet', {
  setIgnoreMouseEvents(ignore) {
    ipcRenderer.send('pet:set-ignore-mouse-events', Boolean(ignore));
  },
  showContextMenu(point) {
    ipcRenderer.send('pet:show-context-menu', point);
  },
  getWorkArea() {
    return ipcRenderer.invoke('pet:get-work-area');
  },
  getScale() {
    return ipcRenderer.invoke('pet:get-scale');
  },
  setScale(scale) {
    return ipcRenderer.invoke('pet:set-scale', scale);
  },
  onScaleChanged(callback) {
    const listener = (_event, scale) => callback(scale);
    ipcRenderer.on('pet:scale-changed', listener);
    return () => ipcRenderer.removeListener('pet:scale-changed', listener);
  },
  exit() {
    ipcRenderer.send('pet:exit');
  }
});

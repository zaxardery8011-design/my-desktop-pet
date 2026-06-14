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
  exit() {
    ipcRenderer.send('pet:exit');
  }
});

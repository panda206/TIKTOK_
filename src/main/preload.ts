import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  connect: (username: string) =>
    ipcRenderer.invoke('connect-tiktok', username),

  onViewer: (callback: any) =>
    ipcRenderer.on('viewer-count', callback),

  onLog: (cb: (msg: any) => void) =>
        ipcRenderer.on('log', (_event, data) => cb(data)),
});
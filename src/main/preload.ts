import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  connect: (username: string) =>
    ipcRenderer.invoke('connect-tiktok', username),

  onViewer: (callback: any) =>
    ipcRenderer.on('viewer-count', callback),

  onLog: (cb: (msg: any) => void) =>
        ipcRenderer.on('log', (_event, data) => cb(data)),

  startScan: () => ipcRenderer.send('start-scan'),
  stopScan: () => ipcRenderer.send('stop-scan'),
  onScanStatus: (cb: (status: string) => void) => 
        ipcRenderer.on('scan-status', (_event, data) => cb(data)),
  // 💡 新增：向渲染层抛出接收数据量更新的监听事件
  onDataCount: (cb: (count: number) => void) =>
        ipcRenderer.on('scan-data-count', (_event, data) => cb(data))
});
import { app, BrowserWindow, ipcMain } from 'electron';
import { broadcast } from "../server/ws_server";
import path from 'path';
import { start, disconnect } from '../core/tiktok';

let mainWindow: BrowserWindow;

// ============================
// 🟢 创建窗口
// ============================
function createWindow() {

    console.log('🟢 [MAIN] 创建窗口');

    mainWindow = new BrowserWindow({
        
        width: 800,
        height: 600,

        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            //devTools: false
        }
    });
    

    mainWindow.loadFile(
    path.join(__dirname, '../renderer/index.html')
);
    mainWindow.webContents.openDevTools();
    console.log('🟢 [MAIN] 窗口已加载 renderer');
}

// ============================
// 📡 发送日志到前端 UI
// ============================
function sendLog(data: any) {

    //console.log(data);

    // 发给OBS
    broadcast(data);

    // 发给Electron窗口
    if (mainWindow && mainWindow.webContents) {
        mainWindow.webContents.send(
            "tiktok-event",
            data
        );
    }
}

// ============================
// 🚀 启动应用
// ============================
app.whenReady().then(() => {

    createWindow();
    ipcMain.handle(
    "disconnect-tiktok",
    async () => {

        await disconnect();

        return true;
    }
);
    
    // ============================
    // 🎯 IPC：连接 TikTok
    // ============================
    ipcMain.handle('connect-tiktok', async (_, username: string) => {

        sendLog(`🟡 MAIN 收到请求: ${username}`);

        try {

            // ⭐ 关键：把 sendLog 传给 core 层
            await start(username, sendLog);

            sendLog('🟢 MAIN：连接完成');

            return true;

        } catch (err) {

            sendLog('🔴 MAIN：连接失败');
            sendLog(String(err));

            return false;
        }
    });
});
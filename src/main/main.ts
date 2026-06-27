import { app, BrowserWindow, ipcMain } from 'electron';
import { broadcast } from "../server/ws_server";
import path from 'path';
import { start, disconnect } from '../core/tiktok';
import { fork, ChildProcess } from 'child_process'; // 💡 新增导入

let mainWindow: BrowserWindow;
let scraperProcess: ChildProcess | null = null; // 💡 新增：用于持有全局 scraper 独立进程指针

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

    // =========================================================================
    // 💡 核心新增：大厅扫描 Scraper 进程全生命周期控制
    // =========================================================================
    
    // 1. 启动扫描大厅
    ipcMain.on('start-scan', (event) => {
        if (scraperProcess) {
            if (mainWindow && mainWindow.webContents) {
                mainWindow.webContents.send('scan-status', '运行中');
            }
            return;
        }

        console.log('🟢 [MAIN] 正在拉起大厅 Scraper 独立进程...');
        const scraperPath = path.join(__dirname, '../scanner/scraper.js');

        // 使用进程分离的 fork 启动
        scraperProcess = fork(scraperPath, [], {
            env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
            silent: true 
        });

        // =========================================================================
        // 🌟 核心修复：彻底删掉原先的 event.reply('scan-status', ...)
        // 改为直接对窗口发送初始化通知，绝不走旧通道队列
        // =========================================================================
        if (mainWindow && mainWindow.webContents) {
            mainWindow.webContents.send('scan-status', '正在初始化大厅无头浏览器...');
        }

        // 管道日志输出
        scraperProcess.stdout?.on('data', (data) => {
            console.log(`[Scraper] ${data.toString().trim()}`);
        });
        scraperProcess.stderr?.on('data', (data) => {
            console.error(`[Scraper 错误] ${data.toString().trim()}`);
        });

        // 接收来自子进程的消息通信
        scraperProcess.on('message', (msg: any) => {
            if (!msg) return;

            // 协议 1：接收计数
            if (msg.type === 'DATA_COUNT_UPDATE') {
                if (mainWindow && mainWindow.webContents) {
                    mainWindow.webContents.send('scan-data-count', msg.count);
                }
            }

            // 协议 2：接收状态（从现在起，它才是队列里的最后胜利者）
            if (msg.type === 'SCAN_STATUS_UPDATE') {
                if (mainWindow && mainWindow.webContents) {
                    mainWindow.webContents.send('scan-status', msg.status);
                }
            }
        });

        // 监听子进程正常或异常退出
        scraperProcess.on('exit', (code) => {
            console.log(`ℹ️ [MAIN] Scraper 进程已安全结束，退出码: ${code}`);
            scraperProcess = null;
            if (mainWindow && mainWindow.webContents) {
                mainWindow.webContents.send('scan-status', '🛑 扫描已停止');
            }
        });

        scraperProcess.on('error', (err) => {
            console.error('❌ [MAIN] Scraper 进程发生崩溃故障:', err);
            scraperProcess = null;
            if (mainWindow && mainWindow.webContents) {
                mainWindow.webContents.send('scan-status', '❌ 扫描器发生严重异常故障');
            }
        });
    });
    // 2. 停止扫描大厅
    ipcMain.on('stop-scan', (event) => {
        if (scraperProcess) {
            console.log('🔴 [MAIN] 正在向 Scraper 进程发送温和优雅退出指令信号 (SIGINT)...');
            
            // 向其发射 SIGINT 信号，触发 Scraper 内部的浏览器安全 close
            scraperProcess.kill('SIGINT');
            
            event.reply('scan-status', '🛑 正在停止中，正在释放无头浏览器环境...');
        } else {
            event.reply('scan-status', '等待开始');
        }
    });
});

// 在软件被强制彻底关闭前，把没有关干净的扫描子进程强行清理掉，防止后台死锁积累 Chromium 僵尸进程
app.on('will-quit', () => {
    if (scraperProcess) {
        scraperProcess.kill('SIGKILL');
        scraperProcess = null;
    }
});


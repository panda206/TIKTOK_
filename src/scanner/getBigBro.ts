import { bus } from './bus';
import { execSync } from 'child_process';
import http from 'http';
import https from 'https';
import { HttpsProxyAgent } from 'https-proxy-agent';
import fs from 'fs';
import path from 'path';
import util from 'util'; // 引入 util 彻底拆解 [object Object]

// 队列调度状态
const hostQueue: string[] = [];
let isProcessing = false;
let currentConnection: any = null;

// 数据存储路径
const DATA_STORE_PATH = path.join(__dirname, 'live_ranks_data.json');

function getUserLevel(user: any): number {
    return user?.level || user?.badgeInfo?.level || 0;
}

function saveData(host: string, topList: any[]) {
    const record = {
        host,
        timestamp: new Date().toISOString(),
        topFiveContributors: topList
    };

    try {
        let currentData: any[] = [];
        if (fs.existsSync(DATA_STORE_PATH)) {
            const fileContent = fs.readFileSync(DATA_STORE_PATH, 'utf-8');
            currentData = JSON.parse(fileContent || '[]');
        }
        currentData.push(record);
        fs.writeFileSync(DATA_STORE_PATH, JSON.stringify(currentData, null, 2), 'utf-8');
        console.log(`💾 [BigBro] @${host} 的前五贡献榜数据已成功写入本地日志。`);
    } catch (err) {
        console.error(`❌ [BigBro] 存储数据失败:`, err);
    }
}

function injectProxyFromRegistry() {
    if (process.platform !== 'win32') return;

    try {
        const result = execSync(
            `reg query "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings" /v ProxyServer`,
            { stdio: ['pipe', 'pipe', 'ignore'] }
        ).toString();

        const match = result.match(/REG_SZ\s+(?:https?:\/\/)?([\d\.]+:\d+)/);
        if (match && match[1]) {
            const proxyUrl = `http://${match[1]}`;
            console.log(`🌐 [BigBro Proxy] 检测到系统局域网代理: ${proxyUrl}，正在注入底层...`);
            
            const agent = new HttpsProxyAgent(proxyUrl);
            const originHttp = http.request;
            const originHttps = https.request;

            (http as any).request = function (...args: any[]) {
                const opt = args[0];
                if (opt && !opt.agent) opt.agent = agent;
                return originHttp.apply(this, args as any);
            };

            (https as any).request = function (...args: any[]) {
                const opt = args[0];
                if (opt && !opt.agent) opt.agent = agent;
                return originHttps.apply(this, args as any);
            };
        }
    } catch (e) {
        console.log(`ℹ️ [BigBro Proxy] 未发现系统注册表代理，将尝试直连。`);
    }
}

async function processQueue() {
    if (isProcessing || hostQueue.length === 0) return;
    isProcessing = true;

    const { TikTokLiveConnection, WebcastEvent } = await import('tiktok-live-connector');

    while (hostQueue.length > 0) {
        const nextHost = hostQueue.shift();
        if (!nextHost) continue;

        if (currentConnection) {
            try {
                console.log(`🔴 [BigBro] 正在断开旧直播间...`);
                currentConnection.removeAllListeners();
                await currentConnection.disconnect();
            } catch (err) {}
            currentConnection = null;
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        console.log(`\n🟡 [BigBro] -----------------------------------------`);
        console.log(`🟡 [BigBro] 正在尝试连接主播: @${nextHost}`);

        currentConnection = new TikTokLiveConnection(nextHost, {
            disableEulerFallbacks: false // 🌟 允许走备用路由
        });

        await new Promise<void>(async (resolve) => {
            let isResolved = false;
            let hasConnected = false;

            const finishCurrentHost = () => {
                if (!isResolved) {
                    isResolved = true;
                    
                    // 🌟 深度清理：彻底解绑所有事件，防止旧连接的 error 污染新连接
                    try { currentConnection.removeAllListeners(); } catch(e){}
                    
                    if (hasConnected) {
                        try { currentConnection.disconnect(); } catch(e){}
                    }
                    resolve();
                }
            };

            // 15 秒强制超时兜底
            const timeoutTimer = setTimeout(() => {
                console.log(`⏳ [@${nextHost}] 15秒观察时间截止，自动切换下一个...`);
                finishCurrentHost();
            }, 15000);

            // 1. 核心监听贡献榜数据
            currentConnection.on(WebcastEvent.ROOM_USER, (data: any) => {
                const ranks = data?.ranksList || [];
                if (ranks.length > 0) {
                    clearTimeout(timeoutTimer);
                    const topList = ranks.slice(0, 5).map((item: any) => {
                        const user = item.user || {};
                        return {
                            rank: item.rank,
                            user: user.uniqueId,
                            avatar: user.profilePicture?.url?.[0],
                            name: user.nickname,
                            level: getUserLevel(user),
                            coin: item.coinCount
                        };
                    });

                    console.log(`🏆 [@${nextHost}] 成功抓取前五贡献榜单(共 ${topList.length} 人)`);
                    saveData(nextHost, topList);
                    finishCurrentHost();
                }
            });

            // 2. 弱警告处理：利用 util 展开看看到底是什么 Object
            currentConnection.on('error', (err: any) => {
                // 仅作日志记录，绝不打断 Promise 流程
                console.log(`⚠️ [@${nextHost}] 内部警告:`, util.inspect(err, { depth: 1, colors: true }));
            });

            currentConnection.on('disconnected', () => {
                finishCurrentHost();
            });

            // 3. 执行异步握手
            try {
                console.log(`📡 [BigBro] 正在与直播间建立 WebSocket 握手...`);
                await currentConnection.connect();
                hasConnected = true; 
                console.log(`✅ [BigBro] 已成功进入房间，等待首帧数据派发...`);
            } catch (err) {
                if (!isResolved) {
                    console.error(`❌ [BigBro] 握手阶段直接失败 @${nextHost}`);
                    clearTimeout(timeoutTimer);
                    finishCurrentHost();
                }
            }
        });

        // 🌟 关键：将切换间隔拉长到 2.5 秒！给代理软件和 TikTok 接口充足的断开/释放时间，防止被连续风控封锁
        console.log(`💤 [BigBro] 进入安全冷却期，等待 3 秒后调度下一位...`);
        await new Promise(r => setTimeout(r, 3000));
    }

    isProcessing = false;
}

export async function startBigBro() {
    console.log('👁️ [BigBro] 监控线程启动，正在等待大厅扫描任务...');
    injectProxyFromRegistry();

    bus.on('hosts', (hosts: string[]) => {
        for (const host of hosts) {
            if (!hostQueue.includes(host)) {
                hostQueue.push(host);
                console.log(`📥 [BigBro] 收到新任务 @${host}，加入队列 (当前排队: ${hostQueue.length})`);
            }
        }
        processQueue();
    });
}
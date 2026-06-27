import { bus } from './bus';
import fs from 'fs';
import path from 'path';
import util from 'util';
import { injectProxyFromRegistry } from './proxyHelper';

// ===================== 状态 =====================

const queue: string[] = [];
const visited = new Set<string>();

let running = false;
let currentConn: any = null;

// 💡 新增：记录总成功获取的数据量
let savedCount = 0;


// ⭐ 核心修复：真正的“暂停闸门”
let pausedUntil = 0;

// 连接节流
let connectLog: number[] = [];

// 💡 允许上游 Scraper 检查当前积压了多少任务
export function getQueueLength(): number {
    return queue.length;
}

// 💡 新增：允许外部拉取当前已成功获取了多少个数据
export function getSavedCount(): number {
    return savedCount;
}



// ===================== 工具 =====================

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

// 🌟 修改：存储路径改为 CSV 表格文件
const CSV_PATH = path.join(__dirname, 'rank_data.csv');

// ===================== 存储 (CSV表格) =====================

function saveToCsv(host: string, data: any[]) {
    // 1. 如果文件不存在，先创建并写入表头（第一列host, 第二列user, 第三列coin, 第四列name, 第五列time）
    if (!fs.existsSync(CSV_PATH)) {
        const header = 'host,user,coin,name,time\n';
        fs.writeFileSync(CSV_PATH, header, 'utf-8');
    }

    const timeStr = new Date().toISOString();
    let rows = '';

    // 2. 将排名的每一条数据拆解成表格的一行
    for (const item of data) {
        const user = item.user || '未知';
        const name = item.name || '未知';
        const coin = item.coin ?? 0;
        
        // 组装成 CSV 标准行，最后加上换行符
        rows += `${host},${user},${coin},${name},${timeStr}\n`;
    }

    // 3. 使用 appendFileSync 实时追加到表格末尾，不影响历史数据
    if (rows) {
        fs.appendFileSync(CSV_PATH, rows, 'utf-8');
        // 🌟 核心修改：数据成功追加一行/一次后，计数器累加，并向 Electron 主进程跨进程通信
        savedCount++;
        if (process.send) {
            process.send({ type: 'DATA_COUNT_UPDATE', count: savedCount });
        }
    }
}

// ===================== 限流记录 =====================

function recordConnectLimit() {
    const now = Date.now();

    connectLog = connectLog.filter(t => now - t < 60000);
    connectLog.push(now);

    if (connectLog.length >= 6) {
        console.log('🧊 每分钟连接过多，强制暂停 60s');
        pausedUntil = now + 60000;
    }
}

// ===================== 主调度 =====================

async function processQueue() {
    if (running) return;
    running = true;

    const { TikTokLiveConnection, WebcastEvent } = await import('tiktok-live-connector');

    while (queue.length > 0) {

        const now = Date.now();

        // ================= ⭐ 关键修复：硬暂停闸门 =================
        if (now < pausedUntil) {
            const wait = pausedUntil - now;
            console.log(`🧊 系统暂停中，剩余 ${Math.ceil(wait / 1000)}s...`);
            await sleep(wait);
            continue;
        }

        const host = queue.shift();
        if (!host) continue;

        if (visited.has(host)) continue;
        visited.add(host);

        console.log(`\n🟡 连接 @${host}`);

        // ================= 断开旧连接并清理 =================
        if (currentConn) {
            try {
                currentConn.removeAllListeners();
                await currentConn.disconnect();
            } catch {}
            currentConn = null;
            await sleep(500);
        }

        currentConn = new TikTokLiveConnection(host, {
            disableEulerFallbacks: false
        });

        let done = false;
        let success = false;
        let timeout: NodeJS.Timeout | null = null;

        const finish = () => {
            if (done) return;
            done = true;

            // ⭐ 核心修复：一旦结束，立刻清除定时器，防止重复触发 timeout 日志
            if (timeout) {
                clearTimeout(timeout);
                timeout = null;
            }

            if (!success) {
                console.log(`❌ @${host} 失败`);
            } else {
                console.log(`✅ @${host} 成功`);
            }
            
            if (currentConn) {
                currentConn.removeAllListeners();
            }
        };

        // 设定超时限制
        timeout = setTimeout(() => {
            console.log(`⏳ @${host} timeout`);
            finish();
        }, 12000);

        // ================= 数据监听 =================
        currentConn.on(WebcastEvent.ROOM_USER, (data: any) => {
            const ranks = data?.ranksList || [];

            if (!ranks.length) return;

            success = true;
            
            const top = ranks.slice(0, 5).map((x: any) => ({
                user: x.user?.uniqueId,
                coin: x.coinCount,
                level: x.user?.level,
                name: x.user?.nickname
            }));

            // 🌟 核心修改：调用 CSV 存储逻辑
            saveToCsv(host, top);
            finish();
        });

        currentConn.on('disconnected', () => {
            finish();
        });

        // ================= 连接前控制与核心风控捕获 =================

        recordConnectLimit();

        try {
            // ⭐ 随机延迟（防风控）
            await sleep(2000 + Math.random() * 3000);

            // 开始连接
            await currentConn.connect();

        } catch (e: any) {
            // 将错误格式化为完整字符串，方便检查
            const errorDetail = util.inspect(e, { depth: 2 });
            const errorStr = String(e?.message || e?.exception?.message || errorDetail);
            const reasonStr = String(e?.reason || e?.exception?.reason || '');

            // ❗ 核心风控判定
            if (errorStr.includes('SIGI_STATE') || reasonStr.includes('SIGI_STATE')) {
                console.log('🧊 触发 SIGI 风控（IP已被TikTok拦截） → 强制暂停 120 秒');
                pausedUntil = Math.max(pausedUntil, Date.now() + 120000);
            } 
            else if (errorStr.includes('Rate Limited') || reasonStr.includes('Rate Limited')) {
                console.log('🧊 触发 Euler 限流 → 强制暂停 120 秒');
                pausedUntil = Math.max(pausedUntil, Date.now() + 120000);
            }
            else {
                console.log(`⚠️ @${host} 连接发生非风控异常:`, errorDetail);
            }

            finish();
        }

        // 每次请求完毕后的基准冷却
        await sleep(15000 + Math.random() * 15000);
    }

    running = false;
}

// ===================== 启动 =====================

export function startBigBro() {
    console.log('🚀 BigBro Stable Fixed Started');

    injectProxyFromRegistry();

    bus.on('hosts', (hosts: string[]) => {
        for (const h of hosts) {
            if (!queue.includes(h)) queue.push(h);
        }

        processQueue();
    });
}
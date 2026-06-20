import http from 'http';
import https from 'https';
import { HttpsProxyAgent } from 'https-proxy-agent';
import axios from 'axios';

// 🎯 当前测试的主播
const TIKTOK_USERNAME = 'vunnypom'; 

const COMMON_PORTS = [10808, 10809, 10810, 7890, 7891, 7893, 7897, 1080, 8888, 8889, 41091];
let globalAgent: any = null;

async function autoDetectAndInjectProxy(): Promise<void> {
    console.log(`\n 🤖 [1/4] 正在全自动雷达深探本地活着的 VPN 通道...`);
    const sniffTasks = COMMON_PORTS.map(async (port) => {
        const proxyUrl = `http://127.0.0.1:${port}`;
        const agent = new HttpsProxyAgent(proxyUrl);
        try {
            await axios.get('https://www.tiktok.com', { 
                httpsAgent: agent, 
                timeout: 2000,
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
            });
            return { agent, port };
        } catch (err) {
            throw err;
        }
    });

    try {
        const winner = await Promise.any(sniffTasks);
        globalAgent = winner.agent;
        console.log(` ✅ [大获成功] 自动识别并捕获当前活着的 VPN 端口: [ ${winner.port} ]`);

        const originalHttpRequest = http.request;
        const originalHttpsRequest = https.request;
        (http as any).request = function (options: any, callback: any) {
            if (options && !options.agent) options.agent = winner.agent;
            return originalHttpRequest.call(this, options, callback);
        };
        (https as any).request = function (options: any, callback: any) {
            if (options && !options.agent) options.agent = winner.agent;
            return originalHttpsRequest.call(this, options, callback);
        };
    } catch (e) {
        console.log(` ⚠️ [警告] 未发现有效 VPN 端口。`);
    }
}

/**
 * ⚡ 网页级逆向升级版：打通两种排行榜类型
 * rank_type=1 (本场打赏榜), rank_type=30 (在线观众前排大咖榜)
 */
async function fetchTop99RanklistSmart(roomId: string, rankType: number = 1) {
    if (!globalAgent) return;
    try {
        const url = `https://www.tiktok.com/api/live/ranklist/online_audience/?room_id=${roomId}&anchor_id=0&rank_type=${rankType}`;
        const response = await axios.get(url, {
            httpsAgent: globalAgent,
            timeout: 5000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Referer': `https://www.tiktok.com/@${TIKTOK_USERNAME}/live`
            }
        });

        const ranks = response.data?.data?.ranks || response.data?.ranks;
        
        if (ranks && Array.isArray(ranks) && ranks.length > 0) {
            const top99 = ranks.slice(0, 99);
            const listTitle = rankType === 1 ? "💎 官方本场打赏贡献百强榜" : "🚪 官方当前在线大咖/观众百强榜";
            
            console.log(`\n🔥 ========================================================= 🔥`);
            console.log(`🚀 [网页初始化同步] 成功拦截 [${listTitle}] (共捕获 ${top99.length} 名):`);
            console.log(`🔥 ========================================================= 🔥`);
            
            top99.forEach((item: any, idx: number) => {
                const uniqueId = item.user?.uniqueId || '隐身用户';
                const nickname = item.user?.nickname || '';
                const score = item.score || 0; 
                console.log(` [第 ${String(idx + 1).padStart(2, '0')} 名] @${uniqueId.padEnd(18)} (${nickname.substring(0, 15)}) -> 权重分: ${score}`);
            });
            console.log(`========================================================================\n`);
            return true; // 抓取成功
        }
        
        // 如果打赏榜是空的，自动触发降级机制，去抓取在线观众榜
        if (rankType === 1) {
            console.log(` ℹ️ [提示] 当前直播间无人打赏（打赏榜为空），正在自动切换抓取 [纯在线观众百强榜]...`);
            return await fetchTop99RanklistSmart(roomId, 30); 
        }
        
        console.log(`\nℹ️ [主动同步提示] 两种官方网页接口均返回空数据（博主可能锁了隐私或彻底无互动）。\n`);
        return false;
    } catch (err) {
        if (rankType === 1) return await fetchTop99RanklistSmart(roomId, 30);
        return false;
    }
}

async function start() {
    await autoDetectAndInjectProxy();

    console.log(` 🤖 [2/4] 正在动态加载 TikTok 弹幕接管内核...`);
    const { TikTokLiveConnection, WebcastEvent } = await import('tiktok-live-connector');

    console.log(` 🤖 [3/4] 正在联络 TikTok 直播间 [ @${TIKTOK_USERNAME} ] ...`);
    const tiktokConnection = new TikTokLiveConnection(TIKTOK_USERNAME, { disableEulerFallbacks: true });

    tiktokConnection.connect()
        .then(async (state: any) => {
            console.log(` 🎉 🎉 🎉 【网络握手完美通关】已成功接入长连接！`);
            console.log(` 🆔 房间 Room ID: ${state.roomId}`);
            
            console.log(` 🤖 [4/4] 正在执行类似网页的[智能多策略预拉取]...`);
            await fetchTop99RanklistSmart(state.roomId, 1);
            
            console.log(` 📺 实时长连接流已就位，进入动态数据监听态...\n---------------------------------------------`);
        })
        .catch((err: any) => {
            console.log(` ❌ 连接失败。`);
        });

    // 动态长连接事件
    tiktokConnection.on(WebcastEvent.ROOM_USER, (data: any) => {
        const currentViewers = data.viewerCount;
        if (currentViewers !== undefined) console.log(` 📊 [日常同步] 在线人数: [ ${currentViewers} ]`);
    });
    tiktokConnection.on(WebcastEvent.CHAT, (data) => {
        console.log(` 💬 [弹幕] ${data.user?.uniqueId}: ${data.comment}`);
    });
    tiktokConnection.on(WebcastEvent.GIFT, (data: any) => {
        if (data.repeatEnd) console.log(` 🎁 [礼物] 感谢 ${data.user?.uniqueId} 送出 [${data.giftName}] x${data.repeatCount}`);
    });
    tiktokConnection.on(WebcastEvent.LIKE, (data) => {
        console.log(` ❤️  [点赞] 用户 ${data.user?.uniqueId} 点了 ${data.likeCount} 个赞`);
    });
    tiktokConnection.on(WebcastEvent.MEMBER, (data) => {
        console.log(` 🚪 [加入] ${data.user?.uniqueId} 进入直播间`);
    });
    tiktokConnection.on(WebcastEvent.STREAM_END, () => {
        console.log(` 🛑 [提示] 直播已结束。`);
    });
}

start();
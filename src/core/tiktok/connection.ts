import { autoDetectAndInjectProxy } from './proxy';
import { bindEvents } from './events';

let tiktokConnection: any = null;

// ⭐ 新增：日志函数
let sendLog: ((msg: string) => void) | null = null;
function log(msg: string) {
    if (sendLog) {
        sendLog(msg);   // 👉 发给 UI
    } else {
        console.log(msg); // fallback
    }
}

export async function start(
    username: string,
    logger?: (msg: string) => void
) {
    // ⭐ 注入 logger
    sendLog = logger || null;

    log(`🟡 正在启动连接: ${username}`);
    await autoDetectAndInjectProxy();

    const { TikTokLiveConnection, WebcastEvent } =
        await import('tiktok-live-connector');

    tiktokConnection = new TikTokLiveConnection(username, {
        disableEulerFallbacks: true
    });

    try {
        await tiktokConnection.connect();
        log("✅ 已连接成功");
    } catch (err) {
        log("❌ 连接失败");
        log(String(err));
        return;
    }

    // ⭐ 关键：把 log 传给事件系统
    bindEvents(tiktokConnection, WebcastEvent, log);
}

export function disconnect() {
    if (tiktokConnection) {
        tiktokConnection.disconnect();
        tiktokConnection = null;
    }
}
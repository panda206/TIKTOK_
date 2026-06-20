import { autoDetectAndInjectProxy } from "./proxy";
import { bindEvents } from "./events";

let tiktokConnection: any = null;

// 当前连接的主播
let currentUsername = "";

// 日志函数
let sendLog: ((msg: any) => void) | null = null;

function log(msg: any) {
    if (sendLog) {
        sendLog(msg);
    } else {
        console.log(msg);
    }
}

// ======================
// 断开连接
// ======================
export async function disconnect() {

    if (!tiktokConnection) {
        return;
    }

    try {

        log("🔴 正在断开旧直播间...");

        // 清除所有事件监听
        if (typeof tiktokConnection.removeAllListeners === "function") {
            tiktokConnection.removeAllListeners();
        }

        // 断开连接
        await tiktokConnection.disconnect();

        console.log("disconnect完成");
        log("✅ 已断开旧直播间");

    } catch (err) {

        console.error(err);

    }

    tiktokConnection = null;
    currentUsername = "";
}


// ======================
// 开始连接
// ======================
export async function start(
    username: string,
    logger?: (msg: any) => void
) {

    sendLog = logger || null;

    username = username.trim();

    // 已经连接当前直播间
    if (
        tiktokConnection &&
        currentUsername === username
    ) {

        log(`⚠️ 已连接 ${username}`);

        return;
    }

    // 如果存在旧连接，先断开
    if (tiktokConnection) {
        console.log("准备断开旧连接...");
        await disconnect();

        // 等待释放
        await new Promise(resolve =>
            setTimeout(resolve, 500)
        );
    }

    log(`🟡 正在连接 ${username}`);

    // 自动检测代理
    await autoDetectAndInjectProxy();

    const {
        TikTokLiveConnection,
        WebcastEvent
    } = await import("tiktok-live-connector");

    // 创建新连接
    tiktokConnection = new TikTokLiveConnection(
        username,
        {
            disableEulerFallbacks: true
        }
    );

    try {

        await tiktokConnection.connect();

        currentUsername = username;

        log("✅ 已连接成功");

    } catch (err) {

        log("❌ 连接失败");

        log(String(err));

        tiktokConnection = null;

        return;
    }

    // 注册事件
    bindEvents(
        tiktokConnection,
        WebcastEvent,
        log
    );
}


// ======================
// 获取连接状态
// ======================
export function isConnected() {

    return tiktokConnection !== null;

}


// ======================
// 获取当前主播
// ======================
export function getCurrentUsername() {

    return currentUsername;

}


// ======================
// 获取连接对象
// ======================
export function getConnection() {

    return tiktokConnection;

}
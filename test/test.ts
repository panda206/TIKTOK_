import { TikTokLiveConnection, WebcastEvent } from 'tiktok-live-connector';

// 🔍 请确保该主播当前确实在直播，可以去浏览器中刷新确认一下
const TIKTOK_USERNAME = 'meeyaw_143'; 

// 🎯 初始化连接（最干净的结构，由于开启了 TUN 模式，Node.js 默认直接走系统代理出国）
const tiktokConnection = new TikTokLiveConnection(TIKTOK_USERNAME, {
    disableEulerFallbacks: true
} as any);

// 🎯 建立连接
tiktokConnection.connect()
    .then((state) => {
        console.log(`\n 🎉 【成功连接】已成功抓取到直播间！`);
        console.log(` 🆔 房间 Room ID: ${state.roomId}`);
    })
    .catch((err) => {
        console.error('\n ❌ 最终连接失败:', err.message);
    });

// --- 以下是各个实时事件的监听 ---

// 弹幕
tiktokConnection.on(WebcastEvent.CHAT, (data) => {
    const uniqueId = data.user?.uniqueId || '未知用户';
    console.log(` 💬 [弹幕] ${uniqueId}: ${data.comment}`);
});

// 礼物
tiktokConnection.on(WebcastEvent.GIFT, (data: any) => {
    const uniqueId = data.user?.uniqueId || '未知用户';
    const giftName = data.giftName || data.gift?.name || `礼物ID:${data.giftId}`;
    const count = data.repeatCount || data.count || 1;
    if (data.repeatEnd) {
        console.log(` 🎁 [礼物] 感谢 ${uniqueId} 送出了 [${giftName}] x${count}`);
    }
});

// 点赞
tiktokConnection.on(WebcastEvent.LIKE, (data) => {
    const uniqueId = data.user?.uniqueId || '未知用户';
    console.log(` ❤️  [点赞] 用户 ${uniqueId} 点了 ${data.likeCount} 个赞`);
});

// 观众进场
tiktokConnection.on(WebcastEvent.MEMBER, (data) => {
    const uniqueId = data.user?.uniqueId || '未知用户';
    console.log(` 🚪 [加入] ${uniqueId} 进入了直播间`);
});

// 房间 status 更新（在线人数）
tiktokConnection.on(WebcastEvent.ROOM_USER, (data) => {
    const currentViewers = (data as any).viewerCount;
    if (currentViewers !== undefined) {
        console.log(` 📊 实时同步：当前直播间在线人数为 [ ${currentViewers} ] 人`);
    }
});

// 断开与错误处理
(tiktokConnection as any).on('disconnect', () => {
    console.log(' 🔌 直播间连接已断开。');
});
(tiktokConnection as any).on('error', (err: any) => {
    console.error(' ⚠️ 抓取中捕获到异常:', err?.message || err);
});
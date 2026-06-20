import http from 'http';
import https from 'https';
import { HttpsProxyAgent } from 'https-proxy-agent';
import axios from 'axios';

// 当前连接主播
let currentUsername = '';

// 当前直播连接
let tiktokConnection: any = null;

// 当前代理
let globalAgent: any = null;
console.log('TEST UTF8 🚀🚪💬🎁🏆');
const COMMON_PORTS = [
    10808,
    10809,
    10810,
    7890,
    7891,
    7893,
    7897,
    1080,
    8888,
    8889,
    41091
];

async function autoDetectAndInjectProxy(): Promise<void> {

    console.log(
        `\n 🤖 [1/4] 正在全自动雷达深探本地活着的 VPN 通道...`
    );

    const sniffTasks = COMMON_PORTS.map(
        async (port) => {

            const proxyUrl =
                `http://127.0.0.1:${port}`;

            const agent =
                new HttpsProxyAgent(proxyUrl);

            try {

                await axios.get(
                    'https://www.tiktok.com',
                    {
                        httpsAgent: agent,
                        timeout: 2000,
                        headers: {
                            'User-Agent':
                                'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
                        }
                    }
                );

                return {
                    agent,
                    port
                };

            } catch (err) {
                throw err;
            }
        }
    );

    try {

        const winner =
            await Promise.any(sniffTasks);

        globalAgent = winner.agent;

        console.log(
            ` ✅ [大获成功] 自动识别并捕获当前活着的 VPN 端口: [ ${winner.port} ]`
        );

        const originalHttpRequest =
            http.request;

        const originalHttpsRequest =
            https.request;

        (http as any).request = function (
            options: any,
            callback: any
        ) {

            if (
                options &&
                !options.agent
            ) {
                options.agent =
                    winner.agent;
            }

            return originalHttpRequest.call(
                this,
                options,
                callback
            );
        };

        (https as any).request = function (
            options: any,
            callback: any
        ) {

            if (
                options &&
                !options.agent
            ) {
                options.agent =
                    winner.agent;
            }

            return originalHttpsRequest.call(
                this,
                options,
                callback
            );
        };

    } catch {

        console.log(
            ` ⚠️ [警告] 未发现有效 VPN 端口。`
        );
    }
}

/**
 * 开始连接直播间
 */
export async function start(username: string) {
    console.log('🟠 [CORE] start() 收到用户名:', username);
    // 已存在连接先断开
    if (tiktokConnection) {

        console.log(
            `🔌 检测到旧连接，正在断开...`
        );
        try {
            tiktokConnection.disconnect();
        } catch {}
        tiktokConnection = null;
    }
    currentUsername =
        username.trim();
    if (!currentUsername) {

        console.log(
            `❌ 主播名不能为空`
        );

        return;
    }

    await autoDetectAndInjectProxy();

    console.log(
        ` 🤖 [2/4] 正在动态加载 TikTok 弹幕接管内核...`
    );

    const {
        TikTokLiveConnection,
        WebcastEvent
    } = await import(
        'tiktok-live-connector'
    );

    console.log(
        ` 🤖 [3/4] 正在联络 TikTok 直播间 [ @${currentUsername} ] ...`
    );

    tiktokConnection =
        new TikTokLiveConnection(
            currentUsername,
            {
                disableEulerFallbacks: true
            }
        );

    try {

        const state =
            await tiktokConnection.connect();

        console.log(
            ` 🎉 🎉 🎉 【网络握手完美通关】已成功接入长连接！`
        );

        console.log(
            ` 🆔 房间 Room ID: ${state.roomId}`
        );

        console.log(
            ` 🤖 [4/4] 正在执行类似网页的[智能多策略预拉取]...`
        );

    } catch (err) {

        console.log(
            ` ❌ 连接失败。`
        );

        return;
    }

    // 在线人数 / 贡献榜
    tiktokConnection.on(
        WebcastEvent.ROOM_USER,
        (data: any) => {

            const currentViewers =
                data.viewerCount;

            if (
                currentViewers !== undefined
            ) {

                console.log(
                    ` 📊 [同步] 在线人数: [ ${currentViewers} ]`
                );
            }

            const ranks =
                data.ranksList || [];

            console.log(
                "\n🏆 ===== 开播时前五贡献用户 ====="
            );

            ranks
                .slice(0, 5)
                .forEach(
                    (item: any) => {

                        const user =
                            item.user;

                        const level =
                            getUserLevel(
                                user
                            );

                        console.log(
                            `#${item.rank} ` +
                            `[LV.${level}] ` +
                            `${user.uniqueId} ` +
                            `(${user.nickname}) ` +
                            `${item.coinCount} coins`
                        );
                    }
                );

            console.log(
                "=============================\n"
            );

            const levelRank =
                (data?.ranksList || [])
                    .map(
                        (item: any) => ({
                            uniqueId:
                                item.user?.uniqueId,
                            nickname:
                                item.user?.nickname,
                            level:
                                item.user?.userHonor?.level || 0
                        })
                    )
                    .sort(
                        (a: any, b: any) =>
                            b.level - a.level
                    );

            if (
                levelRank.length > 0
            ) {

                /*
                console.log(`\n🎖️ ===== 当前直播间用户等级榜 =====`);

                levelRank
                    .slice(0, 10)
                    .forEach((user: any, idx: number) => {

                        console.log(
                            `#${idx + 1} LV.${user.level} @${user.uniqueId} (${user.nickname})`
                        );
                    });

                console.log(`====================================\n`);
                */
            }
        }
    );

    // 弹幕
    tiktokConnection.on(
        WebcastEvent.CHAT,
        (data: any) => {

            console.log(
                ` 💬 [弹幕] ${data.user?.uniqueId}: ${data.comment}`
            );
        }
    );

    // 礼物
    tiktokConnection.on(
        WebcastEvent.GIFT,
        (data: any) => {

            if (
                data.repeatEnd
            ) {

                console.log(
                    ` 🎁 [礼物] ${data.user?.uniqueId} 送出 [${data.giftDetails.giftName}] (${data.giftDetails.id}) 💎[${data.giftDetails.diamondCount}] x${data.repeatCount}`
                );
            }
        }
    );

    // 点赞
    tiktokConnection.on(
        WebcastEvent.LIKE,
        (data: any) => {

            console.log(
                ` ❤️ [点赞] 用户 ${data.user?.uniqueId} 点了 ${data.likeCount} 个赞`
            );
        }
    );

    // 进场
    tiktokConnection.on(
        WebcastEvent.MEMBER,
        (data: any) => {

            console.log(
                ` 🚪 [加入] ${data.user?.uniqueId} 进入直播间`
            );
        }
    );

    // 下播
    tiktokConnection.on(
        WebcastEvent.STREAM_END,
        () => {

            console.log(
                ` 🛑 [提示] 直播已结束。`
            );
        }
    );
}

/**
 * 主动断开
 */
export function disconnect() {

    if (!tiktokConnection) {

        console.log(
            `⚠️ 当前没有连接中的直播间`
        );

        return;
    }

    try {

        tiktokConnection.disconnect();

        console.log(
            `🛑 已断开直播间连接`
        );

    } catch {

        console.log(
            `❌ 断开失败`
        );
    }

    tiktokConnection = null;
}

/**
 * 获取用户等级
 */
function getUserLevel(
    user: any
): number {

    for (
        const badge of user?.badges || []
    ) {

        if (
            badge.badgePriorityType === 20 &&
            badge.logExtra?.level
        ) {

            return Number(
                badge.logExtra.level
            );
        }
    }

    return 0;
}
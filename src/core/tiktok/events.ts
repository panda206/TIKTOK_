import { getUserLevel } from './utils';
import { translate } from "../../translate/translator";


//防止刷屏
const last = new Map<string, number>();

function shouldTranslate(text: string) {
    const now = Date.now();

    if (last.has(text) && now - last.get(text)! < 1000) {
        return false;
    }

    last.set(text, now);
    return true;
}

export function bindEvents(
    tiktokConnection: any,
    WebcastEvent: any,
    log: (msg: any) => void
)  {

    tiktokConnection.on(WebcastEvent.ROOM_USER, (data: any) => {

        const ranks = data.ranksList || [];
        //console.log("========== ROOM_USER RAW ==========");
        //console.log(JSON.stringify(data, null, 2));
        //console.log("\n🏆 前五贡献");
        const topList = ranks.slice(0, 5).map((item: any) => {

            const user = item.user;
            const level = getUserLevel(user);

            return {
                rank: item.rank,
                user: user.uniqueId,
                avatar: user.profilePicture?.url?.[0],
                name: user.nickname,
                level,
                coin: item.coinCount
            };
        });
        // 🏆 一次性输出排行榜（关键）
        log({
            type: 'rank',
            list: topList
        });
        // 👇 在线人数单独发
        log({
            type: 'viewer',
            value: data.viewerCount
        });
       
        console.log(` [日常同步] 在线人数: [${data.viewerCount}]`);
        //log(`[日常同步] 在线人数: [${data.viewerCount}]`);
    });

    tiktokConnection.on(WebcastEvent.CHAT, async (data: any) => {
        //const rawMessage = data.comment || "";
        const message = data.comment || "";
        if (!shouldTranslate(message)) return;
        // 🔥 翻译（核心）
        const translated = await translate(message);
        const avatar =
        data.user?.profilePicture?.url?.[0] || "";
        console.log(`💬 翻译内容: ${translated}`);
        log({
            type: "chat",
            user: data.user?.uniqueId,
            name: data.user?.nickname,
            message: message,
            messageCN:translated,
            avatar: avatar
        });
        
        console.log("========== BACKEND SEND ==========");
        
    });

    tiktokConnection.on(WebcastEvent.GIFT, (data: any) => {
        if (data.repeatEnd) {
            //console.log(`🎁 GIFT_____${data.user?.uniqueId} ${data.giftDetails.giftName}`);
            log({
                type: "gift",
                user: data.user?.uniqueId,
                name: data.user?.nickname,
                gift: data.giftDetails.giftName,
                avatar: data.user?.profilePicture?.url?.[0]
            });
        }
    });

    tiktokConnection.on(WebcastEvent.LIKE, (data: any) => {
        //console.log(`❤️ LIKE_____${data.user?.uniqueId}`);
        log({
            type: "like",
            user: data.user?.uniqueId,
            name: data.user?.nickname,
            count: data.likeCount,
            avatar: data.user?.profilePicture?.url?.[0]
        });
    });

    tiktokConnection.on(WebcastEvent.MEMBER, (data: any) => {
        //console.log(`🚪 IN_____${data.user?.uniqueId}`);
        log({
            type: "member",
            user: data.user?.uniqueId,
            name: data.user?.nickname,
            avatar: data.user?.profilePicture?.url?.[0]
        });
    });

    tiktokConnection.on(WebcastEvent.STREAM_END, () => {
        //console.log(`🛑 直播结束`);
        log({
            type: "stream_end"
        });
    });
}

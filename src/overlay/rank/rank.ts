console.log("🔥 Rank Overlay 已启动");
import { wsClient } from "../common/websocket.js";

interface RankItem {
    user: string;
    score: number;
    avatar?: string;
}

const rankMap = new Map<string, RankItem>();

const rankList = document.getElementById("rankList") as HTMLDivElement;

// ======================
// WebSocket接收
// ======================

wsClient.on((data) => {
    handleData(data);
});

// ======================
// 数据处理
// ======================

function handleData(data: any) {
    switch (data.type) {

        case "gift":
            updateScore(data.user, data.count || 1, data.avatar);
            break;

        case "like":
            updateScore(data.user, data.count || 1, data.avatar);
            break;

        case "member":
            updateScore(data.user, 1, data.avatar);
            break;
    }
}

// ======================
// 更新积分
// ======================

function updateScore(user: string, add: number, avatar?: string) {
    const existing = rankMap.get(user);

    if (existing) {
        existing.score += add;
        if (avatar) existing.avatar = avatar;
    } else {
        rankMap.set(user, {
            user,
            score: add,
            avatar
        });
    }

    renderRank();
}

// ======================
// 渲染排行榜
// ======================

function renderRank() {
    const sorted = Array.from(rankMap.values())
        .sort((a, b) => b.score - a.score)
        .slice(0, 10);

    rankList.innerHTML = "";

    sorted.forEach((item, index) => {
        const div = document.createElement("div");
        div.className = "rank-item";

        div.innerHTML = `
            <div class="left">
                <span class="index">${index + 1}</span>
                <img class="avatar" src="${item.avatar || 'https://dummyimage.com/40x40/444/fff.png&text=?'}" />
                <span class="name">${item.user}</span>
            </div>
            <div class="score">${item.score}</div>
        `;

        rankList.appendChild(div);
    });
}
console.log("🔥 Canvas Overlay 已启动");

import { wsClient } from "../common/websocket.js";

// ======================

interface MessageItem {
    user: string;
    text: string;
    avatar?: string;
}

const messages: MessageItem[] = [];
const MAX_MESSAGE = 10;

const messageLayer =
document.getElementById("messageLayer") as HTMLDivElement;

// ======================
// WebSocket订阅
// ======================

wsClient.on((data: any) => {
    //console.log("📩 收到数据:", data);
    handleMessage(data);
});

// ======================
// 添加消息
// ======================

function addMessage(
    user: string,
    text: string,
    avatar: string = ""
) {
    messages.push({ user, text, avatar });

    if (messages.length > MAX_MESSAGE) {
        messages.shift();
    }

    renderMessages();
}

// ======================
// 渲染UI
// ======================

function renderMessages() {
    messageLayer.innerHTML = "";

    messages.forEach((msg) => {
        const div = document.createElement("div");
        div.className = "message";

        div.innerHTML = `
            <div class="message-row">
                <img class="avatar"
                     src="${msg.avatar || 'https://dummyimage.com/50x50/444/fff.png&text=?'}"
                     onerror="this.src='https://dummyimage.com/50x50/444/fff.png&text=?'"
                />
                <span class="user">${msg.user}</span>
            </div>

            <span class="content">${msg.text}</span>
        `;

        messageLayer.appendChild(div);
    });
}

// ======================
// 数据分发
// ======================

function handleMessage(data: any) {
    switch (data.type) {

        case "chat":
            addMessage(
                data.user,
                data.message,
                data.avatar || ""
            );
            break;

        case "like":
            addMessage(
                data.user,
                `点赞 x${data.count}`,
                data.avatar || ""
            );
            break;

        case "member":
            addMessage(
                data.user,
                "进入直播间",
                data.avatar || ""
            );
            break;

        case "gift":
            console.log("🎁 gift:", data);
            break;

        case "rank":
            console.log("📊 rank:", data);
            break;

        default:
            console.log("❓ 未处理类型:", data.type);
    }
}